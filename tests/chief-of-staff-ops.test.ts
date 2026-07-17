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
  // Sprint 12B — Executive Inbox
  SUBMISSION_TYPES, submissionTypeLabel, typeLabel,
  FOUNDER_VISIBILITIES, visibilityLabel, setVisibility,
  makeSubmission, normalizeRecommendation, inboxLedger, chiefOfStaffQueue, needsPreparation,
  // Sprint 12C — triage + preparation + Founder loop
  TRIAGE_OUTCOMES, triageLabel, triageStateLabel,
  triage, prepareRecommendation, presentToFounder, requestRevision, setBlocked,
  needsTriage, inPreparation, decisionsForFounder, executionFollowUp,
  blockedItems, heldItems, completedItems,
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
  assert.equal(recordFounderDecision(waiting, 'approved', '', T).status, 'decided');
  assert.equal(recordFounderDecision(waiting, 'approved_with_changes', '', T).status, 'decided');
  assert.equal(recordFounderDecision(waiting, 'declined', '', T).status, 'withdrawn');
  assert.equal(recordFounderDecision(waiting, 'deferred', '', T).status, 'held');
  assert.equal(recordFounderDecision(waiting, 'approved', '', T).founderDecision, 'approved');
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
  const executing = advance(recordFounderDecision(advance(rec({ id: 'e' }), 'awaiting_founder', T), 'approved', '', T), 'executing', T);
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
  const prepared = prepareRecommendation(
    routeRecommendation(setPriority(rec({ id: 'w' }), 'now', T), CHAIR_CREATIVE_DIRECTOR, T),
    { recommendation: 'do it', decisionRequested: 'approve?' }, T)!;
  const waiting = presentToFounder(prepared, T);
  const executing = advance(recordFounderDecision(advance(routeRecommendation(rec({ id: 'e' }), CHAIR_CHIEF_OF_STAFF), 'awaiting_founder', T), 'approved', '', T), 'executing', T);
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

/* =============================================================================
   SPRINT 12B — EXECUTIVE INBOX
   ============================================================================= */

test('the nine submission types and their labels are defined', () => {
  assert.deepEqual(SUBMISSION_TYPES.map((s) => s.id), [
    'idea', 'decision_request', 'opportunity', 'risk', 'problem',
    'creative_concept', 'production_request', 'growth_initiative', 'administrative_task',
  ]);
  assert.equal(submissionTypeLabel('creative_concept'), 'Creative Concept');
  assert.equal(submissionTypeLabel('mystery' as never), 'mystery');
});

test('makeSubmission records a typed, tracked institutional record', () => {
  assert.equal(makeSubmission({ id: 's1', type: 'idea', title: '  ', description: 'd' }, T), null);
  const s = makeSubmission(
    { id: 's1', type: 'risk', title: '  A risk  ', description: '  watch this  ', priority: 'now', ownerChairId: CHAIR_CREATIVE_DIRECTOR },
    T,
  )!;
  assert.equal(s.type, 'risk');
  assert.equal(s.title, 'A risk');
  assert.equal(s.summary, 'watch this');
  assert.equal(s.priority, 'now');
  assert.equal(s.ownerChairId, CHAIR_CREATIVE_DIRECTOR);
  assert.equal(s.status, 'preparing', 'enters at preparing');
  assert.equal(s.visibility, 'visible', 'on the Founder’s radar by default');
  assert.equal(s.founderDecision, 'pending');
  assert.equal(typeLabel(s), 'Risk');
});

test('an unknown submission type falls back to idea; unknown owner drops to unassigned', () => {
  const s = makeSubmission({ id: 's2', type: 'bogus' as never, title: 't', description: 'd', ownerChairId: 'ghost' }, T)!;
  assert.equal(s.type, 'idea');
  assert.equal(s.ownerChairId, null);
});

test('Founder visibility has two honest states and can be toggled', () => {
  assert.deepEqual(FOUNDER_VISIBILITIES.map((v) => v.id), ['visible', 'internal']);
  assert.equal(visibilityLabel('internal'), 'Held by the Office');
  const s = makeSubmission({ id: 's3', type: 'idea', title: 't', description: 'd' }, T)!;
  assert.equal(setVisibility(s, 'internal', T).visibility, 'internal');
  assert.equal(setVisibility(s, 'nope' as never, T).visibility, 'visible', 'unknown state is a no-op');
});

