-- 039_direct_sale_class_manager.sql
-- Direct-sale model: learners are created from the CRM "paid" list and placed into a class by a class manager.
-- 1. "manager" (Quản lý lớp) role, separate from the system admin.
-- 2. Session materials: a downloadable "data" type, and course-level opening materials (no session).
-- 3. Course welcome letter.
-- 4. Class-placement email status on each class seat.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'manager', 'teacher', 'student'));

-- The column CHECK from migration 030 has a generated name, so drop every CHECK on the table and re-add them.
DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'session_materials'::regclass AND contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE session_materials DROP CONSTRAINT %I', item.conname);
  END LOOP;
END $$;

ALTER TABLE session_materials ALTER COLUMN session_id DROP NOT NULL;
ALTER TABLE session_materials ADD COLUMN IF NOT EXISTS category TEXT;

-- Spreadsheets, datasets and archives used to be uploaded as "document"; they are the files learners may download.
UPDATE session_materials
SET type = 'data'
WHERE type = 'document'
  AND lower(COALESCE(file_name, '')) ~ '\.(xlsx|xls|csv|pbix|zip|rar)$';

ALTER TABLE session_materials ADD CONSTRAINT session_materials_type_check
  CHECK (type IN ('slide', 'document', 'data', 'youtube', 'link'));
ALTER TABLE session_materials ADD CONSTRAINT session_materials_source_check CHECK (
  (type IN ('slide', 'document', 'data') AND storage_path IS NOT NULL)
  OR (type IN ('youtube', 'link') AND url IS NOT NULL)
);
-- A material belongs either to one session, or to the course's opening materials (reference / practice).
ALTER TABLE session_materials ADD CONSTRAINT session_materials_scope_check CHECK (
  (session_id IS NOT NULL AND category IS NULL)
  OR (session_id IS NULL AND category IN ('reference', 'practice'))
);

CREATE INDEX IF NOT EXISTS idx_session_materials_course_intro
  ON session_materials (course_id, category, sort_order)
  WHERE session_id IS NULL;

ALTER TABLE courses ADD COLUMN IF NOT EXISTS welcome_letter TEXT;

ALTER TABLE course_registrations
  ADD COLUMN IF NOT EXISTS placement_email_status TEXT,
  ADD COLUMN IF NOT EXISTS placement_email_at TIMESTAMPTZ;
