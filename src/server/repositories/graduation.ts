import { Queryable } from "../db";
import { generateId } from "../ids";
import { notifyStudent } from "../notify";

export const graduationRepository = {
  async create(db: Queryable, studentId: string) {
    const profile = (await db.query(
      `SELECT sp.*, p.total_credits
       FROM student_profiles sp
       LEFT JOIN programs p ON p.id = sp.program_id
       WHERE sp.user_id = $1`,
      [studentId]
    )).rows[0];
    if (!profile) return { error: "Student profile not found.", status: 404 };

    const requiredCredits = Number(profile.total_credits || 0);
    const earnedCredits = Number(profile.total_credits_earned || 0);
    const gpa = Number(profile.gpa || 0);
    if (!requiredCredits || earnedCredits < requiredCredits || gpa < 2.0) {
      return { error: "Student is not eligible for graduation.", status: 400 };
    }

    const existing = (await db.query(
      "SELECT * FROM graduation_applications WHERE student_id = $1 AND status IN ('pending', 'eligible', 'approved') ORDER BY applied_at DESC LIMIT 1",
      [studentId]
    )).rows[0];
    if (existing) return { error: "Graduation application already exists.", status: 409 };

    const row = (await db.query(
      `INSERT INTO graduation_applications (id, student_id, status, applied_at, total_credits_at_application, gpa_at_application)
       VALUES ($1,$2,'pending',$3,$4,$5)
       RETURNING *`,
      [generateId("grad"), studentId, new Date().toISOString(), earnedCredits, gpa]
    )).rows[0];
    return { row };
  },

  async list(db: Queryable, user: { id: string; role: string }) {
    if (user.role === "student") return (await db.query("SELECT * FROM graduation_applications WHERE student_id = $1 ORDER BY applied_at DESC", [user.id])).rows;
    if (user.role === "admin") {
      return (await db.query("SELECT * FROM graduation_applications ORDER BY applied_at DESC")).rows;
    }
    return [];
  },

  async approve(db: Queryable, id: string, reviewerId: string, note?: string) {
    const application = (await db.query(
      `SELECT ga.*, sp.total_credits_earned, sp.gpa, p.total_credits
       FROM graduation_applications ga
       JOIN student_profiles sp ON sp.user_id = ga.student_id
       LEFT JOIN programs p ON p.id = sp.program_id
       WHERE ga.id = $1`,
      [id]
    )).rows[0];
    if (!application) return null;

    const requiredCredits = Number(application.total_credits || 0);
    const earnedCredits = Number(application.total_credits_earned || 0);
    const gpa = Number(application.gpa || 0);
    if (!requiredCredits || earnedCredits < requiredCredits || gpa < 2.0) {
      return { error: "Student is not eligible for graduation.", status: 400 };
    }

    const row = (await db.query(
      "UPDATE graduation_applications SET status = 'approved', reviewed_by = $2, note = $3 WHERE id = $1 RETURNING *",
      [id, reviewerId, note || null]
    )).rows[0];
    if (!row) return null;
    await db.query("UPDATE student_profiles SET status = 'graduated' WHERE user_id = $1", [row.student_id]);
    await notifyStudent(db, row.student_id, "Hồ sơ xét tốt nghiệp đã được phê duyệt.", { relatedEntityType: "graduation_application", relatedEntityId: id });
    return row;
  },

  async reject(db: Queryable, id: string, reviewerId: string, note?: string) {
    const row = (await db.query(
      "UPDATE graduation_applications SET status = 'rejected', reviewed_by = $2, note = $3 WHERE id = $1 RETURNING *",
      [id, reviewerId, note || null]
    )).rows[0];
    if (row) await notifyStudent(db, row.student_id, `Hồ sơ xét tốt nghiệp đã bị từ chối.${note ? ` Lý do: ${note}` : ""}`, { relatedEntityType: "graduation_application", relatedEntityId: id });
    return row || null;
  }
};
