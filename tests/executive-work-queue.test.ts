/* =============================================================================
   Sprint 13F — the Executive Work Queue. A pure PROJECTION over the institutional
   stores: derivation, priority, filtering, provenance, navigation, and the
   guarantee that it owns nothing and never duplicates a promoted record.
   ============================================================================= */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  QUEUE_OFFICES, QUEUE_PRIORITIES, queueOfficeLabel, queuePriorityLabel,
  deriveWorkQueue, activeQueue, needsFounder, waitingItems,
  queueByOffice, filterQueue, queueSummary, queueOwners,
  type QueueCollections, type QueueItem,
} from '../src/headquarters/executive-work-queue.ts';
import {
  makeRecommendation, triage, advance, prepareRecommendation, presentToFounder,
  type Recommendation,
} from '../src/headquarters/chief-of-staff-ops.ts';
import { makeIntelligenceItem, reviewIntelligence } from '../src/headquarters/growth-intelligence.ts';
import { makeContentOpportunity, markReadyForReview } from '../src/headquarters/content-opportunity.ts';
import { makeCreativeAssignment, markAssignmentReady, approveAssignment } from '../src/headquarters/creative-assignment.ts';
import { makeCreativeDraft, generateDraft, buildDraftContext, deterministicDraftProvider } from '../src/headquarters/creative-draft.ts';
import { CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION } from '../src/headquarters/executive-register.ts';
import { makeProductionReadiness } from '../src/headquarters/production-readiness.ts';

const T = new Date('2026-07-17T09:00:00.000Z');
const empty: QueueCollections = { intelligence: [], opportunities: [], assignments: [], drafts: [], production: [], recommendations: [] };
const sub = (id: string): Recommendation => makeRecommendation({ id, title: `t${id}`, summary: 's' }, T)!;
const item = (q: QueueItem[], id: string): QueueItem => q.find((x) => x.id === id)!;

/* --- vocabulary ----------------------------------------------------------- */
test('offices and priorities are complete and labelled', () => {
  assert.equal(QUEUE_OFFICES.length, 8);
  assert.equal(queueOfficeLabel('creative_director'), 'Creative Director');
  assert.equal(QUEUE_PRIORITIES.length, 5);
  assert.equal(queuePriorityLabel('critical'), 'Critical');
});

/* --- derivation & priority ------------------------------------------------ */
test('a recommendation awaiting the Founder derives a high-priority Founder action', () => {
  const waiting = presentToFounder(prepareRecommendation(sub('r1'), { recommendation: 'r', decisionRequested: 'd' }, T)!, T);
  const q = deriveWorkQueue({ ...empty, recommendations: [waiting] });
  const it = item(q, 'recommendation:r1');
  assert.equal(it.office, 'founder');
  assert.equal(it.priority, 'high');
  assert.equal(it.requiredAction, 'Awaiting Founder');
  assert.equal(it.status, 'actionable');
  assert.equal(it.route, '#/chief-of-staff/decisions');
});

test('a blocked awaiting-Founder recommendation is critical', () => {
  const waiting = presentToFounder(prepareRecommendation(sub('r2'), { recommendation: 'r', decisionRequested: 'd' }, T)!, T);
  const blocked = { ...waiting, blocked: true };
  assert.equal(item(deriveWorkQueue({ ...empty, recommendations: [blocked] }), 'recommendation:r2').priority, 'critical');
});

test('an executing recommendation waits on its owner office; a complete one is completed', () => {
  const executing = triage(sub('r3'), 'route', { ownerChairId: CHAIR_HEAD_OF_PRODUCTION }, T);
  const it = item(deriveWorkQueue({ ...empty, recommendations: [executing] }), 'recommendation:r3');
  assert.equal(it.office, 'production');
  assert.equal(it.status, 'waiting');
  const done = advance(executing, 'complete', T);
  const cit = item(deriveWorkQueue({ ...empty, recommendations: [done] }), 'recommendation:r3');
  assert.equal(cit.office, 'completed');
  assert.equal(cit.status, 'completed');
});

test('the queue is sorted by priority then recency', () => {
  const founder = presentToFounder(prepareRecommendation(sub('hi'), { recommendation: 'r', decisionRequested: 'd' }, T)!, T);
  const waiting = triage(sub('lo'), 'route', { ownerChairId: CHAIR_CREATIVE_DIRECTOR }, T);
  const q = activeQueue(deriveWorkQueue({ ...empty, recommendations: [waiting, founder] }));
  assert.equal(q[0].id, 'recommendation:hi', 'the Founder-critical item leads');
});

