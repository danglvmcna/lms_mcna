import ExcelJS from "exceljs";
import { Queryable } from "./db";

export type ReportActor = { id: string; role: string };

export type ReportFilters = {
  courseId?: string;
  sectionId?: string;
  from?: string;
  to?: string;
  search?: string;
};

const addFilter = (conditions: string[], values: unknown[], sql: string, value: unknown) => {
  values.push(value);
  conditions.push(sql.replace("$VALUE", `$${values.length}`));
};

const actorScope = (actor: ReportActor, conditions: string[], values: unknown[]) => {
  if (actor.role === "teacher") {
    values.push(actor.id);
    conditions.push(`cs.teacher_id = $${values.length}`);
  }
};

export async function getAttendanceReportRows(db: Queryable, actor: ReportActor, filters: ReportFilters = {}) {
  const values: unknown[] = [];
  const conditions = ["cr.status = 'registered'"];
  actorScope(actor, conditions, values);
  if (filters.courseId) addFilter(conditions, values, "c.id = $VALUE", filters.courseId);
  if (filters.sectionId) addFilter(conditions, values, "cs.id = $VALUE", filters.sectionId);
  // `date` is the canonical column; legacy deployments are migrated to it by
  // 009_attendance_date_compat.sql. Values may include a time label in the UI,
  // so only the ISO date prefix is cast by PostgreSQL.
  const dateFromParam = filters.from ? (values.push(filters.from), values.length) : null;
  const dateToParam = filters.to ? (values.push(filters.to), values.length) : null;
  if (filters.search) {
    values.push(`%${filters.search}%`);
    conditions.push(`(u.name ILIKE $${values.length} OR u.email ILIKE $${values.length} OR cs.section_code ILIKE $${values.length})`);
  }

  const result = await db.query(
    `SELECT
       u.id AS student_id,
       u.name AS student_name,
       u.email AS student_email,
       u.phone AS student_phone,
       c.id AS course_id,
       c.title AS course_title,
       cs.id AS section_id,
       cs.section_code,
       COUNT(DISTINCT ats.id)::int AS total_sessions,
       COUNT(DISTINCT ats.id) FILTER (WHERE ar.status IN ('present', 'late', 'excused'))::int AS attended_sessions,
       COUNT(DISTINCT ats.id) FILTER (WHERE ar.status = 'present')::int AS present_sessions,
       COUNT(DISTINCT ats.id) FILTER (WHERE ar.status = 'late')::int AS late_sessions,
       COUNT(DISTINCT ats.id) FILTER (WHERE ar.status = 'absent' OR ar.id IS NULL)::int AS absent_sessions,
       COUNT(DISTINCT ats.id) FILTER (WHERE ar.status = 'excused')::int AS excused_sessions,
       COALESCE(ROUND(
         COUNT(DISTINCT ats.id) FILTER (WHERE ar.status IN ('present', 'late', 'excused'))::numeric
         * 100 / NULLIF(COUNT(DISTINCT ats.id), 0)
       ), 100)::int AS attendance_percent
     FROM course_registrations cr
     JOIN users u ON u.id = cr.student_id
     JOIN course_sections cs ON cs.id = cr.section_id
     JOIN courses c ON c.id = cs.course_id
     LEFT JOIN attendance_sessions ats
       ON ats.course_id = c.id
      AND (ats.section_id = cs.id OR ats.section_id IS NULL)
      ${dateFromParam || dateToParam ? `AND ${dateFromParam ? `substring(ats.date from '^\\d{4}-\\d{2}-\\d{2}')::date >= $${dateFromParam}::date` : "TRUE"} ${dateToParam ? `AND substring(ats.date from '^\\d{4}-\\d{2}-\\d{2}')::date <= $${dateToParam}::date` : ""}` : ""}
     LEFT JOIN attendance_records ar ON ar.session_id = ats.id AND ar.student_id = cr.student_id
     WHERE ${conditions.filter(item => !item.includes("substring(ats.date") ).join(" AND ")}
     GROUP BY u.id, u.name, u.email, u.phone, c.id, c.title, cs.id, cs.section_code
     ORDER BY c.title, cs.section_code, u.name`,
    values
  );
  return result.rows.map((row: any) => ({
    studentId: row.student_id,
    studentName: row.student_name,
    studentEmail: row.student_email,
    studentPhone: row.student_phone || "",
    courseId: row.course_id,
    courseTitle: row.course_title,
    sectionId: row.section_id,
    sectionCode: row.section_code,
    totalSessions: Number(row.total_sessions || 0),
    attendedSessions: Number(row.attended_sessions || 0),
    presentSessions: Number(row.present_sessions || 0),
    lateSessions: Number(row.late_sessions || 0),
    absentSessions: Number(row.absent_sessions || 0),
    excusedSessions: Number(row.excused_sessions || 0),
    attendancePercent: Number(row.attendance_percent ?? 100)
  }));
}

