/* =============================================================================
   Sprint 13D — Creative Drafting Assistant. The draft model, provider boundary
   (deterministic / failing / malformed — never a live service), prompt-context
   assembly, truthfulness cautions, the Founder projection, and idempotent Route
   to Work with the full chain intelligence → opportunity → assignment → draft →
   recommendation.
   ============================================================================= */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DRAFT_TYPES, DRAFT_STATUSES, VOICE_DIRECTIONS,
  draftTypeLabel, draftStatusLabel,
  buildDraftContext, deterministicDraftProvider, makeCreativeDraft, generateDraft,
  requestDraftRevision, holdDraft, declineDraft, approveDraft, retryDraft,
  isAssignmentEligibleForDraft, draftCautions, founderDraftView,
  isDraftRoutable, routeDraftToWork, draftRecommendationId,
  draftsForAssignment, draftsInProgress, draftsForFounder, draftStanding, draftAuthorLabel,
  normalizeCreativeDraft, isCreativeDraft,
  type CreativeDraft, type DraftProvider, type DraftContext, type DraftContent,
} from '../src/headquarters/creative-draft.ts';
import { makeCreativeAssignment, markAssignmentReady, approveAssignment, type CreativeAssignment } from '../src/headquarters/creative-assignment.ts';
import { makeContentOpportunity } from '../src/headquarters/content-opportunity.ts';
import { makeIntelligenceItem } from '../src/headquarters/growth-intelligence.ts';
import { CHAIR_CREATIVE_DIRECTOR } from '../src/headquarters/executive-register.ts';

const T = new Date('2026-07-17T09:00:00.000Z');

function approvedAssignment(over: Partial<Parameters<typeof makeCreativeAssignment>[0]> = {}): CreativeAssignment {
  const a = makeCreativeAssignment({
    id: 'asn_1', originOpportunityId: 'opp_1', originIntelId: 'intel_1', title: 'Starting over',
    hook: 'You are not behind.', centralIdea: 'Starting over is a choice', talkingPoints: ['reframe', 'name the fear', 'one step'],
    targetAudience: 'Women 28-40', callToAction: 'Follow', substackConnection: 'a companion essay',
    ...over,
  }, T)!;
  return approveAssignment(markAssignmentReady(a));
}
function ctx(a: CreativeAssignment = approvedAssignment()): DraftContext {
  return buildDraftContext(a, null, null);
}
function draft(type: CreativeDraft['type'] = 'tiktok_short', a: CreativeAssignment = approvedAssignment()): CreativeDraft {
  return makeCreativeDraft({ id: 'd1', assignment: a, type, context: buildDraftContext(a, null, null) }, T)!;
}

// Providers for the tests — a deterministic one is exported; here are failure ones.
const failingProvider: DraftProvider = { name: 'fail', async draft() { throw new Error('down'); } };
const notConfiguredProvider: DraftProvider = { name: 'none', async draft() { return { ok: false, reason: 'not_configured' }; } };
const invalidProvider: DraftProvider = { name: 'bad', async draft() { return { ok: false, reason: 'invalid_response' }; } };
const timeoutProvider: DraftProvider = { name: 'slow', async draft() { return { ok: false, reason: 'timeout' }; } };

/* --- construction & eligibility ------------------------------------------- */
test('a draft requests from an eligible approved assignment, linking the whole chain', () => {
  assert.equal(isAssignmentEligibleForDraft(approvedAssignment()), true);
  assert.equal(isAssignmentEligibleForDraft(markAssignmentReady(makeCreativeAssignment({ id: 'x', originOpportunityId: 'o', originIntelId: 'i', title: 't' }, T)!)), false, 'ready but not approved → not eligible');
  const d = draft();
  assert.equal(d.originAssignmentId, 'asn_1');
  assert.equal(d.originOpportunityId, 'opp_1');
  assert.equal(d.originIntelId, 'intel_1');
  assert.equal(d.status, 'requested', 'nothing generated until an authorised request runs');
  assert.equal(d.content, null);
  assert.equal(d.createdBy, CHAIR_CREATIVE_DIRECTOR);
});

