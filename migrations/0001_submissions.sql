-- Editorial Intake — migration 1 (Luscious Honey Collective HQ).
--
-- Reusable submission infrastructure. This is the shared foundation the future
-- canonical Editorial Office UI (the "Dashboard for LHC" sprint) will consume —
-- NOT an Artist-Feature-specific schema. Artist Features is simply the first
-- `type`. Author Features, Creator Spotlights, Partnership/Speaking Requests,
-- Residencies, etc. all land in the SAME three tables.
--
-- Apply:  npx wrangler d1 execute lhc-hq --file=migrations/0001_submissions.sql
--   (add --local for the dev shadow, or --remote for the live database)

-- Pre-release reset: the earlier artist-specific table carried no production
-- data. Drop it so the canonical model is the single source of truth.
DROP TABLE IF EXISTS artist_submissions;

-- ── submissions — one row per public intake, any type ──────────────────────
-- status uses the canonical editorial workflow (see functions/_lib/workflow.js):
--   draft · sent_for_review · under_review · changes_requested ·
--   approved · scheduled · published · not_accepted
-- A fresh public submission enters at 'sent_for_review'.
CREATE TABLE IF NOT EXISTS submissions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  type            TEXT    NOT NULL,                         -- 'artist_feature' | future types
  status          TEXT    NOT NULL DEFAULT 'sent_for_review',
  submitter_name  TEXT    NOT NULL,                         -- universal identity field
  submitter_email TEXT    NOT NULL,                         -- universal identity field
  fields          TEXT    NOT NULL DEFAULT '{}',            -- JSON, type-specific payload
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_submissions_type_status
  ON submissions (type, status, created_at DESC);

-- Soft duplicate guard: one live intake per (type, email). A resubmission after
-- a 'not_accepted' decision is allowed (that row no longer blocks).
CREATE UNIQUE INDEX IF NOT EXISTS uq_submissions_active
  ON submissions (type, submitter_email)
  WHERE status <> 'not_accepted';

-- ── submission_messages — the editorial correspondence foundation ──────────
-- One thread per submission. The automated acknowledgment is message #1
-- (kind='acknowledgment', channel='email'). Editor-only internal notes are
-- kind='internal_note' (channel NULL) — never emailed, never shown publicly.
-- delivery_* track email delivery exactly like the reliable PMU Resend pattern.
CREATE TABLE IF NOT EXISTS submission_messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id   INTEGER NOT NULL,
  kind            TEXT    NOT NULL,             -- 'acknowledgment' | 'outbound' | 'internal_note'
  channel         TEXT,                         -- 'email' | NULL (internal)
  author          TEXT,                         -- editor identity, or 'system'
  body            TEXT    NOT NULL,
  delivery_status TEXT,                          -- email: NULL|sending|sent|failed
  provider_id     TEXT,                          -- Resend message id
  delivery_error  TEXT,                          -- compact last failure reason
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (submission_id) REFERENCES submissions(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_submission
  ON submission_messages (submission_id, created_at);

-- ── submission_events — append-only audit trail ────────────────────────────
-- Every state change is recorded: who (actor), what (action), and the
-- from→to status. Never updated or deleted.
CREATE TABLE IF NOT EXISTS submission_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL,
  actor         TEXT    NOT NULL,               -- 'public' | editor identity | 'system'
  action        TEXT    NOT NULL,               -- 'created' | 'status_changed' | 'message_added'
  from_status   TEXT,
  to_status     TEXT,
  detail        TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (submission_id) REFERENCES submissions(id)
);

CREATE INDEX IF NOT EXISTS idx_events_submission
  ON submission_events (submission_id, created_at);
