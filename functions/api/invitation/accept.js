/**
 * Invitation acceptance endpoint — POST /api/invitation/accept   { token }
 *
 * Records a real, durable acceptance and notifies the Founder exactly once. The
 * acceptance is idempotent: the invitation id is the PRIMARY KEY, so a repeated
 * "I'm Ready to Begin" (or a double-submit) conflicts and stores nothing new, and
 * the Founder is emailed only on the FIRST successful write.
 *
 * Honesty guarantees:
 *   • If the store is not reachable, this returns 503 and NEVER pretends the
 *     acceptance succeeded — the client keeps DaVonna's place and offers retry.
 *   • The notification is best-effort AFTER the durable write: a mail failure
 *     does not fail the acceptance (the record is what matters) and is recorded
 *     so it is not retried into a duplicate.
 *
 * Non-disclosing: an invalid/absent token returns the neutral 200 `{ ok: false }`
 * shape, identical to /view. The token is read from the body only, never logged.
 */

import { resolveInvitationToken, acceptanceNotification, founderNotifyAddress } from '../../_lib/invitation.js';
import { sendEmail } from '../../_lib/email.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false }, 200);
  }

  const invitation = await resolveInvitationToken(env, body && body.token);
  if (!invitation) return json({ ok: false }, 200);

  // A real response requires durable storage. Never fake success.
  if (!env || !env.LHC_DB) {
    return json(
      { ok: false, retry: true, error: 'We could not record your response just yet. Please try again in a moment.' },
      503,
    );
  }

  let firstWrite = false;
  try {
    const res = await env.LHC_DB
      .prepare(
        `INSERT INTO invitation_acceptances (invitation_id, recipient, status, accepted_at)
         VALUES (?, ?, 'accepted', datetime('now'))
         ON CONFLICT(invitation_id) DO NOTHING`,
      )
      .bind(invitation.id, invitation.recipientName)
      .run();
    firstWrite = !!(res && res.meta && res.meta.changes === 1);
  } catch {
    return json(
      { ok: false, retry: true, error: 'We could not record your response just yet. Please try again in a moment.' },
      503,
    );
  }

  // Notify the Founder once — only on the first write, and only if not already
  // marked notified (guards a retry that raced the very first insert).
  if (firstWrite) {
    let row = null;
    try {
      row = await env.LHC_DB
        .prepare('SELECT accepted_at, notified_at FROM invitation_acceptances WHERE invitation_id = ?')
        .bind(invitation.id)
        .first();
    } catch { /* fall through — acceptance already stored */ }

    const to = founderNotifyAddress(env);
    if (to && row && !row.notified_at) {
      const msg = acceptanceNotification(invitation.recipientName, row.accepted_at);
      const sent = await sendEmail(env, { to, ...msg });
      if (sent && sent.ok) {
        try {
          await env.LHC_DB
            .prepare("UPDATE invitation_acceptances SET notified_at = datetime('now') WHERE invitation_id = ? AND notified_at IS NULL")
            .bind(invitation.id)
            .run();
        } catch { /* notification recorded best-effort */ }
      }
    }
  }

  // Idempotent success — first write or repeat both resolve to the accepted state.
  return json({ ok: true, status: 'accepted' }, 200);
}
