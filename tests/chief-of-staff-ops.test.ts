/* =============================================================================
   CHIEF OF STAFF — OPERATIONAL ENGINE tests (Sprint 12A).

   These lock the first operational capability of the Chief of Staff: that
   recommendations are intaken honestly (nothing fabricated), routed only to real
   Register Chairs, progressed only along a permitted lifecycle, answered with the
   Founder's real decision, and gathered into one integrated, derived briefing
   that stays honestly quiet until real work exists.
   ============================================================================= */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PRIORITIES, priorityLabel,
  REC_STATUSES, recStatusLabel, isActiveStatus, canTransition,
  makeRecommendation, routeRecommendation, setPriority, advance, recordFounderDecision,
  activeRecommendations, awaitingFounder, inExecution, chairWorkload, unassigned,
  ownerLabel, decisionLabel,
  operationalBriefing,
  RECOMMENDATIONS_KEY, isRecommendation, loadRecommendations, saveRecommendations, upsertRecommendation,
  type Recommendation,
} from '../src/headquarters/chief-of-staff-ops.ts';
import { CHAIR_CHIEF_OF_STAFF, CHAIR_CREATIVE_DIRECTOR, STORAGE_ROOT } from '../src/headquarters/executive-register.ts';

const T = new Date('2026-07-16T09:00:00.000Z');
function rec(over: Partial<Recommendation> = {}): Recommendation {
  return { ...makeRecommendation({ id: over.id ?? 'r1', title: 't', summary: 's' }, T)!, ...over };
}

/* --- honest empty state --------------------------------------------------- */
test('the engine starts empty — nothing is fabricated', () => {
  assert.deepEqual(loadRecommendations(), []);
  const brief = operationalBriefing([]);
  assert.equal(brief.quiet, true);
  assert.equal(brief.waitingCount, 0);
  assert.deepEqual(brief.priorities, []);
  // Workload is still reported per real Chair, honestly zero.
  assert.ok(brief.workload.length >= 2);
  assert.ok(brief.workload.every((w) => w.activeCount === 0));
});

/* --- intake --------------------------------------------------------------- */
test('makeRecommendation requires title + summary and defaults honestly', () => {
  assert.equal(makeRecommendation({ id: 'x', title: '  ', summary: 's' }, T), null);
  assert.equal(makeRecommendation({ id: 'x', title: 't', summary: '   ' }, T), null);
  const r = makeRecommendation({ id: 'x', title: '  Ship HQ  ', summary: '  deploy  ' }, T)!;
  assert.equal(r.title, 'Ship HQ');
  assert.equal(r.summary, 'deploy');
  assert.equal(r.ownerChairId, null);
  assert.equal(r.priority, 'next');
  assert.equal(r.status, 'preparing');
  assert.equal(r.founderDecision, 'pending');
  assert.equal(r.createdAt, T.toISOString());
});

test('an unknown owner id at intake is dropped to unassigned (honest)', () => {
  const r = makeRecommendation({ id: 'x', title: 't', summary: 's', ownerChairId: 'not_a_chair' }, T)!;
  assert.equal(r.ownerChairId, null);
  const ok = makeRecommendation({ id: 'y', title: 't', summary: 's', ownerChairId: CHAIR_CREATIVE_DIRECTOR }, T)!;
  assert.equal(ok.ownerChairId, CHAIR_CREATIVE_DIRECTOR);
});

/* --- routing (only to real Chairs) ---------------------------------------- */
test('routeRecommendation validates against the Register; null unassigns', () => {
  const r = rec();
  assert.equal(routeRecommendation(r, CHAIR_CREATIVE_DIRECTOR).ownerChairId, CHAIR_CREATIVE_DIRECTOR);
  assert.equal(routeRecommendation(r, 'ghost').ownerChairId, null, 'unknown id leaves owner unchanged (was null)');
  const owned = routeRecommendation(r, CHAIR_CREATIVE_DIRECTOR);
  assert.equal(routeRecommendation(owned, 'ghost').ownerChairId, CHAIR_CREATIVE_DIRECTOR, 'unknown id does not clear a real owner');
  assert.equal(routeRecommendation(owned, null).ownerChairId, null, 'null unassigns');
});

test('ownerLabel and decisionLabel read from the Register', () => {
  assert.equal(ownerLabel(rec()), 'Unassigned');
  assert.equal(ownerLabel(routeRecommendation(rec(), CHAIR_CHIEF_OF_STAFF)), 'Chief of Staff');
  assert.equal(decisionLabel(rec()), 'Pending');
});

/* --- lifecycle ------------------------------------------------------------ */
test('the lifecycle only permits defined transitions', () => {
  assert.ok(canTransition('preparing', 'awaiting_founder'));
  assert.ok(!canTransition('preparing', 'complete'), 'cannot skip to complete');
  assert.ok(!canTransition('complete', 'executing'), 'complete is terminal');
  assert.ok(!canTransition('withdrawn', 'preparing'), 'withdrawn is terminal');
  // advance refuses an illegal jump and leaves the record unchanged.
  const r = rec();
  assert.equal(advance(r, 'complete', T).status, 'preparing', 'illegal advance is a no-op');
  assert.equal(advance(r, 'awaiting_founder', T).status, 'awaiting_founder');
});

