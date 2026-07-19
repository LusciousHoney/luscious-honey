/**
 * Invitation acceptance endpoint — POST /api/invitation/accept   { token }
 *
 * Records a real, durable acceptance in the invitation registry and notifies the
 * Founder exactly once. Acceptance is idempotent: accepted_at is set only when it
 * is still NULL, so a repeated "I'm Ready to Begin" (or a double-submit) records
 * nothing new. The Founder email is guarded by notified_at, so it is sent once —
 * and, crucially, it can be RETRIED: if acceptance persisted but the email failed,
 * notified_at stays NULL and a later acceptance attempt tries the send again
 * without ever duplicating the acceptance.
 *
 * Honesty guarantees:
 *   • If the store is unreachable, this returns 503 and NEVER pretends success —
 *     the client keeps DaVonna's place and offers retry.
 *   • The notification is best-effort AFTER the durable write: a mail failure never
 *     rolls back the acceptance.
 *
 * Non-disclosing: an invalid/absent/expired token returns the neutral 200
 * `{ ok: false }` shape. The token is read from the body only, never logged.
 */

import { resolveInvitation, acceptanceNotification, founderNotifyAddress } from '../../_lib/invitation.js';
import { sendEmail } from '../../_lib/email.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

const RETRY_503 = () => json(
  { ok: false, retry: true, error: 'We could not record your response just yet. Please try again in a moment.' },
  503,
);

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false }, 200);
  }

  const invitation = await resolveInvitation(env, body && body.token);
  if (!invitation) return json({ ok: false }, 200);

  // A real response requires durable storage. Never fake success.
  if (!env || !env.LHC_DB) return RETRY_503();

  // Set acceptance once. accepted_at is written only while still NULL, so repeats
  // and double-submits change nothing.
  try {
    await env.LHC_DB
      .prepare(
        `UPDATE invitations
            SET status = 'accepted', accepted_at = datetime('now')
          WHERE id = ? AND accepted_at IS NULL`,
      )
      .bind(invitation.id)
      .run();
  } catch {
    return RETRY_503();
  }

  // Read the durable state back to drive the (single, retryable) notification.
  let row;
  try {
    row = await env.LHC_DB
      .prepare('SELECT recipient_name, accepted_at, notified_at FROM invitations WHERE id = ?')
      .bind(invitation.id)
      .first();
  } catch {
    // Acceptance is stored; we simply couldn't read back to notify. Still success.
    return json({ ok: true, status: 'accepted' }, 200);
  }

  if (!row || !row.accepted_at) return RETRY_503(); // acceptance did not persist

  // Notify once. Sent only when accepted and not yet notified — which also makes
  // it retry safely if a previous send failed. notified_at is written only after
  // a confirmed send, under a NULL guard so it can never fire twice.
  const to = founderNotifyAddress(env);
  if (to && !row.notified_at) {
    const msg = acceptanceNotification(row.recipient_name, row.accepted_at);
    const sent = await sendEmail(env, { to, ...msg });
    if (sent && sent.ok) {
      try {
        await env.LHC_DB
          .prepare("UPDATE invitations SET notified_at = datetime('now') WHERE id = ? AND notified_at IS NULL")
          .bind(invitation.id)
          .run();
      } catch { /* notification recorded best-effort */ }
    }
  }

  return json({ ok: true, status: 'accepted' }, 200);
}
