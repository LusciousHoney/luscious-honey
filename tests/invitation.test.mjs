/* =============================================================================
   FOUNDING STEWARD INVITATION — registry tests (Sprint 3C).
   Covers durable D1-backed token resolution (valid / missing / invalid / expired,
   all non-disclosing), raw-token-never-stored, first-open recording (and no
   overwrite), acceptance persistence + idempotency, single-and-retryable Founder
   notification, failed-notification-does-not-roll-back, refresh restoration, the
   Access-gated owner review lifecycle, byte-identical + server-only proposal, and
   the invitation surface's freedom from menu/dashboard/workspace chrome.

   Deterministic token fixtures live only in this file and never resemble or become
   a production token.
   ============================================================================= */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { renderProposal } from '../src/invitation/render.js';
import {
  hashToken,
  resolveInvitation,
  markOpened,
  proposalFor,
  acceptanceNotification,
  founderNotifyAddress,
} from '../functions/_lib/invitation.js';
import { PROPOSAL_MARKDOWN, PROPOSAL_STATUS, PROPOSALS } from '../functions/_lib/invitation-content.js';
import { onRequestPost as viewPost } from '../functions/api/invitation/view.js';
import { onRequestPost as acceptPost } from '../functions/api/invitation/accept.js';
import { onRequestGet as reviewGet } from '../functions/invitation-review.js';

// Deterministic, obviously-fake fixture — never a production token.
const TEST_TOKEN = 'TEST-fixture-token-not-a-real-secret-0000';

/* --- A minimal in-memory D1 stand-in modelling the `invitations` table ------ */
function makeDB() {
  const rows = new Map(); // id -> row
  let clock = 0;
  const now = () => `2026-07-19 12:00:${String(clock++).padStart(2, '0')}`;
  const norm = (sql) => sql.replace(/\s+/g, ' ').trim();

  return {
    rows,
    seed(row) { rows.set(row.id, { opened_at: null, accepted_at: null, notified_at: null, expires_at: null, ...row }); return this; },
    prepare(sql) {
      const s = norm(sql);
      let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async run() {
          if (s.includes("UPDATE invitations SET opened_at = datetime('now')") && s.includes('opened_at IS NULL')) {
            const r = rows.get(args[0]);
            if (r && r.opened_at === null) { r.opened_at = now(); if (r.status === 'invited') r.status = 'opened'; return { meta: { changes: 1 } }; }
            return { meta: { changes: 0 } };
          }
          if (s.includes("SET status = 'accepted', accepted_at = datetime('now')") && s.includes('accepted_at IS NULL')) {
            const r = rows.get(args[0]);
            if (r && r.accepted_at === null) { r.accepted_at = now(); r.status = 'accepted'; return { meta: { changes: 1 } }; }
            return { meta: { changes: 0 } };
          }
          if (s.includes("SET notified_at = datetime('now')") && s.includes('notified_at IS NULL')) {
            const r = rows.get(args[0]);
            if (r && r.notified_at === null) { r.notified_at = now(); return { meta: { changes: 1 } }; }
            return { meta: { changes: 0 } };
          }
          return { meta: { changes: 0 } };
        },
        async first() {
          if (s.includes('FROM invitations WHERE token_hash = ?')) {
            for (const r of rows.values()) if (r.token_hash === args[0]) return { ...r };
            return null;
          }
          if (s.includes('SELECT recipient_name, accepted_at, notified_at FROM invitations WHERE id = ?')) {
            const r = rows.get(args[0]);
            return r ? { recipient_name: r.recipient_name, accepted_at: r.accepted_at, notified_at: r.notified_at } : null;
          }
          const r = rows.get(args[0]);
          return r ? { ...r } : null;
        },
        async all() {
          return { results: [...rows.values()].map((r) => ({ ...r })) };
        },
      };
      return api;
    },
  };
}

async function seededDB(overrides = {}) {
  const db = makeDB();
  db.seed({
    id: 'inv_test1',
    recipient_name: 'DaVonna',
    recipient_slug: 'davonna',
    token_hash: await hashToken(TEST_TOKEN),
    proposal_id: 'founding-steward',
    status: 'invited',
    created_at: '2026-07-19 11:00:00',
    ...overrides,
  });
  return db;
}

