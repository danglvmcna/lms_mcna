-- 030_materials_signup_crm.sql
-- 1. Per-session learning materials (slide, document, YouTube, external link).
-- 2. Self sign-up with a temporary password that must be changed on first login.
-- 3. MCNA CRM sync: outbox for LMS -> CRM webhooks, idempotency log for CRM -> LMS calls.

CREATE TABLE IF NOT EXISTS session_materials (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  section_id TEXT REFERENCES course_sections(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('slide', 'document', 'youtube', 'link')),
  title TEXT NOT NULL,
  url TEXT,
  storage_path TEXT,
  file_name TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT session_materials_source_check CHECK (
    (type IN ('slide', 'document') AND storage_path IS NOT NULL)
    OR (type IN ('youtube', 'link') AND url IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_session_materials_session_id ON session_materials (session_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_session_materials_section_id ON session_materials (section_id);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS signup_source TEXT NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS crm_contact_id TEXT;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_signup_source_check;
ALTER TABLE users ADD CONSTRAINT users_signup_source_check CHECK (signup_source IN ('admin', 'self', 'crm'));

CREATE UNIQUE INDEX IF NOT EXISTS ux_users_crm_contact_id ON users (crm_contact_id) WHERE crm_contact_id IS NOT NULL;

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS requested_section_id TEXT REFERENCES course_sections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS crm_deal_id TEXT;

CREATE INDEX IF NOT EXISTS idx_enrollments_crm_deal_id ON enrollments (crm_deal_id) WHERE crm_deal_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS crm_outbox (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_crm_outbox_pending ON crm_outbox (next_attempt_at) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS crm_inbound_events (
  event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'processed', 'failed')),
  response JSONB,
  error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_crm_inbound_events_received_at ON crm_inbound_events (received_at);
