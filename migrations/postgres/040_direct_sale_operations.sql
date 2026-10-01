-- Additive upgrade. No existing class, material, account or payment is removed.
CREATE TABLE IF NOT EXISTS private_uploads (
  filename TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
  mime_type TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS allow_late BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS submission_versions (
  id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  content TEXT NOT NULL, attachment_url TEXT, submitted_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS submission_versions_submission ON submission_versions(submission_id, submitted_at);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS updated_by TEXT REFERENCES users(id);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS taught_minutes INTEGER CHECK (taught_minutes > 0 AND taught_minutes <= 1440);
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS taught_at TIMESTAMPTZ;
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS taught_by TEXT REFERENCES users(id);
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS section_id TEXT REFERENCES course_sections(id);
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS override_reason TEXT;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS issued_by TEXT REFERENCES users(id);
CREATE TABLE IF NOT EXISTS teacher_subjects (
  teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  PRIMARY KEY (teacher_id, course_id)
);
CREATE TABLE IF NOT EXISTS teaching_months (
  teacher_id TEXT NOT NULL REFERENCES users(id), month TEXT NOT NULL CHECK (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status TEXT NOT NULL CHECK (status IN ('submitted','approved','revision')),
  snapshot JSONB NOT NULL, note TEXT NOT NULL DEFAULT '', reviewed_by TEXT REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (teacher_id, month)
);
CREATE TABLE IF NOT EXISTS lesson_plan_templates (
  id TEXT PRIMARY KEY, course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL, sessions JSONB NOT NULL, created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE course_sections ADD COLUMN IF NOT EXISTS lesson_plan_mode TEXT NOT NULL DEFAULT 'custom' CHECK (lesson_plan_mode IN ('default','custom'));
ALTER TABLE course_sections ADD COLUMN IF NOT EXISTS lesson_plan_template_id TEXT REFERENCES lesson_plan_templates(id) ON DELETE SET NULL;
ALTER TABLE course_sections ADD COLUMN IF NOT EXISTS assignment_notice_key TEXT;
ALTER TABLE course_sections ADD COLUMN IF NOT EXISTS assignment_email_status TEXT;
CREATE TABLE IF NOT EXISTS session_solutions (
  session_id TEXT PRIMARY KEY REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '', attachment_url TEXT, published BOOLEAN NOT NULL DEFAULT false,
  updated_by TEXT NOT NULL REFERENCES users(id), updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS operation_settings (
  id TEXT PRIMARY KEY, value JSONB NOT NULL, updated_by TEXT REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO operation_settings(id,value) VALUES ('rules', '{"absentStatuses":["absent"],"tierRules":[],"commissionStart":null,"bankBin":"","bankAccount":"","bankName":""}') ON CONFLICT DO NOTHING;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_manage_sales BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS consultation_requests (
  id TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES users(id), course_id TEXT REFERENCES courses(id),
  message TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'student', status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','closed')),
  assigned_to TEXT REFERENCES users(id), request_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(student_id, request_key)
);
CREATE TABLE IF NOT EXISTS course_recommendations (
  source_course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  target_course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  PRIMARY KEY(source_course_id,target_course_id), CHECK (source_course_id <> target_course_id)
);
CREATE TABLE IF NOT EXISTS vouchers (
  id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, amount NUMERIC(15,0) NOT NULL CHECK(amount > 0),
  course_id TEXT REFERENCES courses(id), student_id TEXT REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL, max_uses INTEGER NOT NULL CHECK(max_uses > 0),
  created_by TEXT NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS upsell_orders (
  id TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES users(id), course_id TEXT NOT NULL REFERENCES courses(id),
  voucher_id TEXT REFERENCES vouchers(id), original_price NUMERIC(15,0) NOT NULL CHECK(original_price > 0),
  discount NUMERIC(15,0) NOT NULL CHECK(discount >= 0), amount NUMERIC(15,0) NOT NULL CHECK(amount >= 0),
  source TEXT NOT NULL CHECK(source IN ('self','sale')), commission_rate NUMERIC(5,4),
  policy JSONB NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','cancelled')),
  enrollment_id TEXT REFERENCES enrollments(id), reference TEXT, request_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, confirmed_by TEXT REFERENCES users(id),
  UNIQUE(student_id,request_key), CHECK(amount = original_price - discount)
);
CREATE INDEX IF NOT EXISTS upsell_orders_voucher ON upsell_orders(voucher_id,status);
CREATE TABLE IF NOT EXISTS operation_dispatches (
  id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id), request_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(actor_id,request_key)
);
