/* =============================================================================
   Sprint 13B — Content Opportunity Brief (Growth Intelligence analysis layer).
   The brief model, transparent scoring, the office review lifecycle, the
   Founder-ready projection, and idempotent Route to Work with the full
   intelligence → opportunity → recommendation provenance chain.
   ============================================================================= */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTENT_PROPERTIES, OPPORTUNITY_TYPES, OPPORTUNITY_STATUSES, RATINGS, SCORE_DIMENSIONS,
  contentPropertyLabel, opportunityTypeLabel, opportunityStatusLabel, ratingLabel,
  makeContentOpportunity, updateOpportunity, scoreOpportunity,
  markReadyForReview, recommendOpportunity, returnOpportunityForResearch, holdOpportunity, declineOpportunity,
  isIntelEligibleForBrief, isOpportunityRoutable, routeOpportunityToWork, opportunityRecommendationId,
  founderBrief, opportunitiesForIntel, draftOpportunities, opportunitiesForReview,
  founderReadyOpportunities, opportunityStanding, opportunityAuthorLabel,
  normalizeContentOpportunity, isContentOpportunity,
  type ContentOpportunity, type OpportunitySignals,
} from '../src/headquarters/content-opportunity.ts';
import { makeIntelligenceItem, reviewIntelligence, type IntelligenceItem } from '../src/headquarters/growth-intelligence.ts';
import { CHAIR_DIRECTOR_OF_GROWTH, CHAIR_CREATIVE_DIRECTOR } from '../src/headquarters/executive-register.ts';

const T = new Date('2026-07-17T09:00:00.000Z');
const at = (s: string): Date => new Date(`2026-07-17T${s}:00.000Z`);
const intel = (id: string, over: Partial<Parameters<typeof makeIntelligenceItem>[0]> = {}): IntelligenceItem =>
  makeIntelligenceItem({ id, title: 't', summary: 's', ...over }, T)!;
const brief = (id: string, over: Partial<Parameters<typeof makeContentOpportunity>[0]> = {}): ContentOpportunity =>
  makeContentOpportunity({ id, intelId: 'intel_1', title: 'A brief', ...over }, T)!;
const strong: OpportunitySignals = {
  timeliness: 'high', audienceRelevance: 'high', propertyFit: 'high', founderFit: 'high',
  contentPotential: 'high', conversionPotential: 'high', effort: 'low',
};

/* --- construction --------------------------------------------------------- */
test('a brief requires an intelligence id and a title, links to intel, defaults honestly', () => {
  assert.equal(makeContentOpportunity({ id: 'x', intelId: '', title: 't' }, T), null);
  assert.equal(makeContentOpportunity({ id: 'x', intelId: 'i', title: '  ' }, T), null);
  const b = brief('b1');
  assert.equal(b.intelId, 'intel_1', 'durable link to intelligence');
  assert.equal(b.status, 'draft');
  assert.equal(b.createdBy, CHAIR_DIRECTOR_OF_GROWTH);
  assert.deepEqual(b.properties, []);
  assert.deepEqual(b.types, []);
  assert.equal(b.confidence, 'medium');
});

test('createdBy is Register-validated; enums/properties/types are sanitised', () => {
  assert.equal(brief('b2', { createdBy: CHAIR_CREATIVE_DIRECTOR }).createdBy, CHAIR_CREATIVE_DIRECTOR);
  assert.equal(brief('b3', { createdBy: 'ghost' }).createdBy, CHAIR_DIRECTOR_OF_GROWTH);
  const b = brief('b4', {
    properties: ['pull_me_under', 'nope' as never, 'hr_baddie_society'],
    types: ['tiktok_short', 'bad' as never, 'substack_note'],
    signals: { timeliness: 'high', effort: 'low', founderFit: 'wild' as never },
    confidence: 'high',
  });
  assert.deepEqual(b.properties, ['pull_me_under', 'hr_baddie_society']);
  assert.deepEqual(b.types, ['tiktok_short', 'substack_note']);
  assert.equal(b.signals.timeliness, 'high');
  assert.equal(b.signals.founderFit, 'medium', 'bad rating falls back to default');
  assert.equal(opportunityAuthorLabel(b), 'Director of Growth');
});