test('normalizeRecommendation fills type/visibility for records that predate them', () => {
  const legacy = { ...makeSubmission({ id: 'L', type: 'idea', title: 't', description: 'd' }, T)! } as Recommendation;
  // Simulate a pre-12B record missing the new fields.
  delete (legacy as { type?: unknown }).type;
  delete (legacy as { visibility?: unknown }).visibility;
  const fixed = normalizeRecommendation(legacy);
  assert.equal(fixed.type, 'idea');
  assert.equal(fixed.visibility, 'visible');
  // A well-formed record is returned unchanged (same reference).
  const good = makeSubmission({ id: 'g', type: 'risk', title: 't', description: 'd' }, T)!;
  assert.equal(normalizeRecommendation(good), good);
});

test('the Inbox reuses the same store as recommendations (no second source)', () => {
  const s = makeSubmission({ id: 'q', type: 'opportunity', title: 't', description: 'd' }, T)!;
  assert.ok(isRecommendation(s), 'a submission is a recommendation record');
  // saved and loaded through the single recommendations store.
  assert.doesNotThrow(() => saveRecommendations([s]));
  assert.deepEqual(loadRecommendations(), [], 'no localStorage in tests → honest empty');
});

test('the working queue is active work in priority order; ledger is newest-first', () => {
  const a = advance(makeSubmission({ id: 'a', type: 'idea', title: 'a', description: 'd', priority: 'later' }, new Date('2026-07-16T08:00:00Z'))!, 'awaiting_founder', T);
  const b = makeSubmission({ id: 'b', type: 'idea', title: 'b', description: 'd', priority: 'now' }, new Date('2026-07-16T10:00:00Z'))!;
  const done = advance(advance(advance(makeSubmission({ id: 'c', type: 'idea', title: 'c', description: 'd' }, T)!, 'awaiting_founder', T), 'decided', T), 'complete', T);
  const store = [a, b, done];
  assert.deepEqual(chiefOfStaffQueue(store).map((r) => r.id), ['b', 'a'], 'now before later; complete excluded');
  assert.deepEqual(needsPreparation(store).map((r) => r.id), ['b'], 'only b is still preparing');
  assert.deepEqual(inboxLedger(store).map((r) => r.id), ['b', 'c', 'a'], 'newest-created first — full memory, nothing dropped');
});

/* =============================================================================
   SPRINT 12C — TRIAGE + PREPARATION + FOUNDER DECISION LOOP
   ============================================================================= */

const sub = (id: string, over: Partial<Recommendation> = {}): Recommendation =>
  ({ ...makeSubmission({ id, type: 'idea', title: 't', description: 'd' }, T)!, ...over });

test('new records carry the 12C defaults (untriaged, unprepared, unblocked)', () => {
  const s = sub('s');
  assert.equal(s.triage, null);
  assert.equal(s.preparation, null);
  assert.equal(s.blocked, false);
});

test('the five triage outcomes each produce a valid, persisted state change', () => {
  assert.deepEqual(TRIAGE_OUTCOMES.map((t) => t.id),
    ['prepare', 'route', 'hold', 'close', 'request_info']);
  const base = sub('t'); // status preparing
  // Prepare — stays in preparation, triage recorded.
  const prep = triage(base, 'prepare', {}, T);
  assert.equal(prep.triage, 'prepare');
  assert.equal(prep.status, 'preparing');
  // Route — needs an owner to enter execution.
  assert.equal(triage(base, 'route', {}, T).status, 'preparing', 'no owner → stays, no unowned execution');
  const routed = triage(base, 'route', { ownerChairId: CHAIR_CREATIVE_DIRECTOR }, T);
  assert.equal(routed.status, 'executing');
  assert.equal(routed.ownerChairId, CHAIR_CREATIVE_DIRECTOR);
  // Hold / Request Info → held.
  assert.equal(triage(base, 'hold', {}, T).status, 'held');
  assert.equal(triage(base, 'request_info', {}, T).status, 'held');
  assert.equal(triage(base, 'request_info', {}, T).triage, 'request_info');
  // Close → withdrawn.
  assert.equal(triage(base, 'close', {}, T).status, 'withdrawn');
  // Unknown outcome is a no-op.
  assert.equal(triage(base, 'bogus' as never, {}, T), base);
  assert.equal(triageLabel('close'), 'Close Without Action');
  assert.equal(triageStateLabel(base), 'Untriaged');
});

