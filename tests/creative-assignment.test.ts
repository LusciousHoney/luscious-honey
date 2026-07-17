/* =============================================================================
   Sprint 13C — Creative Assignment Pack. The assignment model, planning lifecycle,
   TikTok/Substack outputs, cross-property strategy, the Founder projection, and
   idempotent Route to Work with the FULL chain intelligence → opportunity →
   assignment → recommendation.
   ============================================================================= */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTENT_PLATFORMS, TIKTOK_FORMATS, SUBSTACK_KINDS, ASSIGNMENT_STATUSES,
  contentPlatformLabel, tiktokFormatLabel, substackKindLabel, assignmentStatusLabel, complexityLabel,
  makeCreativeAssignment, updateAssignment, isOpportunityEligibleForAssignment,
  markAssignmentReady, approveAssignment, returnAssignmentForRevision, holdAssignment, declineAssignment,
  isAssignmentRoutable, routeAssignmentToWork, assignmentRecommendationId, founderAssignment,
  assignmentsForOpportunity, draftAssignments, assignmentsForReview, approvedAssignments,
  assignmentStanding, crossPropertyReasons, normalizeCreativeAssignment, isCreativeAssignment,
  type CreativeAssignment,
} from '../src/headquarters/creative-assignment.ts';
import { makeContentOpportunity, markReadyForReview, recommendOpportunity, type ContentOpportunity } from '../src/headquarters/content-opportunity.ts';
import { CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION } from '../src/headquarters/executive-register.ts';

const T = new Date('2026-07-17T09:00:00.000Z');
const asn = (id: string, over: Partial<Parameters<typeof makeCreativeAssignment>[0]> = {}): CreativeAssignment =>
  makeCreativeAssignment({ id, originOpportunityId: 'opp_1', originIntelId: 'intel_1', title: 'An assignment', ...over }, T)!;
const opp = (id: string, status: ContentOpportunity['status'] = 'recommended'): ContentOpportunity => {
  let o = makeContentOpportunity({ id, intelId: 'intel_1', title: 't', summary: 's' }, T)!;
  if (status === 'recommended') o = recommendOpportunity(markReadyForReview(o));
  else if (status === 'ready_for_review') o = markReadyForReview(o);
  return o;
};

/* --- construction --------------------------------------------------------- */
test('an assignment requires opportunity + intel ids and a title, links to both, defaults honestly', () => {
  assert.equal(makeCreativeAssignment({ id: 'x', originOpportunityId: '', originIntelId: 'i', title: 't' }, T), null);
  assert.equal(makeCreativeAssignment({ id: 'x', originOpportunityId: 'o', originIntelId: 'i', title: ' ' }, T), null);
  const a = asn('a1');
  assert.equal(a.originOpportunityId, 'opp_1');
  assert.equal(a.originIntelId, 'intel_1', 'retains the originating intelligence id');
  assert.equal(a.status, 'draft');
  assert.equal(a.createdBy, CHAIR_CREATIVE_DIRECTOR, 'Register-derived Creative identity');
  assert.equal(a.substackKind, 'none');
  assert.equal(a.complexity, 'medium');
  assert.deepEqual(a.talkingPoints, []);
});

test('enums and lists are validated and sanitised', () => {
  const a = asn('a2', {
    properties: ['pull_me_under', 'bad' as never], primaryPlatform: 'tiktok', secondaryPlatform: 'zzz' as never,
    tiktokFormat: 'storytime', substackKind: 'essay', complexity: 'high',
    talkingPoints: ['one', '  ', 'two', 3 as never], deliverables: ['a 30s cut'],
    hook: '  Ever felt stuck?  ',
  });
  assert.deepEqual(a.properties, ['pull_me_under']);
  assert.equal(a.primaryPlatform, 'tiktok');
  assert.equal(a.secondaryPlatform, '', 'bad platform → empty');
  assert.equal(a.tiktokFormat, 'storytime');
  assert.equal(a.substackKind, 'essay');
  assert.equal(a.complexity, 'high');
  assert.deepEqual(a.talkingPoints, ['one', 'two']);
  assert.equal(a.hook, 'Ever felt stuck?');
});

