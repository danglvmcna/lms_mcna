import dotenv from "dotenv";
import pg from "pg";
import { getInitialStore } from "../src/store";
import { backfillMegaDemoData } from "../src/mockSeeds";
import { runMigrations } from "../src/dbMigrations";
import { hashPassword } from "../src/authHash";
import { generateUsername } from "../src/server/emailProvisioning/googleWorkspaceClient";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to seed Supabase/Postgres.");
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("supabase.co") ? { rejectUnauthorized: false } : undefined
});

const store = getInitialStore();
backfillMegaDemoData(store);

type Row = Array<string | number | boolean | number[] | null | undefined>;

async function insertBatch(
  client: pg.PoolClient,
  table: string,
  columns: string[],
  rows: Row[],
  conflict = "DO NOTHING",
  chunkSize = 200
) {
  if (rows.length === 0) return;
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const values: unknown[] = [];
    const placeholders = chunk.map((row, rowIndex) => {
      const params = row.map((value, colIndex) => {
        values.push(value ?? null);
        return `$${rowIndex * columns.length + colIndex + 1}`;
      });
      return `(${params.join(",")})`;
    });
    await client.query(
      `INSERT INTO ${table} (${columns.join(",")}) VALUES ${placeholders.join(",")} ON CONFLICT ${conflict}`,
      values
    );
  }
}

