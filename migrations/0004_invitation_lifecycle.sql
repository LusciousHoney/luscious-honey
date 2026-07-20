-- Founding Steward Invitation — full decision lifecycle (Cloudflare D1 / SQLite).
--
-- Forward-only, purely additive. Extends the `invitations` registry (0003) with
-- the columns the four-choice decision experience and the Founder decision
-- workflow require. Existing rows (including DaVonna's) keep their current
-- status and simply gain NULL columns — nothing is rewritten or lost.
--
-- Apply once:
--   npx wrangler d1 execute lhc-hq --file=migrations/0004_invitation_lifecycle.sql --remote
--   (add --local instead of --remote for the dev shadow)
--
-- status now spans the full lifecycle (a superset of 0003's invited|opened|accepted):
--   invited · opened · considering · conversation_requested · reminder_scheduled
--   · accepted · declined · planning_complete · ready_for_workspace
-- Workspace rule (institutional policy): acceptance alone never creates a desk.
-- ready_for_workspace is reached ONLY by an explicit Founder authorization after a
-- planning conversation — never automatically.

ALTER TABLE invitations ADD COLUMN decision TEXT;                    -- accept | time | talk | decline
ALTER TABLE invitations ADD COLUMN decided_at TEXT;                  -- when a terminal-ish choice was made
ALTER TABLE invitations ADD COLUMN reminder_period TEXT;            -- e.g. 'a few days' | 'one week' | 'two weeks'
ALTER TABLE invitations ADD COLUMN reminder_at TEXT;               -- when a follow-up becomes due
ALTER TABLE invitations ADD COLUMN conversation_requested_at TEXT; -- recipient asked to talk first
ALTER TABLE invitations ADD COLUMN conversation_complete_at TEXT;  -- Founder recorded the talk happened
ALTER TABLE invitations ADD COLUMN planning_complete_at TEXT;      -- Founder recorded the planning meeting done
ALTER TABLE invitations ADD COLUMN workspace_authorized_at TEXT;   -- Founder authorized the workspace project
ALTER TABLE invitations ADD COLUMN declined_at TEXT;               -- respectful close
