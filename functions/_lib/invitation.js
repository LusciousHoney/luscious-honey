/**
 * Invitation registry — server-side token hashing, D1 resolution, proposal
 * association, and the Founder notification template. Server-side only (imported
 * by Pages Functions).
 *
 * Privacy model:
 *   • Each invitation carries its own unguessable TOKEN, delivered only in the
 *     private link's URL fragment. The raw token is NEVER stored: D1 holds only a
 *     deterministic SHA-256 hash (token_hash). A submitted token is hashed here and
 *     matched against the stored hash — the token appears in no source, client
 *     bundle, log, review page, email, or error.
 *   • recipient_name / recipient_slug are NOT secret — they are the visible
 *     experience, not the credential.
 *   • A missing / unknown / expired token resolves to null, and every caller
 *     responds with the SAME neutral shape, never revealing whether an invitation
 *     exists. Resolution is a single indexed hash lookup (constant-length key), so
 *     it does not leak the token through timing in any reasonably avoidable way.
 */

import { PROPOSALS, PROPOSAL_STATUS } from './invitation-content.js';

/** Deterministic SHA-256 hash (hex) of a raw token. Shared by the server and the
    admin creation script so a stored hash always matches a submitted token. */
export async function hashToken(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(token)));
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

/** The governed proposal markdown associated with an invitation, or null if the
    proposal is not published or the id is unknown. */
export function proposalFor(proposalId) {
  if (PROPOSAL_STATUS !== 'published') return null;
  return PROPOSALS[proposalId] ?? null;
}

/**
 * Resolve a presented token to its invitation registry row, or null. Returns null
 * (never throws, never leaks) when the token is absent, the store is unreachable,
 * the hash is unknown, or the invitation has expired.
 */
export async function resolveInvitation(env, presented) {
  if (!presented || typeof presented !== 'string') return null;
  if (!env || !env.LHC_DB) return null;
  let row;
  try {
    const tokenHash = await hashToken(presented);
    row = await env.LHC_DB
      .prepare(
        `SELECT id, recipient_name, recipient_slug, proposal_id, status,
                created_at, opened_at, accepted_at, notified_at, expires_at
           FROM invitations
          WHERE token_hash = ?`,
      )
      .bind(tokenHash)
      .first();
  } catch {
    return null;
  }
  if (!row) return null;
  // Expired invitations resolve to null (indistinguishable from unknown).
  if (row.expires_at && row.expires_at <= isoNow()) return null;
  return row;
}

/** Record the first open. Sets opened_at (and advances status) once; a later view
    never overwrites the original opened_at. Best-effort — a failure here must not
    break the reading experience. */
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
  } catch { /* opening is best-effort telemetry, never a blocker */ }
}

/** The address that receives Founder notifications. */
export function founderNotifyAddress(env) {
  return (env && (env.FOUNDER_NOTIFY_EMAIL || env.EMAIL_FROM)) || null;
}

/** Founder notification for a recorded acceptance. Content only; the transport is
    supplied by functions/_lib/email.js. The token is never included. */
export function acceptanceNotification(recipientName, acceptedAtISO) {
  const name = String(recipientName || 'A guest');
  return {
    subject: `${name} has accepted the Founding Steward invitation`,
    text:
      `${name} has accepted the invitation to join The Luscious Honey Collective ` +
      `as a Founding Steward.\n\nRecorded: ${acceptedAtISO}\n\n` +
      `The next step is a conversation — nothing else is required of you here.`,
    html:
      `<p>${escapeText(name)} has accepted the invitation to join ` +
      `The Luscious Honey Collective as a <strong>Founding Steward</strong>.</p>` +
      `<p style="color:#4A3428">Recorded: ${escapeText(acceptedAtISO)}</p>` +
      `<p>The next step is a conversation — nothing else is required of you here.</p>`,
  };
}

function isoNow() {
  // SQLite datetime('now') format: 'YYYY-MM-DD HH:MM:SS' (UTC). Match it so string
  // comparison against expires_at is correct.
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function escapeText(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