async function main() {
  await runMigrations(pool);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    console.log("[Seeding] Truncating existing mock data to ensure clean seed...");
    await client.query("DELETE FROM notifications");
    await client.query("DELETE FROM audit_logs");
    await client.query("DELETE FROM payment_webhook_events");
    await client.query("DELETE FROM password_reset_tokens");
    await client.query("DELETE FROM system_events");
    await client.query("DELETE FROM grades");
    await client.query("DELETE FROM certificates");
    await client.query("DELETE FROM graduation_applications");
    await client.query("DELETE FROM leave_requests");
    await client.query("DELETE FROM grade_appeals");
    await client.query("DELETE FROM scholarship_applications");
    await client.query("DELETE FROM forum_replies");
    await client.query("DELETE FROM forum_posts");
    await client.query("DELETE FROM teacher_attendance");
    await client.query("DELETE FROM attendance_records");
    await client.query("DELETE FROM attendance_sessions");
    await client.query("DELETE FROM course_registrations");
    await client.query("DELETE FROM section_schedules");
    await client.query("DELETE FROM course_sections");
    await client.query("DELETE FROM lesson_progress");
    await client.query("DELETE FROM enrollments");
    await client.query("DELETE FROM quiz_attempts");
    await client.query("DELETE FROM submissions");
    await client.query("DELETE FROM tuition_fees");
    await client.query("DELETE FROM transactions");
    await client.query("DELETE FROM academic_warnings");
    await client.query("DELETE FROM advisor_assignments");
    await client.query("DELETE FROM advisor_notes");
    await client.query("DELETE FROM parent_links");
    await client.query("DELETE FROM student_profiles");
    await client.query("DELETE FROM questions");
    await client.query("DELETE FROM quizzes");
    await client.query("DELETE FROM assignments");
    await client.query("DELETE FROM lessons");
    await client.query("DELETE FROM courses");
    await client.query("DELETE FROM scholarships");
    await client.query("DELETE FROM registration_periods");
    await client.query("DELETE FROM semesters");
    await client.query("DELETE FROM academic_years");
    await client.query(
      `DELETE FROM users WHERE id NOT IN (
        'user_admin', 'user_teacher', 'user_student', 'user_finance', 
        'user_le_tan', 'user_academic', 'user_advisor'
      )`
    );

    await insertBatch(
      client,
      "users",
      ["id", "email", "password_hash", "password_salt", "name", "role", "is_active", "phone", "linked_student_id", "created_at"],
      store.users.map(u => [u.id, u.email.toLowerCase(), u.passwordHash, u.passwordSalt || null, u.name, u.role, u.isActive ? 1 : 0, u.phone || null, u.linkedStudentId || null, u.createdAt]),
      `(id) DO UPDATE SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash, password_salt = EXCLUDED.password_salt, name = EXCLUDED.name, role = EXCLUDED.role, is_active = EXCLUDED.is_active, phone = EXCLUDED.phone, linked_student_id = EXCLUDED.linked_student_id`
    );

    await insertBatch(
      client,
      "academic_years",
      ["id", "name", "start_date", "end_date", "is_current"],
      store.academicYears.map(y => [y.id, y.name, y.startDate, y.endDate, y.isCurrent ? 1 : 0]),
      `(id) DO UPDATE SET name = EXCLUDED.name, start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, is_current = EXCLUDED.is_current`
    );

    await insertBatch(
      client,
      "semesters",
      ["id", "academic_year_id", "name", "type", "start_date", "end_date", "registration_open", "registration_close", "is_current"],
      store.semesters.map(s => [s.id, s.academicYearId, s.name, s.type, s.startDate, s.endDate, s.registrationOpen, s.registrationClose, s.isCurrent ? 1 : 0]),
      `(id) DO UPDATE SET academic_year_id = EXCLUDED.academic_year_id, name = EXCLUDED.name, type = EXCLUDED.type, start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, registration_open = EXCLUDED.registration_open, registration_close = EXCLUDED.registration_close, is_current = EXCLUDED.is_current`
    );

    await insertBatch(
      client,
      "courses",
      ["id", "title", "description", "teacher_id", "status", "category", "thumbnail", "price", "level", "tags_json", "rejection_reason", "created_at"],
      store.courses.map(c => [c.id, c.title, c.description, c.teacherId, c.status, c.category, c.thumbnail || null, c.price || 0, c.level || null, JSON.stringify(c.tags || []), c.rejectionReason || null, c.createdAt]),
      `(id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, teacher_id = EXCLUDED.teacher_id, status = EXCLUDED.status, category = EXCLUDED.category, thumbnail = EXCLUDED.thumbnail, price = EXCLUDED.price, level = EXCLUDED.level, tags_json = EXCLUDED.tags_json, rejection_reason = EXCLUDED.rejection_reason, created_at = EXCLUDED.created_at`
    );

    await insertBatch(
      client,
      "lessons",
      ["id", "course_id", "title", "content", "video_url", "lesson_order", "duration"],
      store.lessons.map(l => [l.id, l.courseId, l.title, l.content, l.videoUrl || null, l.order, l.duration]),
      `(id) DO UPDATE SET course_id = EXCLUDED.course_id, title = EXCLUDED.title, content = EXCLUDED.content, video_url = EXCLUDED.video_url, lesson_order = EXCLUDED.lesson_order, duration = EXCLUDED.duration`
    );

    await insertBatch(
      client,
      "enrollments",
      ["id", "course_id", "student_id", "status", "enrolled_at", "completed_at"],
      store.enrollments.map(e => [e.id, e.courseId, e.studentId, e.status, e.enrolledAt, e.completedAt || null]),
      `(student_id, course_id) DO UPDATE SET status = EXCLUDED.status, enrolled_at = EXCLUDED.enrolled_at, completed_at = EXCLUDED.completed_at`
    );

    const lessonIds = new Set(store.lessons.map(l => l.id));
    const enrollmentIds = new Set(store.enrollments.map(e => e.id));
    await insertBatch(
      client,
      "lesson_progress",
      ["id", "enrollment_id", "lesson_id", "completed", "completed_at"],
      store.lessonProgress
        .filter(p => enrollmentIds.has(p.enrollmentId) && lessonIds.has(p.lessonId))
        .map(p => [p.id, p.enrollmentId, p.lessonId, p.completed ? 1 : 0, p.completedAt || null]),
      `(enrollment_id, lesson_id) DO UPDATE SET completed = EXCLUDED.completed, completed_at = EXCLUDED.completed_at`
    );

    await insertBatch(
      client,
      "quizzes",
      ["id", "course_id", "lesson_id", "title", "passing_score", "time_limit", "max_attempts"],
      store.quizzes.map(q => [q.id, q.courseId, q.lessonId || null, q.title, q.passingScore, q.timeLimit, q.maxAttempts]),
      `(id) DO UPDATE SET course_id = EXCLUDED.course_id, lesson_id = EXCLUDED.lesson_id, title = EXCLUDED.title, passing_score = EXCLUDED.passing_score, time_limit = EXCLUDED.time_limit, max_attempts = EXCLUDED.max_attempts`
    );

    await insertBatch(
      client,
      "questions",
      ["id", "quiz_id", "text", "type", "options_json", "correct_answer"],
      store.questions.map(q => [q.id, q.quizId, q.text, q.type, JSON.stringify(q.options || []), q.correctAnswer]),
      `(id) DO UPDATE SET quiz_id = EXCLUDED.quiz_id, text = EXCLUDED.text, type = EXCLUDED.type, options_json = EXCLUDED.options_json, correct_answer = EXCLUDED.correct_answer`
    );

    await insertBatch(
      client,
      "quiz_attempts",
      ["id", "quiz_id", "student_id", "answers_json", "score", "passed", "started_at", "submitted_at"],
      store.quizAttempts
        .filter(a => store.quizzes.some(q => q.id === a.quizId))
        .map(a => [a.id, a.quizId, a.studentId, JSON.stringify(a.answers || {}), a.score, a.passed ? 1 : 0, a.startedAt, a.submittedAt]),
      `(id) DO UPDATE SET quiz_id = EXCLUDED.quiz_id, student_id = EXCLUDED.student_id, answers_json = EXCLUDED.answers_json, score = EXCLUDED.score, passed = EXCLUDED.passed, started_at = EXCLUDED.started_at, submitted_at = EXCLUDED.submitted_at`
    );

    await insertBatch(
      client,
      "assignments",
      ["id", "course_id", "title", "description", "deadline", "max_score"],
      store.assignments.map(a => [a.id, a.courseId, a.title, a.description, a.deadline, a.maxScore]),
      `(id) DO UPDATE SET course_id = EXCLUDED.course_id, title = EXCLUDED.title, description = EXCLUDED.description, deadline = EXCLUDED.deadline, max_score = EXCLUDED.max_score`
    );

    await insertBatch(
      client,
      "submissions",
      ["id", "assignment_id", "student_id", "content", "score", "feedback", "submitted_at", "graded_at"],
      store.submissions.map(s => [s.id, s.assignmentId, s.studentId, s.content, s.score ?? null, s.feedback || null, s.submittedAt, s.gradedAt || null]),
      `(id) DO UPDATE SET assignment_id = EXCLUDED.assignment_id, student_id = EXCLUDED.student_id, content = EXCLUDED.content, score = EXCLUDED.score, feedback = EXCLUDED.feedback, submitted_at = EXCLUDED.submitted_at, graded_at = EXCLUDED.graded_at`
    );

    await insertBatch(
      client,
      "tuition_fees",
      ["id", "student_id", "semester_id", "amount", "due_date", "status", "paid_amount", "paid_at", "receipt_code"],
      store.tuitionFees.map(f => [f.id, f.studentId, f.semesterId || null, f.amount, f.dueDate, f.status, f.paidAmount, f.paidAt || null, f.receiptCode || null]),
      `(id) DO UPDATE SET student_id = EXCLUDED.student_id, semester_id = EXCLUDED.semester_id, amount = EXCLUDED.amount, due_date = EXCLUDED.due_date, status = EXCLUDED.status, paid_amount = EXCLUDED.paid_amount, paid_at = EXCLUDED.paid_at, receipt_code = EXCLUDED.receipt_code`
    );

    await insertBatch(
      client,
      "academic_warnings",
      ["id", "student_id", "type", "message", "is_resolved", "created_at"],
      store.academicWarnings.map(w => [w.id, w.studentId, w.type, w.message, w.isResolved ? 1 : 0, w.createdAt]),
      `(id) DO UPDATE SET student_id = EXCLUDED.student_id, type = EXCLUDED.type, message = EXCLUDED.message, is_resolved = EXCLUDED.is_resolved, created_at = EXCLUDED.created_at`
    );

    await insertBatch(
      client,
      "transactions",
      ["id", "student_id", "course_id", "amount", "status", "payment_method", "created_at", "processed_at", "processed_by", "notes"],
      (store.transactions || []).map(t => [t.id, t.studentId, t.courseId, t.amount, t.status, t.paymentMethod, t.createdAt, t.processedAt || null, t.processedBy || null, t.notes || null]),
      `(id) DO UPDATE SET student_id = EXCLUDED.student_id, course_id = EXCLUDED.course_id, amount = EXCLUDED.amount, status = EXCLUDED.status, payment_method = EXCLUDED.payment_method, created_at = EXCLUDED.created_at, processed_at = EXCLUDED.processed_at, processed_by = EXCLUDED.processed_by, notes = EXCLUDED.notes`
    );

    await insertBatch(
      client,
      "student_profiles",
      ["id", "user_id", "student_code", "program_id", "department_id", "academic_year", "enrollment_date", "expected_graduation", "status", "gpa", "total_credits_earned", "address", "phone", "date_of_birth", "gender", "notes"],
      (store.studentProfiles || []).map(p => [p.id, p.userId, p.studentCode, p.programId, p.departmentId, p.academicYear, p.enrollmentDate, p.expectedGraduation, p.status, p.gpa, p.totalCreditsEarned, p.address || null, p.phone || null, p.dateOfBirth || null, p.gender || null, p.notes || null]),
      `(id) DO UPDATE SET user_id = EXCLUDED.user_id, student_code = EXCLUDED.student_code, program_id = EXCLUDED.program_id, department_id = EXCLUDED.department_id, academic_year = EXCLUDED.academic_year, enrollment_date = EXCLUDED.enrollment_date, expected_graduation = EXCLUDED.expected_graduation, status = EXCLUDED.status, gpa = EXCLUDED.gpa, total_credits_earned = EXCLUDED.total_credits_earned, address = EXCLUDED.address, phone = EXCLUDED.phone, date_of_birth = EXCLUDED.date_of_birth, gender = EXCLUDED.gender, notes = EXCLUDED.notes`
    );

    await insertBatch(
      client,
      "course_sections",
      ["id", "course_id", "semester_id", "teacher_id", "section_code", "max_students", "schedule", "status"],
      (store.courseSections || []).map(section => [
        section.id,
        section.courseId,
        section.semesterId,
        section.teacherId,
        section.sectionCode,
        section.maxStudents,
        JSON.stringify(section.schedule || []),
        section.status
      ]),
      `(id) DO UPDATE SET course_id = EXCLUDED.course_id, semester_id = EXCLUDED.semester_id, teacher_id = EXCLUDED.teacher_id, section_code = EXCLUDED.section_code, max_students = EXCLUDED.max_students, schedule = EXCLUDED.schedule, status = EXCLUDED.status`
    );

    const fallbackDays = [2, 4, 3, 6];
    const sectionScheduleRows: any[] = [];
    for (const section of store.courseSections || []) {
      for (const [index, slot] of (section.schedule || []).entries()) {
        sectionScheduleRows.push([
          `sched_${section.id}_${index}`,
          section.id,
          fallbackDays[index % fallbackDays.length],
          slot.startTime,
          slot.endTime,
          slot.room || null
        ]);
      }
    }
    
    await insertBatch(
      client,
      "section_schedules",
      ["id", "section_id", "day_of_week", "start_time", "end_time", "room"],
      sectionScheduleRows,
      `(id) DO UPDATE SET section_id = EXCLUDED.section_id, day_of_week = EXCLUDED.day_of_week, start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, room = EXCLUDED.room`
    );

    await insertBatch(
      client,
      "course_registrations",
      ["id", "student_id", "section_id", "semester_id", "status", "registered_at", "dropped_at", "grade", "letter_grade", "grade_point", "credits", "is_retake", "exam_ban", "grade_posted_at"],
      (store.courseRegistrations || []).map(r => [
        r.id, r.studentId, r.sectionId, r.semesterId, r.status, r.registeredAt, r.droppedAt || null,
        r.grade || null, r.letterGrade || null, r.gradePoint ?? null, r.credits, r.isRetake ? 1 : 0, r.examBan ? 1 : 0, r.gradePostedAt || null
      ]),
      `(id) DO UPDATE SET status = EXCLUDED.status, dropped_at = EXCLUDED.dropped_at, grade = EXCLUDED.grade, letter_grade = EXCLUDED.letter_grade, grade_point = EXCLUDED.grade_point, exam_ban = EXCLUDED.exam_ban, grade_posted_at = EXCLUDED.grade_posted_at`
    );

    await insertBatch(
      client,
      "registration_periods",
      ["id", "semester_id", "name", "start_date", "end_date", "allowed_years", "is_open"],
      (store.registrationPeriods || []).map(rp => [
        rp.id, rp.semesterId, rp.name, rp.startDate, rp.endDate, rp.allowedYears || [1, 2, 3, 4], rp.isOpen
      ]),
      `(id) DO UPDATE SET end_date = EXCLUDED.end_date, is_open = EXCLUDED.is_open, allowed_years = EXCLUDED.allowed_years`
    );

    await insertBatch(
      client,
      "advisor_assignments",
      ["id", "advisor_id", "student_id", "semester_id", "assigned_at"],
      (store.advisorAssignments || []).map(aa => [aa.id, aa.advisorId, aa.studentId, aa.semesterId || null, aa.assignedAt]),
      `(id) DO UPDATE SET advisor_id = EXCLUDED.advisor_id, student_id = EXCLUDED.student_id, semester_id = EXCLUDED.semester_id, assigned_at = EXCLUDED.assigned_at`
    );

    await insertBatch(
      client,
      "attendance_sessions",
      ["id", "course_id", "semester_id", "teacher_id", "session_date", "date", "topic"],
      (store.attendanceSessions || []).map(session => [session.id, session.courseId, session.semesterId, session.teacherId, session.date, session.date, session.topic]),
      `(id) DO UPDATE SET course_id = EXCLUDED.course_id, semester_id = EXCLUDED.semester_id, teacher_id = EXCLUDED.teacher_id, session_date = EXCLUDED.session_date, date = EXCLUDED.date, topic = EXCLUDED.topic`
    );

    await insertBatch(
      client,
      "attendance_records",
      ["id", "session_id", "student_id", "status", "note"],
      (store.attendanceRecords || []).map(record => [record.id, record.sessionId, record.studentId, record.status, record.note || null]),
      `(id) DO UPDATE SET session_id = EXCLUDED.session_id, student_id = EXCLUDED.student_id, status = EXCLUDED.status, note = EXCLUDED.note`
    );

    await insertBatch(
      client,
      "scholarships",
      ["id", "name", "type", "amount", "discount_percent", "semester_id", "conditions"],
      (store.scholarships || []).map(s => [s.id, s.name, s.type, s.amount ?? null, s.discountPercent ?? null, s.semesterId || null, s.conditions || null]),
      `(id) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, amount = EXCLUDED.amount, discount_percent = EXCLUDED.discount_percent, semester_id = EXCLUDED.semester_id, conditions = EXCLUDED.conditions`
    );

    await insertBatch(
      client,
      "advisor_notes",
      ["id", "advisor_id", "student_id", "content", "type", "created_at"],
      (store.advisorNotes || []).map(n => [n.id, n.advisorId, n.studentId, n.content, n.type, n.createdAt]),
      `(id) DO UPDATE SET advisor_id = EXCLUDED.advisor_id, student_id = EXCLUDED.student_id, content = EXCLUDED.content, type = EXCLUDED.type, created_at = EXCLUDED.created_at`
    );

    // Backfill school email for all student users in DB during seeding to satisfy new requirements
    console.log("[Seeding] Backfilling school emails for seeded students...");
    const unprovisionedStudents = (await client.query(
      "SELECT id, name FROM users WHERE role = 'student' AND (school_email IS NULL OR email_provisioned = false)"
    )).rows;

    for (const student of unprovisionedStudents) {
      const baseUsername = generateUsername(student.name);
      let suffix = "";
      let counter = 1;
      let schoolEmail = `${baseUsername}@mcna.edu.vn`;
      while (true) {
        schoolEmail = `${baseUsername}${suffix}@mcna.edu.vn`;
        const check = await client.query(
          "SELECT 1 FROM users WHERE school_email = $1 AND id != $2",
          [schoolEmail, student.id]
        );
        if (check.rowCount === 0) {
          break;
        }
        counter++;
        suffix = String(counter);
      }
      await client.query(
        "UPDATE users SET school_email = $1, email_provisioned = true, email_provisioned_at = NOW() WHERE id = $2",
        [schoolEmail, student.id]
      );
    }
    console.log(`[Seeding] Successfully backfilled ${unprovisionedStudents.length} students.`);

    console.log("[Seeding] Seeding initial notifications...");
    await insertBatch(
      client,
      "notifications",
      ["id", "user_id", "type", "message", "is_read", "created_at"],
      (store.notifications || []).map(note => [
        note.id, note.userId, note.type, note.message, Boolean(note.isRead), note.createdAt
      ]),
      `(id) DO UPDATE SET user_id = EXCLUDED.user_id, type = EXCLUDED.type, message = EXCLUDED.message, is_read = EXCLUDED.is_read, created_at = EXCLUDED.created_at`
    );

    await client.query("COMMIT");
    console.log(`Seeded Postgres database with ${store.users.filter(u => u.role === "student").length} students and ${store.courses.length} courses.`);
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