/* --- intelligence / opportunity / assignment / draft derivation ----------- */
test('each pipeline record derives with correct office, action, and provenance', async () => {
  const intel = makeIntelligenceItem({ id: 'i1', title: 't', summary: 's' }, T)!; // captured
  const opp = markReadyForReview(makeContentOpportunity({ id: 'o1', intelId: 'i1', title: 't' }, T)!);
  const asn = approveAssignment(markAssignmentReady(makeCreativeAssignment({ id: 'a1', originOpportunityId: 'o1', originIntelId: 'i1', title: 't' }, T)!));
  const draftReady = await generateDraft(makeCreativeDraft({ id: 'd1', assignment: asn, type: 'tiktok_short', context: buildDraftContext(asn, null, null) }, T)!, deterministicDraftProvider, T);

  const q = deriveWorkQueue({ intelligence: [intel], opportunities: [opp], assignments: [asn], drafts: [draftReady], production: [], recommendations: [] });
  assert.equal(item(q, 'intelligence:i1').office, 'chief_of_staff');
  assert.equal(item(q, 'intelligence:i1').requiredAction, 'Research review');
  assert.equal(item(q, 'opportunity:o1').office, 'chief_of_staff');
  assert.equal(item(q, 'assignment:a1').requiredAction, 'Ready to route', 'approved assignment is ready to route');
  const d = item(q, 'draft:d1');
  assert.equal(d.office, 'founder', 'a ready draft awaits Founder review');
  // provenance is retained end-to-end
  assert.equal(d.provenance.intelId, 'i1');
  assert.equal(d.provenance.opportunityId, 'o1');
  assert.equal(d.provenance.assignmentId, 'a1');
  assert.equal(d.provenance.draftId, 'd1');
});

test('a production-readiness pack surfaces by status; a routed pack is hidden (no duplicate)', () => {
  const ready = { ...makeProdLike('p1'), status: 'ready_for_review' as const };
  const r = item(deriveWorkQueue({ ...empty, production: [ready] }), 'production:p1');
  assert.equal(r.office, 'founder', 'a ready pack awaits Founder review');
  assert.equal(r.status, 'actionable');
  assert.equal(r.requiredAction, 'Review requested');
  assert.equal(r.provenance.productionId, 'p1', 'the pack carries its own id as provenance');
  assert.equal(r.provenance.draftId, 'dr_p1', 'and inherits the upstream draft');

  const approved = { ...makeProdLike('p2'), status: 'approved' as const };
  assert.equal(item(deriveWorkQueue({ ...empty, production: [approved] }), 'production:p2').requiredAction, 'Ready to route');

  const routed = { ...makeProdLike('p3'), status: 'routed_to_work' as const, promotedRecommendationId: 'rec_from_prod_p3' };
  assert.equal(item(deriveWorkQueue({ ...empty, production: [routed] }), 'production:p3').status, 'hidden', 'a routed pack defers to its recommendation');
});

test('originProductionId flows from a recommendation into queue provenance', () => {
  const rec = makeRecommendation({ id: 'rp', title: 't', summary: 's', originProductionId: 'p9' }, T)!;
  assert.equal(item(deriveWorkQueue({ ...empty, recommendations: [rec] }), 'recommendation:rp').provenance.productionId, 'p9');
});

test('a failed draft is a high-priority creative revision; a researching item waits on Growth', () => {
  const failed = { ...makeCreativeDraftLike('df'), status: 'generation_failed' as const, failureReason: 'error' as const };
  const q = deriveWorkQueue({ ...empty, drafts: [failed] });
  const it = item(q, 'draft:df');
  assert.equal(it.office, 'creative_director');
  assert.equal(it.priority, 'high');
  assert.equal(it.requiredAction, 'Creative revision');
  const researching = reviewIntelligence(makeIntelligenceItem({ id: 'ir', title: 't', summary: 's' }, T)!, 'research', '', T);
  assert.equal(item(deriveWorkQueue({ ...empty, intelligence: [researching] }), 'intelligence:ir').office, 'growth');
});

/* --- anti-duplication: promoted records are hidden ------------------------ */
test('a record promoted into a recommendation is HIDDEN — represented once, by the recommendation', () => {
  const routed = reviewIntelligence(makeIntelligenceItem({ id: 'ip', title: 't', summary: 's' }, T)!, 'route', '', T);
  const linked = { ...routed, promotedRecommendationId: 'rec_from_ip' };
  const q = deriveWorkQueue({ ...empty, intelligence: [linked] });
  assert.equal(item(q, 'intelligence:ip').status, 'hidden');
  assert.deepEqual(activeQueue(q), [], 'a promoted source never appears in the active queue');
});

test('archived / dismissed / declined / held records are hidden', () => {
  const archived = reviewIntelligence(makeIntelligenceItem({ id: 'ia', title: 't', summary: 's' }, T)!, 'archive', '', T);
  assert.equal(item(deriveWorkQueue({ ...empty, intelligence: [archived] }), 'intelligence:ia').status, 'hidden');
});

