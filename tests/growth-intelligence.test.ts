/* =============================================================================
   Sprint 13A — Growth Intelligence intake (Council Phase III). The Director of
   Growth's research desk: capture, the office's prioritisation, the Founder-ready
   pipeline, and the promotion seam into the Executive Inbox. Pure model + views.
   ============================================================================= */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  INTEL_SOURCES, INTEL_CATEGORIES, INTEL_STATUSES, INTEL_REVIEW_OUTCOMES,
  intelSourceLabel, intelCategoryLabel, intelStatusLabel, intelOutcomeLabel,
  makeIntelligenceItem, canReviewIntel, reviewIntelligence, beginIntelReview,
  linkPromotedRecommendation, intelligenceToSubmission,
  routeIntelligenceToWork, promotedRecommendationId, isRoutable,
  intelIntakeQueue, growthCaptures, founderReadyPipeline, intelStanding,
  normalizeIntelligenceItem, isIntelligenceItem, capturedByLabel,
  type IntelligenceItem,
} from '../src/headquarters/growth-intelligence.ts';
import { makeSubmission } from '../src/headquarters/chief-of-staff-ops.ts';
import { CHAIR_DIRECTOR_OF_GROWTH, CHAIR_CREATIVE_DIRECTOR } from '../src/headquarters/executive-register.ts';

const T = new Date('2026-07-17T09:00:00.000Z');
const at = (s: string): Date => new Date(`2026-07-17T${s}:00.000Z`);
const item = (id: string, over: Partial<Parameters<typeof makeIntelligenceItem>[0]> = {}): IntelligenceItem =>
  makeIntelligenceItem({ id, title: 't', summary: 's', ...over }, T)!;

/* --- construction & defaults ---------------------------------------------- */
test('an intelligence item requires a title and summary and defaults honestly', () => {
  assert.equal(makeIntelligenceItem({ id: 'x', title: '  ', summary: 's' }, T), null);
  assert.equal(makeIntelligenceItem({ id: 'x', title: 't', summary: '   ' }, T), null);
  const i = makeIntelligenceItem({ id: 'a', title: '  Found a trend  ', summary: '  rising  ' }, T)!;
  assert.equal(i.title, 'Found a trend');
  assert.equal(i.summary, 'rising');
  assert.equal(i.source, 'other');
  assert.equal(i.category, 'other');
  assert.equal(i.confidence, 'medium');
  assert.equal(i.status, 'captured');
  assert.equal(i.capturedBy, CHAIR_DIRECTOR_OF_GROWTH, 'the Growth Chair captures by default');
  assert.deepEqual(i.links, []);
  assert.deepEqual(i.attachments, []);
  assert.equal(i.review, null);
});

test('capturedBy is validated through the Register; an unknown Chair falls back to Growth', () => {
  assert.equal(item('c1', { capturedBy: CHAIR_CREATIVE_DIRECTOR }).capturedBy, CHAIR_CREATIVE_DIRECTOR);
  assert.equal(item('c2', { capturedBy: 'ghost' }).capturedBy, CHAIR_DIRECTOR_OF_GROWTH);
  assert.equal(capturedByLabel(item('c3')), 'Director of Growth');
});

test('enum inputs are validated; bad values fall back to defaults; links/attachments sanitized', () => {
  const i = makeIntelligenceItem({
    id: 'e', title: 't', summary: 's',
    source: 'tiktok_trend', category: 'trend', confidence: 'high',
    links: ['https://a.co', '  ', 'https://b.co', 42 as never],
    attachments: [{ id: 'a1', name: 'shot.png' }, { id: 'a2' } as never, 'junk' as never],
    whyItMatters: '  it is rising  ', audience: ' readers ', notes: ' n ',
  }, T)!;
  assert.equal(i.source, 'tiktok_trend');
  assert.equal(i.confidence, 'high');
  assert.deepEqual(i.links, ['https://a.co', 'https://b.co']);
  assert.deepEqual(i.attachments.map((a) => a.id), ['a1']);
  assert.equal(i.whyItMatters, 'it is rising');
  assert.equal(i.audience, 'readers');
});

