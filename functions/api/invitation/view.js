/**
 * Invitation view endpoint — POST /api/invitation/view   { token }
 *
 * Resolves the private token, records the first open, and returns everything the
 * guided experience needs to render the correct phase: recipient name, the
 * governed proposal, the current phase (open | reminder | conversation | accepted
 * | declined), atmospheric personalization, and any reminder detail.
 *
 * Non-disclosing: an unknown / missing / invalid / expired token returns the SAME
 * neutral 200 `{ ok:false }`. The token is read from the POST body only.
 */

import { resolveInvitation, markOpened, proposalFor, personaFor, phaseOf } from '../../_lib/invitation.js';

const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' };
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: HEADERS });
const NEUTRAL = () => json({ ok: false }, 200);

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return NEUTRAL(); }

  const inv = await resolveInvitation(env, body && body.token);
  if (!inv) return NEUTRAL();

  const proposal = proposalFor(inv.proposal_id);
  if (!proposal) return NEUTRAL();

  await markOpened(env, inv.id);

  return json({
    ok: true,
    recipientName: inv.recipient_name,
    proposal,
    phase: phaseOf(inv),
    personalization: personaFor(inv.recipient_slug),
    reminder: inv.reminder_period ? { period: inv.reminder_period, at: inv.reminder_at } : null,
  });
}