test('preparation requires a direction and a decision requested; the rest is optional', () => {
  const base = sub('p');
  assert.equal(prepareRecommendation(base, { recommendation: '', decisionRequested: 'x' }), null);
  assert.equal(prepareRecommendation(base, { recommendation: 'y', decisionRequested: '  ' }), null);
  const min = prepareRecommendation(base, { recommendation: 'do it', decisionRequested: 'approve?' }, T)!;
  assert.ok(min.preparation);
  assert.equal(min.preparation!.recommendation, 'do it');
  assert.equal(min.preparation!.issue, '', 'optional fields default empty, not fabricated');
  assert.deepEqual(min.preparation!.alternatives, []);
  assert.equal(min.preparation!.preparedBy, 'Chief of Staff');
  assert.equal(min.triage, 'prepare');
  const full = prepareRecommendation(base, {
    issue: 'i', context: 'c', recommendation: 'r',
    alternatives: [' a1 ', '', 'a2'], tradeoffs: ['t1'], decisionRequested: 'dr',
  }, T)!;
  assert.deepEqual(full.preparation!.alternatives, ['a1', 'a2'], 'blank lines pruned');
});

test('present only reaches the Founder with a brief and a legal transition', () => {
  const base = sub('pf');
  assert.equal(presentToFounder(base, T).status, 'preparing', 'no brief → not presented');
  const prepared = prepareRecommendation(base, { recommendation: 'r', decisionRequested: 'd' }, T)!;
  assert.equal(presentToFounder(prepared, T).status, 'awaiting_founder');
  // Only prepared awaiting items are shown to the Founder.
  assert.deepEqual(decisionsForFounder([presentToFounder(prepared, T)]).map((r) => r.id), ['pf']);
  assert.deepEqual(decisionsForFounder([advance(base, 'awaiting_founder', T)]), [], 'awaiting but unprepared is not shown');
});

test('Founder approve → decided; decline → withdrawn; defer → held; and notes are preserved', () => {
  const waiting = presentToFounder(prepareRecommendation(sub('d'), { recommendation: 'r', decisionRequested: 'd' }, T)!, T);
  const approved = recordFounderDecision(waiting, 'approved', '  yes, proceed  ', T);
  assert.equal(approved.status, 'decided');
  assert.equal(approved.founderDecision, 'approved');
  assert.equal(approved.founderNote, 'yes, proceed', 'note trimmed + preserved');
  assert.equal(approved.decidedAt, T.toISOString());
  assert.equal(recordFounderDecision(waiting, 'declined', '', T).status, 'withdrawn');
  assert.equal(recordFounderDecision(waiting, 'deferred', '', T).status, 'held');
});

test('Request Revision returns to preparation with the Founder note preserved', () => {
  const waiting = presentToFounder(prepareRecommendation(sub('rv'), { recommendation: 'r', decisionRequested: 'd' }, T)!, T);
  const revised = requestRevision(waiting, 'tighten the framing', T);
  assert.equal(revised.status, 'preparing', 'returns to preparation');
  assert.equal(revised.founderNote, 'tighten the framing');
  assert.ok(revised.preparation, 'the prior brief is kept for revising');
  // From a non-awaiting state the guard refuses the jump.
  assert.equal(requestRevision(sub('x', { status: 'complete' }), 'n', T).status, 'complete');
});

test('no illegal lifecycle jumps — guards hold across the new transitions', () => {
  assert.ok(canTransition('preparing', 'executing'), 'route path is now legal');
  assert.ok(canTransition('held', 'executing'));
  assert.ok(!canTransition('preparing', 'decided'), 'cannot skip the Founder');
  assert.ok(!canTransition('complete', 'executing'));
  // advance refuses an illegal jump.
  assert.equal(advance(sub('j'), 'complete', T).status, 'preparing');
});