test('the vocabulary is complete and labelled', () => {
  assert.ok(CONTENT_PLATFORMS.length >= 6);
  assert.equal(contentPlatformLabel('substack'), 'Substack');
  assert.equal(contentPlatformLabel(''), 'Not set');
  assert.equal(TIKTOK_FORMATS.length, 6);
  assert.equal(tiktokFormatLabel('direct_to_camera'), 'Direct to camera');
  assert.equal(SUBSTACK_KINDS.length, 5);
  assert.equal(substackKindLabel('note'), 'Substack Note');
  assert.equal(ASSIGNMENT_STATUSES.length, 8);
  assert.equal(assignmentStatusLabel('returned_for_revision'), 'Returned for Revision');
  assert.equal(complexityLabel('low'), 'Low');
});

/* --- eligibility ---------------------------------------------------------- */
test('only a recommended (or already-routed) opportunity is eligible to become an assignment', () => {
  assert.equal(isOpportunityEligibleForAssignment(opp('o1', 'recommended')), true);
  assert.equal(isOpportunityEligibleForAssignment(opp('o2', 'ready_for_review')), false, 'not yet recommended');
  assert.equal(isOpportunityEligibleForAssignment(opp('o3', 'draft')), false);
});

/* --- TikTok & Substack outputs -------------------------------------------- */
test('the pack carries structured TikTok output', () => {
  const a = asn('tk', {
    primaryPlatform: 'tiktok', tiktokFormat: 'direct_to_camera',
    hook: 'You are not behind.', firstSentence: 'Let me tell you why.',
    centralIdea: 'Starting over is not failure', talkingPoints: ['reframe', 'evidence', 'invitation'],
    tiktokVisual: 'soft daylight, close', tiktokCaption: 'save this for a hard day',
    callToAction: 'Follow for the full story',
  });
  assert.equal(a.tiktokFormat, 'direct_to_camera');
  assert.equal(a.hook, 'You are not behind.');
  assert.equal(a.firstSentence, 'Let me tell you why.');
  assert.equal(a.talkingPoints.length, 3);
  assert.equal(a.tiktokVisual, 'soft daylight, close');
  assert.equal(a.callToAction, 'Follow for the full story');
});

test('the pack carries structured Substack output and the TikTok relationship', () => {
  const a = asn('ss', {
    substackKind: 'essay', substackHeadline: 'The Quiet Ambition of Starting Over',
    substackPremise: 'Rest is not retreat', substackReaderPromise: 'A gentler frame for change',
    substackCta: 'Subscribe for the series', substackConnection: 'expands the TikTok into an essay',
  });
  assert.equal(a.substackKind, 'essay');
  assert.equal(a.substackHeadline, 'The Quiet Ambition of Starting Over');
  assert.equal(a.substackReaderPromise, 'A gentler frame for change');
  assert.equal(a.substackConnection, 'expands the TikTok into an essay');
});

/* --- cross-property strategy ---------------------------------------------- */
test('cross-property reasons pair each selected property with its strategic reason', () => {
  const a = asn('cp', {
    properties: ['founder_platform', 'hr_baddie_society'],
    tiktokConnection: 'Founder TikTok as the entry point',
    hrbsConnection: 'A longer educational HR essay',
  });
  const reasons = crossPropertyReasons(a);
  assert.deepEqual(reasons.map((r) => r.property), ['founder_platform', 'hr_baddie_society']);
  assert.equal(reasons.find((r) => r.property === 'founder_platform')!.reason, 'Founder TikTok as the entry point');
  assert.equal(reasons.find((r) => r.property === 'hr_baddie_society')!.reason, 'A longer educational HR essay');
});

/* --- editing & the planning/review lifecycle ------------------------------ */
test('a draft can be edited, marked ready, and moved through the office decisions', () => {
  let a = asn('l1');
  a = updateAssignment(a, { hook: '  A hook  ', talkingPoints: ['a', 'b'], primaryPlatform: 'tiktok' });
  assert.equal(a.hook, 'A hook');
  assert.deepEqual(a.talkingPoints, ['a', 'b']);
  a = markAssignmentReady(a);
  assert.equal(a.status, 'ready_for_review');
  assert.equal(approveAssignment(a).status, 'approved');
  assert.equal(holdAssignment(a).status, 'held');
  assert.equal(declineAssignment(a).status, 'declined');
});

