-- 0005_notifications.sql — the House's outbound notice ledger.
--
-- Records every notification the House attempts about the submissions spine:
-- a new arrival on the desk, or a matter gone stale in a non-terminal status.
-- The row is created BEFORE any send is attempted, so a failed or unconfigured
-- send is itself a durable record (never silently swallowed), and the
-- Headquarters Notifications panel reads real state from here.
--
-- Idempotency:
--   * 'arrival' — at most one per submission, enforced by a partial unique
--     index. A retried intake or a re-run hook cannot double-notify.
--   * 'stale'   — re-notification is bounded by a cooldown enforced in
--     functions/_lib/notifications.js against the latest 'stale' row.

CREATE TABLE IF NOT EXISTS notifications (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id   INTEGER NOT NULL,
  kind            TEXT    NOT NULL,                    -- 'arrival' | 'stale'
  channel         TEXT    NOT NULL DEFAULT 'email',
  recipient       TEXT,                                -- NULL when not configured
  subject         TEXT,
  delivery_status TEXT    NOT NULL DEFAULT 'sending',  -- sending|sent|failed|not_configured
  delivery_error  TEXT,
  provider_id     TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  sent_at         TEXT
);

-- Exactly one arrival notice may ever exist per submission.
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_arrival_once
  ON notifications (submission_id) WHERE kind = 'arrival';

-- Cooldown lookups: latest 'stale' notice per submission.
CREATE INDEX IF NOT EXISTS idx_notifications_sub_kind_created
  ON notifications (submission_id, kind, created_at);

-- Panel reads: newest first.
CREATE INDEX IF NOT EXISTS idx_notifications_created
  ON notifications (created_at);
