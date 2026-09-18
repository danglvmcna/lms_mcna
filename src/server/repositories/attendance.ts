import { AttendanceSession, AttendanceRecord } from "../../types";
import { Queryable } from "../db";
import { pool } from "../db";
import { eventBus } from "../eventBus";

export const attendanceRepository = {
  async createSession(db: Queryable, session: AttendanceSession): Promise<AttendanceSession> {
    const columns = (await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'attendance_sessions' AND column_name IN ('date', 'session_date', 'section_id', 'video_url', 'recording_url', 'content')"
    )).rows.map(row => row.column_name);
    const sessionDateOnly = session.date.slice(0, 10);
    if (columns.includes("session_date") && columns.includes("date")) {
      await db.query(
        `INSERT INTO attendance_sessions (id, course_id, teacher_id, session_date, date, topic)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [session.id, session.courseId, session.teacherId, sessionDateOnly, session.date, session.topic]
      );
    } else if (columns.includes("session_date")) {
      await db.query(
        "INSERT INTO attendance_sessions (id, course_id, teacher_id, session_date, topic) VALUES ($1,$2,$3,$4,$5)",
        [session.id, session.courseId, session.teacherId, sessionDateOnly, session.topic]
      );
    } else {
      await db.query(
        "INSERT INTO attendance_sessions (id, course_id, teacher_id, date, topic) VALUES ($1,$2,$3,$4,$5)",
        [session.id, session.courseId, session.teacherId, session.date, session.topic]
      );
    }
    if (columns.includes("section_id") && session.sectionId) {
      await db.query("UPDATE attendance_sessions SET section_id = $1 WHERE id = $2", [session.sectionId, session.id]);
    }
    if (columns.includes("video_url") && session.videoUrl !== undefined) {
      await db.query("UPDATE attendance_sessions SET video_url = $1 WHERE id = $2", [session.videoUrl || null, session.id]);
    }
    if (columns.includes("recording_url") && session.recordingUrl !== undefined) {
      await db.query("UPDATE attendance_sessions SET recording_url = $1 WHERE id = $2", [session.recordingUrl || null, session.id]);
    }
    if (columns.includes("content") && session.content !== undefined) {
      await db.query("UPDATE attendance_sessions SET content = $1 WHERE id = $2", [session.content || null, session.id]);
    }
    return session;
  },

  async bulkMarkRecords(db: Queryable, records: AttendanceRecord[]): Promise<void> {
    for (const r of records) {
      await db.query(
        `INSERT INTO attendance_records (id, session_id, student_id, status, note, checked_in_at, checkin_method)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           note = EXCLUDED.note,
           checked_in_at = COALESCE(EXCLUDED.checked_in_at, attendance_records.checked_in_at),
           checkin_method = COALESCE(EXCLUDED.checkin_method, attendance_records.checkin_method)`,
        [r.id, r.sessionId, r.studentId, r.status, r.note || null, r.checkedInAt || null, r.checkinMethod || null]
      );
    }
    if (records.length) {
      const session = (await db.query("SELECT course_id FROM attendance_sessions WHERE id = $1", [records[0].sessionId])).rows[0];
      if (session) await eventBus.emit("attendance.session.saved", { sessionId: records[0].sessionId, courseId: session.course_id, records }, pool);
    }
  },

  async saveAttendanceSession(db: Queryable, session: AttendanceSession, records: AttendanceRecord[]) {
    await this.createSession(db, session);
    await this.bulkMarkRecords(db, records);
    return session;
  },

  async calcAttendancePercent(db: Queryable, studentId: string, courseId: string): Promise<number> {
    const sessionsRes = await db.query("SELECT id FROM attendance_sessions WHERE course_id = $1", [courseId]);
    const sessionIds = sessionsRes.rows.map(row => row.id);
    if (sessionIds.length === 0) return 100; // default compliant

    const recordsRes = await db.query(
      "SELECT status FROM attendance_records WHERE student_id = $1 AND session_id = ANY($2)",
      [studentId, sessionIds]
    );

    const attended = recordsRes.rows.filter(r => r.status === "present" || r.status === "late" || r.status === "excused").length;
    return Math.round((attended / sessionIds.length) * 100);
  },

  async updateSession(db: Queryable, id: string, input: { topic?: string; date?: string; videoUrl?: string; recordingUrl?: string; content?: string }) {
    const columns = (await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'attendance_sessions' AND column_name IN ('date', 'session_date', 'video_url', 'recording_url', 'content')"
    )).rows.map(row => row.column_name);

    const sets: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.topic !== undefined) {
      sets.push(`topic = $${paramIndex++}`);
      values.push(input.topic);
    }
    if (input.date !== undefined) {
      sets.push(`date = $${paramIndex++}`);
      values.push(input.date);
      if (columns.includes("session_date")) {
        sets.push(`session_date = $${paramIndex++}`);
        values.push(input.date.slice(0, 10));
      }
    }
    if (input.videoUrl !== undefined && columns.includes("video_url")) {
      sets.push(`video_url = $${paramIndex++}`);
      values.push(input.videoUrl || null);
    }
    if (input.recordingUrl !== undefined && columns.includes("recording_url")) {
      sets.push(`recording_url = $${paramIndex++}`);
      values.push(input.recordingUrl || null);
    }
    if (input.content !== undefined && columns.includes("content")) {
      sets.push(`content = $${paramIndex++}`);
      values.push(input.content || null);
    }

    if (sets.length > 0) {
      values.push(id);
      await db.query(
        `UPDATE attendance_sessions SET ${sets.join(", ")} WHERE id = $${paramIndex}`,
        values
      );
    }

    const row = (await db.query("SELECT * FROM attendance_sessions WHERE id = $1", [id])).rows[0];
    return row ? {
      id: row.id,
      courseId: row.course_id,
      sectionId: row.section_id || undefined,
      teacherId: row.teacher_id,
      date: row.date || row.session_date,
      topic: row.topic,
      videoUrl: row.video_url || undefined,
      recordingUrl: row.recording_url || undefined,
      content: row.content || undefined,
      code: row.code || undefined,
      expiresAt: row.expires_at || undefined
    } : null;
  }
};
