/* =============================================================================
   FOUNDING STEWARD INVITATION — focused tests.
   Covers token resolution (valid / invalid / missing, non-disclosing), exact
   recipient + published-only proposal rendering, durable acceptance persistence,
   idempotent repeated acceptance, single notification, failure/retry honesty,
   accepted-state restoration, Founder review retrieval, and the absence of any
   menu / dashboard / workspace scaffolding in the invitation surface.
   ============================================================================= */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { renderProposal } from '../src/invitation/render.js';
import {
  INVITATION,
  resolveInvitationToken,
  acceptanceNotification,
  founderNotifyAddress,
} from '../functions/_lib/invitation.js';
import { PROPOSAL_MARKDOWN, PROPOSAL_STATUS } from '../functions/_lib/invitation-content.js';
import { onRequestPost as viewPost } from '../functions/api/invitation/view.js';
import { onRequestPost as acceptPost } from '../functions/api/invitation/accept.js';
import { onRequestGet as reviewGet } from '../functions/invitation-review.js';

const REAL_TOKEN = 'unguessable-secret-token-value-123456';
const baseEnv = () => ({ INVITATION_TOKEN: REAL_TOKEN });

/* --- A minimal in-memory D1 stand-in --------------------------------------
   Implements just the surface these endpoints use: prepare().bind().run()/
   first()/all(), an INSERT ... ON CONFLICT DO NOTHING with meta.changes, a
   SELECT by id, an UPDATE of notified_at, and a SELECT-all for review. */
function makeDB() {
  const rows = new Map(); // invitation_id -> row
  return {
    rows,
    prepare(sql) {
      const s = sql.replace(/\s+/g, ' ').trim();
      let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async run() {
          if (s.startsWith('INSERT INTO invitation_acceptances')) {
            const [id, recipient] = args;
            if (rows.has(id)) return { meta: { changes: 0 } };
            rows.set(id, { invitation_id: id, recipient, status: 'accepted', accepted_at: '2026-07-19T12:00:00Z', notified_at: null });
            return { meta: { changes: 1 } };
          }
          if (s.startsWith('UPDATE invitation_acceptances SET notified_at')) {
            const [id] = args;
            const r = rows.get(id);
            if (r && !r.notified_at) r.notified_at = '2026-07-19T12:00:01Z';
            return { meta: { changes: r ? 1 : 0 } };
          }
          return { meta: { changes: 0 } };
        },
        async first() {
          const id = args[0];
          const r = rows.get(id);
          if (!r) return null;
          if (s.includes('SELECT status')) return { status: r.status };
          if (s.includes('SELECT accepted_at, notified_at')) return { accepted_at: r.accepted_at, notified_at: r.notified_at };
          return r;
        },
        async all() {
          return { results: [...rows.values()] };
        },
      };
      return api;
    },
  };
}

function req(body) {
  return new Request('https://x/api', { method: 'POST', body: JSON.stringify(body) });
}

/* --- Token resolution ------------------------------------------------------ */

test('valid token resolves to the invitation', async () => {
  const inv = await resolveInvitationToken(baseEnv(), REAL_TOKEN);
  assert.equal(inv?.id, INVITATION.id);
  assert.equal(inv?.recipientName, 'DaVonna');
});

test('invalid token resolves to null', async () => {
  assert.equal(await resolveInvitationToken(baseEnv(), 'wrong-token'), null);
});

test('missing token / unconfigured secret resolve to null', async () => {
  assert.equal(await resolveInvitationToken(baseEnv(), ''), null);
  assert.equal(await resolveInvitationToken(baseEnv(), undefined), null);
  assert.equal(await resolveInvitationToken({}, REAL_TOKEN), null);
});

test('view is non-disclosing for an invalid token (neutral 200 { ok:false })', async () => {
  const res = await viewPost({ request: req({ token: 'nope' }), env: baseEnv() });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(data, { ok: false });
});

test('the neutral response is byte-identical whether or not a recipient exists', async () => {
  const a = await (await viewPost({ request: req({ token: 'nope' }), env: baseEnv() })).text();
  const b = await (await viewPost({ request: req({}), env: baseEnv() })).text();
  assert.equal(a, b);
});

/* --- Exact recipient + published-only proposal ----------------------------- */

