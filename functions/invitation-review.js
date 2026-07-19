/**
 * Founder review — GET /invitation-review   (private, Access-gated)
 *
 * The owner-facing, in-app place where the Founder reads the invitation lifecycle:
 * recipient, status, created, first opened, accepted, and Founder-notified. This
 * is the review workflow — NOT the Cloudflare dashboard and NOT raw D1. It is
 * defended in depth: the edge middleware gates the `/invitation-review` prefix, and
 * this handler independently verifies the Access identity and fails closed.
 *
 * It reads only, and it never shows the raw token, the token hash, the private URL,
 * an IP address, or any unnecessary technical identifier.
 */

import { verifyAccessRequest } from './_lib/access.js';

const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
};

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const cell = (v) => (v ? esc(v) : '—');

function page(title, inner) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="robots" content="noindex, nofollow"><title>${esc(title)}</title>
<style>
  :root{--ink-900:#17120E;--ink:#211D1A;--alabaster:#F3EEE6;--umber:#4A3428;--brass:#B08A4F;--plaster:#C9BFB0}
  *{box-sizing:border-box}
  body{margin:0;background:var(--ink-900);color:var(--alabaster);
    font-family:Georgia,'Times New Roman',serif;line-height:1.6;
    display:flex;justify-content:center;padding:64px 24px}
  main{width:min(100%,860px)}
  .label{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;
    text-transform:uppercase;letter-spacing:.16em;font-size:.72rem;color:var(--brass)}
  h1{font-weight:300;font-size:2rem;margin:.4em 0 1.2em}
  .plate{background:var(--alabaster);color:var(--ink);padding:32px;overflow-x:auto}
  table{width:100%;border-collapse:collapse;font-family:system-ui,sans-serif;font-size:.9rem}
  th,td{text-align:left;padding:12px 10px;border-bottom:1px solid rgba(33,29,26,.14);white-space:nowrap}
  th{font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:var(--umber)}
  td:first-child{font-weight:600}
  .empty{color:var(--umber);font-style:italic}
</style></head><body><main>
  <span class="label">The Luscious Honey Collective</span>
  <h1>Founding Steward — Invitation Lifecycle</h1>
  <div class="plate">${inner}</div>
</main></body></html>`,
    { status: 200, headers: HTML_HEADERS },
  );
}

export async function onRequestGet({ request, env }) {
  const access = await verifyAccessRequest(request, env);
  if (!access.configured) {
    if (env.LHC_LOCAL_DEV === 'true') {
      // Local shadow only; production always requires a verified identity.
    } else {
      return page('Review unavailable', '<p class="empty">This review is not available on this deployment.</p>');
    }
  } else if (!access.ok) {
    return new Response('Unauthorized', { status: 401, headers: { 'cache-control': 'no-store' } });
  }

  if (!env || !env.LHC_DB) {
    return page('Review', '<p class="empty">The invitation registry is not connected.</p>');
  }

  let rows = [];
  try {
    const res = await env.LHC_DB
      .prepare(
        `SELECT recipient_name, status, created_at, opened_at, accepted_at, notified_at
           FROM invitations ORDER BY created_at DESC`,
      )
      .all();
    rows = (res && res.results) || [];
  } catch {
    return page('Review', '<p class="empty">The invitation registry could not be read.</p>');
  }

  if (rows.length === 0) {
    return page('Review', '<p class="empty">No invitations yet.</p>');
  }

  const body =
    '<table><thead><tr>' +
    '<th>Recipient</th><th>Status</th><th>Created</th><th>First opened</th><th>Accepted</th><th>Founder notified</th>' +
    '</tr></thead><tbody>' +
    rows.map((r) =>
      `<tr><td>${esc(r.recipient_name)}</td><td>${esc(r.status)}</td>` +
      `<td>${cell(r.created_at)}</td><td>${cell(r.opened_at)}</td>` +
      `<td>${cell(r.accepted_at)}</td><td>${cell(r.notified_at)}</td></tr>`,
    ).join('') +
    '</tbody></table>';

  return page('Review', body);
}
