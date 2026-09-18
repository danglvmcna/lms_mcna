-- 036_engagement_reports_crm.sql
-- Reporting, QR attendance, private learner notes, grading templates and risk/CRM state.

ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkin_method TEXT;

ALTER TABLE attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_checkin_method_check;

ALTER TABLE attendance_records
  ADD CONSTRAINT attendance_records_checkin_method_check
  CHECK (checkin_method IS NULL OR checkin_method IN ('manual', 'link', 'qr'));

CREATE INDEX IF NOT EXISTS idx_attendance_records_student_session
  ON attendance_records (student_id, session_id);

CREATE TABLE IF NOT EXISTS attendance_qr_sessions (
  id TEXT PRIMARY KEY,
  attendance_session_id TEXT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  section_id TEXT REFERENCES course_sections(id) ON DELETE CASCADE,
  token_version INTEGER NOT NULL DEFAULT 1,
  interval_seconds INTEGER NOT NULL DEFAULT 30 CHECK (interval_seconds BETWEEN 15 AND 120),
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_attendance_qr_active_session
  ON attendance_qr_sessions (attendance_session_id)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS attendance_risk_alerts (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  section_id TEXT REFERENCES course_sections(id) ON DELETE CASCADE,
  risk_type TEXT NOT NULL,
  risk_key TEXT NOT NULL,
  consecutive_absences INTEGER NOT NULL DEFAULT 0,
  attendance_rate INTEGER,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_attendance_risk_alert_key
  ON attendance_risk_alerts (risk_key);
CREATE INDEX IF NOT EXISTS idx_attendance_risk_open
  ON attendance_risk_alerts (status, created_at DESC);

CREATE TABLE IF NOT EXISTS lesson_notes (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT lesson_notes_student_lesson_unique UNIQUE (student_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_notes_student ON lesson_notes (student_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS feedback_templates (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feedback_templates_owner
  ON feedback_templates (owner_user_id, course_id, sort_order, created_at);

INSERT INTO feedback_templates (id, owner_user_id, title, content, sort_order)
SELECT 'feedback_default_' || u.id || '_' || seed.key, u.id, seed.title, seed.content, seed.sort_order
FROM users u
CROSS JOIN (VALUES
  ('good', 'Bài làm tốt', 'Bài làm tốt, tư duy logic và cách trình bày rõ ràng.', 10),
  ('data', 'Bổ sung dữ liệu', 'Cần bổ sung nguồn dữ liệu và giải thích rõ cách xử lý.', 20),
  ('format', 'Đúng định dạng', 'File nộp chưa đúng định dạng yêu cầu, vui lòng kiểm tra và nộp lại.', 30),
  ('conclusion', 'Cải thiện kết luận', 'Cần làm rõ phần kết luận và liên hệ với mục tiêu bài tập.', 40)
) AS seed(key, title, content, sort_order)
WHERE u.role IN ('teacher', 'admin', 'super_admin')
  AND NOT EXISTS (
    SELECT 1 FROM feedback_templates ft
    WHERE ft.owner_user_id = u.id AND ft.course_id IS NULL AND ft.title = seed.title
  );
