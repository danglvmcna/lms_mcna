import { Queryable } from "../db";
import { generateId } from "../ids";
import { eventBus } from "../eventBus";
import { pool } from "../db";
import { notifyStudent } from "../notify";
import { toGradePoint, toLetterGrade } from "../gpaCalculator";

export const gradeAppealsRepository = {
  async create(db: Queryable, studentId: string, input: { courseRegistrationId: string; reason: string }) {
    const reg = (await db.query("SELECT * FROM course_registrations WHERE id = $1 AND student_id = $2", [input.courseRegistrationId, studentId])).rows[0];
    if (!reg) return { error: "Course registration not found.", status: 404 };
    if (!reg.grade_posted_at || (!reg.grade && !reg.letter_grade)) return { error: "No posted grade is available for appeal.", status: 400 };

    const posted = new Date(reg.grade_posted_at).getTime();
    if (Date.now() - posted > 7 * 24 * 60 * 60 * 1000) return { error: "Grade appeal window has closed.", status: 400 };

    const existing = (await db.query(
      "SELECT id FROM grade_appeals WHERE student_id = $1 AND course_registration_id = $2 AND status IN ('pending', 'under_review')",
      [studentId, input.courseRegistrationId]
    )).rows[0];
    if (existing) return { error: "A grade appeal is already in progress for this registration.", status: 409 };

    const row = (await db.query(
      `INSERT INTO grade_appeals (id, student_id, course_registration_id, reason, status, original_grade, submitted_at)
       VALUES ($1,$2,$3,$4,'pending',$5,$6)
       RETURNING *`,
      [generateId("appeal"), studentId, input.courseRegistrationId, input.reason, String(reg.grade || reg.letter_grade || ""), new Date().toISOString()]
    )).rows[0];
    return { row };
  },

  async list(db: Queryable, user: { id: string; role: string }) {
    if (user.role === "student") {
      return (await db.query("SELECT * FROM grade_appeals WHERE student_id = $1 ORDER BY submitted_at DESC", [user.id])).rows;
    }
    if (user.role === "teacher") {
      return (await db.query(
        `SELECT ga.*
         FROM grade_appeals ga
         JOIN course_registrations cr ON cr.id = ga.course_registration_id
         JOIN course_sections cs ON cs.id = cr.section_id
         WHERE cs.teacher_id = $1
         ORDER BY ga.submitted_at DESC`,
        [user.id]
      )).rows;
    }
    if (user.role !== "admin") return [];
    return (await db.query("SELECT * FROM grade_appeals ORDER BY submitted_at DESC")).rows;
  },

  async review(db: Queryable, appealId: string, teacherId: string, revisedGrade?: string) {
    const row = (await db.query(
      `UPDATE grade_appeals ga
       SET status = 'under_review', revised_grade = COALESCE($3, ga.revised_grade)
       FROM course_registrations cr
       JOIN course_sections cs ON cs.id = cr.section_id
       WHERE ga.id = $1
         AND ga.course_registration_id = cr.id
         AND cs.teacher_id = $2
       RETURNING ga.*`,
      [appealId, teacherId, revisedGrade || null]
    )).rows[0];
    return row || null;
  },

  async resolve(db: Queryable, appealId: string, reviewerId: string, status: "approved" | "rejected", resolutionNote?: string) {
    const row = (await db.query(
      `UPDATE grade_appeals
       SET status = $2, resolved_by = $3, resolution_note = $4, resolved_at = $5
       WHERE id = $1
       RETURNING *`,
      [appealId, status, reviewerId, resolutionNote || null, new Date().toISOString()]
    )).rows[0];
    if (!row) return null;
    if (status === "approved" && row.revised_grade) {
      const numericScore = Number(row.revised_grade);
      const letterGrade = Number.isFinite(numericScore) ? toLetterGrade(numericScore) : String(row.revised_grade);
      const gradePoint = toGradePoint(letterGrade);
      const gradeValue = Number.isFinite(numericScore) ? numericScore : null;
      await db.query(
        `UPDATE course_registrations
         SET grade = COALESCE($1, grade), letter_grade = $2, grade_point = $3, grade_posted_at = $4
         WHERE id = $5`,
        [gradeValue, letterGrade, gradePoint, new Date().toISOString(), row.course_registration_id]
      );
      await eventBus.emit("grade.saved", { studentId: row.student_id, courseRegistrationId: row.course_registration_id, grade: letterGrade }, pool);
    }
    await notifyStudent(db, row.student_id, status === "approved" ? "Phúc khảo điểm số đã được phê duyệt." : `Phúc khảo điểm số đã bị từ chối.${resolutionNote ? ` Lý do: ${resolutionNote}` : ""}`, { relatedEntityType: "grade_appeal", relatedEntityId: appealId });
    return row;
  },

  async escalate(db: Queryable, appealId: string, studentId: string) {
    const row = (await db.query(
      "UPDATE grade_appeals SET escalated = true, status = 'under_review' WHERE id = $1 AND student_id = $2 AND status = 'rejected' AND escalated = false RETURNING *",
      [appealId, studentId]
    )).rows[0];
    return row || null;
  }
};
