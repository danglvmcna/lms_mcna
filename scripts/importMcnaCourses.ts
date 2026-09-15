import dotenv from "dotenv";
import fs from "fs";
import { fileURLToPath } from "url";
import { pool } from "../src/server/db";
import { addDaysIso, dayOfWeekIndex, SectionScheduleSlot, upsertCourseSection } from "../src/server/services/sectionSchedule";

dotenv.config();

// Imports the MCNA course catalog (scripts/mcnaCatalog.json, taken from mcna.vn) into the LMS database:
// courses with their session syllabus as lessons, and the published opening classes with generated sessions.
// Safe to re-run: records use fixed ids, existing classes are left untouched and admin-set prices are kept.
//
// Usage: npm run import:mcna -- [--hide-other-courses] [--teacher-email=teacher@mcna.local] [--semester=<id>]
//   --hide-other-courses  move every other published course (e.g. demo data) back to draft
//   --teacher-email       teacher account assigned to new courses and classes
//   --semester            semester for new classes (default: the current semester)

type CatalogSession = { title: string; content?: string };
type CatalogCourse = {
  key: string;
  code: string;
  title: string;
  englishName: string;
  category: string;
  level: string;
  description: string;
  thumbnail: string;
  sourceUrl: string;
  sessions: CatalogSession[];
};
type CatalogClass = { course: string; openingDate: string; days: string[]; startTime: string; endTime: string; room?: string };
type Catalog = { defaultPrice: number; defaultMaxStudents: number; courses: CatalogCourse[]; classes: CatalogClass[] };

const catalog: Catalog = JSON.parse(fs.readFileSync(fileURLToPath(new URL("./mcnaCatalog.json", import.meta.url)), "utf8"));
const args = new Map(
  process.argv.slice(2).map(arg => {
    const [key, ...value] = arg.replace(/^--/, "").split("=");
    return [key, value.join("=") || "true"] as const;
  })
);

const courseId = (key: string) => `course_mcna_${key}`;
const lessonId = (key: string, order: number) => `lesson_mcna_${key}_${order}`;

// The session generator walks the slots in order, so start from the weekday that comes first after opening.
function slotsInOpeningOrder(cls: CatalogClass): SectionScheduleSlot[] {
  const [year, month, day] = cls.openingDate.split("-").map(Number);
  const openingDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return cls.days
    .map(name => {
      const index = dayOfWeekIndex(name);
      if (index === null) throw new Error(`Unknown weekday "${name}" in class ${cls.course} ${cls.openingDate}.`);
      return { slot: { dayOfWeek: name, startTime: cls.startTime, endTime: cls.endTime, room: cls.room || "Online (Zoom)" }, offset: (index - openingDay + 7) % 7 };
    })
    .sort((a, b) => a.offset - b.offset)
    .map(item => item.slot);
}

