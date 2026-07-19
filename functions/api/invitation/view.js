/**
 * Invitation view endpoint — POST /api/invitation/view   { token }
 *
 * Resolves the private token against the durable invitation registry and, only on
 * a valid match, records the first open, then returns the recipient's display
 * name, the governed proposal copy, and the current status (so a refresh after
 * acceptance restores the closing state instead of replaying the flow).
 *
 * Non-disclosing by design: an unknown, missing, invalid, or expired token returns
 * the SAME neutral 200 `{ ok: false }` shape — never a different status code, never
 * a hint that an invitation exists. The token is read from the POST body only
 * (never a URL parameter), and is never logged or echoed back.
 */

import { resolveInvitation, markOpened, proposalFor } from '../../_lib/invitation.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// Uniform neutral response for anything that is not a valid, known invitation.
const NEUTRAL = () => json({ ok: false }, 200);

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NEUTRAL();
  }

  const invitation = await resolveInvitation(env, body && body.token);
  if (!invitation) return NEUTRAL();

  // Only genuinely published proposal copy is ever served.
  const proposal = proposalFor(invitation.proposal_id);
  if (!proposal) return NEUTRAL();

  // Record the first open (idempotent; never overwrites the original opened_at).
  await markOpened(env, invitation.id);

  return json({
    ok: true,
    recipientName: invitation.recipient_name,
    proposal,
    status: invitation.accepted_at ? 'accepted' : 'open',
  });
}