test('the vocabulary is complete and labelled', () => {
  assert.equal(CONTENT_PROPERTIES.length, 5);
  assert.equal(contentPropertyLabel('pull_me_under'), 'Pull Me Under');
  assert.equal(contentPropertyLabel('hr_baddie_society'), 'HR Baddie Society');
  assert.ok(OPPORTUNITY_TYPES.length >= 10);
  assert.equal(opportunityTypeLabel('tiktok_live'), 'TikTok LIVE — topic');
  assert.equal(opportunityStatusLabel('ready_for_review'), 'Ready for Review');
  assert.equal(ratingLabel('high'), 'High');
  assert.equal(RATINGS.length, 3);
  assert.equal(OPPORTUNITY_STATUSES.length, 7);
});

/* --- eligibility ---------------------------------------------------------- */
test('only an open intelligence item is eligible to become a brief', () => {
  assert.equal(isIntelEligibleForBrief(intel('e1')), true, 'captured is eligible');
  assert.equal(isIntelEligibleForBrief(reviewIntelligence(intel('e2'), 'recommend', '', T)), true, 'recommended is eligible');
  assert.equal(isIntelEligibleForBrief(reviewIntelligence(intel('e3'), 'archive', '', T)), false);
  assert.equal(isIntelEligibleForBrief(reviewIntelligence(intel('e4'), 'ignore', '', T)), false);
});

/* --- transparent scoring -------------------------------------------------- */
test('scoring is transparent — derived from explicit signals, with a per-factor explanation', () => {
  const s = scoreOpportunity(strong, 'high');
  assert.equal(s.score, 100, 'all-high, low-effort → full marks');
  assert.equal(s.band, 'Strong fit');
  assert.equal(s.factors.length, SCORE_DIMENSIONS.length, 'every dimension is explained');
  const effort = s.factors.find((f) => f.id === 'effort')!;
  assert.equal(effort.rating, 'low');
  assert.equal(effort.points, 3, 'low effort is inverted to a high contribution');
  assert.ok(s.factors.every((f) => f.note.length > 0));
});

test('a weak, low-confidence brief reads as a low-confidence signal, not a failure', () => {
  const weak: OpportunitySignals = {
    timeliness: 'low', audienceRelevance: 'low', propertyFit: 'low', founderFit: 'low',
    contentPotential: 'low', conversionPotential: 'low', effort: 'high',
  };
  const s = scoreOpportunity(weak, 'low');
  assert.equal(s.band, 'Low-confidence signal', 'low confidence overrides the band');
  assert.match(s.caution!, /low-confidence/i);
  // honest hedged language — never a guaranteed-performance claim
  assert.doesNotMatch(JSON.stringify(s), /guarantee|viral|exact|expected views/i);
});

test('a timely, solid brief surfaces a timeliness caution', () => {
  const s = scoreOpportunity({ ...strong, contentPotential: 'medium' }, 'high');
  assert.match(s.caution!, /timely/i);
});

/* --- editing & the analysis/prioritisation lifecycle ---------------------- */
test('a draft can be edited and marked ready for review; the office decisions map correctly', () => {
  let b = brief('l1');
  b = updateOpportunity(b, { angle: '  a fresh angle  ', properties: ['pull_me_under'], signals: strong, confidence: 'high' }, at('09:05'));
  assert.equal(b.angle, 'a fresh angle');
  assert.deepEqual(b.properties, ['pull_me_under']);
  assert.ok(b.updatedAt > b.createdAt);
  b = markReadyForReview(b, at('09:06'));
  assert.equal(b.status, 'ready_for_review');
  assert.equal(recommendOpportunity(b).status, 'recommended');
  assert.equal(returnOpportunityForResearch(b).status, 'analyzing');
  assert.equal(holdOpportunity(b).status, 'held');
  assert.equal(declineOpportunity(b).status, 'declined');
});

