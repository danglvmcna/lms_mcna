import { generateId } from "../ids";
import { courseSectionFromRow, parseSchedule } from "../mappers";

// Class (course section) scheduling: the generated "Buổi N" attendance sessions and placeholder lessons
// that follow a class's weekly timetable. Shared by the API server and scripts/importMcnaCourses.ts.

export type SectionScheduleSlot = { dayOfWeek: string; startTime: string; endTime: string; room?: string; specificDate?: string };
export type SectionPayload = {
  id?: string;
  courseId: string;
  semesterId: string;
  teacherId: string;
  sectionCode: string;
  maxStudents: number;
  schedule: SectionScheduleSlot[];
  status: "pending" | "open" | "closed" | "cancelled";
  openingDate?: string;
  numberOfSessions?: number;
  meetingUrl?: string;
  groupChatUrl?: string;
};

export const normalizeDayText = (value: any) => String(value || "")
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .toLowerCase();

// Exact names only. Substring matching used to read "Thứ Sáu" as Thứ Năm ("thu") and "Thứ Bảy" as Thứ Ba ("ba").
const DAY_INDEX_BY_NAME: Record<string, number> = {
  "chu nhat": 0, "cn": 0, "sun": 0, "sunday": 0,
  "thu hai": 1, "thu 2": 1, "t2": 1, "mon": 1, "monday": 1,
  "thu ba": 2, "thu 3": 2, "t3": 2, "tue": 2, "tuesday": 2,
  "thu tu": 3, "thu 4": 3, "t4": 3, "wed": 3, "wednesday": 3,
  "thu nam": 4, "thu 5": 4, "t5": 4, "thu": 4, "thursday": 4,
  "thu sau": 5, "thu 6": 5, "t6": 5, "fri": 5, "friday": 5,
  "thu bay": 6, "thu 7": 6, "t7": 6, "sat": 6, "saturday": 6
};

export const dayOfWeekIndex = (value: any): number | null => {
  const text = normalizeDayText(value).replace(/\s+/g, " ").trim();
  return DAY_INDEX_BY_NAME[text] ?? null;
};