test('valid view returns the exact recipient name and the governed proposal', async () => {
  const res = await viewPost({ request: req({ token: REAL_TOKEN }), env: { ...baseEnv(), LHC_DB: makeDB() } });
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.recipientName, 'DaVonna');
  assert.equal(data.status, 'open');
  assert.equal(data.proposal, PROPOSAL_MARKDOWN);
});

test('proposal content is governed as published and matches the approved source byte-for-byte', () => {
  assert.equal(PROPOSAL_STATUS, 'published');
  const source = readFileSync(new URL('../src/invitation/content/founding-steward-invitation.md', import.meta.url), 'utf8');
  assert.equal(PROPOSAL_MARKDOWN, source);
});

test('renderer preserves approved order, headings, and the exact Founder signature', () => {
  const html = renderProposal(PROPOSAL_MARKDOWN);
  // Approved section order is preserved.
  const order = ['Why I Thought of You', 'Your Role Within the Collective', 'Growing Together', 'Next Steps'];
  let last = -1;
  for (const h of order) {
    const at = html.indexOf(h);
    assert.ok(at > last, `section out of order: ${h}`);
    last = at;
  }
  // Institutional language and the exact signature survive rendering.
  assert.ok(html.includes('<strong>Luscious Honey</strong>'));
  assert.ok(html.includes('<em>Founder, The Luscious Honey Collective</em>'));
  assert.ok(html.includes('Community &amp; Literary Engagement Coordinator'));
  // Bold-italic flagship title renders as nested emphasis.
  assert.ok(html.includes('<strong><em>Pull Me Under</em></strong>'));
});

test('renderer escapes before emphasis so content cannot inject markup', () => {
  const html = renderProposal('a **b** <script>x</script> *c*');
  assert.ok(html.includes('<strong>b</strong>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
});

/* --- Acceptance: persistence, idempotency, notification, honesty ----------- */

function acceptEnv(db, mail) {
  return {
    ...baseEnv(),
    LHC_DB: db,
    RESEND_API_KEY: 'k',
    EMAIL_FROM: 'House <editorial@luscioushoneycollective.com>',
    FOUNDER_NOTIFY_EMAIL: 'founder@luscioushoneycollective.com',
    __mail: mail,
  };
}

test('acceptance persists a durable record and notifies the Founder once', async () => {
  const db = makeDB();
  const sent = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('resend.com')) { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ id: 'm1' }), { status: 200 }); }
    throw new Error('unexpected fetch ' + url);
  };
  const res = await acceptPost({ request: req({ token: REAL_TOKEN }), env: acceptEnv(db) });
  const data = await res.json();
  assert.deepEqual(data, { ok: true, status: 'accepted' });
  assert.equal(db.rows.get(INVITATION.id)?.status, 'accepted');
  assert.equal(db.rows.get(INVITATION.id)?.notified_at !== null, true);
  assert.equal(sent.length, 1);
  assert.match(sent[0].subject, /DaVonna has accepted/);
});

test('repeated acceptance is idempotent: no duplicate write, no second email', async () => {
  const db = makeDB();
  let mails = 0;
  globalThis.fetch = async () => { mails++; return new Response(JSON.stringify({ id: 'm' }), { status: 200 }); };
  await acceptPost({ request: req({ token: REAL_TOKEN }), env: acceptEnv(db) });
  await acceptPost({ request: req({ token: REAL_TOKEN }), env: acceptEnv(db) });
  await acceptPost({ request: req({ token: REAL_TOKEN }), env: acceptEnv(db) });
  assert.equal(db.rows.size, 1);
  assert.equal(mails, 1);
});

test('acceptance with no store returns 503 retry and never fakes success', async () => {
  const res = await acceptPost({ request: req({ token: REAL_TOKEN }), env: baseEnv() });
  assert.equal(res.status, 503);
  const data = await res.json();
  assert.equal(data.ok, false);
  assert.equal(data.retry, true);
});

test('a storage failure returns 503 retry (honest, not a false acceptance)', async () => {
  const brokenDB = { prepare() { return { bind() { return this; }, async run() { throw new Error('db down'); } }; } };
  const res = await acceptPost({ request: req({ token: REAL_TOKEN }), env: { ...baseEnv(), LHC_DB: brokenDB } });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).retry, true);
});

test('invalid token acceptance is non-disclosing and writes nothing', async () => {
  const db = makeDB();
  const res = await acceptPost({ request: req({ token: 'nope' }), env: acceptEnv(db) });
  assert.deepEqual(await res.json(), { ok: false });
  assert.equal(db.rows.size, 0);
});