async function main() {
  const courseByKey = new Map(catalog.courses.map(course => [course.key, course]));
  for (const cls of catalog.classes) {
    if (!courseByKey.has(cls.course)) throw new Error(`Class ${cls.openingDate} refers to unknown course "${cls.course}".`);
  }

  const client = await pool.connect();
  const summary = { coursesCreated: 0, coursesUpdated: 0, lessons: 0, classesCreated: 0, classesSkipped: 0, otherCoursesHidden: 0 };
  try {
    await client.query("BEGIN");

    const teacherEmail = args.get("teacher-email") || "teacher@mcna.local";
    const teacher = (await client.query("SELECT id, name, email FROM users WHERE lower(email) = lower($1) AND role = 'teacher'", [teacherEmail])).rows[0]
      || (await client.query("SELECT id, name, email FROM users WHERE role = 'teacher' ORDER BY created_at LIMIT 1")).rows[0];
    if (!teacher) throw new Error("No teacher account found. Create one or pass --teacher-email=<teacher email>.");
    console.log(`Teacher: ${teacher.name} <${teacher.email}>`);

    for (const course of catalog.courses) {
      const firstClass = catalog.classes.filter(cls => cls.course === course.key).map(cls => cls.openingDate).sort()[0] || null;
      const description = [
        course.description,
        "",
        `Tên tiếng Anh: ${course.englishName}`,
        `Mã khóa: ${course.code} · ${course.sessions.length} buổi · Online`,
        `Nguồn: ${course.sourceUrl}`
      ].join("\n");
      const result = await client.query(
        `INSERT INTO courses (id, title, description, teacher_id, status, category, thumbnail, price, level, tags_json, rejection_reason, created_at, opening_date, number_of_lessons)
         VALUES ($1, $2, $3, $4, 'published', $5, $6, $7, $8, $9, NULL, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           status = 'published',
           category = EXCLUDED.category,
           thumbnail = EXCLUDED.thumbnail,
           level = EXCLUDED.level,
           tags_json = EXCLUDED.tags_json,
           opening_date = EXCLUDED.opening_date,
           number_of_lessons = EXCLUDED.number_of_lessons,
           price = CASE WHEN courses.price IS NULL OR courses.price = 0 THEN EXCLUDED.price ELSE courses.price END
         RETURNING (xmax = 0) AS inserted`,
        [
          courseId(course.key),
          course.title,
          description,
          teacher.id,
          course.category,
          course.thumbnail,
          catalog.defaultPrice,
          course.level,
          JSON.stringify(["mcna", course.code]),
          new Date().toISOString(),
          firstClass,
          course.sessions.length
        ]
      );
      if (result.rows[0].inserted) summary.coursesCreated++;
      else summary.coursesUpdated++;

      for (const [index, session] of course.sessions.entries()) {
        const order = index + 1;
        await client.query(
          `INSERT INTO lessons (id, course_id, title, content, video_url, lesson_order, duration)
           VALUES ($1, $2, $3, $4, NULL, $5, $6)
           ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, content = EXCLUDED.content, lesson_order = EXCLUDED.lesson_order, duration = EXCLUDED.duration`,
          [lessonId(course.key, order), courseId(course.key), `Buổi ${order}: ${session.title}`, session.content || session.title, order, "2 giờ"]
        );
        summary.lessons++;
      }
    }

    for (const cls of catalog.classes) {
      const course = courseByKey.get(cls.course)!;
      const [, month, day] = cls.openingDate.split("-");
      const sectionId = `section_mcna_${cls.course}_${cls.openingDate.replace(/-/g, "")}`;
      if ((await client.query("SELECT 1 FROM course_sections WHERE id = $1", [sectionId])).rowCount) {
        summary.classesSkipped++;
        continue;
      }

      await upsertCourseSection(client, {
        id: sectionId,
        courseId: courseId(course.key),
        teacherId: teacher.id,
        sectionCode: `${course.code}-${day}${month}`,
        maxStudents: catalog.defaultMaxStudents,
        schedule: slotsInOpeningOrder(cls),
        status: "open",
        openingDate: cls.openingDate,
        numberOfSessions: course.sessions.length
      });

      // Name the generated sessions after the syllabus. Topics without the "Buổi N:" prefix are kept
      // by the generator when an admin later edits the class.
      const sessions = (await client.query(
        "SELECT id, date FROM attendance_sessions WHERE section_id = $1 ORDER BY date",
        [sectionId]
      )).rows;
      for (const [index, row] of sessions.entries()) {
        const syllabus = course.sessions[index];
        if (!syllabus) continue;
        await client.query(
          "UPDATE attendance_sessions SET topic = $1, content = $2 WHERE id = $3",
          [syllabus.title, syllabus.content || syllabus.title, row.id]
        );
      }
      const lastDate = sessions.length ? String(sessions[sessions.length - 1].date).slice(0, 10) : addDaysIso(cls.openingDate, 0);
      console.log(`  + ${course.code}-${day}${month}: ${cls.days.join(" & ")} ${cls.startTime}-${cls.endTime}, ${sessions.length} buổi, ${cls.openingDate} → ${lastDate}`);
      summary.classesCreated++;
    }

    if (args.has("hide-other-courses")) {
      const hidden = await client.query(
        "UPDATE courses SET status = 'draft' WHERE status = 'published' AND id NOT LIKE 'course_mcna_%' RETURNING id"
      );
      summary.otherCoursesHidden = hidden.rowCount || 0;
    }

    await client.query("COMMIT");
    console.table(summary);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
