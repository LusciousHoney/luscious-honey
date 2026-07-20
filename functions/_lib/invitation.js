/**
 * Invitation registry — server-side token hashing, D1 resolution, proposal
 * association, per-recipient personalization, and the notification templates.
 * Server-side only (imported by Pages Functions).
 *
 * Privacy model unchanged from the registry: the raw token is never stored (only
 * its SHA-256 hash); a missing/unknown/expired token resolves to null and every
 * caller returns the same neutral shape.
 */

import { PROPOSALS, PROPOSAL_STATUS } from './invitation-content.js';

/* --- Lifecycle states ------------------------------------------------------ */
export const STATUS = Object.freeze({
  INVITED: 'invited',
  OPENED: 'opened',
  CONSIDERING: 'considering',                 // after a talk, back to decide
  CONVERSATION_REQUESTED: 'conversation_requested',
  REMINDER_SCHEDULED: 'reminder_scheduled',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  PLANNING_COMPLETE: 'planning_complete',
  READY_FOR_WORKSPACE: 'ready_for_workspace',
});

/* --- Personalization (ATMOSPHERIC ONLY) -----------------------------------
   Per-recipient accent + pacing hint. Deliberately NON-VERBAL: it never puts
   words in the Founder's mouth. 'accent' is a restrained mood the experience
   wears (e.g. a deep verdant whisper for a green-lover), never themed decoration.
   Recipients not listed here simply use the House's default brass. */
const PERSONAS = {
  davonna: { accent: 'verdant' },   // a quiet love of green, worn softly
};
export function personaFor(slug) {
  const p = PERSONAS[slug];
  return { accent: (p && p.accent) || 'house' };
}

/* --- Token hashing --------------------------------------------------------- */
export async function hashToken(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(token)));
  let hex = '';
  for (const b of new Uint8Array(digest)) hex += b.toString(16).padStart(2, '0');
  return hex;
}

export function proposalFor(proposalId) {
  if (PROPOSAL_STATUS !== 'published') return null;
  return PROPOSALS[proposalId] ?? null;
}

/** Resolve a presented token to its invitation row, or null (never throws). */
export async function resolveInvitation(env, presented) {
  if (!presented || typeof presented !== 'string' || !env || !env.LHC_DB) return null;
  let row;
  try {
    row = await env.LHC_DB
      .prepare(
        `SELECT id, recipient_name, recipient_slug, proposal_id, status, created_at,
                opened_at, accepted_at, notified_at, expires_at, decision, decided_at,
                reminder_period, reminder_at, conversation_requested_at,
                conversation_complete_at, planning_complete_at, workspace_authorized_at,
                declined_at
           FROM invitations WHERE token_hash = ?`,
      )
      .bind(await hashToken(presented))
      .first();
  } catch { return null; }
  if (!row) return null;
  if (row.expires_at && row.expires_at <= isoNow()) return null;
  return row;
}

/** Record the first open once; never overwrite, and never regress a later state. */
export async function markOpened(env, invitationId) {
  if (!env || !env.LHC_DB) return;
  try {
    await env.LHC_DB
      .prepare(
        `UPDATE invitations
            SET opened_at = datetime('now'),
                status = CASE WHEN status = 'invited' THEN 'opened' ELSE status END
          WHERE id = ? AND opened_at IS NULL`,
      )
      .bind(invitationId)
      .run();
  } catch { /* opening is best-effort */ }
}

/** The reader-facing phase the client should route to, derived from a row. */
export function phaseOf(row) {
  switch (row.status) {
    case STATUS.ACCEPTED:
    case STATUS.PLANNING_COMPLETE:
    case STATUS.READY_FOR_WORKSPACE:
      return 'accepted';
    case STATUS.DECLINED:               return 'declined';
    case STATUS.REMINDER_SCHEDULED:     return 'reminder';
    case STATUS.CONVERSATION_REQUESTED: return 'conversation';
    default:                            return 'open'; // invited | opened | considering
  }
}

/* --- Notifications --------------------------------------------------------- */
export function founderNotifyAddress(env) {
  return (env && (env.FOUNDER_NOTIFY_EMAIL || env.EMAIL_FROM)) || null;
}

const NOTES = {
  accept: (n) => ({
    subject: `${n} has accepted the Founding Steward invitation`,
    body: `${n} has accepted the invitation to join The Luscious Honey Collective as a Founding Steward.\n\nNext step: the planning conversation. A workspace is authorized only after you and ${n} meet and you approve it.`,
  }),
  talk: (n) => ({
    subject: `${n} would like to talk before deciding`,
    body: `${n} has read the Founding Steward invitation and would like a conversation before deciding.\n\nWhen you have spoken, mark the conversation complete in the review so ${n} can return and decide.`,
  }),
  decline: (n) => ({
    subject: `${n} has respectfully declined`,
    body: `${n} has read the Founding Steward invitation and respectfully declined. The invitation has closed. Nothing further is required.`,
  }),
};

/** Content-only notification for a recipient decision; transport is email.js. */
export function decisionNotification(kind, recipientName) {
  const n = String(recipientName || 'A guest');
  const t = NOTES[kind];
  if (!t) return null;
  const { subject, body } = t(n);
  return { subject, text: body, html: `<p>${escapeText(body).replace(/\n\n/g, '</p><p>')}</p>` };
}

function isoNow() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}
function escapeText(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