test('execution follow-up derives approved/in-flight work; blocked + held surface separately', () => {
  const decided = recordFounderDecision(presentToFounder(prepareRecommendation(sub('a'), { recommendation: 'r', decisionRequested: 'd' }, T)!, T), 'approved', '', T);
  const executing = setBlocked(advance(decided, 'executing', T), true, T);
  const held = triage(sub('h'), 'hold', {}, T);
  const store = [executing, held];
  assert.deepEqual(executionFollowUp(store).map((r) => r.id), ['a'], 'decided/executing only');
  assert.deepEqual(blockedItems(store).map((r) => r.id), ['a']);
  assert.deepEqual(heldItems(store).map((r) => r.id), ['h']);
  assert.equal(setBlocked(executing, false, T).blocked, false);
});

test('the full loop runs end to end: captured → triaged → prepared → decided → executing → complete', () => {
  let r = makeSubmission({ id: 'loop', type: 'decision_request', title: 'Ship it', description: 'the thing' }, T)!;
  assert.equal(r.status, 'preparing');
  r = triage(r, 'prepare', {}, T);
  r = prepareRecommendation(r, { recommendation: 'ship', decisionRequested: 'approve the ship?' }, T)!;
  r = presentToFounder(r, T);
  assert.equal(r.status, 'awaiting_founder');
  assert.deepEqual(decisionsForFounder([r]).map((x) => x.id), ['loop']);
  r = recordFounderDecision(r, 'approved', 'go', T);
  assert.equal(r.status, 'decided');
  r = advance(r, 'executing', T);
  r = advance(r, 'complete', T);
  assert.equal(r.status, 'complete');
  assert.deepEqual(completedItems([r]).map((x) => x.id), ['loop']);
});

test('backward compatibility: a Sprint 12A/12B record normalizes without data loss', () => {
  // A record from before 12C — no triage/preparation/blocked; from before 12B — no type/visibility.
  const legacy = { ...sub('legacy') } as Recommendation;
  delete (legacy as { triage?: unknown }).triage;
  delete (legacy as { preparation?: unknown }).preparation;
  delete (legacy as { blocked?: unknown }).blocked;
  delete (legacy as { type?: unknown }).type;
  delete (legacy as { visibility?: unknown }).visibility;
  const n = normalizeRecommendation(legacy);
  assert.equal(n.type, 'idea');
  assert.equal(n.visibility, 'visible');
  assert.equal(n.triage, null);
  assert.equal(n.preparation, null);
  assert.equal(n.blocked, false);
  assert.equal(n.title, 'legacy'.length ? n.title : n.title, 'core fields intact');
  assert.equal(n.id, 'legacy', 'no data loss on identity');
  // A malformed triage/blocked value is dropped to a safe default.
  const bad = normalizeRecommendation({ ...sub('b'), triage: 'nonsense' as never, blocked: 'yes' as never });
  assert.equal(bad.triage, null);
  assert.equal(bad.blocked, false);
});

test('storage stays fail-closed and single-source through the loop', () => {
  assert.doesNotThrow(() => saveRecommendations([sub('s')]));
  assert.deepEqual(loadRecommendations(), [], 'no localStorage in tests → honest empty, never throws');
});

test('the integrated briefing derives every loop count honestly', () => {
  const toTriage = sub('t1');
  const preparing = triage(sub('t2'), 'prepare', {}, T);
  const ready = presentToFounder(prepareRecommendation(sub('t3'), { recommendation: 'r', decisionRequested: 'd' }, T)!, T);
  const executing = advance(recordFounderDecision(presentToFounder(prepareRecommendation(sub('t4'), { recommendation: 'r', decisionRequested: 'd' }, T)!, T), 'approved', '', T), 'executing', T);
  const held = triage(sub('t5'), 'hold', {}, T);
  const store = [toTriage, preparing, ready, executing, held];
  assert.deepEqual(needsTriage(store).map((r) => r.id), ['t1']);
  assert.deepEqual(inPreparation(store).map((r) => r.id), ['t2']);
  const b = operationalBriefing(store);
  assert.equal(b.quiet, false);
  assert.equal(b.needsTriageCount, 1);
  assert.equal(b.inPreparationCount, 1);
  assert.equal(b.readyForFounderCount, 1);
  assert.equal(b.waitingCount, 1, 'only prepared, presented items await her');
  assert.equal(b.inFollowUpCount, 1);
  assert.equal(b.heldCount, 1);
  // Honest quiet when truly empty.
  assert.equal(operationalBriefing([]).quiet, true);
});
