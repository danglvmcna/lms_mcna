-- Migration 037: Add attachment_url and missing relations to assignments, submissions, and quizzes
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS attachment_url TEXT;

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS session_id TEXT REFERENCES attendance_sessions(id) ON DELETE SET NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS session_id TEXT REFERENCES attendance_sessions(id) ON DELETE SET NULL;