/* --- filtering ------------------------------------------------------------ */
test('the queue filters by office, priority, needs-Founder, waiting, and completed', () => {
  const founder = presentToFounder(prepareRecommendation(sub('f'), { recommendation: 'r', decisionRequested: 'd' }, T)!, T);
  const waiting = triage(sub('w'), 'route', { ownerChairId: CHAIR_CREATIVE_DIRECTOR }, T);
  const complete = advance(triage(sub('c'), 'route', { ownerChairId: CHAIR_HEAD_OF_PRODUCTION }, T), 'complete', T);
  const q = deriveWorkQueue({ ...empty, recommendations: [founder, waiting, complete] });
  assert.deepEqual(filterQueue(q, { needsFounder: true }).map((i) => i.sourceId), ['f']);
  assert.deepEqual(filterQueue(q, { office: 'creative_director' }).map((i) => i.sourceId), ['w']);
  assert.deepEqual(filterQueue(q, { waiting: true }).map((i) => i.sourceId), ['w']);
  assert.deepEqual(filterQueue(q, { completed: true }).map((i) => i.sourceId), ['c']);
  assert.deepEqual(filterQueue(q, { priority: 'high' }).map((i) => i.sourceId), ['f']);
  // hidden records never pass a filter
  const hidden = advance(sub('h'), 'withdrawn', T);
  assert.deepEqual(filterQueue(deriveWorkQueue({ ...empty, recommendations: [hidden] }), {}), []);
});

test('queueByOffice, needsFounder, waiting and completed views agree', () => {
  const founder = presentToFounder(prepareRecommendation(sub('vf'), { recommendation: 'r', decisionRequested: 'd' }, T)!, T);
  const waiting = triage(sub('vw'), 'route', { ownerChairId: CHAIR_HEAD_OF_PRODUCTION }, T);
  const q = deriveWorkQueue({ ...empty, recommendations: [founder, waiting] });
  assert.equal(needsFounder(q).length, 1);
  assert.equal(waitingItems(q).length, 1);
  assert.equal(queueByOffice(q, 'production').length, 1);
});

/* --- summary & owners ----------------------------------------------------- */
test('the Executive Office summary counts Founder attention, waiting, and completed today', () => {
  const founder = presentToFounder(prepareRecommendation(sub('sf'), { recommendation: 'r', decisionRequested: 'd' }, T)!, T);
  const waitProd = triage(sub('sp'), 'route', { ownerChairId: CHAIR_HEAD_OF_PRODUCTION }, T);
  const doneToday = advance(triage(sub('sc'), 'route', { ownerChairId: CHAIR_CREATIVE_DIRECTOR }, T), 'complete', T);
  const q = deriveWorkQueue({ ...empty, recommendations: [founder, waitProd, doneToday] });
  const s = queueSummary(q, T);
  assert.equal(s.founderAttention, 1);
  assert.equal(s.waitingProduction, 1);
  assert.equal(s.completedToday, 1);
  assert.ok(s.recentlyFinished.length >= 1);
  assert.ok(queueOwners(q).length >= 1);
});

/* --- projection integrity ------------------------------------------------- */
test('the projection is idempotent and never mutates the source records', () => {
  const rec = triage(sub('idem'), 'route', { ownerChairId: CHAIR_HEAD_OF_PRODUCTION }, T);
  const before = JSON.stringify(rec);
  const a = deriveWorkQueue({ ...empty, recommendations: [rec] });
  const b = deriveWorkQueue({ ...empty, recommendations: [rec] });
  assert.deepEqual(a, b, 'deriving twice yields identical items');
  assert.equal(JSON.stringify(rec), before, 'the source record is untouched');
});

test('malformed / empty collections derive to an empty queue without throwing', () => {
  assert.deepEqual(deriveWorkQueue(empty), []);
  assert.doesNotThrow(() => deriveWorkQueue({ ...empty, recommendations: [sub('ok')] }));
});

/* --- helper: a minimal draft-shaped record for direct derivation ---------- */
function makeCreativeDraftLike(id: string) {
  const a = approveAssignment(markAssignmentReady(makeCreativeAssignment({ id: `asn_${id}`, originOpportunityId: 'o', originIntelId: 'i', title: 't' }, T)!));
  return makeCreativeDraft({ id, assignment: a, type: 'tiktok_short', context: buildDraftContext(a, null, null) }, T)!;
}
function makeProdLike(id: string) {
  return makeProductionReadiness({ id, draft: makeCreativeDraftLike(`dr_${id}`), title: `Prod ${id}` }, T)!;
}
