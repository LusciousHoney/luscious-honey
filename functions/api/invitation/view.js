/**
 * Invitation view endpoint — POST /api/invitation/view   { token }
 *
 * Resolves the private token server-side and, only on a valid match, returns the
 * recipient's display name, the governed proposal copy, and the current
 * acceptance status (so a refresh after acceptance restores the closing state
 * instead of replaying the flow).
 *
 * Non-disclosing by design: an unknown, missing, or invalid token returns the
 * SAME neutral 200 `{ ok: false }` shape — never a different status code, never a
 * hint that a recipient exists. The token is read from the POST body only (never
 * a URL parameter), and is never logged or echoed back.
 */

import { resolveInvitationToken } from '../../_lib/invitation.js';
import { PROPOSAL_MARKDOWN, PROPOSAL_STATUS } from '../../_lib/invitation-content.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// Uniform neutral response for anything that is not a valid, known token.
const NEUTRAL = () => json({ ok: false }, 200);

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NEUTRAL();
  }

  const invitation = await resolveInvitationToken(env, body && body.token);
  if (!invitation) return NEUTRAL();

  // Only genuinely published proposal copy is ever served.
  if (PROPOSAL_STATUS !== 'published') return NEUTRAL();

  // Current acceptance status, if the store is reachable. If the store is not
  // bound we still let the invitation be read; acceptance simply defaults to open.
  let status = 'open';
  if (env && env.LHC_DB) {
    try {
      const row = await env.LHC_DB
        .prepare('SELECT status FROM invitation_acceptances WHERE invitation_id = ?')
        .bind(invitation.id)
        .first();
      if (row && row.status === 'accepted') status = 'accepted';
    } catch {
      status = 'open';
    }
  }

  return json({
    ok: true,
    recipientName: invitation.recipientName,
    proposal: PROPOSAL_MARKDOWN,
    status,
  });
}