export async function getGradebookReportRows(db: Queryable, actor: ReportActor, filters: ReportFilters = {}) {
  const values: unknown[] = [];
  const conditions = ["cr.status = 'registered'"];
  actorScope(actor, conditions, values);
  if (filters.courseId) addFilter(conditions, values, "c.id = $VALUE", filters.courseId);
  if (filters.sectionId) addFilter(conditions, values, "cs.id = $VALUE", filters.sectionId);
  if (filters.search) {
    values.push(`%${filters.search}%`);
    conditions.push(`(u.name ILIKE $${values.length} OR u.email ILIKE $${values.length} OR cs.section_code ILIKE $${values.length})`);
  }

  const result = await db.query(
    `WITH lesson_counts AS (
       SELECT course_id, COUNT(*)::int AS total_lessons FROM lessons GROUP BY course_id
     ), progress_counts AS (
       SELECT e.id AS enrollment_id, COUNT(*) FILTER (WHERE lp.completed)::int AS completed_lessons
       FROM enrollments e
       LEFT JOIN lesson_progress lp ON lp.enrollment_id = e.id
       GROUP BY e.id
     ), assignment_scores AS (
       SELECT a.course_id, s.student_id,
              ROUND(AVG((s.score::numeric / NULLIF(a.max_score, 0)) * 100), 2) AS assignment_percent
       FROM assignments a
       JOIN submissions s ON s.assignment_id = a.id
       WHERE s.score IS NOT NULL
       GROUP BY a.course_id, s.student_id
     ), quiz_scores AS (
       SELECT q.course_id, qa.student_id, ROUND(AVG(qa.score), 2) AS quiz_percent
       FROM quizzes q
       JOIN LATERAL (
         SELECT DISTINCT ON (student_id, quiz_id) student_id, quiz_id, score
         FROM quiz_attempts
         WHERE quiz_id = q.id
         ORDER BY student_id, quiz_id, score DESC, submitted_at DESC
       ) qa ON TRUE
       GROUP BY q.course_id, qa.student_id
     )
     SELECT u.id AS student_id, u.name AS student_name, u.email AS student_email, u.phone AS student_phone,
            c.id AS course_id, c.title AS course_title, cs.id AS section_id, cs.section_code,
            COALESCE(lp.completed_lessons, 0)::int AS completed_lessons,
            COALESCE(lc.total_lessons, 0)::int AS total_lessons,
            ascore.assignment_percent, qscore.quiz_percent,
            CASE
              WHEN ascore.assignment_percent IS NOT NULL AND qscore.quiz_percent IS NOT NULL THEN ROUND(ascore.assignment_percent * 0.3 + qscore.quiz_percent * 0.7, 2)
              ELSE COALESCE(ascore.assignment_percent, qscore.quiz_percent)
            END AS final_percent,
            cr.letter_grade, cr.grade_point
     FROM course_registrations cr
     JOIN users u ON u.id = cr.student_id
     JOIN course_sections cs ON cs.id = cr.section_id
     JOIN courses c ON c.id = cs.course_id
     LEFT JOIN progress_counts lp ON lp.enrollment_id = (
       SELECT e.id FROM enrollments e WHERE e.student_id = cr.student_id AND e.course_id = c.id ORDER BY e.enrolled_at DESC LIMIT 1
     )
     LEFT JOIN lesson_counts lc ON lc.course_id = c.id
     LEFT JOIN assignment_scores ascore ON ascore.course_id = c.id AND ascore.student_id = u.id
     LEFT JOIN quiz_scores qscore ON qscore.course_id = c.id AND qscore.student_id = u.id
     WHERE ${conditions.join(" AND ")}
     ORDER BY c.title, cs.section_code, u.name`,
    values
  );
  return result.rows.map((row: any) => ({
    studentId: row.student_id,
    studentName: row.student_name,
    studentEmail: row.student_email,
    studentPhone: row.student_phone || "",
    courseId: row.course_id,
    courseTitle: row.course_title,
    sectionId: row.section_id,
    sectionCode: row.section_code,
    completedLessons: Number(row.completed_lessons || 0),
    totalLessons: Number(row.total_lessons || 0),
    assignmentPercent: row.assignment_percent === null ? null : Number(row.assignment_percent),
    quizPercent: row.quiz_percent === null ? null : Number(row.quiz_percent),
    finalPercent: row.final_percent === null ? null : Number(row.final_percent),
    letterGrade: row.letter_grade || "",
    gradePoint: row.grade_point === null ? null : Number(row.grade_point)
  }));
}

export function csvCell(value: unknown) {
  const text = String(value ?? "");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: Array<Record<string, unknown>>, keys: string[]) {
  return `\uFEFF${headers.map(csvCell).join(",")}\r\n${rows.map(row => keys.map(key => csvCell(row[key])).join(",")).join("\r\n")}\r\n`;
}

export async function toXlsx(sheetName: string, headers: string[], rows: Array<Record<string, unknown>>, keys: string[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MCNA LMS";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = headers.map((header, index) => ({ header, key: keys[index], width: Math.min(Math.max(header.length + 4, 14), 32) }));
  rows.forEach(row => sheet.addRow(Object.fromEntries(keys.map(key => [key, row[key] ?? ""]))));
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4338CA" } };
  headerRow.alignment = { vertical: "middle" };
  sheet.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + Math.min(headers.length, 26))}1` };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
