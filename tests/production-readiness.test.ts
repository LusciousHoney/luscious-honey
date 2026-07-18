/* =============================================================================
   Sprint 13E — Production Readiness Pack. The model, checklist/asset tracking,
   the planning lifecycle, the Founder projection, and idempotent Route to Work
   with the full chain intelligence → opportunity → assignment → draft →
   production → recommendation.
   ============================================================================= */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PRODUCTION_STATUSES, PRODUCTION_COMPLEXITIES, CONTENT_PLATFORMS,
  productionStatusLabel, productionComplexityLabel, contentPlatformLabel,
  makeProductionReadiness, updateProductionReadiness, isDraftEligibleForProduction,
  addChecklistItem, toggleChecklistItem, checklistProgress,
  markProductionReady, approveProduction, returnProductionForRevision, holdProduction, declineProduction,
  isProductionRoutable, routeProductionToWork, productionRecommendationId, founderProductionView,
  productionForDraft, productionDrafts, productionForReview, approvedProduction, productionStanding, productionAuthorLabel,
  normalizeProductionReadiness, isProductionReadiness,
  type ProductionReadiness,
} from '../src/headquarters/production-readiness.ts';
import { makeCreativeDraft, generateDraft, approveDraft, deterministicDraftProvider, buildDraftContext, type CreativeDraft } from '../src/headquarters/creative-draft.ts';
import { makeCreativeAssignment, markAssignmentReady, approveAssignment } from '../src/headquarters/creative-assignment.ts';
import { CHAIR_HEAD_OF_PRODUCTION, CHAIR_CREATIVE_DIRECTOR } from '../src/headquarters/executive-register.ts';

const T = new Date('2026-07-17T09:00:00.000Z');

async function approvedDraft(): Promise<CreativeDraft> {
  const a = approveAssignment(markAssignmentReady(makeCreativeAssignment({
    id: 'asn_1', originOpportunityId: 'opp_1', originIntelId: 'intel_1', title: 'Starting over',
    hook: 'You are not behind.', centralIdea: 'Starting over is a choice', talkingPoints: ['a', 'b'], callToAction: 'Follow',
  }, T)!));
  const d = makeCreativeDraft({ id: 'd1', assignment: a, type: 'tiktok_short', context: buildDraftContext(a, null, null) }, T)!;
  return approveDraft(await generateDraft(d, deterministicDraftProvider, T));
}
async function pack(over: Partial<Parameters<typeof makeProductionReadiness>[0]> = {}): Promise<ProductionReadiness> {
  return makeProductionReadiness({ id: 'p1', draft: await approvedDraft(), ...over }, T)!;
}

/* --- construction & eligibility ------------------------------------------- */
test('a pack requires an approved draft and links the whole chain', async () => {
  const d = await approvedDraft();
  assert.equal(isDraftEligibleForProduction(d), true);
  const p = makeProductionReadiness({ id: 'p1', draft: d }, T)!;
  assert.equal(p.originDraftId, 'd1');
  assert.equal(p.originAssignmentId, 'asn_1');
  assert.equal(p.originOpportunityId, 'opp_1');
  assert.equal(p.originIntelId, 'intel_1');
  assert.equal(p.status, 'draft');
  assert.equal(p.createdBy, CHAIR_HEAD_OF_PRODUCTION, 'Register-derived Head of Production identity');
  assert.equal(p.primaryPlatform, 'tiktok', 'seeded from the draft type');
  assert.ok(p.checklist.length >= 5, 'seeded with a recording checklist');
  assert.equal(productionAuthorLabel(p), 'Head of Production');
});

test('an unapproved draft is not eligible for a production pack', async () => {
  const a = approveAssignment(markAssignmentReady(makeCreativeAssignment({ id: 'asn_x', originOpportunityId: 'o', originIntelId: 'i', title: 't' }, T)!));
  const ready = await generateDraft(makeCreativeDraft({ id: 'dx', assignment: a, type: 'tiktok_short', context: buildDraftContext(a, null, null) }, T)!, deterministicDraftProvider, T);
  assert.equal(isDraftEligibleForProduction(ready), false, 'draft_ready but not approved');
});

test('the vocabulary is complete and labelled', () => {
  assert.equal(PRODUCTION_STATUSES.length, 8);
  assert.equal(productionStatusLabel('revision_requested'), 'Revision Requested');
  assert.equal(PRODUCTION_COMPLEXITIES.length, 3);
  assert.equal(productionComplexityLabel('high'), 'High');
  assert.ok(CONTENT_PLATFORMS.length >= 6);
  assert.equal(contentPlatformLabel('tiktok'), 'TikTok');
});