export const addDaysIso = (dateOnly: string, days: number) => {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const isDateOnlyText = (value: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").slice(0, 10));
export const normalizeDateOnly = (value: any, fallback = new Date().toISOString().slice(0, 10)) => {
  const dateOnly = String(value || "").slice(0, 10);
  return isDateOnlyText(dateOnly) ? dateOnly : fallback;
};

const nextDateForSlot = (fromDate: string, slot: SectionScheduleSlot, cycle: number) => {
  if (slot.specificDate) return addDaysIso(normalizeDateOnly(slot.specificDate, fromDate), cycle * 7);
  const targetDay = dayOfWeekIndex(slot.dayOfWeek);
  if (targetDay === null) return addDaysIso(fromDate, cycle * 7);
  const [year, month, day] = fromDate.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  const currentDay = start.getUTCDay();
  const delta = (targetDay - currentDay + 7) % 7;
  return addDaysIso(fromDate, delta + cycle * 7);
};

const dateTimeForSlot = (dateOnly: string, slot?: SectionScheduleSlot | null) => {
  const startTime = String(slot?.startTime || "").trim();
  return /^\d{2}:\d{2}$/.test(startTime) ? `${dateOnly}T${startTime}:00` : dateOnly;
};

const buildScheduledSessionSeed = (order: number, schedule: SectionScheduleSlot[], openingDate?: string | null) => {
  const slotCount = Math.max(schedule.length, 1);
  const slot = schedule.length > 0 ? schedule[(order - 1) % slotCount] : null;
  const cycle = Math.floor((order - 1) / slotCount);
  const baseDate = normalizeDateOnly(openingDate || slot?.specificDate);
  const date = slot ? nextDateForSlot(baseDate, slot, cycle) : addDaysIso(baseDate, order - 1);
  const time = slot ? `${slot.startTime} - ${slot.endTime}` : "";
  const room = slot?.room || "Online";
  const scheduleText = slot
    ? `${slot.dayOfWeek}, ${time}, ${room}`
    : date;
  return {
    date: dateTimeForSlot(date, slot),
    topic: `Buổi ${order}: ${scheduleText}`,
    content: slot
      ? `Lịch học theo thời khóa biểu: ${scheduleText}. Giảng viên có thể cập nhật nội dung chi tiết cho buổi học này.`
      : "Giảng viên có thể cập nhật nội dung chi tiết cho buổi học này."
  };
};

const buildLessonSeed = (order: number, schedule: SectionScheduleSlot[], openingDate?: string) => {
  const slot = schedule.length > 0 ? schedule[(order - 1) % schedule.length] : null;
  const cycle = Math.floor((order - 1) / Math.max(schedule.length, 1));
  const baseDate = normalizeDateOnly(openingDate || slot?.specificDate);
  const date = slot ? nextDateForSlot(baseDate, slot, cycle) : "";
  const time = slot ? `${slot.startTime} - ${slot.endTime}` : "";
  const room = slot?.room || "Online";
  const titleSuffix = date || time ? ` (${[date, time].filter(Boolean).join(" ")})` : "";
  return {
    title: `Buoi ${order}${titleSuffix}`,
    content: slot
      ? `Lich hoc du kien: ${slot.dayOfWeek}, ${time}, ${room}. Giang vien cap nhat ten buoi hoc va noi dung bai day tai day.`
      : "Giang vien cap nhat ten buoi hoc va noi dung bai day tai day.",
    duration: time ? `${time}${room ? ` | ${room}` : ""}` : "1 buoi"
  };
};

export async function ensureCourseLessonsForSchedule(db: any, courseId: string, count?: number | null, schedule: SectionScheduleSlot[] = [], openingDate?: string | null) {
  const targetCount = Number(count || 0);
  if (!Number.isFinite(targetCount) || targetCount < 1) return;

  const existing = (await db.query(
    "SELECT lesson_order FROM lessons WHERE course_id = $1",
    [courseId]
  )).rows;
  const existingOrders = new Set(existing.map((row: any) => Number(row.lesson_order)));

  for (let order = 1; order <= targetCount; order++) {
    if (existingOrders.has(order)) continue;
    const seed = buildLessonSeed(order, schedule, openingDate || undefined);
    await db.query(
      "INSERT INTO lessons (id, course_id, title, content, video_url, lesson_order, duration) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [generateId("lesson"), courseId, seed.title, seed.content, null, order, seed.duration]
    );
  }
}

const isGeneratedSessionTopicForOrder = (topic: any, order: number) => {
  const normalized = normalizeDayText(topic).replace(/\s+/g, " ").trim();
  return normalized === `buoi ${order}` || normalized.startsWith(`buoi ${order}:`) || normalized.startsWith(`buoi ${order} `);
};

export const generatedSessionOrder = (topic: any) => {
  const normalized = normalizeDayText(topic).replace(/\s+/g, " ").trim();
  const match = normalized.match(/^buoi\s+(\d+)(?::|\s|$)/);
  return match ? Number(match[1]) : null;
};

export async function ensureSectionAttendanceSessionsForSchedule(
  db: any,
  section: { id: string; course_id: string; semester_id: string; teacher_id: string; number_of_sessions?: number | null; opening_date?: string | null },
  schedule: SectionScheduleSlot[] = []
) {
  const targetCount = Number(section.number_of_sessions || 0);
  if (!Number.isFinite(targetCount) || targetCount < 1) return;

  const columns = (await db.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'attendance_sessions'"
  )).rows.map((row: any) => row.column_name);
  const hasDate = columns.includes("date");
  const hasSessionDate = columns.includes("session_date");
  const hasSectionId = columns.includes("section_id");
  const hasContent = columns.includes("content");
  if (!hasSectionId) return;
  const dateOrderExpression = hasDate && hasSessionDate
    ? "COALESCE(date::text, session_date::text)"
    : hasDate
      ? "date::text"
      : hasSessionDate
        ? "session_date::text"
        : "id";

  const existing = (await db.query(
    `SELECT * FROM attendance_sessions
     WHERE section_id = $1
     ORDER BY ${dateOrderExpression}, topic, id`,
    [section.id]
  )).rows;
  const usedIds = new Set<string>();

  for (let order = 1; order <= targetCount; order++) {
    const seed = buildScheduledSessionSeed(order, schedule, section.opening_date);
    const generatedMatch = existing.find((row: any) => !usedIds.has(row.id) && isGeneratedSessionTopicForOrder(row.topic, order));
    const fallbackMatch = existing[order - 1] && !usedIds.has(existing[order - 1].id) ? existing[order - 1] : null;
    const current = generatedMatch || fallbackMatch;

    if (current) {
      usedIds.add(current.id);
      const sets = ["semester_id = $1", "teacher_id = $2"];
      const values: any[] = [section.semester_id || null, section.teacher_id];
      let paramIndex = values.length + 1;

      if (hasDate) {
        sets.push(`date = $${paramIndex++}`);
        values.push(seed.date);
      }
      if (hasSessionDate) {
        sets.push(`session_date = $${paramIndex++}`);
        values.push(seed.date.slice(0, 10));
      }
      if (isGeneratedSessionTopicForOrder(current.topic, order)) {
        sets.push(`topic = $${paramIndex++}`);
        values.push(seed.topic);
      }
      if (hasContent && !current.content) {
        sets.push(`content = $${paramIndex++}`);
        values.push(seed.content);
      }
      values.push(current.id);
      await db.query(`UPDATE attendance_sessions SET ${sets.join(", ")} WHERE id = $${paramIndex}`, values);
      continue;
    }

    const insertColumns = ["id", "course_id", "semester_id", "teacher_id", "topic"];
    const values: any[] = [generateId("ats"), section.course_id, section.semester_id || null, section.teacher_id, seed.topic];
    const placeholders = values.map((_, index) => `$${index + 1}`);
    if (hasDate) {
      insertColumns.push("date");
      values.push(seed.date);
      placeholders.push(`$${values.length}`);
    }
    if (hasSessionDate) {
      insertColumns.push("session_date");
      values.push(seed.date.slice(0, 10));
      placeholders.push(`$${values.length}`);
    }
    if (hasSectionId) {
      insertColumns.push("section_id");
      values.push(section.id);
      placeholders.push(`$${values.length}`);
    }
    if (hasContent) {
      insertColumns.push("content");
      values.push(seed.content);
      placeholders.push(`$${values.length}`);
    }
    await db.query(
      `INSERT INTO attendance_sessions (${insertColumns.join(", ")}) VALUES (${placeholders.join(", ")})`,
      values
    );
  }

  const excessGeneratedIds = existing
    .filter((row: any) => {
      const order = generatedSessionOrder(row.topic);
      return order !== null && (order > targetCount || !usedIds.has(row.id));
    })
    .map((row: any) => row.id);
  if (excessGeneratedIds.length > 0) {
    await db.query("DELETE FROM attendance_sessions WHERE id = ANY($1)", [excessGeneratedIds]);
  }
}

async function getCourseSectionColumnSet(db: { query: (sql: string, params?: any[]) => Promise<any> }) {
  const rows = (await db.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'course_sections'"
  )).rows;
  return new Set<string>(rows.map((row: any) => row.column_name));
}