/* --- Accepted-state restoration -------------------------------------------- */

test('after acceptance, view reports accepted so a refresh restores the closing state', async () => {
  const db = makeDB();
  globalThis.fetch = async () => new Response(JSON.stringify({ id: 'm' }), { status: 200 });
  await acceptPost({ request: req({ token: REAL_TOKEN }), env: acceptEnv(db) });
  const res = await viewPost({ request: req({ token: REAL_TOKEN }), env: { ...baseEnv(), LHC_DB: db } });
  assert.equal((await res.json()).status, 'accepted');
});

/* --- Founder notification content ------------------------------------------ */

test('the Founder notification names the recipient and carries no token', () => {
  const msg = acceptanceNotification('DaVonna', '2026-07-19T12:00:00Z');
  assert.match(msg.subject, /Founding Steward/);
  assert.ok(msg.text.includes('DaVonna'));
  assert.ok(!msg.text.includes(REAL_TOKEN) && !msg.html.includes(REAL_TOKEN));
  assert.equal(founderNotifyAddress({ FOUNDER_NOTIFY_EMAIL: 'f@x' }), 'f@x');
  assert.equal(founderNotifyAddress({ EMAIL_FROM: 'e@x' }), 'e@x');
});

/* --- Founder review retrieval ---------------------------------------------- */

function reviewReq() {
  return new Request('https://x/invitation-review', { method: 'GET' });
}

test('Founder review lists recorded acceptances (owner-facing retrieval)', async () => {
  const db = makeDB();
  globalThis.fetch = async () => new Response(JSON.stringify({ id: 'm' }), { status: 200 });
  await acceptPost({ request: req({ token: REAL_TOKEN }), env: acceptEnv(db) });
  // Local-dev path: Access unconfigured (no ACCESS_* vars) + LHC_LOCAL_DEV bypass.
  const res = await reviewGet({ request: reviewReq(), env: { LHC_DB: db, LHC_LOCAL_DEV: 'true' } });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes('DaVonna'));
  assert.ok(html.includes('accepted'));
  assert.ok(html.includes('Founding Steward'));
});

test('Founder review shows a calm empty state when there are no responses', async () => {
  const res = await reviewGet({ request: reviewReq(), env: { LHC_DB: makeDB(), LHC_LOCAL_DEV: 'true' } });
  assert.equal(res.status, 200);
  assert.ok((await res.text()).includes('No responses yet'));
});

test('Founder review denies an unauthenticated request when Access is configured', async () => {
  // Access configured (vars present) but no valid JWT → not ok → 401.
  const res = await reviewGet({
    request: reviewReq(),
    env: { LHC_DB: makeDB(), ACCESS_TEAM_DOMAIN: 't.cloudflareaccess.com', ACCESS_AUD: 'aud' },
  });
  assert.equal(res.status, 401);
});

/* --- Surface hygiene: no dashboard / menu / workspace scaffolding ---------- */

test('the invitation surface builds no menu, dashboard, or navigation chrome', () => {
  const main = readFileSync(new URL('../src/invitation/main.ts', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../invitation/index.html', import.meta.url), 'utf8');
  // Assert nothing NAVIGATIONAL is constructed (ignore prose/comments — check for
  // actual element/role creation and the HQ chrome hooks).
  const built = main.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''); // strip comments
  for (const forbidden of ["el('nav'", "el(\"nav\"", "role: 'menu'", "role: 'navigation'", 'hq-rail', 'hq-wing', 'progressbar']) {
    assert.ok(!built.includes(forbidden), `main.ts should not build "${forbidden}"`);
  }
  assert.ok(!/<nav\b/i.test(html), 'index.html should have no <nav>');
  // The closing copy says "taking shape" but promises no workspace functionality.
  assert.ok(main.includes('taking shape'));
});

/* --- Token never present in client source ---------------------------------- */

test('no invitation token literal appears in shipped client source', () => {
  const main = readFileSync(new URL('../src/invitation/main.ts', import.meta.url), 'utf8');
  const content = readFileSync(new URL('../functions/_lib/invitation.js', import.meta.url), 'utf8');
  assert.ok(!main.includes(REAL_TOKEN));
  // The server lib reads the token from env only — it is never a literal here.
  assert.ok(!/INVITATION_TOKEN\s*=\s*['"]/.test(content));
});