test('the vocabulary is complete and labelled', () => {
  assert.ok(INTEL_SOURCES.length >= 12 && INTEL_SOURCES.every((s) => s.label.length));
  assert.ok(INTEL_CATEGORIES.every((c) => c.label.length));
  assert.equal(intelSourceLabel('substack_notes'), 'Substack — Notes');
  assert.equal(intelCategoryLabel('content_gap'), 'Content gap');
  assert.equal(intelStatusLabel('recommended'), 'Recommended');
  assert.equal(intelOutcomeLabel('route'), 'Route to Work');
  assert.equal(INTEL_STATUSES.length, 7);
  assert.equal(INTEL_REVIEW_OUTCOMES.length, 5);
});

/* --- the office's review (prioritisation) --------------------------------- */
test('the office review maps each outcome to the right settled/open status', () => {
  assert.equal(reviewIntelligence(item('r1'), 'ignore', '', T).status, 'dismissed');
  assert.equal(reviewIntelligence(item('r2'), 'archive', '', T).status, 'archived');
  assert.equal(reviewIntelligence(item('r3'), 'research', 'dig into hashtag', T).status, 'researching');
  assert.equal(reviewIntelligence(item('r4'), 'recommend', '', T).status, 'recommended');
  assert.equal(reviewIntelligence(item('r5'), 'route', '', T).status, 'routed');
  const reviewed = reviewIntelligence(item('r6'), 'research', '  look closer  ', T);
  assert.equal(reviewed.review!.outcome, 'research');
  assert.equal(reviewed.review!.note, 'look closer');
  assert.ok(reviewed.review!.decidedAt);
});

test('only OPEN intelligence can be reviewed; a settled item is left untouched', () => {
  const routed = reviewIntelligence(item('s1'), 'route', '', T);
  assert.equal(canReviewIntel(routed), false);
  assert.equal(reviewIntelligence(routed, 'archive', '', T).status, 'routed', 'a settled item does not change');
  assert.equal(canReviewIntel(item('s2')), true, 'captured is open');
  assert.equal(canReviewIntel(reviewIntelligence(item('s3'), 'recommend', '', T)), true, 'recommended is still open');
});

test('beginIntelReview only moves a captured item into under_review', () => {
  assert.equal(beginIntelReview(item('b1')).status, 'under_review');
  const recommended = reviewIntelligence(item('b2'), 'recommend', '', T);
  assert.equal(beginIntelReview(recommended).status, 'recommended', 'not re-opened');
});

/* --- the Founder-ready pipeline & the promotion seam ---------------------- */
test('only RECOMMENDED opportunities enter the Founder-ready pipeline', () => {
  const store = [
    item('p1'),                                        // captured
    reviewIntelligence(item('p2', { confidence: 'low' }), 'recommend', '', T),
    reviewIntelligence(item('p3', { confidence: 'high' }), 'recommend', '', T),
    reviewIntelligence(item('p4'), 'route', '', T),     // routed, not in pipeline
  ];
  const pipe = founderReadyPipeline(store);
  assert.deepEqual(pipe.map((i) => i.id), ['p3', 'p2'], 'recommended only, most confident first');
});

test('the promotion seam shapes an Executive Inbox submission that actually builds', () => {
  const routed = reviewIntelligence(item('pr', {
    title: 'A rising sound', summary: 'a trending audio', whyItMatters: 'our audience uses it',
    source: 'tiktok_trend',
  }), 'route', '', T);
  const input = intelligenceToSubmission(routed);
  assert.equal(input.ownerChairId, CHAIR_DIRECTOR_OF_GROWTH);
  assert.match(input.description, /Why it matters: our audience uses it/);
  assert.match(input.description, /Source: TikTok — Trend Discovery/);
  const rec = makeSubmission(input, T);
  assert.ok(rec, 'the seam produces a valid recommendation submission');
  const linked = linkPromotedRecommendation(routed, rec!.id);
  assert.equal(linked.promotedRecommendationId, rec!.id);
});

