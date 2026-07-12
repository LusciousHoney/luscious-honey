-- TK Guest Book — shared submission store (Cloudflare D1 / SQLite).
--
-- Apply once against the bound database (binding name: DB). See docs/DEPLOY.md.
--   npx wrangler d1 execute <DB_NAME> --file migrations/0001_tribute_guestbook.sql --remote
--
-- Submissions default to 'pending' and are NEVER shown publicly until an admin
-- moves them to 'active'. The columns match the endpoint's INSERT/SELECT and the
-- brief: id, tribute_id, display_name, reflection, status, created_at,
-- approved_at, approved_by. ip_hash is a SHA-256 of the submitter's IP, used only
-- for rate limiting — no raw addresses are stored.

CREATE TABLE IF NOT EXISTS tribute_guestbook (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tribute_id   TEXT    NOT NULL,
  display_name TEXT,
  reflection   TEXT    NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'pending',
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  approved_at  TEXT,
  approved_by  TEXT,
  ip_hash      TEXT
);

-- Public read path (per tribute, by status, newest first) and the admin queue.
CREATE INDEX IF NOT EXISTS idx_tribute_guestbook_tribute_status_created
  ON tribute_guestbook (tribute_id, status, created_at);

-- Rate-limit lookups (recent submissions from one hashed IP).
CREATE INDEX IF NOT EXISTS idx_tribute_guestbook_iphash_created
  ON tribute_guestbook (ip_hash, created_at);