export async function upsertCourseSection(db: any, section: SectionPayload) {
  const id = section.id || generateId("section");
  const scheduleJson = JSON.stringify(section.schedule || []);
  const columns = await getCourseSectionColumnSet(db);
  const insertColumns = ["id", "course_id", "semester_id", "teacher_id", "section_code", "max_students", "status"];
  const values: any[] = [id, section.courseId, section.semesterId, section.teacherId, section.sectionCode, Number(section.maxStudents), section.status];
  const placeholders = values.map((_, index) => `$${index + 1}`);
  const updates = [
    "course_id = EXCLUDED.course_id",
    "semester_id = EXCLUDED.semester_id",
    "teacher_id = EXCLUDED.teacher_id",
    "section_code = EXCLUDED.section_code",
    "max_students = EXCLUDED.max_students",
    "status = EXCLUDED.status"
  ];

  if (columns.has("schedule_json")) {
    insertColumns.push("schedule_json");
    values.push(scheduleJson);
    placeholders.push(`$${values.length}`);
    updates.push("schedule_json = EXCLUDED.schedule_json");
  }
  if (columns.has("schedule")) {
    insertColumns.push("schedule");
    values.push(scheduleJson);
    placeholders.push(`$${values.length}::jsonb`);
    updates.push("schedule = EXCLUDED.schedule");
  }
  if (columns.has("opening_date")) {
    insertColumns.push("opening_date");
    values.push(section.openingDate || null);
    placeholders.push(`$${values.length}`);
    updates.push("opening_date = EXCLUDED.opening_date");
  }
  if (columns.has("number_of_sessions")) {
    insertColumns.push("number_of_sessions");
    values.push(section.numberOfSessions || null);
    placeholders.push(`$${values.length}`);
    updates.push("number_of_sessions = EXCLUDED.number_of_sessions");
  }
  if (columns.has("meeting_url")) {
    insertColumns.push("meeting_url");
    values.push(section.meetingUrl || null);
    placeholders.push(`$${values.length}`);
    updates.push("meeting_url = EXCLUDED.meeting_url");
  }
  if (columns.has("group_chat_url")) {
    insertColumns.push("group_chat_url");
    values.push(section.groupChatUrl || null);
    placeholders.push(`$${values.length}`);
    updates.push("group_chat_url = EXCLUDED.group_chat_url");
  }

  const row = (await db.query(
    `INSERT INTO course_sections (${insertColumns.join(", ")})
     VALUES (${placeholders.join(", ")})
     ON CONFLICT (id) DO UPDATE SET ${updates.join(", ")}
     RETURNING *`,
    values
  )).rows[0];

  await ensureCourseLessonsForSchedule(
    db,
    row.course_id,
    row.number_of_sessions,
    parseSchedule(row),
    row.opening_date || undefined
  );
  await ensureSectionAttendanceSessionsForSchedule(db, row, parseSchedule(row));

  return courseSectionFromRow(row);
}

