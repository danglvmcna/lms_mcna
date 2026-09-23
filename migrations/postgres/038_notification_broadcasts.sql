-- Atomic, retry-safe in-app notification broadcasts.
CREATE TABLE IF NOT EXISTS notification_broadcasts (
  id TEXT PRIMARY KEY,
  created_by TEXT NOT NULL REFERENCES users(id),
  idempotency_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  target_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT notification_broadcasts_creator_key_unique UNIQUE (created_by, idempotency_key)
);

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS broadcast_id TEXT REFERENCES notification_broadcasts(id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_notifications_broadcast_user
  ON notifications (broadcast_id, user_id)
  WHERE broadcast_id IS NOT NULL;
