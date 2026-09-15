-- Removes SIS semester dependency
ALTER TABLE course_sections ALTER COLUMN semester_id DROP NOT NULL;
DROP INDEX IF EXISTS idx_course_sections_code_semester;
CREATE UNIQUE INDEX IF NOT EXISTS idx_course_sections_code ON course_sections(section_code);
ALTER TABLE course_registrations ALTER COLUMN semester_id DROP NOT NULL;
ALTER TABLE attendance_sessions ALTER COLUMN semester_id DROP NOT NULL;
