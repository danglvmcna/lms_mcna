import { Queryable } from "../db";
import { generateId } from "../ids";
import { eventBus } from "../eventBus";
import { pool } from "../db";
import { notifyStudent } from "../notify";

export const scholarshipsRepository = {
  async list(db: Queryable) {
    return (await db.query("SELECT * FROM scholarships ORDER BY created_at DESC")).rows;
  },

  async create(db: Queryable, input: { name: string; type: string; amount?: number; discountPercent?: number; semesterId?: string; conditions?: string }) {
    const row = (await db.query(
      `INSERT INTO scholarships (id, name, type, amount, discount_percent, semester_id, conditions, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [generateId("scholarship"), input.name, input.type, input.amount ?? null, input.discountPercent ?? null, input.semesterId || null, input.conditions || null, new Date().toISOString()]
    )).rows[0];
    return row;
  },

  async listApplications(db: Queryable, user: { id: string; role: string }) {
    if (user.role === "student") return (await db.query("SELECT * FROM scholarship_applications WHERE student_id = $1 ORDER BY applied_at DESC", [user.id])).rows;
    if (user.role === "advisor") {
      return (await db.query(
        `SELECT sa.*
         FROM scholarship_applications sa
         JOIN advisor_assignments aa ON aa.student_id = sa.student_id
         WHERE aa.advisor_id = $1
         ORDER BY sa.applied_at DESC`,
        [user.id]
      )).rows;
    }
    if (user.role !== "admin") return [];
    return (await db.query("SELECT * FROM scholarship_applications ORDER BY applied_at DESC")).rows;
  },

  async apply(db: Queryable, studentId: string, input: { scholarshipId: string; semesterId: string }) {
    const scholarship = (await db.query("SELECT id FROM scholarships WHERE id = $1", [input.scholarshipId])).rows[0];
    if (!scholarship) return { error: "Scholarship not found.", status: 404 };

    const semester = (await db.query("SELECT id FROM semesters WHERE id = $1", [input.semesterId])).rows[0];
    if (!semester) return { error: "Semester not found.", status: 404 };

    const existing = (await db.query(
      "SELECT * FROM scholarship_applications WHERE student_id = $1 AND scholarship_id = $2 AND semester_id = $3",
      [studentId, input.scholarshipId, input.semesterId]
    )).rows[0];
    if (existing) return { error: "Scholarship application already exists.", status: 409 };

    const row = (await db.query(
      `INSERT INTO scholarship_applications (id, student_id, scholarship_id, semester_id, status, applied_at)
       VALUES ($1,$2,$3,$4,'pending',$5)
       RETURNING *`,
      [generateId("sch_app"), studentId, input.scholarshipId, input.semesterId, new Date().toISOString()]
    )).rows[0];
    return { row };
  },

  async approve(db: Queryable, id: string, reviewerId: string, reviewNote?: string) {
    const row = (await db.query(
      "UPDATE scholarship_applications SET status = 'approved', reviewed_by = $2, review_note = $3 WHERE id = $1 RETURNING *",
      [id, reviewerId, reviewNote || null]
    )).rows[0];
    if (!row) return null;
    await eventBus.emit("scholarship.approved", { studentId: row.student_id, scholarshipId: row.scholarship_id, semesterId: row.semester_id }, pool);
    return row;
  },

  async reject(db: Queryable, id: string, reviewerId: string, reviewNote?: string) {
    const row = (await db.query(
      "UPDATE scholarship_applications SET status = 'rejected', reviewed_by = $2, review_note = $3 WHERE id = $1 RETURNING *",
      [id, reviewerId, reviewNote || null]
    )).rows[0];
    if (row) await notifyStudent(db, row.student_id, `Đơn xin học bổng đã bị từ chối.${reviewNote ? ` Lý do: ${reviewNote}` : ""}`, { relatedEntityType: "scholarship_application", relatedEntityId: id });
    return row || null;
  }
};