test('Return for Revision records a concise instruction (no thread) and re-opens development', () => {
  const ready = markAssignmentReady(asn('l2'));
  const returned = returnAssignmentForRevision(ready, '  Sharpen the hook  ', T);
  assert.equal(returned.status, 'returned_for_revision');
  assert.equal(returned.revisionNote, 'Sharpen the hook');
  assert.equal(markAssignmentReady(returned).status, 'ready_for_review', 'can be resubmitted');
});

test('assignment statuses stay in planning/review — a declined assignment is terminal', () => {
  const ids = ASSIGNMENT_STATUSES.map((s) => s.id).sort();
  assert.deepEqual(ids, ['approved', 'declined', 'draft', 'held', 'in_development', 'ready_for_review', 'returned_for_revision', 'routed_to_work']);
  assert.equal(markAssignmentReady(declineAssignment(markAssignmentReady(asn('l3')))).status, 'declined');
});

/* --- Founder projection --------------------------------------------------- */
test('the Founder assignment view is concise and hides internal form complexity', () => {
  const a = asn('f1', {
    title: 'Make the starting-over TikTok', hook: 'You are not behind.', centralIdea: 'Reframe the timeline',
    targetAudience: 'Women 28-40', primaryPlatform: 'tiktok', tiktokFormat: 'direct_to_camera',
    substackKind: 'note', substackConnection: 'a companion Note', callToAction: 'Follow', timing: 'This week',
  });
  const fa = founderAssignment(a);
  assert.equal(fa.make, 'Make the starting-over TikTok');
  assert.equal(fa.hook, 'You are not behind.');
  assert.equal(fa.mainPoint, 'Reframe the timeline');
  assert.match(fa.format, /TikTok/);
  assert.match(fa.substackConnection, /Note/);
  assert.equal(fa.cta, 'Follow');
  assert.match(fa.decision, /Approve/);
  // no raw internal fields leak into the projection
  assert.doesNotMatch(JSON.stringify(fa), /voiceGuidance|talkingPoints|complexity/i);
});

/* --- provenance & idempotent routing -------------------------------------- */
test('routing an approved assignment creates ONE recommendation with the FULL chain', () => {
  const a = approveAssignment(markAssignmentReady(asn('rt1', { originOpportunityId: 'opp_src', originIntelId: 'intel_src', title: 'Make it', centralIdea: 'idea', hook: 'h', primaryPlatform: 'tiktok', callToAction: 'Follow' })));
  assert.equal(isAssignmentRoutable(a), true);
  const res = routeAssignmentToWork(a, [], T);
  assert.equal(res.created, true);
  assert.equal(res.recommendations.length, 1);
  const rec = res.recommendation!;
  assert.equal(rec.id, assignmentRecommendationId(a));
  assert.equal(rec.originAssignmentId, 'rt1');
  assert.equal(rec.originOpportunityId, 'opp_src');
  assert.equal(rec.originIntelId, 'intel_src');
  assert.equal(res.assignment.status, 'routed_to_work');
  assert.equal(res.assignment.promotedRecommendationId, rec.id);
  // description is a concise execution summary, not the whole payload
  assert.match(rec.summary, /Hook: h/);
  assert.ok(rec.summary.length < 400);
});

test('routing fabricates no Founder approval and uses Register-derived Creative identity', () => {
  const res = routeAssignmentToWork(approveAssignment(markAssignmentReady(asn('rt2'))), [], T);
  assert.equal(res.recommendation!.status, 'preparing');
  assert.equal(res.recommendation!.founderDecision, 'pending');
  assert.equal(res.recommendation!.ownerChairId, CHAIR_CREATIVE_DIRECTOR);
});

test('repeated Route to Work is idempotent — reuses the record, never duplicates or overwrites', () => {
  const a = approveAssignment(markAssignmentReady(asn('rt3')));
  const first = routeAssignmentToWork(a, [], T);
  const second = routeAssignmentToWork(first.assignment, first.recommendations, T);
  assert.equal(second.created, false);
  assert.equal(second.recommendations.length, 1);
  const progressed = first.recommendations.map((r) => ({ ...r, status: 'executing' as const }));
  const again = routeAssignmentToWork(first.assignment, progressed, T);
  assert.equal(again.created, false);
  assert.equal(again.recommendation!.status, 'executing', 'advanced work untouched');
});

test('an un-approved (draft) assignment cannot be routed', () => {
  const res = routeAssignmentToWork(asn('rt4'), [], T);
  assert.equal(res.created, false);
  assert.equal(res.recommendations.length, 0);
});

