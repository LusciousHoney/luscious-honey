/**
 * Founder advancement — POST /api/invitation/advance   (private, Access-gated)
 *   form/body: { id, action }
 *
 * Lets the Founder move an invitation forward after a REAL-WORLD event. Nothing
 * here is automatic. Access-gated (fails closed) exactly like the review page.
 *
 *   record_conversation_complete : conversation_requested → considering
 *        (the recipient may now return and accept or decline)
 *   record_planning_complete     : accepted → planning_complete
 *   authorize_workspace          : planning_complete → ready_for_workspace
 *
 * WORKSPACE RULE (institutional policy): authorize_workspace only records that the
 * Founder has authorized the project. It does NOT create a workspace/desk — that
 * remains a separate, deliberate act.
 *
 * On success, redirects back to the review (303) for the HTML form flow.
 */

import { verifyAccessRequest } from '../../_lib/access.js';
import { STATUS } from '../../_lib/invitation.js';

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const TRANSITIONS = {
  record_conversation_complete: { from: STATUS.CONVERSATION_REQUESTED, to: STATUS.CONSIDERING, stamp: 'conversation_complete_at' },
  record_planning_complete:     { from: STATUS.ACCEPTED,               to: STATUS.PLANNING_COMPLETE, stamp: 'planning_complete_at' },
  authorize_workspace:          { from: STATUS.PLANNING_COMPLETE,      to: STATUS.READY_FOR_WORKSPACE, stamp: 'workspace_authorized_at' },
};

export async function onRequestPost({ request, env }) {
  // Gate: fail closed unless a verified Access identity (or local dev) is present.
  const access = await verifyAccessRequest(request, env);
  if (!access.configured) {
    if (env.LHC_LOCAL_DEV !== 'true') return json({ ok: false, error: 'Access not configured.' }, 503);
  } else if (!access.ok) {
    return new Response('Unauthorized', { status: 401 });
  }

  let id, action;
  const ct = request.headers.get('content-type') || '';
  try {
    if (ct.includes('application/json')) { const b = await request.json(); id = b.id; action = b.action; }
    else { const f = await request.formData(); id = f.get('id'); action = f.get('action'); }
  } catch { return json({ ok: false, error: 'Bad request.' }, 400); }

  const t = TRANSITIONS[String(action)];
  if (!t || !id) return json({ ok: false, error: 'Unknown action.' }, 400);
  if (!env.LHC_DB) return json({ ok: false, error: 'Database not connected.' }, 503);

  let res;
  try {
    res = await env.LHC_DB.prepare(
      `UPDATE invitations SET status=?, ${t.stamp}=datetime('now') WHERE id=? AND status=?`,
    ).bind(t.to, id, t.from).run();
  } catch { return json({ ok: false, error: 'Update failed.' }, 503); }

  const changed = !!(res && res.meta && res.meta.changes === 1);
  // For the HTML form flow, redirect back to the review regardless (idempotent).
  if (!ct.includes('application/json')) {
    return new Response(null, { status: 303, headers: { Location: '/invitation-review', 'cache-control': 'no-store' } });
  }
  return json({ ok: changed, status: changed ? t.to : 'unchanged' });
}