test('vocabulary is complete and labelled', () => {
  assert.equal(DRAFT_TYPES.length, 4);
  assert.equal(draftTypeLabel('tiktok_live'), 'TikTok LIVE — brief');
  assert.equal(DRAFT_STATUSES.length, 9);
  assert.equal(draftStatusLabel('generation_failed'), 'Generation Failed');
  assert.ok(VOICE_DIRECTIONS.length >= 8);
});

/* --- prompt context: only relevant records -------------------------------- */
test('the context is assembled from approved records and excludes unrelated data', () => {
  const a = approvedAssignment({ cautions: 'no medical claims' });
  const opp = makeContentOpportunity({ id: 'opp_1', intelId: 'intel_1', title: 't', summary: 's', audienceNeed: 'how to begin' }, T)!;
  const intel = makeIntelligenceItem({ id: 'intel_1', title: 't', summary: 's', source: 'tiktok_trend', whyItMatters: 'high demand' }, T)!;
  const c = buildDraftContext(a, opp, intel);
  assert.equal(c.assignmentId, 'asn_1');
  assert.equal(c.centralIdea, 'Starting over is a choice');
  assert.match(c.sourceEvidence, /high demand/);
  assert.equal(c.trendingSupported, true, 'a trend source supports a trending framing');
  assert.equal(c.cautions, 'no medical claims');
  // no unrelated fields leak — the context has a fixed, known shape
  assert.deepEqual(Object.keys(c).sort(), ['assignmentId', 'audience', 'callToAction', 'cautions', 'centralIdea', 'hook', 'intelId', 'opportunityId', 'properties', 'sourceEvidence', 'substackConnection', 'talkingPoints', 'tiktokConnection', 'tone', 'trendingSupported', 'voiceGuidance'].sort());
});

/* --- generation: deterministic success + honest failures ------------------ */
test('the deterministic provider produces structured TikTok short-form output', async () => {
  const d = await generateDraft(draft('tiktok_short'), deterministicDraftProvider, T);
  assert.equal(d.status, 'draft_ready');
  assert.equal(d.providerMeta!.provider, 'stub-preview', 'clearly a stub, not a live model');
  assert.ok(d.content!.hookOptions!.length >= 3);
  assert.ok(d.content!.recommendedHook && d.content!.firstSentence && d.content!.outline!.length);
  assert.equal(d.content!.cta, 'Follow');
  assert.ok(d.generatedAt);
});

test('each draft type yields its own structured shape', async () => {
  const live = await generateDraft(draft('tiktok_live'), deterministicDraftProvider, T);
  assert.ok(live.content!.liveTitle && live.content!.primaryQuestion && live.content!.discussionBeats!.length >= 4);
  const note = await generateDraft(draft('substack_note'), deterministicDraftProvider, T);
  assert.ok(note.content!.noteCopy && note.content!.tiktokConnection);
  const essay = await generateDraft(draft('substack_essay'), deterministicDraftProvider, T);
  assert.ok(essay.content!.headlineOptions!.length && essay.content!.thesis && essay.content!.sections!.length);
});

test('generation failures are honest and never fabricate content', async () => {
  for (const [prov, reason] of [[failingProvider, 'error'], [notConfiguredProvider, 'not_configured'], [invalidProvider, 'invalid_response'], [timeoutProvider, 'timeout']] as const) {
    const d = await generateDraft(draft(), prov, T);
    assert.equal(d.status, 'generation_failed');
    assert.equal(d.failureReason, reason);
    assert.equal(d.content, null, 'no content is invented on failure');
  }
});

test('a failed draft can be retried; a revision re-generates and marks revised', async () => {
  let d = await generateDraft(draft(), failingProvider, T);
  assert.equal(d.status, 'generation_failed');
  d = retryDraft(d, T);
  assert.equal(d.status, 'requested');
  d = await generateDraft(d, deterministicDraftProvider, T);
  assert.equal(d.status, 'draft_ready');
  d = requestDraftRevision(d, 'sharper hook', T);
  assert.equal(d.status, 'revision_requested');
  assert.equal(d.revisionInstruction, 'sharper hook');
  assert.equal(d.revisionNumber, 1);
  d = await generateDraft(d, deterministicDraftProvider, T);
  assert.equal(d.status, 'revised', 'a re-generated revision is marked revised');
});