/* --- derived views -------------------------------------------------------- */
test('the intake queue shows open work only, most-confident and newest first', () => {
  const store = [
    item('q1', { confidence: 'low' }),                                   // captured, low
    makeIntelligenceItem({ id: 'q2', title: 't', summary: 's', confidence: 'high' }, at('09:05'))!, // captured, high, newer
    beginIntelReview(item('q3')),                                     // under_review
    reviewIntelligence(item('q4'), 'research', '', T),                   // researching
    reviewIntelligence(item('q5'), 'route', '', T),                      // routed → excluded
    reviewIntelligence(item('q6'), 'archive', '', T),                    // archived → excluded
  ];
  const q = intelIntakeQueue(store);
  assert.deepEqual(q.map((i) => i.id), ['q2', 'q1', 'q3', 'q4'], 'captured (by confidence) then under_review then researching');
});

test('growthCaptures lists everything the Chair found, newest first', () => {
  const store = [
    makeIntelligenceItem({ id: 'g1', title: 't', summary: 's' }, at('09:01'))!,
    makeIntelligenceItem({ id: 'g2', title: 't', summary: 's' }, at('09:03'))!,
    makeIntelligenceItem({ id: 'g3', title: 't', summary: 's' }, at('09:02'))!,
  ];
  assert.deepEqual(growthCaptures(store).map((i) => i.id), ['g2', 'g3', 'g1']);
});

test('intelStanding gives an honest at-a-glance count', () => {
  const store = [
    item('a'), item('b'),                                     // 2 captured
    beginIntelReview(item('c')),                            // under_review
    reviewIntelligence(item('d'), 'recommend', '', T),        // recommended
    reviewIntelligence(item('e'), 'route', '', T),            // routed
    reviewIntelligence(item('f'), 'ignore', '', T),           // dismissed
  ];
  const s = intelStanding(store);
  assert.equal(s.captured, 2);
  assert.equal(s.underReview, 1);
  assert.equal(s.recommended, 1);
  assert.equal(s.routed, 1);
  assert.equal(s.dismissed, 1);
  assert.equal(s.total, 6);
});

/* --- storage: normalization & robustness ---------------------------------- */
test('a malformed / partial stored record normalizes to safe defaults', () => {
  const bad = {
    id: 'n1', title: 't', summary: 's', capturedAt: T.toISOString(),
    source: 'nonsense', category: 'nope', confidence: 'ultra', status: 'weird',
    capturedBy: 'ghost', links: ['ok', 3], attachments: ['junk'],
  } as unknown as IntelligenceItem;
  const n = normalizeIntelligenceItem(bad);
  assert.equal(n.source, 'other');
  assert.equal(n.category, 'other');
  assert.equal(n.confidence, 'medium');
  assert.equal(n.status, 'captured');
  assert.equal(n.capturedBy, CHAIR_DIRECTOR_OF_GROWTH);
  assert.deepEqual(n.links, ['ok']);
  assert.deepEqual(n.attachments, []);
  assert.equal(n.review, null);
});

test('a well-formed record passes normalization unchanged (same reference)', () => {
  const clean = item('clean', { source: 'tiktok_search', category: 'trend', confidence: 'high' });
  assert.equal(normalizeIntelligenceItem(clean), clean);
});

test('the type guard accepts real records and rejects junk', () => {
  assert.equal(isIntelligenceItem(item('t1')), true);
  assert.equal(isIntelligenceItem({}), false);
  assert.equal(isIntelligenceItem(null), false);
  assert.equal(isIntelligenceItem({ id: 'x' }), false);
});

/* =============================================================================
   ROUTE TO WORK — durable, bidirectional, idempotent promotion (Phase 4)
   ============================================================================= */

test('routing an eligible opportunity creates ONE recommendation with a bidirectional link', () => {
  const i = item('rt1', { title: 'A rising sound', summary: 'trending audio', source: 'tiktok_trend', whyItMatters: 'our audience uses it', audience: 'TikTok', links: ['https://x.co'] });
  const res = routeIntelligenceToWork(i, [], T);
  assert.equal(res.created, true);
  assert.equal(res.recommendations.length, 1, 'exactly one recommendation');
  // intelligence → recommendation
  assert.equal(res.item.status, 'routed');
  assert.equal(res.item.promotedRecommendationId, res.recommendation!.id);
  // recommendation → intelligence (reverse link) + stable id
  assert.equal(res.recommendation!.id, promotedRecommendationId(i));
  assert.equal(res.recommendation!.originIntelId, i.id);
  // provenance snapshot carried into the work record
  assert.match(res.recommendation!.summary, /Source: TikTok — Trend Discovery/);
});