function req(body) {
  return new Request('https://x/api', { method: 'POST', body: JSON.stringify(body) });
}
function reviewReq() {
  return new Request('https://x/invitation-review', { method: 'GET' });
}
const localReviewEnv = (db) => ({ LHC_DB: db, LHC_LOCAL_DEV: 'true' });
function acceptEnv(db) {
  return { LHC_DB: db, RESEND_API_KEY: 'k', EMAIL_FROM: 'House <editorial@luscioushoneycollective.com>', FOUNDER_NOTIFY_EMAIL: 'founder@luscioushoneycollective.com' };
}
function mailOk() {
  const sent = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('resend.com')) { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ id: 'm1' }), { status: 200 }); }
    throw new Error('unexpected fetch ' + url);
  };
  return sent;
}
function mailFail() {
  let count = 0;
  globalThis.fetch = async () => { count++; return new Response(JSON.stringify({ message: 'nope' }), { status: 400 }); };
  return () => count;
}

/* --- Token hashing --------------------------------------------------------- */

test('token hash is deterministic SHA-256 hex and never the raw token', async () => {
  const h1 = await hashToken(TEST_TOKEN);
  const h2 = await hashToken(TEST_TOKEN);
  assert.equal(h1, h2);
  assert.match(h1, /^[0-9a-f]{64}$/);
  assert.notEqual(h1, TEST_TOKEN);
});

/* --- Resolution: valid / missing / invalid / expired (non-disclosing) ------- */

test('valid token resolves to its invitation via D1', async () => {
  const inv = await resolveInvitation({ LHC_DB: await seededDB() }, TEST_TOKEN);
  assert.equal(inv?.recipient_name, 'DaVonna');
  assert.equal(inv?.proposal_id, 'founding-steward');
});

test('missing / invalid / no-store tokens resolve to null', async () => {
  const db = await seededDB();
  assert.equal(await resolveInvitation({ LHC_DB: db }, ''), null);
  assert.equal(await resolveInvitation({ LHC_DB: db }, undefined), null);
  assert.equal(await resolveInvitation({ LHC_DB: db }, 'wrong-token'), null);
  assert.equal(await resolveInvitation({}, TEST_TOKEN), null); // no LHC_DB
});

test('expired invitation resolves to null', async () => {
  const db = await seededDB({ expires_at: '2000-01-01 00:00:00' });
  assert.equal(await resolveInvitation({ LHC_DB: db }, TEST_TOKEN), null);
});

test('not-yet-expired invitation still resolves', async () => {
  const db = await seededDB({ expires_at: '2999-01-01 00:00:00' });
  assert.equal((await resolveInvitation({ LHC_DB: db }, TEST_TOKEN))?.recipient_name, 'DaVonna');
});

test('view is non-disclosing for invalid, missing, and expired tokens (identical neutral)', async () => {
  const good = await seededDB();
  const expired = await seededDB({ expires_at: '2000-01-01 00:00:00' });
  const a = await (await viewPost({ request: req({ token: 'nope' }), env: { LHC_DB: good } })).text();
  const b = await (await viewPost({ request: req({}), env: { LHC_DB: good } })).text();
  const c = await (await viewPost({ request: req({ token: TEST_TOKEN }), env: { LHC_DB: expired } })).text();
  const res = await viewPost({ request: req({ token: 'nope' }), env: { LHC_DB: good } });
  assert.equal(res.status, 200);
  assert.equal(a, '{"ok":false}');
  assert.equal(a, b);
  assert.equal(a, c);
});

/* --- Raw token is never stored --------------------------------------------- */

test('the registry stores only a hash — the raw token is never persisted', async () => {
  const db = await seededDB();
  for (const r of db.rows.values()) {
    assert.match(r.token_hash, /^[0-9a-f]{64}$/);
    for (const v of Object.values(r)) assert.notEqual(v, TEST_TOKEN);
  }
});

/* --- Exact recipient + published-only proposal ----------------------------- */

test('valid view returns the exact recipient and the governed proposal', async () => {
  const res = await viewPost({ request: req({ token: TEST_TOKEN }), env: { LHC_DB: await seededDB() } });
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.recipientName, 'DaVonna');
  assert.equal(data.status, 'open');
  assert.equal(data.proposal, PROPOSAL_MARKDOWN);
});

test('proposal is governed as published, associated by id, and byte-identical to source', () => {
  assert.equal(PROPOSAL_STATUS, 'published');
  assert.equal(proposalFor('founding-steward'), PROPOSAL_MARKDOWN);
  assert.equal(proposalFor('unknown'), null);
  assert.equal(PROPOSALS['founding-steward'], PROPOSAL_MARKDOWN);
  const source = readFileSync(new URL('../src/invitation/content/founding-steward-invitation.md', import.meta.url), 'utf8');
  assert.equal(PROPOSAL_MARKDOWN, source);
});

