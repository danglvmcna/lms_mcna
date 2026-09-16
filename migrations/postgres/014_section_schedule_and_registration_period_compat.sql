-- Keep production schemas compatible when course_sections was created with
-- schedule JSONB instead of the newer schedule_json TEXT column.

ALTER TABLE course_sections
  ADD COLUMN IF NOT EXISTS schedule_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE course_sections DROP CONSTRAINT IF EXISTS course_sections_status_check;
ALTER TABLE course_sections
  ADD CONSTRAINT course_sections_status_check
  CHECK (status IN ('pending', 'open', 'closed', 'cancelled'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'course_sections'
      AND column_name = 'schedule'
  ) THEN
    EXECUTE $sql$
      UPDATE course_sections
      SET schedule_json = COALESCE(NULLIF(schedule::text, ''), '[]')
      WHERE schedule_json IS NULL OR schedule_json = '[]'
    $sql$;

    EXECUTE $sql$
      ALTER TABLE course_sections
      ALTER COLUMN schedule SET DEFAULT '[]'::jsonb
    $sql$;
  END IF;
END $$;

-- The demo registration period that used to be inserted here was removed with the SIS features:
-- it referenced semester 'sem_spring25', which does not exist on a fresh database, so the insert
-- failed every clean install. Databases that already ran this migration keep their existing rows.
