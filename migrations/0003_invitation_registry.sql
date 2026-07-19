-- Founding Steward Invitation — durable invitation registry (Cloudflare D1 / SQLite).
--
-- Forward-only. Bound as the House's own database (binding name: LHC_DB). Apply once:
--   npx wrangler d1 execute lhc-hq --file=migrations/0003_invitation_registry.sql --remote
--   (add --local instead of --remote for the dev shadow)
--
-- Replaces the single-secret INVITATION_TOKEN model with a registry that supports
-- one unique private token per invitation. The RAW token is never stored — only a
-- deterministic SHA-256 hash of it (token_hash), which is what the server resolves
-- a submitted token against. recipient_slug is a stable, non-secret identifier;
-- proposal_id associates the correct governed proposal without duplicating its copy.
--
-- Lifecycle: status invited → opened (first valid view) → accepted. opened_at,
-- accepted_at, and notified_at are set once and never overwritten by later views.
CREATE TABLE IF NOT EXISTS invitations (
  id             TEXT PRIMARY KEY,          -- non-secret invitation id
  recipient_name TEXT NOT NULL,             -- shown in the experience
  recipient_slug TEXT NOT NULL UNIQUE,      -- stable non-secret identifier
  token_hash     TEXT NOT NULL UNIQUE,      -- SHA-256(token) hex — never the raw token
  proposal_id    TEXT NOT NULL,             -- associates the governed proposal
  status         TEXT NOT NULL DEFAULT 'invited',  -- invited | opened | accepted
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  opened_at      TEXT,
  accepted_at    TEXT,
  notified_at    TEXT,
  expires_at     TEXT                       -- nullable; NULL = never expires
);

-- Token resolution reads by hash; the UNIQUE index above already backs it.

-- The Sprint 3B single-invitation acceptance store is superseded by this registry
-- and carries no production data (the invitation surface was never deployed). Drop
-- it so the registry is the single source of truth. This is forward-only and does
-- not alter the historical 0002 migration file.
DROP TABLE IF EXISTS invitation_acceptances;