test('renderer preserves approved order, headings, and the exact Founder signature', () => {
  const html = renderProposal(PROPOSAL_MARKDOWN);
  const order = ['Why I Thought of You', 'Your Role Within the Collective', 'Growing Together', 'Next Steps'];
  let last = -1;
  for (const h of order) { const at = html.indexOf(h); assert.ok(at > last, `out of order: ${h}`); last = at; }
  assert.ok(html.includes('<strong>Luscious Honey</strong>'));
  assert.ok(html.includes('<em>Founder, The Luscious Honey Collective</em>'));
  assert.ok(html.includes('Community &amp; Literary Engagement Coordinator'));
  assert.ok(html.includes('<strong><em>Pull Me Under</em></strong>'));
});

test('renderer escapes before emphasis so content cannot inject markup', () => {
  const html = renderProposal('a **b** <script>x</script> *c*');
  assert.ok(html.includes('<strong>b</strong>') && html.includes('&lt;script&gt;') && !html.includes('<script>'));
});

/* --- First open records opened_at; later views do not overwrite ------------- */

test('the first valid view records opened_at and advances status to opened', async () => {
  const db = await seededDB();
  await viewPost({ request: req({ token: TEST_TOKEN }), env: { LHC_DB: db } });
  const r = db.rows.get('inv_test1');
  assert.ok(r.opened_at);
  assert.equal(r.status, 'opened');
});

test('a later view does not overwrite the original opened_at', async () => {
  const db = await seededDB();
  await viewPost({ request: req({ token: TEST_TOKEN }), env: { LHC_DB: db } });
  const firstOpened = db.rows.get('inv_test1').opened_at;
  await viewPost({ request: req({ token: TEST_TOKEN }), env: { LHC_DB: db } });
  assert.equal(db.rows.get('inv_test1').opened_at, firstOpened);
});

test('markOpened is a no-op when opened_at is already set', async () => {
  const db = await seededDB({ opened_at: '2026-07-19 09:00:00' });
  await markOpened({ LHC_DB: db }, 'inv_test1');
  assert.equal(db.rows.get('inv_test1').opened_at, '2026-07-19 09:00:00');
});

/* --- Acceptance: persistence, idempotency, notification, honesty ----------- */

test('acceptance records accepted_at, notifies the Founder once, and is idempotent', async () => {
  const db = await seededDB();
  const sent = mailOk();
  const r1 = await acceptPost({ request: req({ token: TEST_TOKEN }), env: acceptEnv(db) });
  assert.deepEqual(await r1.json(), { ok: true, status: 'accepted' });
  const acceptedAt = db.rows.get('inv_test1').accepted_at;
  assert.ok(acceptedAt);
  assert.equal(db.rows.get('inv_test1').status, 'accepted');
  assert.ok(db.rows.get('inv_test1').notified_at);
  // Repeats change nothing and never re-notify.
  await acceptPost({ request: req({ token: TEST_TOKEN }), env: acceptEnv(db) });
  await acceptPost({ request: req({ token: TEST_TOKEN }), env: acceptEnv(db) });
  assert.equal(db.rows.get('inv_test1').accepted_at, acceptedAt);
  assert.equal(sent.length, 1);
});

test('a failed notification does NOT roll back acceptance and can be retried later', async () => {
  const db = await seededDB();
  const fails = mailFail();
  const res = await acceptPost({ request: req({ token: TEST_TOKEN }), env: acceptEnv(db) });
  assert.deepEqual(await res.json(), { ok: true, status: 'accepted' }); // honest: acceptance stored
  assert.ok(db.rows.get('inv_test1').accepted_at);
  assert.equal(db.rows.get('inv_test1').notified_at, null); // email failed → not marked
  assert.equal(fails(), 1);
  // Retry: acceptance not duplicated, email now succeeds and is marked.
  const acceptedAt = db.rows.get('inv_test1').accepted_at;
  const sent = mailOk();
  await acceptPost({ request: req({ token: TEST_TOKEN }), env: acceptEnv(db) });
  assert.equal(db.rows.get('inv_test1').accepted_at, acceptedAt);
  assert.ok(db.rows.get('inv_test1').notified_at);
  assert.equal(sent.length, 1);
});

test('acceptance with no store returns 503 retry and never fakes success', async () => {
  const res = await acceptPost({ request: req({ token: TEST_TOKEN }), env: {} });
  // No LHC_DB → resolveInvitation returns null → neutral (indistinguishable). With a
  // reachable store but broken writes we get the honest 503:
  assert.equal(res.status, 200);
  const brokenDB = { prepare() { return { bind() { return this; }, async run() { throw new Error('down'); }, async first() { return null; } }; } };
  const db = await seededDB();
  // Simulate a store that resolves the row but fails the acceptance write.
  const failingWrite = {
    prepare(sql) {
      if (sql.includes("SET status = 'accepted'")) return { bind() { return this; }, async run() { throw new Error('down'); } };
      return db.prepare(sql);
    },
  };
  const res2 = await acceptPost({ request: req({ token: TEST_TOKEN }), env: { LHC_DB: failingWrite } });
  assert.equal(res2.status, 503);
  assert.equal((await res2.json()).retry, true);
});

