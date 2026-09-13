import { Enrollment, LessonProgress, User } from "../../types";
import { Queryable } from "../db";
import { generateId } from "../ids";
import { enrollmentFromRow, lessonProgressFromRow } from "../mappers";

export const enrollmentsRepository = {
  async listForUser(db: Queryable, user: User) {
    const adminRoles = ["manager", "super_admin", "admin"] as User["role"][];
    const result = adminRoles.includes(user.role)
      ? await db.query("SELECT * FROM enrollments")
      : await db.query("SELECT * FROM enrollments WHERE student_id = $1", [user.id]);
    return result.rows.map(enrollmentFromRow);
  },

  async register(
    db: Queryable,
    studentId: string,
    courseId: string,
    isPaidCourse: boolean,
    extra: { requestedSectionId?: string; crmDealId?: string } = {}
  ) {
    const enrollment: Enrollment = {
      id: generateId("enroll"),
      courseId,
      studentId,
      status: isPaidCourse ? "pending_payment" : "pending",
      enrolledAt: new Date().toISOString(),
      requestedSectionId: extra.requestedSectionId,
      crmDealId: extra.crmDealId
    };
    await db.query(
      "INSERT INTO enrollments (id,course_id,student_id,status,enrolled_at,completed_at,requested_section_id,crm_deal_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [enrollment.id, enrollment.courseId, enrollment.studentId, enrollment.status, enrollment.enrolledAt, null, extra.requestedSectionId || null, extra.crmDealId || null]
    );
    return enrollment;
  },

  async findStudentEnrollment(db: Queryable, studentId: string, enrollmentId: string) {
    return (await db.query("SELECT * FROM enrollments WHERE id = $1 AND student_id = $2", [enrollmentId, studentId])).rows[0] || null;
  },

  async existsForCourse(db: Queryable, studentId: string, courseId: string) {
    return Boolean((await db.query(
      "SELECT id FROM enrollments WHERE course_id = $1 AND student_id = $2 AND status IN ('pending', 'active', 'pending_payment')",
      [courseId, studentId]
    )).rows[0]);
  },

  async toggleProgress(db: Queryable, enrollmentId: string, lessonId: string) {
    const validLesson = (await db.query(
      `SELECT l.id
       FROM lessons l
       JOIN enrollments e ON e.course_id = l.course_id
       WHERE e.id = $1 AND l.id = $2`,
      [enrollmentId, lessonId]
    )).rows[0];
    if (!validLesson) return { error: "Lesson does not belong to this enrollment.", status: 400 };

    const existing = (await db.query("SELECT * FROM lesson_progress WHERE enrollment_id = $1 AND lesson_id = $2", [enrollmentId, lessonId])).rows[0];
    if (existing) {
      const completed = !Boolean(existing.completed);
      const completedAt = completed ? new Date().toISOString() : null;
      const row = (await db.query("UPDATE lesson_progress SET completed = $1, completed_at = $2 WHERE id = $3 RETURNING *", [completed, completedAt, existing.id])).rows[0];
      return { row: lessonProgressFromRow(row) };
    }

    const progress: LessonProgress = { id: generateId("prog"), enrollmentId, lessonId, completed: true, completedAt: new Date().toISOString() };
    await db.query("INSERT INTO lesson_progress (id,enrollment_id,lesson_id,completed,completed_at) VALUES ($1,$2,$3,$4,$5)", [progress.id, enrollmentId, lessonId, true, progress.completedAt]);
    return { row: progress };
  },

  async activateEnrollment(db: Queryable, id: string) {
    const row = (await db.query("UPDATE enrollments SET status = 'active' WHERE id = $1 RETURNING *", [id])).rows[0];
    return row ? enrollmentFromRow(row) : null;
  }
};
