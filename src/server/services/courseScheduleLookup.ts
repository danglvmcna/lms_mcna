import { Queryable } from "../db";
import { parseSchedule } from "../mappers";
import { commonScheduleRoom, formatDateVi, formatScheduleSummary } from "../../scheduleText";

export interface CourseSectionScheduleItem {
  sectionCode: string;
  openingDate?: string | null;
  scheduleText?: string | null;
  room?: string | null;
  status?: string | null;
}

export interface CourseScheduleInfo {
  courseTitle: string;
  courseId?: string;
  sections: CourseSectionScheduleItem[];
}

/**
 * Looks up all current and upcoming classes (sections) for the given courses,
 * so learners know the class timetable options when their payment is confirmed.
 */
export async function lookupCourseSchedules(db: Queryable, courseIdsOrTitles: string[]): Promise<CourseScheduleInfo[]> {
  const cleanInputs = courseIdsOrTitles.map(t => String(t || "").trim()).filter(Boolean);
  if (!cleanInputs.length) return [];

  const coursesRes = await db.query(
    "SELECT id, title FROM courses WHERE id = ANY($1) OR title = ANY($1)",
    [cleanInputs]
  );
  const courses = coursesRes.rows;
  if (!courses.length) {
    return cleanInputs.map(title => ({ courseTitle: title, sections: [] }));
  }

  const courseIds = courses.map(c => c.id);
  const sectionsRes = await db.query(
    `SELECT cs.id, cs.course_id, cs.section_code, cs.opening_date, cs.schedule, cs.schedule_json, cs.status, cs.meeting_url
     FROM course_sections cs
     WHERE cs.course_id = ANY($1) AND cs.status IN ('open', 'planned', 'upcoming')
     ORDER BY cs.opening_date ASC NULLS LAST, cs.section_code ASC`,
    [courseIds]
  );

  const sectionsByCourse = new Map<string, CourseSectionScheduleItem[]>();
  for (const row of sectionsRes.rows) {
    const schedule = parseSchedule(row);
    const item: CourseSectionScheduleItem = {
      sectionCode: row.section_code,
      openingDate: formatDateVi(row.opening_date),
      scheduleText: formatScheduleSummary(schedule),
      room: commonScheduleRoom(schedule) || "Online (Zoom)",
      status: row.status
    };
    const list = sectionsByCourse.get(row.course_id) || [];
    list.push(item);
    sectionsByCourse.set(row.course_id, list);
  }

  return courses.map(c => ({
    courseId: c.id,
    courseTitle: c.title,
    sections: sectionsByCourse.get(c.id) || []
  }));
}