export async function ensureScheduledSessionsForAllSections(db: any) {
  const sectionColumns = await getCourseSectionColumnSet(db);
  const numberOfSessionsSelect = sectionColumns.has("number_of_sessions") ? "cs.number_of_sessions" : "NULL";
  const openingDateSelect = sectionColumns.has("opening_date") ? "cs.opening_date" : "NULL";
  const rows = (await db.query(
    `SELECT cs.*, ${numberOfSessionsSelect} AS resolved_number_of_sessions,
            ${openingDateSelect} AS resolved_opening_date,
            c.number_of_lessons AS course_number_of_lessons,
            c.opening_date AS course_opening_date
     FROM course_sections cs
     JOIN courses c ON c.id = cs.course_id`
  )).rows;

  for (const row of rows) {
    const targetCount = Number(row.resolved_number_of_sessions || row.course_number_of_lessons || 10);
    const openingDate = row.resolved_opening_date || row.course_opening_date || undefined;
    if (sectionColumns.has("number_of_sessions") && !row.resolved_number_of_sessions) {
      await db.query("UPDATE course_sections SET number_of_sessions = $1 WHERE id = $2", [targetCount, row.id]);
    }
    await ensureCourseLessonsForSchedule(db, row.course_id, targetCount, parseSchedule(row), openingDate);
    await ensureSectionAttendanceSessionsForSchedule(
      db,
      { ...row, number_of_sessions: targetCount, opening_date: openingDate },
      parseSchedule(row)
    );
  }
}
