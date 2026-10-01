import { getInitialStore } from "../store";
import { backfillMegaDemoData } from "../mockSeeds";
import { Queryable } from "./db";
import { usersRepository } from "./repositories/users";
import { generateId } from "./ids";
import { generateUsername } from "./emailProvisioning/googleWorkspaceClient";
import { importMcnaCatalog } from "./services/catalogImport";

// A fresh database is seeded with the three base accounts and the real MCNA catalogue.
// Set SEED_DEMO_DATA=true to also generate the demo directory (20 teachers, 40 courses, 300 learners).
const seedDemoData = () => process.env.SEED_DEMO_DATA === "true";

function getSeedStore() {
  const store = getInitialStore();
  if (seedDemoData()) backfillMegaDemoData(store);
  return store;
}

export async function seedCoreLearningData(db: Queryable) {
  if (!seedDemoData()) {
    const catalogCount = Number((await db.query("SELECT COUNT(*) AS count FROM courses WHERE id LIKE 'course_mcna_%'")).rows[0].count);
    if (catalogCount === 0) {
      console.log("[Seeding] Importing the MCNA catalogue...");
      const summary = await importMcnaCatalog(db, { log: message => console.log(message) });
      console.log(`[Seeding] Catalogue ready: ${summary.coursesCreated} khóa học, ${summary.lessons} bài học, ${summary.classesCreated} lớp.`);
    }
    return;
  }

  const store = getSeedStore();
  const initialCourseCount = Number((await db.query("SELECT COUNT(*) AS count FROM courses")).rows[0].count);
  const needsMegaBackfill = initialCourseCount < 40;

  // 1. Courses & lessons
  if (initialCourseCount === 0 || needsMegaBackfill) {
    for (const c of store.courses) {
      await db.query(
        `INSERT INTO courses (id, title, description, teacher_id, status, category, thumbnail, price, level, tags_json, rejection_reason, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`,
        [c.id, c.title, c.description, c.teacherId, c.status, c.category, c.thumbnail || null, c.price || 0, c.level || null, JSON.stringify(c.tags || []), c.rejectionReason || null, c.createdAt]
      );
    }
    for (const l of store.lessons) {
      await db.query(
        "INSERT INTO lessons (id, course_id, title, content, video_url, lesson_order, duration) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING",
        [l.id, l.courseId, l.title, l.content, l.videoUrl || null, l.order, l.duration]
      );
    }
  }

  // 2. Enrollments
  if (Number((await db.query("SELECT COUNT(*) AS count FROM enrollments")).rows[0].count) === 0) {
    for (const e of store.enrollments) {
      await db.query(
        "INSERT INTO enrollments (id, course_id, student_id, status, enrolled_at, completed_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING",
        [e.id, e.courseId, e.studentId, e.status, e.enrolledAt, e.completedAt || null]
      );
    }
  }

  // 3. Classes and their weekly schedule
  if (Number((await db.query("SELECT COUNT(*) AS count FROM course_sections")).rows[0].count) === 0) {
    for (const section of store.courseSections || []) {
      await db.query(
        `INSERT INTO course_sections (id, course_id, teacher_id, section_code, max_students, schedule, schedule_json, status)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)
         ON CONFLICT (id) DO NOTHING`,
        [
          section.id,
          section.courseId,
          section.teacherId,
          section.sectionCode,
          section.maxStudents,
          JSON.stringify(section.schedule || []),
          JSON.stringify(section.schedule || []),
          section.status
        ]
      );
    }
  }

  if (Number((await db.query("SELECT COUNT(*) AS count FROM section_schedules")).rows[0].count) === 0) {
    const fallbackDays = [2, 4, 3, 6];
    for (const section of store.courseSections || []) {
      for (const [index, slot] of (section.schedule || []).entries()) {
        await db.query(
          `INSERT INTO section_schedules (id, section_id, day_of_week, start_time, end_time, room)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (id) DO NOTHING`,
          [
            `sched_${section.id}_${index}`,
            section.id,
            fallbackDays[index % fallbackDays.length],
            slot.startTime,
            slot.endTime,
            slot.room || null
          ]
        );
      }
    }
  }

  // 4. Class placements
  if (Number((await db.query("SELECT COUNT(*) AS count FROM course_registrations")).rows[0].count) === 0) {
    for (const registration of store.courseRegistrations || []) {
      await db.query(
        `INSERT INTO course_registrations (
          id, student_id, section_id, status, registered_at, dropped_at,
          grade, letter_grade, grade_point, credits, is_retake, exam_ban, grade_posted_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (id) DO NOTHING`,
        [
          registration.id,
          registration.studentId,
          registration.sectionId,
          registration.status,
          registration.registeredAt,
          registration.droppedAt || null,
          registration.grade || null,
          registration.letterGrade || null,
          registration.gradePoint ?? null,
          registration.credits || 0,
          Boolean(registration.isRetake),
          Boolean(registration.examBan),
          registration.gradePostedAt || null
        ]
      );
    }
  }

  // 5. Lesson progress
  if (Number((await db.query("SELECT COUNT(*) AS count FROM lesson_progress")).rows[0].count) === 0) {
    for (const p of store.lessonProgress) {
      await db.query(
        "INSERT INTO lesson_progress (id, enrollment_id, lesson_id, completed, completed_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING",
        [p.id, p.enrollmentId, p.lessonId, p.completed, p.completedAt || null]
      ).catch(() => undefined);
    }
  }

  // 6. Quizzes, questions & assignments
  if (Number((await db.query("SELECT COUNT(*) AS count FROM quizzes")).rows[0].count) === 0 || needsMegaBackfill) {
    for (const q of store.quizzes) {
      await db.query(
        "INSERT INTO quizzes (id, course_id, lesson_id, title, passing_score, time_limit, max_attempts) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING",
        [q.id, q.courseId, q.lessonId || null, q.title, q.passingScore, q.timeLimit, q.maxAttempts]
      );
    }
    for (const q of store.questions) {
      await db.query(
        "INSERT INTO questions (id, quiz_id, text, type, options_json, correct_answer) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING",
        [q.id, q.quizId, q.text, q.type, JSON.stringify(q.options || []), q.correctAnswer]
      );
    }
  }

  if (Number((await db.query("SELECT COUNT(*) AS count FROM assignments")).rows[0].count) === 0 || needsMegaBackfill) {
    for (const a of store.assignments) {
      await db.query(
        "INSERT INTO assignments (id, course_id, title, description, deadline, max_score, lesson_id, type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING",
        [a.id, a.courseId, a.title, a.description, a.deadline, a.maxScore, a.lessonId || null, a.type || null]
      );
    }
    for (const s of store.submissions) {
      await db.query(
        "INSERT INTO submissions (id, assignment_id, student_id, content, score, feedback, submitted_at, graded_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING",
        [s.id, s.assignmentId, s.studentId, s.content, s.score ?? null, s.feedback || null, s.submittedAt, s.gradedAt || null]
      ).catch(() => undefined);
    }
  }

  // 7. Sessions, materials and attendance
  if (Number((await db.query("SELECT COUNT(*) AS count FROM attendance_sessions")).rows[0].count) === 0) {
    for (const session of store.attendanceSessions || []) {
      await db.query(
        `INSERT INTO attendance_sessions (id, course_id, section_id, teacher_id, date, topic)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO NOTHING`,
        [session.id, session.courseId, session.sectionId || null, session.teacherId, session.date, session.topic]
      );
    }
  }

  if (Number((await db.query("SELECT COUNT(*) AS count FROM session_materials")).rows[0].count) === 0) {
    const firstSession = (await db.query("SELECT id, section_id, course_id FROM attendance_sessions ORDER BY id LIMIT 1")).rows[0];
    if (firstSession) {
      await db.query(
        `INSERT INTO session_materials (id, session_id, section_id, course_id, type, title, url, storage_path, file_name, mime_type, size_bytes, sort_order, created_at)
         VALUES
         ($1, $2, $3, $4, 'youtube', 'Bài giảng giới thiệu môn học (Video mẫu)', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', NULL, NULL, NULL, NULL, 0, NOW()),
         ($5, $2, $3, $4, 'link', 'Tài liệu hướng dẫn trực tuyến (Link tài liệu)', 'https://docs.mcna.edu.vn', NULL, NULL, NULL, NULL, 1, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [generateId("mat"), firstSession.id, firstSession.section_id, firstSession.course_id, generateId("mat")]
      ).catch(() => undefined);
    }
  }

  if (Number((await db.query("SELECT COUNT(*) AS count FROM attendance_records")).rows[0].count) === 0) {
    for (const record of store.attendanceRecords || []) {
      await db.query(
        `INSERT INTO attendance_records (id, session_id, student_id, status, note)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO NOTHING`,
        [record.id, record.sessionId, record.studentId, record.status, record.note || null]
      ).catch(() => undefined);
    }
  }

  // 8. Payment transactions
  if (Number((await db.query("SELECT COUNT(*) AS count FROM transactions")).rows[0].count) === 0) {
    for (const t of store.transactions || []) {
      await db.query(
        `INSERT INTO transactions (id, student_id, course_id, amount, status, payment_method, created_at, processed_at, processed_by, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
        [t.id, t.studentId, t.courseId, t.amount, t.status, t.paymentMethod, t.createdAt, t.processedAt || null, t.processedBy || null, t.notes || null]
      );
    }
  }
}

export async function seedAuthUsers(db: Queryable) {
  if (!seedDemoData()) {
    // Base accounts only: admin, teacher and a sample learner.
    if (Number((await db.query("SELECT COUNT(*) AS count FROM users")).rows[0].count) === 0) {
      await usersRepository.seed(db, getInitialStore().users);
    }
  } else {
    const studentCount = Number((await db.query("SELECT COUNT(*) AS count FROM users WHERE role = 'student'")).rows[0].count);
    const teacherCount = Number((await db.query("SELECT COUNT(*) AS count FROM users WHERE role = 'teacher'")).rows[0].count);
    if (studentCount < 300 || teacherCount < 20) {
      await usersRepository.seed(db, getSeedStore().users);
    }
  }

  // Learners created by an admin get a school mailbox; backfill the ones still missing it.
  const unprovisionedStudents = (await db.query(
    "SELECT id, name FROM users WHERE role = 'student' AND COALESCE(signup_source, 'admin') = 'admin' AND (school_email IS NULL OR email_provisioned = false)"
  )).rows;
  if (unprovisionedStudents.length === 0) return;

  console.log("[Seeding] Backfilling school emails for seeded students...");
  for (const student of unprovisionedStudents) {
    const baseUsername = generateUsername(student.name);
    let suffix = "";
    let counter = 1;
    let schoolEmail = `${baseUsername}@mcna.edu.vn`;
    while (true) {
      schoolEmail = `${baseUsername}${suffix}@mcna.edu.vn`;
      const check = await db.query(
        "SELECT 1 FROM users WHERE school_email = $1 AND id != $2",
        [schoolEmail, student.id]
      );
      if (check.rowCount === 0) {
        break;
      }
      counter++;
      suffix = String(counter);
    }
    await db.query(
      "UPDATE users SET school_email = $1, email_provisioned = true, email_provisioned_at = NOW() WHERE id = $2",
      [schoolEmail, student.id]
    );
  }
  console.log(`[Seeding] Successfully backfilled ${unprovisionedStudents.length} students.`);
}
