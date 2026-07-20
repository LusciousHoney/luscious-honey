/* =============================================================================
   FOUNDING STEWARD INVITATION — guided experience + decision lifecycle tests.
   Covers token resolution (non-disclosing), first-open, the four decisions and
   their states, single/idempotent Founder notifications, the conversation and
   reminder workflows, the Founder advancement workflow (conversation → planning →
   workspace authorization), the workspace rule, personalization, movement
   splitting, byte-identical + server-only proposal, and surface hygiene.
   Deterministic fixtures only; never a production token.
   ============================================================================= */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { renderProposal, splitSections, renderMovements } from '../src/invitation/render.js';
import { hashToken, resolveInvitation, personaFor, phaseOf, STATUS } from '../functions/_lib/invitation.js';
import { PROPOSAL_MARKDOWN, PROPOSAL_STATUS } from '../functions/_lib/invitation-content.js';
import { onRequestPost as viewPost } from '../functions/api/invitation/view.js';
import { onRequestPost as decisionPost } from '../functions/api/invitation/decision.js';
import { onRequestPost as advancePost } from '../functions/api/invitation/advance.js';
import { onRequestGet as reviewGet } from '../functions/invitation-review.js';

const TEST_TOKEN = 'TEST-fixture-token-not-a-real-secret-0000';
const now = (() => { let c = 0; return () => `2026-07-19 12:00:${String(c++).padStart(2, '0')}`; })();