test('recording the Founder decision moves status to match her answer', () => {
  const waiting = advance(rec(), 'awaiting_founder', T);
  assert.equal(recordFounderDecision(waiting, 'approved', T).status, 'decided');
  assert.equal(recordFounderDecision(waiting, 'approved_with_changes', T).status, 'decided');
  assert.equal(recordFounderDecision(waiting, 'declined', T).status, 'withdrawn');
  assert.equal(recordFounderDecision(waiting, 'deferred', T).status, 'held');
  assert.equal(recordFounderDecision(waiting, 'approved', T).founderDecision, 'approved');
});

test('setPriority validates and updates', () => {
  assert.equal(setPriority(rec(), 'now', T).priority, 'now');
  assert.equal(setPriority(rec(), 'bogus' as never, T).priority, 'next', 'unknown priority is a no-op');
});

/* --- derived views -------------------------------------------------------- */
test('active view excludes closed items and orders by priority', () => {
  const now  = setPriority(rec({ id: 'a' }), 'now', T);
  const next = rec({ id: 'b' }); // next
  const later = setPriority(rec({ id: 'c' }), 'later', T);
  const done = advance(advance(advance(rec({ id: 'd' }), 'awaiting_founder', T), 'decided', T), 'complete', T);
  const active = activeRecommendations([later, done, now, next]);
  assert.deepEqual(active.map((r) => r.id), ['a', 'b', 'c'], 'now, next, later — closed excluded');
});

test('awaitingFounder and inExecution surface the right states', () => {
  const waiting = advance(rec({ id: 'w' }), 'awaiting_founder', T);
  const executing = advance(recordFounderDecision(advance(rec({ id: 'e' }), 'awaiting_founder', T), 'approved', T), 'executing', T);
  const list = [waiting, executing];
  assert.deepEqual(awaitingFounder(list).map((r) => r.id), ['w']);
  assert.deepEqual(inExecution(list).map((r) => r.id), ['e']);
});

test('chairWorkload counts active work per real Chair, unowned surfaced separately', () => {
  const a = routeRecommendation(rec({ id: 'a' }), CHAIR_CREATIVE_DIRECTOR);
  const b = routeRecommendation(rec({ id: 'b' }), CHAIR_CREATIVE_DIRECTOR);
  const c = rec({ id: 'c' }); // unassigned
  const load = chairWorkload([a, b, c]);
  const cd = load.find((w) => w.chairId === CHAIR_CREATIVE_DIRECTOR)!;
  assert.equal(cd.activeCount, 2);
  const cofs = load.find((w) => w.chairId === CHAIR_CHIEF_OF_STAFF)!;
  assert.equal(cofs.activeCount, 0, 'honest zero');
  assert.deepEqual(unassigned([a, b, c]).map((r) => r.id), ['c']);
});

/* --- the integrated briefing ---------------------------------------------- */
test('operationalBriefing integrates the whole picture from real records', () => {
  const waiting = advance(routeRecommendation(setPriority(rec({ id: 'w' }), 'now', T), CHAIR_CREATIVE_DIRECTOR), 'awaiting_founder', T);
  const executing = advance(recordFounderDecision(advance(routeRecommendation(rec({ id: 'e' }), CHAIR_CHIEF_OF_STAFF), 'awaiting_founder', T), 'approved', T), 'executing', T);
  const brief = operationalBriefing([executing, waiting]);
  assert.equal(brief.quiet, false);
  assert.equal(brief.waitingCount, 1);
  assert.equal(brief.priorities[0].id, 'w', 'the "now" item leads the priorities');
  assert.deepEqual(brief.inExecution.map((r) => r.id), ['e']);
  assert.equal(brief.workload.find((w) => w.chairId === CHAIR_CREATIVE_DIRECTOR)!.activeCount, 1);
});

/* --- persistence ---------------------------------------------------------- */
test('storage key is namespaced + versioned; guard rejects malformed rows', () => {
  assert.ok(RECOMMENDATIONS_KEY.startsWith(STORAGE_ROOT + '.'));
  assert.ok(/\.v\d+$/.test(RECOMMENDATIONS_KEY));
  assert.ok(isRecommendation(rec()));
  assert.ok(!isRecommendation({ id: 'x' }));
  assert.ok(!isRecommendation({ ...rec(), status: 'nonsense' }), 'unknown status is rejected');
});

test('persistence is fail-closed and upsert is one-record-per-id', () => {
  assert.doesNotThrow(() => saveRecommendations([rec()]));
  assert.deepEqual(loadRecommendations(), [], 'no localStorage in tests → honest empty, never throws');
  let store = upsertRecommendation([], rec({ id: 'a', priority: 'now' }));
  store = upsertRecommendation(store, rec({ id: 'a', priority: 'later' }));
  assert.equal(store.length, 1, 'one record per id');
  assert.equal(store[0].priority, 'later', 'the upsert replaced');
});

/* --- catalogues ----------------------------------------------------------- */
test('priorities and statuses expose labels', () => {
  assert.deepEqual(PRIORITIES.map((p) => p.id), ['now', 'next', 'later']);
  assert.equal(priorityLabel('now'), 'Now');
  assert.ok(REC_STATUSES.length === 7);
  assert.equal(recStatusLabel('awaiting_founder'), 'Awaiting You');
  assert.equal(isActiveStatus('executing'), true);
  assert.equal(isActiveStatus('complete'), false);
});