test('multiple assignments on one opportunity keep unique stable ids and links', () => {
  const a1 = asn('m1', { originOpportunityId: 'opp_shared' });
  const a2 = asn('m2', { originOpportunityId: 'opp_shared' });
  const forOpp = assignmentsForOpportunity('opp_shared', [a1, a2, asn('m3', { originOpportunityId: 'other' })]);
  assert.deepEqual(forOpp.map((a) => a.id).sort(), ['m1', 'm2']);
  const r1 = routeAssignmentToWork(approveAssignment(markAssignmentReady(a1)), [], T);
  const r2 = routeAssignmentToWork(approveAssignment(markAssignmentReady(a2)), r1.recommendations, T);
  assert.equal(r2.recommendations.length, 2);
  assert.notEqual(r1.recommendation!.id, r2.recommendation!.id);
});

/* --- derived views -------------------------------------------------------- */
test('the queues and standing separate drafts, review, and approved honestly', () => {
  const draft = asn('v1');
  const ready = markAssignmentReady(asn('v2'));
  const approved = approveAssignment(markAssignmentReady(asn('v3')));
  const store = [draft, ready, approved];
  assert.deepEqual(draftAssignments(store).map((a) => a.id), ['v1']);
  assert.deepEqual(assignmentsForReview(store).map((a) => a.id), ['v2']);
  assert.deepEqual(approvedAssignments(store).map((a) => a.id), ['v3']);
  const s = assignmentStanding(store);
  assert.equal(s.draft, 1); assert.equal(s.readyForReview, 1); assert.equal(s.approved, 1); assert.equal(s.total, 3);
});

/* --- storage: normalization & backward compatibility ---------------------- */
test('a malformed / partial assignment normalizes to safe defaults', () => {
  const bad = {
    id: 'n1', originOpportunityId: 'o', originIntelId: 'i', title: 't', status: 'weird',
    createdAt: T.toISOString(), createdBy: 'ghost', complexity: 'ultra', substackKind: 'zzz',
    primaryPlatform: 'nope', tiktokFormat: 'bad', properties: ['pull_me_under', 'x'], talkingPoints: ['ok', 5],
  } as unknown as CreativeAssignment;
  const n = normalizeCreativeAssignment(bad);
  assert.equal(n.status, 'draft');
  assert.equal(n.complexity, 'medium');
  assert.equal(n.substackKind, 'none');
  assert.equal(n.primaryPlatform, '');
  assert.equal(n.tiktokFormat, '');
  assert.equal(n.createdBy, CHAIR_CREATIVE_DIRECTOR);
  assert.deepEqual(n.properties, ['pull_me_under']);
  assert.deepEqual(n.talkingPoints, ['ok']);
  assert.equal(n.hook, '');
});

test('a clean assignment passes normalization unchanged (same reference)', () => {
  const clean = asn('clean', { properties: ['pull_me_under'], primaryPlatform: 'tiktok', tiktokFormat: 'voiceover', talkingPoints: ['a'] });
  assert.equal(normalizeCreativeAssignment(clean), clean);
});

test('the type guard accepts real assignments and rejects junk', () => {
  assert.equal(isCreativeAssignment(asn('t1')), true);
  assert.equal(isCreativeAssignment({}), false);
  assert.equal(isCreativeAssignment(null), false);
  assert.equal(isCreativeAssignment({ id: 'x', originOpportunityId: 'y' }), false);
});

test('backward compatibility: routing an assignment does not disturb 13A/13B records', () => {
  const o = opp('bc_opp', 'recommended');
  const a = approveAssignment(markAssignmentReady(asn('bc1', { originOpportunityId: o.id, originIntelId: 'intel_1' })));
  routeAssignmentToWork(a, [], T);
  assert.equal(o.status, 'recommended', 'the opportunity brief is untouched');
});

test('routing owner differs from a Growth-routed brief — Creative owns creative work', () => {
  const res = routeAssignmentToWork(approveAssignment(markAssignmentReady(asn('own'))), [], T);
  assert.equal(res.recommendation!.ownerChairId, CHAIR_CREATIVE_DIRECTOR);
  assert.notEqual(res.recommendation!.ownerChairId, CHAIR_HEAD_OF_PRODUCTION);
});
