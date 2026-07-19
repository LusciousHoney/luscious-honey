/**
 * Founder review — GET /invitation-review   (private, Access-gated)
 *
 * The owner-facing, in-app place where the Founder reads recorded acceptances of
 * the Founding Steward invitation. This is the review workflow — NOT the
 * Cloudflare dashboard and NOT raw D1. It is defended in depth: the edge
 * middleware gates the `/invitation-review` prefix, and this handler independently
 * verifies the Access identity and fails closed.
 *
 * It reads only. There is no menu, no dashboard chrome, no workspace — a single
 * quiet plate listing who has accepted and when.
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

function page(title, inner) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark"><title>${esc(title)}</title>
<style>
  :root{--ink-900:#17120E;--ink:#211D1A;--alabaster:#F3EEE6;--umber:#4A3428;--brass:#B08A4F;--plaster:#C9BFB0}
  *{box-sizing:border-box}
  body{margin:0;background:var(--ink-900);color:var(--alabaster);
    font-family:Georgia,'Times New Roman',serif;line-height:1.6;
    display:flex;justify-content:center;padding:64px 24px}
  main{width:min(100%,720px)}
  .label{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;
    text-transform:uppercase;letter-spacing:.16em;font-size:.72rem;color:var(--brass)}
  h1{font-weight:300;font-size:2rem;margin:.4em 0 1.2em}
  .plate{background:var(--alabaster);color:var(--ink);padding:32px}
  table{width:100%;border-collapse:collapse;font-family:system-ui,sans-serif;font-size:.95rem}
  th,td{text-align:left;padding:12px 8px;border-bottom:1px solid rgba(33,29,26,.14)}
  th{font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--umber)}
  .empty{color:var(--umber);font-style:italic}
</style></head><body><main>
  <span class="label">The Luscious Honey Collective</span>
  <h1>Founding Steward — Responses</h1>
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
    return page('Review', '<p class="empty">The response store is not connected.</p>');
  }

  let rows = [];
  try {
    const res = await env.LHC_DB
      .prepare('SELECT recipient, status, accepted_at, notified_at FROM invitation_acceptances ORDER BY accepted_at DESC')
      .all();
    rows = (res && res.results) || [];
  } catch {
    return page('Review', '<p class="empty">The response store could not be read.</p>');
  }

  if (rows.length === 0) {
    return page('Review', '<p class="empty">No responses yet.</p>');
  }

  const body =
    '<table><thead><tr><th>Recipient</th><th>Status</th><th>Recorded</th><th>Founder notified</th></tr></thead><tbody>' +
    rows.map((r) =>
      `<tr><td>${esc(r.recipient)}</td><td>${esc(r.status)}</td><td>${esc(r.accepted_at)}</td>` +
      `<td>${r.notified_at ? esc(r.notified_at) : '—'}</td></tr>`,
    ).join('') +
    '</tbody></table>';

  return page('Review', body);
}
