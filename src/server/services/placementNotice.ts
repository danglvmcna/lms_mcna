import { Queryable } from "../db";
import { getSupportPhone } from "../config";
import { parseSchedule } from "../mappers";
import { auditRepository } from "../repositories/audit";
import { notificationsRepository } from "../repositories/notifications";
import { commonScheduleRoom, formatDateVi, formatScheduleSummary } from "../../scheduleText";
import { EmailDeliveryStatus, sendClassPlacementEmail } from "./email";

// Everything a learner is told once a class manager seats them in a class: the placement email
// (class name, timetable, Zalo group, teacher, support phone) and an in-app notification.

export type PlacementNoticeResult = {
  studentId: string;
  sectionId: string;
  email: string | null;
  status: EmailDeliveryStatus | "skipped";
  reason?: string;
};

// Sample system accounts are not shown to learners as their instructor.
const teacherDisplayName = (name?: string | null, email?: string | null) =>
  !name || String(email || "").toLowerCase().endsWith("@mcna.local") ? "Giảng viên MCNA" : name;

/**
 * Sends the class-placement email for a learner seated in a class and records the outcome on the seat.
 * Call after the placement transaction has committed. Never throws: the placement itself already succeeded.
 */
export async function sendClassPlacementNotice(
  db: Queryable,
  input: { studentId: string; sectionId: string; actorId?: string | null; notifyInApp?: boolean }
): Promise<PlacementNoticeResult> {
  const base = { studentId: input.studentId, sectionId: input.sectionId };
  try {
    const row = (await db.query(
      `SELECT cs.section_code, cs.schedule, cs.schedule_json, cs.opening_date, cs.number_of_sessions, cs.group_chat_url,
              c.title AS course_title,
              t.name AS teacher_name, t.email AS teacher_email,
              u.name AS student_name, u.email AS student_email, u.must_change_password,
              cr.id AS registration_id,
              e.id AS enrollment_id
       FROM course_sections cs
       JOIN courses c ON c.id = cs.course_id
       JOIN users u ON u.id = $1
       LEFT JOIN users t ON t.id = cs.teacher_id
       LEFT JOIN course_registrations cr ON cr.section_id = cs.id AND cr.student_id = u.id AND cr.status = 'registered'
       LEFT JOIN enrollments e ON e.course_id = cs.course_id AND e.student_id = u.id AND e.status IN ('active', 'completed')
       WHERE cs.id = $2
       LIMIT 1`,
      [input.studentId, input.sectionId]
    )).rows[0];

    if (!row) return { ...base, email: null, status: "skipped", reason: "Không tìm thấy lớp hoặc học viên." };
    if (!row.registration_id) return { ...base, email: row.student_email || null, status: "skipped", reason: "Học viên chưa có chỗ trong lớp này." };
    if (!row.student_email) return { ...base, email: null, status: "skipped", reason: "Học viên chưa có email." };

    const schedule = parseSchedule(row);
    const status = await sendClassPlacementEmail({
      to: row.student_email,
      name: row.student_name || "Học viên",
      courseTitle: row.course_title,
      sectionCode: row.section_code,
      scheduleText: formatScheduleSummary(schedule),
      room: commonScheduleRoom(schedule),
      openingDate: formatDateVi(row.opening_date),
      numberOfSessions: row.number_of_sessions ? Number(row.number_of_sessions) : null,
      teacherName: teacherDisplayName(row.teacher_name, row.teacher_email),
      groupChatUrl: row.group_chat_url,
      supportPhone: getSupportPhone(),
      firstLoginPending: Boolean(row.must_change_password)
    });

    await db.query(
      "UPDATE course_registrations SET placement_email_status = $1, placement_email_at = CURRENT_TIMESTAMP WHERE id = $2",
      [status, row.registration_id]
    );
    await auditRepository.log(
      db,
      input.actorId || input.studentId,
      `class_placement_email_${status}`,
      input.sectionId,
      `Email xếp lớp ${row.section_code} tới ${row.student_email}`
    );

    if (input.notifyInApp !== false) {
      await notificationsRepository.create(db, {
        userId: input.studentId,
        type: "success",
        message: `Bạn đã được xếp vào lớp ${row.section_code} của khóa "${row.course_title}". Xem lịch học, nhóm Zalo và tài liệu trong mục Lớp học của tôi.`,
        relatedEntityType: "enrollment",
        relatedEntityId: row.enrollment_id || undefined,
        skipEmail: true
      });
    }

    return { ...base, email: row.student_email, status };
  } catch (error: any) {
    console.error("[placement-notice] failed:", error);
    return { ...base, email: null, status: "failed", reason: String(error?.message || error) };
  }
}

/** One summary per class for its teacher, instead of one notification per learner. */
export async function notifyTeacherOfPlacements(db: Queryable, sectionId: string, studentCount: number) {
  if (studentCount <= 0) return;
  try {
    const section = (await db.query("SELECT teacher_id, section_code FROM course_sections WHERE id = $1", [sectionId])).rows[0];
    if (!section?.teacher_id) return;
    await notificationsRepository.create(db, {
      userId: section.teacher_id,
      type: "info",
      message: `${studentCount} học viên mới vừa được xếp vào lớp ${section.section_code} của bạn.`,
      relatedEntityType: "section",
      relatedEntityId: sectionId
    });
  } catch (error) {
    console.error("[placement-notice] failed to notify teacher:", error);
  }
}