test('routing does NOT fabricate a Founder approval — the work enters at preparing', () => {
  const res = routeIntelligenceToWork(item('rt2'), [], T);
  assert.equal(res.recommendation!.status, 'preparing');
  assert.equal(res.recommendation!.founderDecision, 'pending');
});

test('routing uses the Register-derived Growth identity as owner', () => {
  const res = routeIntelligenceToWork(item('rt3'), [], T);
  assert.equal(res.recommendation!.ownerChairId, CHAIR_DIRECTOR_OF_GROWTH);
});

test('repeated Route to Work is IDEMPOTENT — the existing recommendation is reused, never duplicated', () => {
  const i = item('rt4');
  const first = routeIntelligenceToWork(i, [], T);
  assert.equal(first.created, true);
  // Route the (now routed, linked) item again against the store that already has it.
  const second = routeIntelligenceToWork(first.item, first.recommendations, T);
  assert.equal(second.created, false, 'no new recommendation');
  assert.equal(second.recommendations.length, 1, 'still exactly one');
  assert.equal(second.recommendation!.id, first.recommendation!.id);
  // Even a fresh capture-shaped item with the same id must not fork a second record.
  const third = routeIntelligenceToWork(item('rt4'), first.recommendations, T);
  assert.equal(third.created, false);
  assert.equal(third.recommendations.length, 1);
});

test('routing preserves downstream progress on the promoted recommendation (no overwrite)', () => {
  const first = routeIntelligenceToWork(item('rt5'), [], T);
  // Simulate the work progressing in the recommendation system.
  const progressed = first.recommendations.map((r) => ({ ...r, status: 'executing' as const }));
  const again = routeIntelligenceToWork(first.item, progressed, T);
  assert.equal(again.created, false);
  assert.equal(again.recommendation!.status, 'executing', 'the advanced work record is untouched');
});

test('only eligible intelligence may be routed; a settled, never-promoted item creates nothing', () => {
  assert.equal(isRoutable(item('rt6')), true, 'captured is routable');
  const archived = reviewIntelligence(item('rt7'), 'archive', '', T);
  assert.equal(isRoutable(archived), false);
  const res = routeIntelligenceToWork(archived, [], T);
  assert.equal(res.created, false);
  assert.equal(res.recommendations.length, 0, 'no recommendation for a settled item');
  assert.equal(res.item.status, 'archived', 'unchanged');
});

test('the original intelligence record remains available after promotion (provenance kept)', () => {
  const i = item('rt8', { category: 'trend', audience: 'readers', notes: 'seen thrice' });
  const res = routeIntelligenceToWork(i, [], T);
  // The intelligence item is not consumed — its full research context survives.
  assert.equal(res.item.id, i.id);
  assert.equal(res.item.category, 'trend');
  assert.equal(res.item.audience, 'readers');
  assert.equal(res.item.notes, 'seen thrice');
  assert.equal(res.item.source, i.source);
  assert.equal(res.item.capturedAt, i.capturedAt);
});

test('a recommendation from before the linkage field remains valid (backward compatible)', () => {
  // An older promoted item with a link but a recommendation lacking originIntelId.
  const i = linkPromotedRecommendation(reviewIntelligence(item('rt9'), 'route', '', T), 'rec_legacy');
  const legacyRec = makeSubmission({ id: 'rec_legacy', type: 'idea', title: 't', description: 'd' }, T)!;
  assert.equal(legacyRec.originIntelId, undefined, 'legacy work has no origin link — still valid');
  const res = routeIntelligenceToWork(i, [legacyRec], T);
  assert.equal(res.created, false, 'the existing (legacy) recommendation is reused');
  assert.equal(res.recommendation!.id, 'rec_legacy');
});

test('intelligenceToSubmission carries the origin id for the reverse link', () => {
  const input = intelligenceToSubmission(item('rt10'));
  assert.equal(input.originIntelId, 'rt10');
  assert.equal(input.id, promotedRecommendationId(item('rt10')));
});