/* --- truthfulness & cautions ---------------------------------------------- */
test('every draft carries the unverified caution and flags weak evidence', () => {
  const d = draft(); // no source evidence in the plain context
  const cautions = draftCautions(d);
  assert.ok(cautions.some((c) => /unverified/i.test(c)));
  assert.ok(cautions.some((c) => /evidence is limited/i.test(c)));
});

test('an HR Baddie Society draft carries a legal-information caution', () => {
  const a = approvedAssignment({ properties: ['hr_baddie_society'] });
  const d = makeCreativeDraft({ id: 'hr', assignment: a, type: 'tiktok_short', context: buildDraftContext(a, null, null) }, T)!;
  assert.ok(draftCautions(d).some((c) => /legal advice/i.test(c)));
});

test('a draft that implies trending without support is flagged', async () => {
  const a = approvedAssignment({ centralIdea: 'this is trending everywhere' });
  const c = buildDraftContext(a, null, null); // no intel → trendingSupported false
  let d = makeCreativeDraft({ id: 'tr', assignment: a, type: 'substack_note', context: c }, T)!;
  d = await generateDraft(d, deterministicDraftProvider, T);
  assert.ok(draftCautions(d).some((x) => /trend the intelligence record does not support/i.test(x)));
});

/* --- Founder projection --------------------------------------------------- */
test('the Founder draft view is concise, shows the platform, and always carries cautions', async () => {
  const d = await generateDraft(draft('tiktok_short'), deterministicDraftProvider, T);
  const fv = founderDraftView(d);
  assert.equal(fv.platform, 'TikTok');
  assert.equal(fv.draftType, 'TikTok — short-form draft');
  assert.ok(fv.highlights.some((h) => h.label === 'Recommended hook'));
  assert.ok(fv.cautions.length >= 1);
  assert.match(fv.decision, /Approve/);
});

/* --- approval: Founder is the authority ----------------------------------- */
test('only the Founder approves a ready/revised draft — approval never comes from the AI', async () => {
  const ready = await generateDraft(draft(), deterministicDraftProvider, T);
  assert.equal(approveDraft(draft()).status, 'requested', 'a not-yet-generated draft cannot be approved');
  const approved = approveDraft(ready, null, 'love it', T);
  assert.equal(approved.status, 'approved');
  assert.equal(approved.founderFeedback, 'love it');
  assert.deepEqual(approved.approvedContent, ready.content, 'the generated draft becomes the approved copy');
});

test('the Founder may edit or replace the final copy before approving', async () => {
  const ready = await generateDraft(draft(), deterministicDraftProvider, T);
  const edited: DraftContent = { ...ready.content!, recommendedHook: 'A hook in the Founder’s own words' };
  const approved = approveDraft(ready, edited, '', T);
  assert.equal(approved.approvedContent!.recommendedHook, 'A hook in the Founder’s own words');
});

test('hold and decline behave; an approved draft is not declined away', async () => {
  const ready = await generateDraft(draft(), deterministicDraftProvider, T);
  assert.equal(holdDraft(ready).status, 'held');
  assert.equal(declineDraft(ready).status, 'declined');
  assert.equal(declineDraft(approveDraft(ready)).status, 'approved', 'approved is protected');
});

/* --- provenance & idempotent routing -------------------------------------- */
test('routing an approved draft creates ONE recommendation carrying the FULL chain', async () => {
  const ready = await generateDraft(draft(), deterministicDraftProvider, T);
  const approved = approveDraft(ready);
  assert.equal(isDraftRoutable(approved), true);
  const res = routeDraftToWork(approved, [], T);
  assert.equal(res.created, true);
  const rec = res.recommendation!;
  assert.equal(rec.id, draftRecommendationId(approved));
  assert.equal(rec.originDraftId, 'd1');
  assert.equal(rec.originAssignmentId, 'asn_1');
  assert.equal(rec.originOpportunityId, 'opp_1');
  assert.equal(rec.originIntelId, 'intel_1');
  assert.equal(rec.ownerChairId, CHAIR_CREATIVE_DIRECTOR);
  assert.equal(rec.status, 'preparing');
  assert.equal(rec.founderDecision, 'pending', 'no fabricated Founder approval');
  assert.equal(res.draft.promotedRecommendationId, rec.id);
  assert.ok(rec.summary.length < 500, 'a concise execution summary, not the full payload');
});