/* --- checklist & asset tracking ------------------------------------------- */
test('the checklist and asset checklist can be added to and ticked; progress is honest', async () => {
  let p = await pack();
  const before = p.checklist.length;
  p = addChecklistItem(p, 'checklist', 'Charge the mic', T, 'ck_x');
  assert.equal(p.checklist.length, before + 1);
  p = addChecklistItem(p, 'requiredAssets', 'Ring light', T, 'as_1');
  p = addChecklistItem(p, 'requiredAssets', 'Backdrop', T, 'as_2');
  assert.equal(p.requiredAssets.length, 2);
  const total = p.checklist.length + p.requiredAssets.length;
  p = toggleChecklistItem(p, 'requiredAssets', 'as_1', T);
  assert.equal(p.requiredAssets.find((i) => i.id === 'as_1')!.done, true);
  assert.ok(Math.abs(checklistProgress(p) - 1 / total) < 1e-9, 'one of N items done');
  p = toggleChecklistItem(p, 'requiredAssets', 'as_1', T);
  assert.equal(p.requiredAssets.find((i) => i.id === 'as_1')!.done, false, 'toggles back');
});

/* --- editing & lifecycle -------------------------------------------------- */
test('a pack can be edited and moved through the office decisions', async () => {
  let p = await pack();
  p = updateProductionReadiness(p, { estimatedDuration: '  45s  ', recordingEnvironment: 'home studio', primaryPlatform: 'tiktok_live', cautions: 'no legal claims' });
  assert.equal(p.estimatedDuration, '45s');
  assert.equal(p.recordingEnvironment, 'home studio');
  assert.equal(p.primaryPlatform, 'tiktok_live');
  p = markProductionReady(p);
  assert.equal(p.status, 'ready_for_review');
  assert.equal(approveProduction(p).status, 'approved');
  assert.equal(holdProduction(p).status, 'held');
  assert.equal(declineProduction(p).status, 'declined');
  const ret = returnProductionForRevision(p, '  tighten the runtime  ', T);
  assert.equal(ret.status, 'revision_requested');
  assert.equal(ret.revisionNote, 'tighten the runtime');
});

test('production statuses stay in planning — a declined pack is terminal', () => {
  const ids = PRODUCTION_STATUSES.map((s) => s.id).sort();
  assert.deepEqual(ids, ['approved', 'declined', 'draft', 'held', 'preparing', 'ready_for_review', 'revision_requested', 'routed_to_work']);
});

/* --- Founder projection --------------------------------------------------- */
test('the Founder production view is concise and shows what will be recorded', async () => {
  let p = await pack({ estimatedDuration: '60s', recordingEnvironment: 'sunlit desk', visualDirection: 'close, warm' });
  p = addChecklistItem(p, 'requiredAssets', 'Ring light', T, 'a1');
  const fv = founderProductionView(p);
  assert.match(fv.format, /TikTok/);
  assert.equal(fv.duration, '60s');
  assert.equal(fv.environment, 'sunlit desk');
  assert.ok(fv.assets.some((a) => /Ring light/.test(a)));
  assert.match(fv.decision, /Approve/);
});

/* --- provenance & idempotent routing -------------------------------------- */
test('routing an approved pack creates ONE recommendation carrying the FULL chain', async () => {
  const approved = approveProduction(markProductionReady(await pack()));
  assert.equal(isProductionRoutable(approved), true);
  const res = routeProductionToWork(approved, [], T);
  assert.equal(res.created, true);
  const rec = res.recommendation!;
  assert.equal(rec.id, productionRecommendationId(approved));
  assert.equal(rec.originProductionId, 'p1');
  assert.equal(rec.originDraftId, 'd1');
  assert.equal(rec.originAssignmentId, 'asn_1');
  assert.equal(rec.originOpportunityId, 'opp_1');
  assert.equal(rec.originIntelId, 'intel_1');
  assert.equal(rec.ownerChairId, CHAIR_HEAD_OF_PRODUCTION);
  assert.notEqual(rec.ownerChairId, CHAIR_CREATIVE_DIRECTOR);
  assert.equal(rec.status, 'preparing');
  assert.equal(rec.founderDecision, 'pending', 'no fabricated Founder approval');
  assert.equal(res.pack.status, 'routed_to_work');
  assert.equal(res.pack.promotedRecommendationId, rec.id);
});

