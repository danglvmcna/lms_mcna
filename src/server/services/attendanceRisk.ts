import { Queryable, pool } from "../db";
import { generateId } from "../ids";
import { notifyStudent } from "../notify";
import { enqueueCrmEvent } from "../crm/crmOutbox";

type AttendanceRow = {
  student_id: string;
  student_name: string;
  student_email: string;
  student_phone: string | null;
  crm_contact_id: string | null;
  course_id: string;
  course_title: string;
  section_id: string | null;
  section_code: string | null;
  session_id: string | null;
  session_date: string | null;
  status: "present" | "absent" | "late" | "excused" | null;
};

const toSessionDate = (value: unknown) => {
  const text = String(value || "");
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  const date = new Date(`${match[1]}T23:59:59+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Finds students who missed two consecutive past sessions or whose attendance
 * is below 75%. Each new latest session creates one deterministic alert, so
 * repeated scheduler runs remain idempotent.
 */
export async function checkAttendanceRisks(db: Queryable = pool) {
  const rows = (await db.query(
    `SELECT cr.student_id, u.name AS student_name, u.email AS student_email, u.phone AS student_phone, u.crm_contact_id,
            cs.course_id, c.title AS course_title, cs.id AS section_id, cs.section_code,
            ats.id AS session_id, ats.date AS session_date, ar.status
     FROM course_registrations cr
     JOIN users u ON u.id = cr.student_id
     JOIN course_sections cs ON cs.id = cr.section_id
     JOIN courses c ON c.id = cs.course_id
     LEFT JOIN attendance_sessions ats
       ON ats.course_id = cs.course_id
      AND (ats.section_id = cs.id OR ats.section_id IS NULL)
     LEFT JOIN attendance_records ar ON ar.session_id = ats.id AND ar.student_id = cr.student_id
     WHERE cr.status = 'registered'
     ORDER BY cr.student_id, cs.id, ats.date DESC NULLS LAST, ats.id DESC`
  )).rows as AttendanceRow[];

  const grouped = new Map<string, AttendanceRow[]>();
  for (const row of rows) {
    if (!row.session_id || !toSessionDate(row.session_date) || toSessionDate(row.session_date)!.getTime() > Date.now()) continue;
    const key = `${row.student_id}:${row.section_id || row.course_id}`;
    const list = grouped.get(key) || [];
    // A malformed/legacy join can duplicate a session; keep the first record.
    if (!list.some(item => item.session_id === row.session_id)) list.push(row);
    grouped.set(key, list);
  }

  let created = 0;
  let resolved = 0;
  for (const [groupKey, sessions] of grouped.entries()) {
    if (!sessions.length) continue;
    const latest = sessions[0];
    const statuses = sessions.map(item => item.status || "absent");
    let consecutiveAbsences = 0;
    for (const status of statuses) {
      if (status === "absent") consecutiveAbsences++;
      else break;
    }
    const attended = statuses.filter(status => status === "present" || status === "late" || status === "excused").length;
    const attendanceRate = Math.round((attended / statuses.length) * 100);
    const atRisk = consecutiveAbsences >= 2 || (statuses.length >= 2 && attendanceRate < 75);
    const riskKey = `${groupKey}:${latest.session_id}:${atRisk ? "risk" : "clear"}`;

    if (atRisk) {
      // Keep one actionable alert per learner/class. A new session gets a new
      // evidence key; older alerts are closed as superseded (not recovered).
      await db.query(
        `UPDATE attendance_risk_alerts
         SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP
         WHERE student_id = $1 AND course_id = $2 AND section_id IS NOT DISTINCT FROM $3
           AND status = 'open' AND risk_key <> $4`,
        [latest.student_id, latest.course_id, latest.section_id, riskKey]
      );
      const alertId = generateId("risk");
      const inserted = (await db.query(
        `INSERT INTO attendance_risk_alerts
           (id, student_id, course_id, section_id, risk_type, risk_key, consecutive_absences, attendance_rate, evidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (risk_key) DO NOTHING
         RETURNING id`,
        [
          alertId,
          latest.student_id,
          latest.course_id,
          latest.section_id,
          consecutiveAbsences >= 2 ? "consecutive_absence" : "low_attendance",
          riskKey,
          consecutiveAbsences,
          attendanceRate,
          JSON.stringify({ latestSessionId: latest.session_id, sessionCount: statuses.length, sectionCode: latest.section_code })
        ]
      )).rows[0];
      if (inserted) {
        created++;
        const message = consecutiveAbsences >= 2
          ? `Cảnh báo chuyên cần: bạn đã vắng ${consecutiveAbsences} buổi liên tiếp ở lớp ${latest.course_title}. Hãy liên hệ học vụ nếu cần hỗ trợ.`
          : `Tỷ lệ chuyên cần của bạn ở lớp ${latest.course_title} đang là ${attendanceRate}%. Hãy chủ động tham gia các buổi tiếp theo.`;
        await notifyStudent(db, latest.student_id, message, { relatedEntityType: "attendance_risk", relatedEntityId: inserted.id });
        await enqueueCrmEvent(db, "attendance.risk_detected", {
          alertId: inserted.id,
          riskType: consecutiveAbsences >= 2 ? "consecutive_absence" : "low_attendance",
          consecutiveAbsences,
          attendanceRate,
          latestSessionId: latest.session_id,
          student: { lmsUserId: latest.student_id, crmContactId: latest.crm_contact_id || null, name: latest.student_name, email: latest.student_email, phone: latest.student_phone || null },
          course: { id: latest.course_id, title: latest.course_title },
          section: latest.section_id ? { id: latest.section_id, code: latest.section_code } : null
        });
      }
    }

    // Resolve earlier open alerts once attendance is healthy again.
    if (!atRisk) {
      const result = await db.query(
        `UPDATE attendance_risk_alerts
         SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP
         WHERE student_id = $1 AND course_id = $2 AND section_id IS NOT DISTINCT FROM $3 AND status = 'open'
         RETURNING id, risk_type, attendance_rate`,
        [latest.student_id, latest.course_id, latest.section_id]
      );
      for (const alert of result.rows) {
        resolved++;
        await enqueueCrmEvent(db, "attendance.recovered", {
          alertId: alert.id,
          riskType: alert.risk_type,
          attendanceRate,
          student: { lmsUserId: latest.student_id, crmContactId: latest.crm_contact_id || null, name: latest.student_name, email: latest.student_email, phone: latest.student_phone || null },
          course: { id: latest.course_id, title: latest.course_title }
        });
      }
    }
  }
  return { created, resolved };
}