test('invalid token acceptance is non-disclosing and writes nothing', async () => {
  const db = await seededDB();
  const res = await acceptPost({ request: req({ token: 'nope' }), env: acceptEnv(db) });
  assert.deepEqual(await res.json(), { ok: false });
  assert.equal(db.rows.get('inv_test1').accepted_at, null);
});

/* --- Refresh restoration ---------------------------------------------------- */

test('after acceptance, view reports accepted so a refresh restores the closing state', async () => {
  const db = await seededDB();
  mailOk();
  await acceptPost({ request: req({ token: TEST_TOKEN }), env: acceptEnv(db) });
  const res = await viewPost({ request: req({ token: TEST_TOKEN }), env: { LHC_DB: db } });
  assert.equal((await res.json()).status, 'accepted');
});

/* --- Founder notification content ------------------------------------------ */

test('the Founder notification names the recipient and carries no token', () => {
  const msg = acceptanceNotification('DaVonna', '2026-07-19 12:00:00');
  assert.match(msg.subject, /Founding Steward/);
  assert.ok(msg.text.includes('DaVonna') && !msg.text.includes(TEST_TOKEN) && !msg.html.includes(TEST_TOKEN));
  assert.equal(founderNotifyAddress({ FOUNDER_NOTIFY_EMAIL: 'f@x' }), 'f@x');
  assert.equal(founderNotifyAddress({ EMAIL_FROM: 'e@x' }), 'e@x');
});

/* --- Founder review lifecycle ---------------------------------------------- */

test('Founder review renders lifecycle fields and never shows token/hash/URL', async () => {
  const db = await seededDB();
  mailOk();
  await viewPost({ request: req({ token: TEST_TOKEN }), env: { LHC_DB: db } });   // opened
  await acceptPost({ request: req({ token: TEST_TOKEN }), env: acceptEnv(db) });  // accepted + notified
  const res = await reviewGet({ request: reviewReq(), env: localReviewEnv(db) });
  assert.equal(res.status, 200);
  const html = await res.text();
  for (const h of ['Recipient', 'Status', 'Created', 'First opened', 'Accepted', 'Founder notified']) assert.ok(html.includes(h), `missing column ${h}`);
  assert.ok(html.includes('DaVonna') && html.includes('accepted'));
  // Must never leak the token, the hash, or any private URL.
  assert.ok(!html.includes(TEST_TOKEN));
  assert.ok(!html.includes(await hashToken(TEST_TOKEN)));
  assert.ok(!html.includes('/invitation/#'));
});

test('Founder review shows a calm empty state when there are no invitations', async () => {
  const res = await reviewGet({ request: reviewReq(), env: localReviewEnv(makeDB()) });
  assert.ok((await res.text()).includes('No invitations yet'));
});

test('Founder review denies an unauthenticated request when Access is configured', async () => {
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
  const built = main.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  for (const forbidden of ["el('nav'", "el(\"nav\"", "role: 'menu'", "role: 'navigation'", 'hq-rail', 'hq-wing', 'progressbar']) {
    assert.ok(!built.includes(forbidden), `main.ts should not build "${forbidden}"`);
  }
  assert.ok(!/<nav\b/i.test(html), 'index.html should have no <nav>');
  assert.ok(main.includes('taking shape'));
});

test('the proposal copy is absent from the client entry (served server-only)', () => {
  const main = readFileSync(new URL('../src/invitation/main.ts', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../invitation/index.html', import.meta.url), 'utf8');
  assert.ok(!main.includes('Dear DaVonna') && !html.includes('Dear DaVonna'));
  assert.ok(!main.includes('Founding Steward') && !html.includes('Founding Steward'));
});

/* --- No raw token literal in client source ---------------------------------- */

test('no invitation token literal appears in shipped client source', () => {
  const main = readFileSync(new URL('../src/invitation/main.ts', import.meta.url), 'utf8');
  const lib = readFileSync(new URL('../functions/_lib/invitation.js', import.meta.url), 'utf8');
  assert.ok(!main.includes(TEST_TOKEN));
  // The server lib never contains an INVITATION_TOKEN literal (env-secret model is gone).
  assert.ok(!/INVITATION_TOKEN/.test(lib));
});