test('repeated Route to Work is idempotent — reuses the record, never overwrites advanced work', async () => {
  const approved = approveProduction(markProductionReady(await pack()));
  const first = routeProductionToWork(approved, [], T);
  const second = routeProductionToWork(first.pack, first.recommendations, T);
  assert.equal(second.created, false);
  assert.equal(second.recommendations.length, 1);
  const progressed = first.recommendations.map((r) => ({ ...r, status: 'executing' as const }));
  const again = routeProductionToWork(first.pack, progressed, T);
  assert.equal(again.created, false);
  assert.equal(again.recommendation!.status, 'executing');
});

test('an un-approved pack cannot be routed', async () => {
  const res = routeProductionToWork(await pack(), [], T);
  assert.equal(res.created, false);
  assert.equal(res.recommendations.length, 0);
});

test('multiple packs on one draft keep unique ids and links', async () => {
  const d = await approvedDraft();
  const p1 = makeProductionReadiness({ id: 'm1', draft: d }, T)!;
  const p2 = makeProductionReadiness({ id: 'm2', draft: d }, T)!;
  assert.deepEqual(productionForDraft('d1', [p1, p2]).map((p) => p.id).sort(), ['m1', 'm2']);
  const r1 = routeProductionToWork(approveProduction(markProductionReady(p1)), [], T);
  const r2 = routeProductionToWork(approveProduction(markProductionReady(p2)), r1.recommendations, T);
  assert.equal(r2.recommendations.length, 2);
  assert.notEqual(r1.recommendation!.id, r2.recommendation!.id);
});

/* --- derived views -------------------------------------------------------- */
test('the queues and standing separate drafts, review, and approved', async () => {
  const d = await approvedDraft();
  const draft = makeProductionReadiness({ id: 'v1', draft: d }, T)!;
  const ready = markProductionReady(makeProductionReadiness({ id: 'v2', draft: d }, T)!);
  const approved = approveProduction(markProductionReady(makeProductionReadiness({ id: 'v3', draft: d }, T)!));
  const store = [draft, ready, approved];
  assert.deepEqual(productionDrafts(store).map((p) => p.id), ['v1']);
  assert.deepEqual(productionForReview(store).map((p) => p.id), ['v2']);
  assert.deepEqual(approvedProduction(store).map((p) => p.id), ['v3']);
  const s = productionStanding(store);
  assert.equal(s.draft, 1); assert.equal(s.readyForReview, 1); assert.equal(s.approved, 1); assert.equal(s.total, 3);
});

/* --- storage: normalization & backward compatibility ---------------------- */
test('a malformed / partial pack normalizes to safe defaults', () => {
  const bad = { id: 'n1', originDraftId: 'd', title: 't', status: 'weird', createdAt: T.toISOString(), createdBy: 'ghost', complexity: 'ultra', readiness: 'x', primaryPlatform: 'nope', checklist: [{ id: 'a', label: 'x', done: 1 }, 'junk'], requiredAssets: 'nope' } as unknown as ProductionReadiness;
  const n = normalizeProductionReadiness(bad);
  assert.equal(n.status, 'draft');
  assert.equal(n.complexity, 'medium');
  assert.equal(n.readiness, 'low');
  assert.equal(n.primaryPlatform, '');
  assert.equal(n.createdBy, CHAIR_HEAD_OF_PRODUCTION);
  assert.deepEqual(n.checklist.map((i) => i.id), ['a']);
  assert.equal(n.checklist[0].done, true, 'truthy done coerced to boolean');
  assert.deepEqual(n.requiredAssets, []);
  assert.equal(n.objective, '');
});

test('a clean pack passes normalization unchanged (same reference)', async () => {
  const clean = await pack();
  assert.equal(normalizeProductionReadiness(clean), clean);
});

test('the type guard accepts real packs and rejects junk', async () => {
  assert.equal(isProductionReadiness(await pack()), true);
  assert.equal(isProductionReadiness({}), false);
  assert.equal(isProductionReadiness(null), false);
});

test('backward compatibility: making a pack does not disturb the draft', async () => {
  const d = await approvedDraft();
  makeProductionReadiness({ id: 'bc', draft: d }, T);
  assert.equal(d.status, 'approved', 'the draft is untouched');
});
