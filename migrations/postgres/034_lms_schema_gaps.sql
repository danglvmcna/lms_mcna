-- Columns the application reads and writes but no migration ever created, so production
-- (where they were added by hand) and a fresh install had drifted apart.

-- course_sections.schedule: the JSONB copy of the weekly timetable. server.ts, the sections
-- repository and the seed all write it; mappers read either this or schedule_json.
ALTER TABLE course_sections ADD COLUMN IF NOT EXISTS schedule JSONB NOT NULL DEFAULT '[]'::jsonb;

-- questions.created_at: the store snapshot orders questions by it and /api/store/sync writes it.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;