test('repeated Route to Work is idempotent — reuses the record, never overwrites advanced work', async () => {
  const approved = approveDraft(await generateDraft(draft(), deterministicDraftProvider, T));
  const first = routeDraftToWork(approved, [], T);
  const second = routeDraftToWork(first.draft, first.recommendations, T);
  assert.equal(second.created, false);
  assert.equal(second.recommendations.length, 1);
  const progressed = first.recommendations.map((r) => ({ ...r, status: 'executing' as const }));
  const again = routeDraftToWork(first.draft, progressed, T);
  assert.equal(again.created, false);
  assert.equal(again.recommendation!.status, 'executing');
});

test('a draft that is not approved cannot be routed', async () => {
  const ready = await generateDraft(draft(), deterministicDraftProvider, T);
  assert.equal(routeDraftToWork(ready, [], T).created, false);
});

/* --- derived views -------------------------------------------------------- */
test('the queues and standing separate in-progress, Founder-ready, and approved', async () => {
  const ready = await generateDraft(makeCreativeDraft({ id: 'q1', assignment: approvedAssignment(), type: 'tiktok_short', context: ctx() }, T)!, deterministicDraftProvider, T);
  const failed = await generateDraft(makeCreativeDraft({ id: 'q2', assignment: approvedAssignment(), type: 'tiktok_short', context: ctx() }, T)!, failingProvider, T);
  const approved = approveDraft(await generateDraft(makeCreativeDraft({ id: 'q3', assignment: approvedAssignment(), type: 'tiktok_short', context: ctx() }, T)!, deterministicDraftProvider, T));
  const store = [ready, failed, approved];
  assert.deepEqual(draftsForFounder(store).map((d) => d.id), ['q1']);
  assert.equal(draftsInProgress(store).length, 2, 'ready + failed are in progress; approved is not');
  assert.deepEqual(draftsForAssignment('asn_1', store).map((d) => d.id).sort(), ['q1', 'q2', 'q3']);
  const s = draftStanding(store);
  assert.equal(s.ready, 1); assert.equal(s.failed, 1); assert.equal(s.approved, 1); assert.equal(s.total, 3);
  assert.equal(draftAuthorLabel(ready), 'Creative Director');
});

/* --- storage: normalization & backward compatibility ---------------------- */
test('a malformed / partial draft normalizes to safe defaults', () => {
  const bad = { id: 'n1', originAssignmentId: 'a', type: 'zzz', status: 'weird', createdAt: T.toISOString(), createdBy: 'ghost', properties: ['ok', 3], revisionNumber: NaN } as unknown as CreativeDraft;
  const n = normalizeCreativeDraft(bad);
  assert.equal(n.status, 'requested');
  assert.equal(n.type, 'tiktok_short');
  assert.equal(n.createdBy, CHAIR_CREATIVE_DIRECTOR);
  assert.deepEqual(n.properties, ['ok']);
  assert.equal(n.revisionNumber, 0);
  assert.equal(n.content, null);
});

test('a clean draft passes normalization unchanged (same reference)', async () => {
  const clean = await generateDraft(draft(), deterministicDraftProvider, T);
  assert.equal(normalizeCreativeDraft(clean), clean);
});

test('the type guard accepts real drafts and rejects junk', () => {
  assert.equal(isCreativeDraft(draft()), true);
  assert.equal(isCreativeDraft({}), false);
  assert.equal(isCreativeDraft(null), false);
});

test('backward compatibility: drafting does not disturb the assignment record', async () => {
  const a = approvedAssignment();
  await generateDraft(makeCreativeDraft({ id: 'bc', assignment: a, type: 'tiktok_short', context: buildDraftContext(a, null, null) }, T)!, deterministicDraftProvider, T);
  assert.equal(a.status, 'approved', 'the assignment is untouched by drafting');
});
