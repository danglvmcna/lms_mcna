import { AcademicWarning, User } from "../../types";
import { Queryable } from "../db";
import { generateId } from "../ids";
import { academicWarningFromRow } from "../mappers";
const ADMIN_WARNING_ROLES = new Set<User["role"]>(["admin"]);

export const academicsRepository = {
  async listWarnings(db: Queryable, studentId?: string) {
    const result = studentId
      ? await db.query("SELECT * FROM academic_warnings WHERE student_id = $1 ORDER BY created_at DESC", [studentId])
      : await db.query("SELECT * FROM academic_warnings ORDER BY created_at DESC");
    return result.rows.map(academicWarningFromRow);
  },

  async isAdvisorForStudent(db: Queryable, advisorId: string, studentId: string) {
    const row = await db.query(
      "SELECT 1 FROM advisor_assignments WHERE advisor_id = $1 AND student_id = $2 LIMIT 1",
      [advisorId, studentId]
    );
    return Boolean(row.rowCount);
  },

  async listWarningsForUser(
    db: Queryable,
    user: Pick<User, "id" | "role">,
    requestedStudentId?: string
  ): Promise<{ warnings: AcademicWarning[] } | { error: string; status: number }> {
    if (user.role === "student") {
      return { warnings: await this.listWarnings(db, user.id) };
    }

    if (user.role === "teacher") {
      if (requestedStudentId) {
        if (!(await this.isAdvisorForStudent(db, user.id, requestedStudentId))) {
          return { error: "You are not assigned to this student.", status: 403 };
        }
        return { warnings: await this.listWarnings(db, requestedStudentId) };
      }
      const result = await db.query(
        `SELECT aw.*
         FROM academic_warnings aw
         INNER JOIN advisor_assignments aa ON aa.student_id = aw.student_id
         WHERE aa.advisor_id = $1
         ORDER BY aw.created_at DESC`,
        [user.id]
      );
      return { warnings: result.rows.map(academicWarningFromRow) };
    }

    if (ADMIN_WARNING_ROLES.has(user.role)) {
      return { warnings: await this.listWarnings(db, requestedStudentId) };
    }

    return { error: "Permission denied.", status: 403 };
  },

  async createWarning(db: Queryable, input: Omit<AcademicWarning, "id" | "createdAt" | "isResolved">) {
    const warning: AcademicWarning = { ...input, id: generateId("warning"), isResolved: false, createdAt: new Date().toISOString() };
    const res = await db.query(
      `INSERT INTO academic_warnings (id, student_id, type, course_id, message, is_resolved, created_at)
       VALUES ($1,$2,$3,$4,$5,false,$6)
       ON CONFLICT (student_id, type, COALESCE(course_id, '')) DO UPDATE
       SET message = EXCLUDED.message, is_resolved = false, created_at = EXCLUDED.created_at
       RETURNING *`,
      [warning.id, warning.studentId, warning.type, warning.courseId || null, warning.message, warning.createdAt]
    );
    return academicWarningFromRow(res.rows[0]);
  },

  async resolveWarning(db: Queryable, id: string, resolvedBy?: string) {
    const row = (await db.query("UPDATE academic_warnings SET is_resolved = true, resolved_by = $2, resolved_at = $3 WHERE id = $1 RETURNING *", [id, resolvedBy || null, new Date().toISOString()])).rows[0];
    return row ? academicWarningFromRow(row) : null;
  },

  async getAdvisorNotes(db: Queryable, advisorId: string) {
    return (await db.query("SELECT * FROM advisor_notes WHERE advisor_id = $1 ORDER BY created_at DESC", [advisorId])).rows;
  },

  async addAdvisorNote(db: Queryable, advisorId: string, studentId: string, content: string, type: string) {
    const note = { id: generateId("note"), advisorId, studentId, content, type, createdAt: new Date().toISOString() };
    await db.query(
      "INSERT INTO advisor_notes (id, advisor_id, student_id, content, type, created_at) VALUES ($1,$2,$3,$4,$5,$6)",
      [note.id, advisorId, studentId, content, type, note.createdAt]
    );
    return note;
  }
};
