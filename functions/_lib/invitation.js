/**
 * Invitation server library — token resolution, recipient metadata, and the
 * Founder notification template. Server-side only (imported by Pages Functions).
 *
 * Privacy model:
 *   • The private link carries an unguessable TOKEN. The token is NEVER stored in
 *     source, in a client-readable map, in logs, or in error text. It is held
 *     only as an encrypted Cloudflare environment secret (INVITATION_TOKEN) and
 *     compared here in constant time.
 *   • Recipient metadata below (id + display name) is NOT secret — it is the
 *     visible experience, not the credential. The token does not encode it.
 *   • An unknown / missing / mismatched token resolves to null. Callers respond
 *     with the SAME neutral shape either way, never revealing whether a recipient
 *     exists.
 *
 * Single recipient by design this chapter (DaVonna). Shaped so more invitations
 * could be added later without changing callers.
 */

/** Non-secret invitation record. `id` keys the durable acceptance row. */
export const INVITATION = Object.freeze({
  id: 'founding-steward-davonna',
  recipientName: 'DaVonna',
});

/**
 * Constant-time token match. Both sides are SHA-256'd first so the compare runs
 * over fixed-length digests and leaks neither length nor content through timing.
 */
async function tokenMatches(presented, secret) {
  if (typeof presented !== 'string' || typeof secret !== 'string' || secret.length === 0) {
    return false;
  }
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(presented)),
    crypto.subtle.digest('SHA-256', enc.encode(secret)),
  ]);
  const av = new Uint8Array(a);
  const bv = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < av.length; i++) diff |= av[i] ^ bv[i];
  return diff === 0;
}

/**
 * Resolve a presented token to its invitation record, or null.
 * Returns null (never throws, never leaks) when the token is absent, the secret
 * is unconfigured, or the two do not match.
 */
export async function resolveInvitationToken(env, presented) {
  const secret = env && env.INVITATION_TOKEN;
  if (await tokenMatches(presented, secret)) return INVITATION;
  return null;
}

/** The email address that receives Founder notifications. */
export function founderNotifyAddress(env) {
  return (env && (env.FOUNDER_NOTIFY_EMAIL || env.EMAIL_FROM)) || null;
}

/**
 * Founder notification template for a recorded acceptance. Content only — the
 * transport (Resend) is supplied by functions/_lib/email.js. The token is never
 * included.
 */
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

function escapeText(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