/* --- In-memory D1 modelling the extended `invitations` table --------------- */
function makeDB() {
  const rows = new Map();
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  return {
    rows,
    seed(r) { rows.set(r.id, { opened_at: null, accepted_at: null, notified_at: null, expires_at: null, decision: null, decided_at: null, reminder_period: null, reminder_at: null, conversation_requested_at: null, conversation_complete_at: null, planning_complete_at: null, workspace_authorized_at: null, declined_at: null, ...r }); return this; },
    prepare(sql) {
      const s = norm(sql); let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async run() {
          // markOpened
          if (s.includes("SET opened_at = datetime('now')") && s.includes('opened_at IS NULL')) {
            const r = rows.get(args[0]);
            if (r && r.opened_at === null) { r.opened_at = now(); if (r.status === 'invited') r.status = 'opened'; return { meta: { changes: 1 } }; }
            return { meta: { changes: 0 } };
          }
          // decision: accept
          if (s.includes("status='accepted'")) { const r = rows.get(args[0]); if (r && r.status !== 'accepted' && r.status !== 'declined') { r.status = 'accepted'; r.decision = 'accept'; r.accepted_at = now(); r.decided_at = now(); return { meta: { changes: 1 } }; } return { meta: { changes: 0 } }; }
          // decision: decline
          if (s.includes("status='declined'")) { const r = rows.get(args[0]); if (r && r.status !== 'declined') { r.status = 'declined'; r.decision = 'decline'; r.declined_at = now(); r.decided_at = now(); return { meta: { changes: 1 } }; } return { meta: { changes: 0 } }; }
          // decision: talk
          if (s.includes("status='conversation_requested'")) { const r = rows.get(args[0]); if (r && r.status !== 'accepted' && r.status !== 'declined') { r.status = 'conversation_requested'; r.decision = 'talk'; r.conversation_requested_at = r.conversation_requested_at || now(); return { meta: { changes: 1 } }; } return { meta: { changes: 0 } }; }
          // decision: time  (bind: period, mod, id)
          if (s.includes("status='reminder_scheduled'")) { const r = rows.get(args[2]); if (r && r.status !== 'accepted' && r.status !== 'declined') { r.status = 'reminder_scheduled'; r.decision = 'time'; r.reminder_period = args[0]; r.reminder_at = '2026-08-01 00:00:00'; return { meta: { changes: 1 } }; } return { meta: { changes: 0 } }; }
          // notifyOnce
          if (s.includes('SET notified_at=datetime') || s.includes("SET notified_at = datetime")) { const r = rows.get(args[0]); if (r) { r.notified_at = now(); return { meta: { changes: 1 } }; } return { meta: { changes: 0 } }; }
          // advance: SET status=?, <stamp>=datetime('now') WHERE id=? AND status=?  (bind: to,id,from)
          const adv = /SET status=\?, (\w+)=datetime\('now'\) WHERE id=\? AND status=\?/.exec(s);
          if (adv) { const [to, id, from] = args; const r = rows.get(id); if (r && r.status === from) { r.status = to; r[adv[1]] = now(); return { meta: { changes: 1 } }; } return { meta: { changes: 0 } }; }
          return { meta: { changes: 0 } };
        },
        async first() {
          if (s.includes('WHERE token_hash = ?')) { for (const r of rows.values()) if (r.token_hash === args[0]) return { ...r }; return null; }
          const r = rows.get(args[0]); return r ? { ...r } : null;
        },
        async all() { return { results: [...rows.values()].map((r) => ({ ...r })) }; },
      };
      return api;
    },
  };
}
async function seededDB(o = {}) {
  const db = makeDB();
  db.seed({ id: 'inv_1', recipient_name: 'DaVonna', recipient_slug: 'davonna', token_hash: await hashToken(TEST_TOKEN), proposal_id: 'founding-steward', status: 'invited', created_at: '2026-07-19 11:00:00', ...o });
  return db;
}
const reqJSON = (b) => new Request('https://x/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
function env(db, extra = {}) { return { LHC_DB: db, RESEND_API_KEY: 'k', EMAIL_FROM: 'H <e@x>', FOUNDER_NOTIFY_EMAIL: 'f@x', ...extra }; }
function mailCounter() { let n = 0; globalThis.fetch = async () => { n++; return new Response(JSON.stringify({ id: 'm' }), { status: 200 }); }; return () => n; }
async function decide(db, choice, reminderPeriod) { return decisionPost({ request: reqJSON({ token: TEST_TOKEN, choice, reminderPeriod }), env: env(db) }); }

/* --- Resolution & non-disclosure ------------------------------------------- */
test('valid token resolves; missing/invalid/expired do not (non-disclosing view)', async () => {
  const db = await seededDB();
  assert.equal((await resolveInvitation({ LHC_DB: db }, TEST_TOKEN)).recipient_name, 'DaVonna');
  assert.equal(await resolveInvitation({ LHC_DB: db }, 'nope'), null);
  const a = await (await viewPost({ request: reqJSON({ token: 'nope' }), env: { LHC_DB: db } })).text();
  const b = await (await viewPost({ request: reqJSON({}), env: { LHC_DB: db } })).text();
  assert.equal(a, '{"ok":false}'); assert.equal(a, b);
});

test('view records first open and returns phase + atmospheric personalization', async () => {
  const db = await seededDB(); mailCounter();
  const d = await (await viewPost({ request: reqJSON({ token: TEST_TOKEN }), env: { LHC_DB: db } })).json();
  assert.equal(d.ok, true); assert.equal(d.recipientName, 'DaVonna'); assert.equal(d.phase, 'open');
  assert.equal(d.personalization.accent, 'verdant');   // green, worn softly
  assert.equal(d.proposal, PROPOSAL_MARKDOWN);
  assert.ok(db.rows.get('inv_1').opened_at);
});

test('personaFor is atmospheric only and defaults to house', () => {
  assert.equal(personaFor('davonna').accent, 'verdant');
  assert.equal(personaFor('someone-else').accent, 'house');
});

/* --- The four decisions ---------------------------------------------------- */
test('accept records accepted state and notifies the Founder once (idempotent)', async () => {
  const db = await seededDB(); const mails = mailCounter();
  assert.deepEqual(await (await decide(db, 'accept')).json(), { ok: true, phase: 'accepted' });
  assert.equal(db.rows.get('inv_1').status, 'accepted');
  await decide(db, 'accept'); await decide(db, 'accept');
  assert.equal(mails(), 1);
});

test('decline closes respectfully and notifies once', async () => {
  const db = await seededDB(); const mails = mailCounter();
  assert.deepEqual(await (await decide(db, 'decline')).json(), { ok: true, phase: 'declined' });
  assert.equal(db.rows.get('inv_1').status, 'declined');
  await decide(db, 'decline'); assert.equal(mails(), 1);
});

test('talk requests a conversation and notifies once', async () => {
  const db = await seededDB(); const mails = mailCounter();
  assert.deepEqual(await (await decide(db, 'talk')).json(), { ok: true, phase: 'conversation' });
  assert.equal(db.rows.get('inv_1').status, 'conversation_requested');
  await decide(db, 'talk'); assert.equal(mails(), 1);
});

test('time schedules a reminder (no email) and can be re-selected', async () => {
  const db = await seededDB(); const mails = mailCounter();
  const r = await (await decide(db, 'time', 'two weeks')).json();
  assert.equal(r.phase, 'reminder'); assert.equal(r.reminder.period, 'two weeks');
  assert.equal(db.rows.get('inv_1').status, 'reminder_scheduled');
  assert.equal(db.rows.get('inv_1').reminder_period, 'two weeks');
  assert.equal(mails(), 0);
});

test('decision with no store returns honest 503, never fakes success', async () => {
  const res = await decisionPost({ request: reqJSON({ token: TEST_TOKEN, choice: 'accept' }), env: { INVITATION: 1 } });
  // no LHC_DB but token resolves? resolveInvitation needs LHC_DB → null → neutral 200:
  assert.equal(res.status, 200);
  const broken = { prepare() { return { bind() { return this; }, async run() { throw new Error('x'); }, async first() { return null; } }; } };
  // resolves via a working read but write throws:
  const db = await seededDB();
  const failing = { prepare(sql) { return sql.includes("status='accepted'") ? { bind() { return this; }, async run() { throw new Error('x'); } } : db.prepare(sql); } };
  const r2 = await decisionPost({ request: reqJSON({ token: TEST_TOKEN, choice: 'accept' }), env: env(failing) });
  assert.equal(r2.status, 503); assert.equal((await r2.json()).retry, true);
  assert.ok(broken);
});

test('invalid token decision is non-disclosing and writes nothing', async () => {
  const db = await seededDB();
  assert.deepEqual(await (await decisionPost({ request: reqJSON({ token: 'nope', choice: 'accept' }), env: env(db) })).json(), { ok: false });
  assert.equal(db.rows.get('inv_1').status, 'invited');
});

/* --- Conversation workflow: talk → Founder records complete → decide -------- */
test('conversation workflow: talk → record complete → considering → accept', async () => {
  const db = await seededDB(); mailCounter();
  await decide(db, 'talk');
  const adv = await advancePost({ request: reqJSON({ id: 'inv_1', action: 'record_conversation_complete' }), env: env(db, { LHC_LOCAL_DEV: 'true' }) });
  assert.equal(adv.status, 200); assert.equal((await adv.json()).status, STATUS.CONSIDERING);
  assert.equal(db.rows.get('inv_1').status, 'considering');
  // view now routes back to the decision
  assert.equal(phaseOf(db.rows.get('inv_1')), 'open');
  assert.deepEqual(await (await decide(db, 'accept')).json(), { ok: true, phase: 'accepted' });
});

/* --- Founder workflow: accept → planning → authorize workspace -------------- */
test('Founder workflow: accepted → planning complete → workspace authorized (never automatic)', async () => {
  const db = await seededDB(); mailCounter();
  await decide(db, 'accept');
  // acceptance alone does NOT authorize a workspace
  assert.equal(db.rows.get('inv_1').workspace_authorized_at, null);
  const e = env(db, { LHC_LOCAL_DEV: 'true' });
  await advancePost({ request: reqJSON({ id: 'inv_1', action: 'record_planning_complete' }), env: e });
  assert.equal(db.rows.get('inv_1').status, 'planning_complete');
  await advancePost({ request: reqJSON({ id: 'inv_1', action: 'authorize_workspace' }), env: e });
  assert.equal(db.rows.get('inv_1').status, 'ready_for_workspace');
  assert.ok(db.rows.get('inv_1').workspace_authorized_at);
  // out-of-order authorization is rejected (guarded transition)
  const db2 = await seededDB(); await decide(db2, 'accept');
  const r = await advancePost({ request: reqJSON({ id: 'inv_1', action: 'authorize_workspace' }), env: env(db2, { LHC_LOCAL_DEV: 'true' }) });
  assert.equal((await r.json()).ok, false);
});

test('advance fails closed without a verified Access identity', async () => {
  const db = await seededDB(); await decide(db, 'accept');
  const r = await advancePost({ request: reqJSON({ id: 'inv_1', action: 'record_planning_complete' }), env: { LHC_DB: db, ACCESS_TEAM_DOMAIN: 't', ACCESS_AUD: 'a' } });
  assert.equal(r.status, 401);
});

/* --- Founder review lifecycle ---------------------------------------------- */
test('review renders lifecycle + the right advancement control, Access-gated', async () => {
  const db = await seededDB(); mailCounter(); await decide(db, 'accept');
  const html = await (await reviewGet({ request: new Request('https://x/invitation-review'), env: env(db, { LHC_LOCAL_DEV: 'true' }) })).text();
  assert.ok(html.includes('DaVonna') && html.includes('Accepted'));
  assert.ok(html.includes('record_planning_complete'));   // the next Founder action
  assert.ok(!html.includes(await hashToken(TEST_TOKEN)) && !html.includes('/invitation/#'));
  // gated when Access configured but unauthenticated
  const r = await reviewGet({ request: new Request('https://x/invitation-review'), env: { LHC_DB: db, ACCESS_TEAM_DOMAIN: 't', ACCESS_AUD: 'a' } });
  assert.equal(r.status, 401);
});

/* --- Content: movements, byte-identity, server-only ------------------------ */
test('the letter splits into paced movements without losing or reordering copy', () => {
  const secs = splitSections(PROPOSAL_MARKDOWN);
  assert.ok(secs.length >= 6);
  const movements = renderMovements(PROPOSAL_MARKDOWN);
  assert.ok(movements.length >= 3 && movements.length <= 6);
  const joined = movements.join('\n');
  for (const marker of ['Founding Stewards', 'Community &amp; Literary Engagement Coordinator', '<strong><em>Pull Me Under</em></strong>', '<strong>Luscious Honey</strong>'])
    assert.ok(joined.includes(marker), `movement copy missing: ${marker}`);
});

test('proposal is published, byte-identical to source, and server-only', () => {
  assert.equal(PROPOSAL_STATUS, 'published');
  const src = readFileSync(new URL('../src/invitation/content/founding-steward-invitation.md', import.meta.url), 'utf8');
  assert.equal(PROPOSAL_MARKDOWN, src);
  const main = readFileSync(new URL('../src/invitation/main.ts', import.meta.url), 'utf8');
  assert.ok(!main.includes('Dear DaVonna'));   // copy never shipped in the client entry
});

test('the invitation surface builds no menu, dashboard, or navigation chrome', () => {
  const main = readFileSync(new URL('../src/invitation/main.ts', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  for (const f of ["el('nav'", 'hq-rail', 'hq-wing', 'progressbar', 'dashboard'])
    assert.ok(!main.includes(f), `should not build ${f}`);
  assert.ok(!main.includes(TEST_TOKEN));
});
