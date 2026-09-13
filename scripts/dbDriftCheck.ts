import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to check schema drift.");
}

const expected: Record<string, string[]> = {
  users: ["id", "email", "password_hash", "password_salt", "name", "role", "is_active", "phone", "linked_student_id", "created_at", "must_change_password", "signup_source", "crm_contact_id"],
  courses: ["id", "title", "description", "teacher_id", "status", "category", "thumbnail", "price", "level", "tags_json", "rejection_reason", "created_at"],
  lessons: ["id", "course_id", "title", "content", "video_url", "lesson_order", "duration"],
  enrollments: ["id", "course_id", "student_id", "status", "enrolled_at", "completed_at", "requested_section_id", "crm_deal_id"],
  session_materials: ["id", "session_id", "section_id", "course_id", "type", "title", "url", "storage_path", "file_name", "mime_type", "size_bytes", "sort_order", "created_by", "created_at"],
  crm_outbox: ["id", "event_type", "payload", "status", "attempts", "next_attempt_at", "last_error", "created_at", "sent_at"],
  crm_inbound_events: ["event_id", "type", "payload_sha256", "status", "response", "error", "received_at", "processed_at"],
  lesson_progress: ["id", "enrollment_id", "lesson_id", "completed", "completed_at"],
  quizzes: ["id", "course_id", "lesson_id", "title", "passing_score", "time_limit", "max_attempts"],
  questions: ["id", "quiz_id", "text", "type", "options_json", "correct_answer"],
  quiz_attempts: ["id", "quiz_id", "student_id", "answers_json", "score", "passed", "started_at", "submitted_at"],
  assignments: ["id", "course_id", "title", "description", "deadline", "max_score"],
  submissions: ["id", "assignment_id", "student_id", "content", "score", "feedback", "submitted_at", "graded_at"],
  tuition_fees: ["id", "student_id", "semester_id", "amount", "due_date", "status", "paid_amount", "paid_at", "receipt_code"],
  academic_warnings: ["id", "student_id", "type", "message", "is_resolved", "created_at"],
  audit_logs: ["id", "user_id", "action", "target", "detail", "created_at"],
  advisor_notes: ["id", "advisor_id", "student_id", "content", "type", "created_at"],
  schema_migrations: ["version", "name", "applied_at"]
};

const forbidden: Record<string, string[]> = {
  courses: ["tags"],
  quiz_attempts: ["answers"]
};

const requiredIndexes = [
  "idx_users_email_lower",
  "idx_courses_teacher_id",
  "idx_enrollments_student_id",
  "idx_quiz_attempts_student_id",
  "idx_submissions_student_id",
  "idx_tuition_fees_student_id",
  "idx_audit_logs_user_id",
  "idx_advisor_notes_student_id",
  "ux_enrollments_student_course",
  "ux_lesson_progress_enrollment_lesson",
  "idx_session_materials_session_id",
  "ux_users_crm_contact_id",
  "idx_crm_outbox_pending"
];

const requiredForeignKeys = [
  "courses_teacher_id_fkey",
  "lessons_course_id_fkey",
  "enrollments_course_id_fkey",
  "enrollments_student_id_fkey",
  "lesson_progress_enrollment_id_fkey",
  "lesson_progress_lesson_id_fkey",
  "quizzes_course_id_fkey",
  "questions_quiz_id_fkey",
  "quiz_attempts_quiz_id_fkey",
  "quiz_attempts_student_id_fkey",
  "assignments_course_id_fkey",
  "submissions_assignment_id_fkey",
  "submissions_student_id_fkey",
  "tuition_fees_student_id_fkey",
  "academic_warnings_student_id_fkey",
  "audit_logs_user_id_fkey",
  "advisor_notes_student_id_fkey",
  "session_materials_session_id_fkey",
  "enrollments_requested_section_id_fkey"
];

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("supabase.co") ? { rejectUnauthorized: false } : undefined
});

const problems: string[] = [];

try {
  const columns = await pool.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
  `);

  const byTable = new Map<string, Set<string>>();
  for (const row of columns.rows) {
    if (!byTable.has(row.table_name)) byTable.set(row.table_name, new Set());
    byTable.get(row.table_name)!.add(row.column_name);
  }

  for (const [table, expectedColumns] of Object.entries(expected)) {
    const actual = byTable.get(table);
    if (!actual) {
      problems.push(`Missing table: ${table}`);
      continue;
    }
    for (const column of expectedColumns) {
      if (!actual.has(column)) problems.push(`Missing column: ${table}.${column}`);
    }
  }

  for (const [table, columnsToReject] of Object.entries(forbidden)) {
    const actual = byTable.get(table);
    if (!actual) continue;
    for (const column of columnsToReject) {
      if (actual.has(column)) problems.push(`Legacy column still exists: ${table}.${column}`);
    }
  }

  const indexes = await pool.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
  `);
  const actualIndexes = new Set(indexes.rows.map(row => row.indexname));
  for (const indexName of requiredIndexes) {
    if (!actualIndexes.has(indexName)) problems.push(`Missing index: ${indexName}`);
  }

  const constraints = await pool.query(`
    SELECT conname
    FROM pg_constraint
    WHERE contype = 'f'
  `);
  const actualForeignKeys = new Set(constraints.rows.map(row => row.conname));
  for (const constraintName of requiredForeignKeys) {
    if (!actualForeignKeys.has(constraintName)) problems.push(`Missing foreign key: ${constraintName}`);
  }

  const migrationRows = await pool.query("SELECT version, name FROM schema_migrations ORDER BY version");

  const result = {
    ok: problems.length === 0,
    appliedMigrations: migrationRows.rows,
    problems
  };
  console.log(JSON.stringify(result, null, 2));
  if (problems.length) process.exitCode = 1;
} finally {
  await pool.end();
}
