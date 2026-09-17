-- 035_material_files.sql
-- Persistent binary storage for session materials on serverless environments without S3/Supabase Storage bucket

CREATE TABLE IF NOT EXISTS material_files (
  storage_path TEXT PRIMARY KEY,
  file_data BYTEA NOT NULL,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_material_files_created_at ON material_files (created_at);
