/**
 * Founder review — GET /invitation-review   (private, Access-gated)
 *
 * The owner-facing place where the Founder reads each invitation's full lifecycle
 * and advances it after real-world conversations. Read + a few POST controls that
 * submit to /api/invitation/advance (also Access-gated). Defended in depth: the
 * edge middleware gates the prefix, and this handler verifies Access and fails
 * closed. Never shows the token, hash, private URL, or IP.
 */

import { verifyAccessRequest } from './_lib/access.js';

const HTML = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cell = (v) => (v ? esc(v) : '—');

const LABELS = {
  invited: 'Invited', opened: 'Opened', considering: 'Considering',
  conversation_requested: 'Conversation Requested', reminder_scheduled: 'Reminder Scheduled',
  accepted: 'Accepted', declined: 'Declined', planning_complete: 'Planning Complete',
  ready_for_workspace: 'Ready for Workspace',
};

// The single Founder action available from each state (real-world advancement).
function actionFor(r) {
  if (r.status === 'conversation_requested') return { action: 'record_conversation_complete', label: 'Mark conversation complete' };
  if (r.status === 'accepted') return { action: 'record_planning_complete', label: 'Mark planning meeting complete' };
  if (r.status === 'planning_complete') return { action: 'authorize_workspace', label: 'Authorize workspace project' };
  if (r.status === 'reminder_scheduled') return { note: r.reminder_at ? `Reminder due ${esc(r.reminder_at)}` : 'Reminder scheduled' };
  if (r.status === 'ready_for_workspace') return { note: 'Workspace authorized — begin the project when ready' };
  return {};
}

function page(inner) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark">
<meta name="robots" content="noindex, nofollow"><title>Founding Steward — Review</title>
<style>
 :root{--ink-900:#17120E;--ink:#211D1A;--alabaster:#F3EEE6;--umber:#4A3428;--brass:#B08A4F;--verdant:#3E5B4A}
 *{box-sizing:border-box} body{margin:0;background:var(--ink-900);color:var(--alabaster);
   font-family:Georgia,serif;line-height:1.6;display:flex;justify-content:center;padding:56px 20px}
 main{width:min(100%,960px)}
 .label{font-family:system-ui,sans-serif;text-transform:uppercase;letter-spacing:.16em;font-size:.72rem;color:var(--brass)}
 h1{font-weight:300;font-size:2rem;margin:.3em 0 1em}
 .card{background:var(--alabaster);color:var(--ink);padding:24px 28px;margin-bottom:16px}
 .row1{display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap}
 .name{font-size:1.4rem;font-weight:300}
 .status{font-family:system-ui,sans-serif;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;
   color:var(--umber);border:1px solid rgba(33,29,26,.22);padding:4px 10px;white-space:nowrap}
 dl{display:grid;grid-template-columns:auto 1fr;gap:4px 16px;margin:16px 0 0;font-family:system-ui,sans-serif;font-size:.86rem}
 dt{color:var(--umber);text-transform:uppercase;letter-spacing:.1em;font-size:.66rem;align-self:center}
 dd{margin:0}
 form{margin:18px 0 0} button{font-family:system-ui,sans-serif;font-weight:600;font-size:.74rem;letter-spacing:.1em;
   text-transform:uppercase;background:var(--ink);color:var(--alabaster);border:0;padding:12px 18px;cursor:pointer}
 button:hover{background:var(--verdant)} .note{margin:16px 0 0;font-style:italic;color:var(--umber)}
 .empty{color:var(--umber);font-style:italic}
</style></head><body><main>
 <span class="label">The Luscious Honey Collective</span>
 <h1>Founding Steward — Invitations</h1>${inner}</main></body></html>`,
    { status: 200, headers: HTML },
  );
}

function card(r) {
  const a = actionFor(r);
  const control = a.action
    ? `<form method="POST" action="/api/invitation/advance"><input type="hidden" name="id" value="${esc(r.id)}"><input type="hidden" name="action" value="${a.action}"><button type="submit">${a.label}</button></form>`
    : a.note ? `<p class="note">${a.note}</p>` : '';
  return `<div class="card">
    <div class="row1"><span class="name">${esc(r.recipient_name)}</span><span class="status">${esc(LABELS[r.status] || r.status)}</span></div>
    <dl>
      <dt>Created</dt><dd>${cell(r.created_at)}</dd>
      <dt>Opened</dt><dd>${cell(r.opened_at)}</dd>
      <dt>Considered</dt><dd>${cell(r.conversation_requested_at || r.reminder_at || r.decided_at)}</dd>
      <dt>Accepted</dt><dd>${cell(r.accepted_at)}</dd>
      <dt>Declined</dt><dd>${cell(r.declined_at)}</dd>
      <dt>Planning done</dt><dd>${cell(r.planning_complete_at)}</dd>
      <dt>Workspace ok'd</dt><dd>${cell(r.workspace_authorized_at)}</dd>
    </dl>${control}</div>`;
}

export async function onRequestGet({ request, env }) {
  const access = await verifyAccessRequest(request, env);
  if (!access.configured) {
    if (env.LHC_LOCAL_DEV !== 'true') return page('<p class="empty">This review is not available on this deployment.</p>');
  } else if (!access.ok) {
    return new Response('Unauthorized', { status: 401, headers: { 'cache-control': 'no-store' } });
  }
  if (!env || !env.LHC_DB) return page('<p class="empty">The invitation registry is not connected.</p>');

  let rows = [];
  try {
    const res = await env.LHC_DB.prepare(
      `SELECT id, recipient_name, status, created_at, opened_at, decided_at,
              conversation_requested_at, reminder_at, accepted_at, declined_at,
              planning_complete_at, workspace_authorized_at
         FROM invitations ORDER BY created_at DESC`).all();
    rows = (res && res.results) || [];
  } catch { return page('<p class="empty">The invitation registry could not be read.</p>'); }

  if (!rows.length) return page('<p class="empty">No invitations yet.</p>');
  return page(rows.map(card).join(''));
}
