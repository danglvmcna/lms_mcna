import { getInitialStore } from "../store";
import { backfillMegaDemoData } from "../mockSeeds";
import { Queryable } from "./db";
import { usersRepository } from "./repositories/users";
import { hashPassword } from "../authHash";
import { generateId } from "./ids";
import { generateUsername } from "./emailProvisioning/googleWorkspaceClient";

async function cleanupParentSeedData(db: Queryable) {
  await db.query("SELECT 1");
}

function getBackfilledSeedStore() {
  const store = getInitialStore();
  backfillMegaDemoData(store);
  store.studentProfiles = (store.studentProfiles || []).map(profile => ({
    ...profile,
    guardianName: undefined,
    guardianPhone: undefined,
    guardianEmail: undefined
  }));
  return store;
}

export async function seedCoreLearningData(db: Queryable) {
  const store = getBackfilledSeedStore();
  await cleanupParentSeedData(db);
  const initialCourseCount = Number((await db.query("SELECT COUNT(*) AS count FROM courses")).rows[0].count);
  const initialProfileCount = Number((await db.query("SELECT COUNT(*) AS count FROM student_profiles")).rows[0].count);
  const needsMegaBackfill = initialCourseCount < 40 || initialProfileCount < 300;

  // 1. Seed Academic Years & Semesters
  for (const y of store.academicYears) {
    await db.query(
      `INSERT INTO academic_years (id, name, start_date, end_date, is_current)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         start_date = EXCLUDED.start_date,
         end_date = EXCLUDED.end_date,
         is_current = EXCLUDED.is_current`,
      [y.id, y.name, y.startDate, y.endDate, y.isCurrent]
    );
  }

  for (const s of store.semesters) {
    await db.query(
      `INSERT INTO semesters (id, academic_year_id, name, type, start_date, end_date, registration_open, registration_close, is_current)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET
         academic_year_id = EXCLUDED.academic_year_id,
         name = EXCLUDED.name,
         type = EXCLUDED.type,
         start_date = EXCLUDED.start_date,
         end_date = EXCLUDED.end_date,
         registration_open = EXCLUDED.registration_open,
         registration_close = EXCLUDED.registration_close,
         is_current = EXCLUDED.is_current`,
      [s.id, s.academicYearId, s.name, s.type, s.startDate, s.endDate, s.registrationOpen, s.registrationClose, Boolean(s.isCurrent)]
    );
  }

  // 2. Seed Departments & Programs
  if (Number((await db.query("SELECT COUNT(*) AS count FROM departments")).rows[0].count) === 0) {
    for (const d of store.departments) {
      await db.query(
        "INSERT INTO departments (id, name, code, head_teacher_id, description) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING",
        [d.id, d.name, d.code, d.headTeacherId || null, d.description || null]
      );
    }
  }

  if (Number((await db.query("SELECT COUNT(*) AS count FROM programs")).rows[0].count) === 0) {
    for (const p of store.programs) {
      await db.query(
        "INSERT INTO programs (id, department_id, name, code, type, total_credits, description) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING",
        [p.id, p.departmentId, p.name, p.code, p.type, p.totalCredits, p.description || null]
      );
    }
  }

  // 3. Seed Courses & Lessons
  if (Number((await db.query("SELECT COUNT(*) AS count FROM courses")).rows[0].count) === 0) {
    for (const c of store.courses) {
      await db.query(
        `INSERT INTO courses (id, title, description, teacher_id, status, category, thumbnail, price, level, tags_json, rejection_reason, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`,
        [c.id, c.title, c.description, c.teacherId, c.status, c.category, c.thumbnail || null, c.price || 0, c.level || null, JSON.stringify(c.tags || []), c.rejectionReason || null, c.createdAt]
      );
    }
  }
  if (needsMegaBackfill) {
    for (const c of store.courses) {
      await db.query(
        `INSERT INTO courses (id, title, description, teacher_id, status, category, thumbnail, price, level, tags_json, rejection_reason, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`,
        [c.id, c.title, c.description, c.teacherId, c.status, c.category, c.thumbnail || null, c.price || 0, c.level || null, JSON.stringify(c.tags || []), c.rejectionReason || null, c.createdAt]
      );
    }
  }

  if (Number((await db.query("SELECT COUNT(*) AS count FROM lessons")).rows[0].count) === 0) {
    for (const l of store.lessons) {
      await db.query(
        "INSERT INTO lessons (id, course_id, title, content, video_url, lesson_order, duration) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING",
        [l.id, l.courseId, l.title, l.content, l.videoUrl || null, l.order, l.duration]
      );
    }
  }
  if (needsMegaBackfill) {
    for (const l of store.lessons) {
      await db.query(
        "INSERT INTO lessons (id, course_id, title, content, video_url, lesson_order, duration) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING",
        [l.id, l.courseId, l.title, l.content, l.videoUrl || null, l.order, l.duration]
      );
    }
  }

  // 4. Seed Program Courses Curriculum
  if (Number((await db.query("SELECT COUNT(*) AS count FROM program_courses")).rows[0].count) === 0) {
    for (const pc of store.programCourses) {
      await db.query(
        "INSERT INTO program_courses (id, program_id, course_id, credits, is_required, semester) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING",
        [pc.id, pc.programId, pc.courseId, pc.credits, pc.isRequired, pc.semester]
      );
    }
  }

  // 5. Seed Student Profiles & Enrollments
  if (Number((await db.query("SELECT COUNT(*) AS count FROM student_profiles")).rows[0].count) === 0) {
    for (const p of store.studentProfiles) {
      await db.query(
        `INSERT INTO student_profiles (
          id, user_id, student_code, program_id, department_id, academic_year, enrollment_date,
          expected_graduation, status, gpa, total_credits_earned, address, phone, date_of_birth,
          gender, guardian_name, guardian_phone, guardian_email, notes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) ON CONFLICT (id) DO NOTHING`,
        [
          p.id, p.userId, p.studentCode, p.programId, p.departmentId, p.academicYear, p.enrollmentDate,
          p.expectedGraduation, p.status, p.gpa, p.totalCreditsEarned, p.address || null, p.phone || null,
          p.dateOfBirth || null, p.gender || null, p.guardianName || null, p.guardianPhone || null,
          p.guardianEmail || null, p.notes || null
        ]
      );
    }
  }
  if (needsMegaBackfill) {
    for (const p of store.studentProfiles) {
      await db.query(
        `INSERT INTO student_profiles (
          id, user_id, student_code, program_id, department_id, academic_year, enrollment_date,
          expected_graduation, status, gpa, total_credits_earned, address, phone, date_of_birth,
          gender, guardian_name, guardian_phone, guardian_email, notes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) ON CONFLICT (id) DO NOTHING`,
        [
          p.id, p.userId, p.studentCode, p.programId, p.departmentId, p.academicYear, p.enrollmentDate,
          p.expectedGraduation, p.status, p.gpa, p.totalCreditsEarned, p.address || null, p.phone || null,
          p.dateOfBirth || null, p.gender || null, null, null, null, p.notes || null
        ]
      );
    }
  }

  if (Number((await db.query("SELECT COUNT(*) AS count FROM enrollments")).rows[0].count) === 0) {
    for (const e of store.enrollments) {
      await db.query(
        "INSERT INTO enrollments (id, course_id, student_id, status, enrolled_at, completed_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING",
        [e.id, e.courseId, e.studentId, e.status, e.enrolledAt, e.completedAt || null]
      );
    }
  }

  // Seed SIS section data used by course registration workflows.
  if (Number((await db.query("SELECT COUNT(*) AS count FROM course_sections")).rows[0].count) === 0) {
    for (const section of store.courseSections || []) {
      await db.query(
        `INSERT INTO course_sections (id, course_id, semester_id, teacher_id, section_code, max_students, schedule, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
         ON CONFLICT (id) DO NOTHING`,
        [
          section.id,
          section.courseId,
          section.semesterId,
          section.teacherId,
          section.sectionCode,
          section.maxStudents,
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

  for (const period of store.registrationPeriods || []) {
    await db.query(
      `INSERT INTO registration_periods (id, semester_id, name, start_date, end_date, allowed_years, is_open)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET
         end_date = EXCLUDED.end_date,
         is_open = EXCLUDED.is_open,
         allowed_years = EXCLUDED.allowed_years`,
      [
        period.id,
        period.semesterId,
        period.name,
        period.startDate,
        period.endDate,
        period.allowedYears || [1, 2, 3, 4],
        period.isOpen
      ]
    );
  }

  if (Number((await db.query("SELECT COUNT(*) AS count FROM course_registrations")).rows[0].count) === 0) {
    for (const registration of store.courseRegistrations || []) {
      await db.query(
        `INSERT INTO course_registrations (
          id, student_id, section_id, semester_id, status, registered_at, dropped_at,
          grade, letter_grade, grade_point, credits, is_retake, exam_ban, grade_posted_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        ON CONFLICT (id) DO NOTHING`,
        [
          registration.id,
          registration.studentId,
          registration.sectionId,
          registration.semesterId,
          registration.status,
          registration.registeredAt,
          registration.droppedAt || null,
          registration.grade || null,
          registration.letterGrade || null,
          registration.gradePoint ?? null,
          registration.credits,
          Boolean(registration.isRetake),
          Boolean(registration.examBan),
          registration.gradePostedAt || null
        ]
      );
    }
  }

  // 6. Seed Lesson Progress
  if (Number((await db.query("SELECT COUNT(*) AS count FROM lesson_progress")).rows[0].count) === 0) {
    for (const p of store.lessonProgress) {
      await db.query(
        "INSERT INTO lesson_progress (id, enrollment_id, lesson_id, completed, completed_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING",
        [p.id, p.enrollmentId, p.lessonId, p.completed, p.completedAt || null]
      ).catch(() => undefined);
    }
  }

  // 7. Seed Quizzes, Questions & Assignments
  if (Number((await db.query("SELECT COUNT(*) AS count FROM quizzes")).rows[0].count) === 0) {
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
  if (needsMegaBackfill) {
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

  if (Number((await db.query("SELECT COUNT(*) AS count FROM assignments")).rows[0].count) === 0) {
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
      );
    }
  }
  if (needsMegaBackfill) {
    for (const a of store.assignments) {
      await db.query(
        "INSERT INTO assignments (id, course_id, title, description, deadline, max_score, lesson_id, type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING",
        [a.id, a.courseId, a.title, a.description, a.deadline, a.maxScore, a.lessonId || null, a.type || null]
      );
    }
  }

  // 8. Seed Tuition Fees
  if (Number((await db.query("SELECT COUNT(*) AS count FROM tuition_fees")).rows[0].count) === 0) {
    for (const f of store.tuitionFees) {
      await db.query(
        "INSERT INTO tuition_fees (id, student_id, semester_id, amount, due_date, status, paid_amount, paid_at, receipt_code) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING",
        [f.id, f.studentId, f.semesterId || null, f.amount, f.dueDate, f.status, f.paidAmount, f.paidAt || null, f.receiptCode || null]
      );
    }
  }

  if (Number((await db.query("SELECT COUNT(*) AS count FROM scholarships")).rows[0].count) === 0) {
    for (const scholarship of store.scholarships || []) {
      await db.query(
        `INSERT INTO scholarships (id, name, type, amount, discount_percent, semester_id, conditions)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO NOTHING`,
        [
          scholarship.id,
          scholarship.name,
          scholarship.type,
          scholarship.amount ?? null,
          scholarship.discountPercent ?? null,
          scholarship.semesterId || null,
          scholarship.conditions || null
        ]
      );
    }
  }

  if (Number((await db.query("SELECT COUNT(*) AS count FROM attendance_sessions")).rows[0].count) === 0) {
    for (const session of store.attendanceSessions || []) {
      await db.query(
        `INSERT INTO attendance_sessions (id, course_id, semester_id, teacher_id, date, topic)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO NOTHING`,
        [session.id, session.courseId, session.semesterId, session.teacherId, session.date, session.topic]
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

  if (Number((await db.query("SELECT COUNT(*) AS count FROM advisor_assignments")).rows[0].count) === 0) {
    for (const assignment of store.advisorAssignments || []) {
      await db.query(
        `INSERT INTO advisor_assignments (id, advisor_id, student_id, semester_id, assigned_at)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO NOTHING`,
        [assignment.id, assignment.advisorId, assignment.studentId, assignment.semesterId || null, assignment.assignedAt]
      );
    }
  }

  // 9. Seed Academic Warnings & Advisor Notes
  if (Number((await db.query("SELECT COUNT(*) AS count FROM academic_warnings")).rows[0].count) === 0) {
    for (const w of store.academicWarnings) {
      await db.query(
        "INSERT INTO academic_warnings (id, student_id, type, message, is_resolved, created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING",
        [w.id, w.studentId, w.type, w.message, w.isResolved, w.createdAt]
      );
    }
  }

  if (Number((await db.query("SELECT COUNT(*) AS count FROM advisor_notes")).rows[0].count) === 0) {
    for (const n of store.advisorNotes || []) {
      await db.query(
        "INSERT INTO advisor_notes (id, advisor_id, student_id, content, type, created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING",
        [n.id, n.advisorId, n.studentId, n.content, n.type, n.createdAt]
      );
    }
  }

  // 10. Seed Transactions
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
  await cleanupParentSeedData(db);

  const studentCount = Number((await db.query("SELECT COUNT(*) AS count FROM users WHERE role = 'student'")).rows[0].count);
  const teacherCount = Number((await db.query("SELECT COUNT(*) AS count FROM users WHERE role = 'teacher'")).rows[0].count);
  if (studentCount < 300 || teacherCount < 20) {
    await usersRepository.seed(db, getBackfilledSeedStore().users);
  }

  // Backfill school email for all student users in DB during seeding to satisfy new requirements
  console.log("[Seeding] Backfilling school emails for seeded students...");
  const unprovisionedStudents = (await db.query(
    "SELECT id, name FROM users WHERE role = 'student' AND (school_email IS NULL OR email_provisioned = false)"
  )).rows;

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
