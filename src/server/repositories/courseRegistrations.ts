import { Queryable } from "../db";
import { pool } from "../db";
import { generateId } from "../ids";
import { notifyStudent, notifyUsers } from "../notify";
import { eventBus } from "../eventBus";
import { parseSchedule } from "../mappers";

const scheduleDateOnly = (slot: any): string => {
  const value = slot?.specificDate || slot?.specific_date;
  return value ? String(value).slice(0, 10) : "";
};

const scheduleDay = (slot: any): string => String(slot?.dayOfWeek || slot?.day_of_week || "").toLowerCase();

const schedulesCanOverlap = (targetSlot: any, existingSlot: any): boolean => {
  const targetDate = scheduleDateOnly(targetSlot);
  const existingDate = scheduleDateOnly(existingSlot);
  if (targetDate && existingDate) return targetDate === existingDate;
  const targetDay = scheduleDay(targetSlot);
  const existingDay = scheduleDay(existingSlot);
  return Boolean(targetDay && existingDay && targetDay === existingDay);
};

async function resolveSectionCredits(db: Queryable, sectionId: string, courseId: string): Promise<number> {
  const row = (await db.query(
    `SELECT COALESCE(MAX(pc.credits), 3) AS credits
     FROM program_courses pc
     WHERE pc.course_id = $1`,
    [courseId]
  )).rows[0];
  return Number(row?.credits || 3);
}

export const courseRegistrationsRepository = {
  async register(db: Queryable, studentId: string, sectionId: string) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const section = (await client.query("SELECT * FROM course_sections WHERE id = $1 FOR UPDATE", [sectionId])).rows[0];
      if (!section) {
        await client.query("ROLLBACK");
        return { error: "Section not found.", status: 404 };
      }
      if (section.status !== 'open') {
        await client.query("ROLLBACK");
        return { error: "Lớp học phần này hiện không ở trạng thái mở đăng ký.", status: 403 };
      }

      const course = (await client.query("SELECT price FROM courses WHERE id = $1", [section.course_id])).rows[0];
      if (Number(course?.price || 0) > 0) {
        const activeEnrollment = (await client.query(
          "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2 AND status IN ('active', 'completed')",
          [studentId, section.course_id]
        )).rows[0];
        if (!activeEnrollment) {
          await client.query("ROLLBACK");
          return { error: "Payment confirmation and admin class placement are required before joining this paid class.", status: 403 };
        }
      }

      const existing = (await client.query(
        "SELECT * FROM course_registrations WHERE student_id = $1 AND section_id = $2 AND status IN ('registered', 'waitlisted')",
        [studentId, sectionId]
      )).rows[0];
      if (existing) {
        await client.query("ROLLBACK");
        return { error: "Student is already registered or waitlisted for this section.", status: 409 };
      }

      const profile = (await client.query("SELECT fee_hold, academic_year FROM student_profiles WHERE user_id = $1", [studentId])).rows[0];
      if (!profile) {
        await client.query("ROLLBACK");
        return { error: "Student profile not found.", status: 404 };
      }
      if (profile.fee_hold) {
        await client.query("ROLLBACK");
        return { error: "Clear outstanding fees before registering for courses.", status: 403 };
      }



      // Check schedule conflict using the shared parseSchedule helper
      const targetSchedule = parseSchedule(section);

      const currentRegs = (await client.query(
        `SELECT cs.* 
         FROM course_registrations cr
         JOIN course_sections cs ON cr.section_id = cs.id
         WHERE cr.student_id = $1 AND cr.status = 'registered'`,
        [studentId]
      )).rows;

      const existingSchedules = currentRegs.flatMap(r => parseSchedule(r));

      const timeToMinutes = (timeStr: string): number => {
        const [hrs, mins] = timeStr.split(":").map(Number);
        return hrs * 60 + mins;
      };

      let hasConflict = false;
      for (const t of targetSchedule) {
        for (const e of existingSchedules) {
          if (schedulesCanOverlap(t, e)) {
            const tStart = timeToMinutes(t.startTime || t.start_time);
            const tEnd = timeToMinutes(t.endTime || t.end_time);
            const eStart = timeToMinutes(e.startTime || e.start_time);
            const eEnd = timeToMinutes(e.endTime || e.end_time);

            if (Math.max(tStart, eStart) < Math.min(tEnd, eEnd)) {
              hasConflict = true;
              break;
            }
          }
        }
        if (hasConflict) break;
      }

      if (hasConflict) {
        await client.query("ROLLBACK");
        return { error: "Schedule conflict detected", status: 409 };
      }

      const count = Number((await client.query(
        "SELECT COUNT(*) AS count FROM course_registrations WHERE section_id = $1 AND status = 'registered'",
        [sectionId]
      )).rows[0].count);
      const status = count >= Number(section.max_students) ? "waitlisted" : "registered";
      const credits = await resolveSectionCredits(client, sectionId, section.course_id);

      const row = (await client.query(
        `INSERT INTO course_registrations (id, student_id, section_id, status, registered_at, credits, is_retake)
         VALUES ($1,$2,$3,$4,$5,$6,false)
         RETURNING *`,
        [generateId("reg"), studentId, sectionId, status, new Date().toISOString(), credits]
      )).rows[0];

      await client.query("COMMIT");
      await notifyUsers(db, [section.teacher_id], { type: "info", message: `Học viên đã đăng ký vào lớp học phần ${section.section_code}.`, relatedEntityType: "course_registration", relatedEntityId: row.id });
      return { row };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async drop(db: Queryable, registrationId: string, studentId: string) {
    const reg = (await db.query(
      `SELECT cr.*, cs.teacher_id
       FROM course_registrations cr
       JOIN course_sections cs ON cs.id = cr.section_id
       WHERE cr.id = $1 AND cr.student_id = $2`,
      [registrationId, studentId]
    )).rows[0];
    if (!reg) return null;

    const registeredTime = new Date(reg.registered_at).getTime();
    const dropDeadline = registeredTime + 14 * 24 * 60 * 60 * 1000;
    const nextStatus = Date.now() <= dropDeadline ? "dropped" : "withdrawn";
    const grade = nextStatus === "withdrawn" ? "W" : null;
    const row = (await db.query(
      "UPDATE course_registrations SET status = $2, dropped_at = $3, grade = COALESCE($4, grade), letter_grade = COALESCE($4, letter_grade) WHERE id = $1 RETURNING *",
      [registrationId, nextStatus, new Date().toISOString(), grade]
    )).rows[0];

    const promoted = (await db.query(
      `UPDATE course_registrations
       SET status = 'registered'
       WHERE id = (
         SELECT id FROM course_registrations
         WHERE section_id = $1 AND status = 'waitlisted'
         ORDER BY registered_at ASC
         LIMIT 1
       )
       RETURNING *`,
      [reg.section_id]
    )).rows[0];
    if (promoted) await notifyStudent(db, promoted.student_id, "Bạn đã được chuyển từ danh sách chờ sang đăng ký chính thức thành công.", { relatedEntityType: "course_registration", relatedEntityId: promoted.id });
    await notifyUsers(db, [reg.teacher_id], { type: "info", message: "Một học viên đã hủy đăng ký hoặc rút lui khỏi lớp học phần của bạn.", relatedEntityType: "course_registration", relatedEntityId: registrationId });
    await eventBus.emit("registration.dropped", { registrationId, studentId, status: nextStatus }, pool);
    return row;
  }
};
