-- Founding Steward Invitation — acceptance store (Cloudflare D1 / SQLite).
--
-- Bound as the House's own database (binding name: LHC_DB). Apply once:
--   npx wrangler d1 execute lhc-hq --file=migrations/0002_invitation_acceptances.sql --remote
--   (add --local instead of --remote for the dev shadow)
--
-- One row per invitation. `invitation_id` is the PRIMARY KEY, which makes the
-- acceptance write idempotent by construction: a repeated "I'm Ready to Begin"
-- conflicts on the key and stores nothing new (see functions/api/invitation/
-- accept.js). `notified_at` records that the single Founder email was sent, so a
-- notification is never sent twice. No token, no IP, and no private link data are
-- ever stored here.
CREATE TABLE IF NOT EXISTS invitation_acceptances (
  invitation_id TEXT    PRIMARY KEY,
  recipient     TEXT    NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'accepted',
  accepted_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  notified_at   TEXT
);