test('the opportunity status stays within analysis/prioritisation (no execution lifecycle)', () => {
  const ids = OPPORTUNITY_STATUSES.map((s) => s.id).sort();
  assert.deepEqual(ids, ['analyzing', 'declined', 'draft', 'held', 'ready_for_review', 'recommended', 'routed_to_work']);
  // a declined brief is terminal
  assert.equal(markReadyForReview(declineOpportunity(brief('l2'))).status, 'declined');
});

/* --- the Founder-ready projection ----------------------------------------- */
test('the Founder brief is a concise executive projection, not raw research', () => {
  const b = brief('f1', {
    summary: 'A rising sound', audience: 'TikTok followers', angle: 'a calm voiceover',
    properties: ['pull_me_under'], types: ['tiktok_short', 'substack_note'],
    recommendation: 'It fits the House voice', nextAction: 'Approve to make it',
    signals: { ...strong }, confidence: 'high',
  });
  const fb = founderBrief(b);
  assert.equal(fb.found, 'A rising sound');
  assert.equal(fb.where, 'Pull Me Under');
  assert.equal(fb.who, 'TikTok followers');
  assert.deepEqual(fb.formats, ['TikTok — short-form video', 'Substack — Note']);
  assert.match(fb.whyNow, /timely/i);
  assert.ok(fb.decision.length > 0);
});

/* --- provenance & idempotent routing -------------------------------------- */
test('routing a reviewed brief creates ONE recommendation carrying BOTH intel and opportunity ids', () => {
  const b = markReadyForReview(brief('rt1', { intelId: 'intel_src', title: 'Make the video', summary: 's', angle: 'x', properties: ['pull_me_under'] }));
  assert.equal(isOpportunityRoutable(b), true);
  const res = routeOpportunityToWork(b, [], T);
  assert.equal(res.created, true);
  assert.equal(res.recommendations.length, 1);
  assert.equal(res.recommendation!.id, opportunityRecommendationId(b));
  // full chain: recommendation → opportunity AND → intelligence
  assert.equal(res.recommendation!.originOpportunityId, 'rt1');
  assert.equal(res.recommendation!.originIntelId, 'intel_src');
  // opportunity → recommendation
  assert.equal(res.opportunity.status, 'routed_to_work');
  assert.equal(res.opportunity.promotedRecommendationId, res.recommendation!.id);
});

test('routing fabricates no Founder approval and uses Register-derived Growth identity', () => {
  const res = routeOpportunityToWork(markReadyForReview(brief('rt2')), [], T);
  assert.equal(res.recommendation!.status, 'preparing');
  assert.equal(res.recommendation!.founderDecision, 'pending');
  assert.equal(res.recommendation!.ownerChairId, CHAIR_DIRECTOR_OF_GROWTH);
});

test('repeated Route to Work is idempotent — reuses the record, never duplicates or overwrites', () => {
  const b = recommendOpportunity(markReadyForReview(brief('rt3')));
  const first = routeOpportunityToWork(b, [], T);
  assert.equal(first.created, true);
  const second = routeOpportunityToWork(first.opportunity, first.recommendations, T);
  assert.equal(second.created, false);
  assert.equal(second.recommendations.length, 1);
  assert.equal(second.recommendation!.id, first.recommendation!.id);
  // downstream progress on the work record is preserved
  const progressed = first.recommendations.map((r) => ({ ...r, status: 'executing' as const }));
  const again = routeOpportunityToWork(first.opportunity, progressed, T);
  assert.equal(again.created, false);
  assert.equal(again.recommendation!.status, 'executing');
});

test('an un-reviewed (draft) brief cannot be routed', () => {
  const res = routeOpportunityToWork(brief('rt4'), [], T);
  assert.equal(res.created, false);
  assert.equal(res.recommendations.length, 0);
  assert.equal(res.opportunity.status, 'draft');
});

