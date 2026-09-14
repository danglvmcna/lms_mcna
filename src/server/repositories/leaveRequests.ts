import { Queryable } from "../db";
import { generateId } from "../ids";
import { eventBus } from "../eventBus";
import { pool } from "../db";
import { notifyStudent } from "../notify";

export const leaveRequestsRepository = {
  async create(db: Queryable, studentId: string, input: { type: string; semesterId: string; reason: string; resumeSemesterId?: string }) {
    const row = (await db.query(
      `INSERT INTO leave_requests (id, student_id, type, semester_id, reason, status, requested_at, resume_semester_id)
       VALUES ($1,$2,$3,$4,$5,'pending',$6,$7)
       RETURNING *`,
      [generateId("leave"), studentId, input.type, input.semesterId, input.reason, new Date().toISOString(), input.resumeSemesterId || null]
    )).rows[0];
    return row;
  },

  async list(db: Queryable, user: { id: string; role: string }) {
    if (user.role === "student") return (await db.query("SELECT * FROM leave_requests WHERE student_id = $1 ORDER BY requested_at DESC", [user.id])).rows;
    if (user.role !== "admin") return [];
    return (await db.query("SELECT * FROM leave_requests ORDER BY requested_at DESC")).rows;
  },

  async approve(db: Queryable, id: string, reviewerId: string, reviewNote?: string) {
    const row = (await db.query(
      "UPDATE leave_requests SET status = 'approved', reviewed_by = $2, review_note = $3 WHERE id = $1 RETURNING *",
      [id, reviewerId, reviewNote || null]
    )).rows[0];
    if (!row) return null;
    await eventBus.emit("leave.approved", { studentId: row.student_id, semesterId: row.semester_id }, pool);
    return row;
  },

  async reject(db: Queryable, id: string, reviewerId: string, reviewNote?: string) {
    const row = (await db.query(
      "UPDATE leave_requests SET status = 'rejected', reviewed_by = $2, review_note = $3 WHERE id = $1 RETURNING *",
      [id, reviewerId, reviewNote || null]
    )).rows[0];
    if (row) await notifyStudent(db, row.student_id, `Yêu cầu nghỉ học/bảo lưu đã bị từ chối.${reviewNote ? ` Lý do: ${reviewNote}` : ""}`, { relatedEntityType: "leave_request", relatedEntityId: id });
    return row || null;
  }
};
