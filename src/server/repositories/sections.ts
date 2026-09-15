import { CourseSection, CourseRegistration } from "../../types";
import { Queryable } from "../db";
import { courseSectionFromRow, parseSchedule } from "../mappers";

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

export const sectionsRepository = {
  async createSection(db: Queryable, section: CourseSection): Promise<CourseSection> {
    await db.query(
      `INSERT INTO course_sections (id, course_id, teacher_id, section_code, max_students, schedule, status, opening_date, number_of_sessions, meeting_url, group_chat_url)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11)`,
      [section.id, section.courseId, section.teacherId, section.sectionCode, section.maxStudents, JSON.stringify(section.schedule), section.status, section.openingDate || null, section.numberOfSessions || null, section.meetingUrl || null, section.groupChatUrl || null]
    );
    return section;
  },

  async listSections(db: Queryable, courseId?: string): Promise<CourseSection[]> {
    const res = courseId
      ? await db.query("SELECT * FROM course_sections WHERE course_id = $1", [courseId])
      : await db.query("SELECT * FROM course_sections");
    return res.rows.map(courseSectionFromRow);
  },

  async registerToSection(db: Queryable, reg: CourseRegistration): Promise<CourseRegistration> {
    await db.query(
      `INSERT INTO course_registrations (id, student_id, section_id, status, registered_at, dropped_at, grade, letter_grade, grade_point, credits, is_retake)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [reg.id, reg.studentId, reg.sectionId, reg.status, reg.registeredAt, reg.droppedAt || null, reg.grade || null, reg.letterGrade || null, reg.gradePoint ?? null, reg.credits, reg.isRetake || false]
    );
    return reg;
  },

  async conflictCheck(db: Queryable, studentId: string, sectionId: string): Promise<boolean> {
    // 1. Get schedule of target section
    const targetRes = await db.query("SELECT * FROM course_sections WHERE id = $1", [sectionId]);
    if (!targetRes.rows[0]) return false;
    const targetRow = targetRes.rows[0];
    const targetSchedule = parseSchedule(targetRow);

    // 2. Get schedules of student's already registered sections
    const currentRegs = await db.query(
      `SELECT cs.* 
       FROM course_registrations cr
       JOIN course_sections cs ON cr.section_id = cs.id
       WHERE cr.student_id = $1 AND cr.status NOT IN ('dropped', 'waitlisted', 'withdrawn')`,
      [studentId]
    );

    const existingSchedules = currentRegs.rows.flatMap(r => {
      return parseSchedule(r);
    });

    // 3. Compare calendar date/day and overlapping times.
    for (const t of targetSchedule) {
      for (const e of existingSchedules) {
        if (schedulesCanOverlap(t, e)) {
          const tStart = this.timeToMinutes(t.startTime);
          const tEnd = this.timeToMinutes(t.endTime);
          const eStart = this.timeToMinutes(e.startTime);
          const eEnd = this.timeToMinutes(e.endTime);

          if (Math.max(tStart, eStart) < Math.min(tEnd, eEnd)) {
            return true; // Overlap found
          }
        }
      }
    }

    return false;
  },

  async promoteWaitlist(db: Queryable, sectionId: string): Promise<void> {
    // Check if space is available
    const secRes = await db.query("SELECT max_students FROM course_sections WHERE id = $1", [sectionId]);
    if (!secRes.rows[0]) return;
    const cap = secRes.rows[0].max_students;

    const countRes = await db.query("SELECT COUNT(*) AS count FROM course_registrations WHERE section_id = $1 AND status = 'registered'", [sectionId]);
    const enrolled = Number(countRes.rows[0].count);

    if (enrolled < cap) {
      // Find oldest waitlisted
      const wlRes = await db.query(
        "SELECT id FROM course_registrations WHERE section_id = $1 AND status = 'waitlisted' ORDER BY registered_at ASC LIMIT 1",
        [sectionId]
      );
      if (wlRes.rows[0]) {
        await db.query("UPDATE course_registrations SET status = 'registered' WHERE id = $1", [wlRes.rows[0].id]);
      }
    }
  },

  timeToMinutes(timeStr: string): number {
    const [hrs, mins] = timeStr.split(":").map(Number);
    return hrs * 60 + mins;
  }
};