test('multiple briefs on one intelligence item keep distinct identities and links', () => {
  const b1 = brief('m1', { intelId: 'intel_shared' });
  const b2 = brief('m2', { intelId: 'intel_shared' });
  const forIntel = opportunitiesForIntel('intel_shared', [b1, b2, brief('m3', { intelId: 'other' })]);
  assert.deepEqual(forIntel.map((o) => o.id).sort(), ['m1', 'm2']);
  // routing each yields two distinct recommendations
  const r1 = routeOpportunityToWork(markReadyForReview(b1), [], T);
  const r2 = routeOpportunityToWork(markReadyForReview(b2), r1.recommendations, T);
  assert.equal(r2.recommendations.length, 2);
  assert.notEqual(r1.recommendation!.id, r2.recommendation!.id);
});

/* --- derived views -------------------------------------------------------- */
test('review and Founder-ready queues sort by score; standing counts honestly', () => {
  const weakSignals: OpportunitySignals = { ...strong, timeliness: 'low', audienceRelevance: 'low', propertyFit: 'low' };
  const hi = markReadyForReview(brief('v1', { signals: strong, confidence: 'high' }));
  const lo = markReadyForReview(brief('v2', { signals: weakSignals, confidence: 'high' }));
  const rec = recommendOpportunity(markReadyForReview(brief('v3', { signals: strong, confidence: 'high' })));
  const draft = brief('v4');
  const store = [lo, hi, rec, draft];
  assert.deepEqual(opportunitiesForReview(store).map((o) => o.id), ['v1', 'v2'], 'best score first');
  assert.deepEqual(founderReadyOpportunities(store).map((o) => o.id), ['v3']);
  assert.deepEqual(draftOpportunities(store).map((o) => o.id), ['v4']);
  const s = opportunityStanding(store);
  assert.equal(s.readyForReview, 2);
  assert.equal(s.recommended, 1);
  assert.equal(s.draft, 1);
  assert.equal(s.total, 4);
});

/* --- storage: normalization & backward compatibility ---------------------- */
test('a malformed / partial brief normalizes to safe defaults', () => {
  const bad = {
    id: 'n1', intelId: 'i', title: 't', status: 'weird', confidence: 'ultra',
    createdAt: T.toISOString(), createdBy: 'ghost',
    properties: ['pull_me_under', 'bad'], types: ['nope'], signals: { timeliness: 'high' },
  } as unknown as ContentOpportunity;
  const n = normalizeContentOpportunity(bad);
  assert.equal(n.status, 'draft');
  assert.equal(n.confidence, 'medium');
  assert.equal(n.createdBy, CHAIR_DIRECTOR_OF_GROWTH);
  assert.deepEqual(n.properties, ['pull_me_under']);
  assert.deepEqual(n.types, []);
  // signals filled to a complete, valid set
  assert.ok(SCORE_DIMENSIONS.every((d) => ['low', 'medium', 'high'].includes(n.signals[d.id])));
  assert.equal(n.summary, '');
});

test('a clean brief passes normalization unchanged (same reference)', () => {
  const clean = brief('clean', { properties: ['pull_me_under'], types: ['tiktok_short'], signals: strong, confidence: 'high' });
  assert.equal(normalizeContentOpportunity(clean), clean);
});

test('the type guard accepts real briefs and rejects junk', () => {
  assert.equal(isContentOpportunity(brief('t1')), true);
  assert.equal(isContentOpportunity({}), false);
  assert.equal(isContentOpportunity(null), false);
  assert.equal(isContentOpportunity({ id: 'x', intelId: 'y' }), false);
});

test('backward compatibility: a Sprint 13A intelligence record is untouched by the brief layer', () => {
  const i = intel('bc1', { source: 'tiktok_trend' });
  const b = brief('bc2', { intelId: i.id });
  // the intelligence record is never mutated by making or routing a brief
  routeOpportunityToWork(markReadyForReview(b), [], T);
  assert.equal(i.status, 'captured');
  assert.equal(i.source, 'tiktok_trend');
});
