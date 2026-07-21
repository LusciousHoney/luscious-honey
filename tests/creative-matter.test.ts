/* =============================================================================
   APPROVED CREATIVE MATTER — activation derivation tests (pure, no DOM/I/O).

   Locks the first operational lifecycle step: an accepted submission becomes ONE
   coordinated creative matter, with responsibilities and a next step derived from
   the creative type and the requested Collective involvement — never fabricated,
   never duplicated, and never routing non-audio work to the Voice Notes Studio.
   ============================================================================= */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isAcceptedMatter,
  deriveCreativeMatter,
  activateMatters,
  matterResponsibilities,
  voiceNotesEligibility,
  matterNarrative,
  nextRecommendation,
} from '../src/headquarters/creative-matter.ts';
import type { Submission } from '../src/headquarters/adapters.ts';

const sub = (over: Partial<Submission> = {}): Submission => ({
  id: 1, type: 'artist_feature', status: 'approved', name: 'Nova', email: 'nova@x.com',
  fields: {}, created_at: '2026-07-01 09:00:00', updated_at: '2026-07-01 09:00:00', ...over,
});

/* --- activation gate ------------------------------------------------------ */
test('only accepted statuses become a creative matter', () => {
  for (const s of ['approved', 'scheduled', 'published']) assert.equal(isAcceptedMatter(s), true, s);
  for (const s of ['draft', 'sent_for_review', 'under_review', 'changes_requested', 'not_accepted']) {
    assert.equal(isAcceptedMatter(s), false, s);
    assert.equal(deriveCreativeMatter(sub({ status: s as any })), null, `no matter for ${s}`);
  }
});

/* --- identity preserved, never copied ------------------------------------- */
test('the matter references the originating submission id (no copy)', () => {
  const m = deriveCreativeMatter(sub({ id: 42, name: 'Ada V' }))!;
  assert.equal(m.submissionId, 42);
  assert.equal(m.artist, 'Ada V');
  assert.equal(m.decision, 'accepted');
});

/* --- duplicate-activation prevention -------------------------------------- */
test('the same submission never activates twice', () => {
  const dupes = [sub({ id: 7 }), sub({ id: 7 }), sub({ id: 8 }), sub({ id: 8, status: 'sent_for_review' })];
  const matters = activateMatters(dupes);
  assert.deepEqual(matters.map((m) => m.submissionId).sort(), [7, 8]);
});

/* --- responsibility derivation by creative type --------------------------- */
test('responsibilities derive from the creative type', () => {
  assert.deepEqual(matterResponsibilities('artist_feature', []),
    ['Creator Relationships', 'Editorial', 'Production', 'Publishing', 'Growth']);
  assert.deepEqual(matterResponsibilities('music', []),
    ['Creator Relationships', 'Editorial', 'Production', 'Publishing', 'Growth']);
  // Book has no Production by default…
  assert.deepEqual(matterResponsibilities('book', []),
    ['Creator Relationships', 'Editorial', 'Publishing', 'Growth']);
  // …unless a recording/reading is requested.
  assert.ok(matterResponsibilities('book', ['Interview or live presentation']).includes('Production'));
  // Visual art has no Production by default.
  assert.ok(!matterResponsibilities('visual_art', []).includes('Production'));
  // Event coverage (Editorial/Publishing) only when requested.
  assert.deepEqual(matterResponsibilities('event', []), ['Creator Relationships', 'Production', 'Growth']);
  assert.ok(matterResponsibilities('event', ['Publishing']).includes('Publishing'));
});

test('Other Creative Proposal does not silently claim every area', () => {
  assert.deepEqual(matterResponsibilities('other_proposal', []), []);
  // It derives only what was explicitly requested.
  assert.deepEqual(matterResponsibilities('other_proposal', ['Editorial', 'Growth']), ['Editorial', 'Growth']);
  const m = deriveCreativeMatter(sub({ type: 'other_proposal', fields: { title: 'A residency idea' } }))!;
  assert.match(m.disposition, /awaiting your direction/i);
  assert.match(nextRecommendation(m).line, /awaits your direction/i);
});

/* --- Voice Notes Studio eligibility --------------------------------------- */
test('audio matters are eligible for the Voice Notes Studio', () => {
  assert.equal(voiceNotesEligibility('artist_feature', [], 'Interview').eligible, true);
  assert.equal(voiceNotesEligibility('music', []).eligible, true);
  assert.equal(voiceNotesEligibility('podcast', []).eligible, true);
});

test('non-audio matters are NOT routed to the Voice Notes Studio by default', () => {
  assert.equal(voiceNotesEligibility('book', []).eligible, false);
  assert.equal(voiceNotesEligibility('visual_art', []).eligible, false);
  assert.equal(voiceNotesEligibility('event', []).eligible, false);
  assert.equal(voiceNotesEligibility('other_proposal', []).eligible, false);
  // …but a requested spoken/recorded element makes them eligible.
  assert.equal(voiceNotesEligibility('book', ['Interview or live presentation']).eligible, true);
  assert.equal(voiceNotesEligibility('visual_art', ['Interview or live presentation']).eligible, true);
});

test('the Voice Notes handoff only appears for eligible active matters', () => {
  const visual = deriveCreativeMatter(sub({ type: 'visual_art', name: 'Ivy', fields: { title: 'Salt & Light', involvement: ['Publishing'] } }))!;
  assert.equal(visual.voiceNotes.eligible, false);
  const next = nextRecommendation(visual);
  assert.ok(!/voice notes/i.test(next.open?.label || ''));
});

/* --- Founder / representative / recommender submissions ------------------- */
test('the requester relation reflects who submitted', () => {
  const self = deriveCreativeMatter(sub({ fields: {} }))!;
  assert.match(self.requesterRelation, /artist, submitting/i);
  const rep = deriveCreativeMatter(sub({
    type: 'book', name: 'Toni Okafor',
    fields: { submittedBy: 'A Collective representative proposing an artist', submitterName: 'Melody', title: 'The Long Room' },
  }))!;
  assert.equal(rep.artist, 'Toni Okafor');
  assert.equal(rep.requester, 'Melody');
  assert.match(rep.requesterRelation, /representative/i);
});

/* --- Artist Feature / Interview vertical slice ---------------------------- */
test('the Artist Feature vertical slice derives a full coordinated matter', () => {
  const m = deriveCreativeMatter(sub({
    id: 100, name: 'Nova', status: 'approved',
    summary: 'Interview · A new EP about the coast.',
    fields: { interest: 'Interview + Live Performance', promoting: 'A new EP about the coast.' },
  }))!;
  assert.deepEqual(m.responsibilities, ['Creator Relationships', 'Editorial', 'Production', 'Publishing', 'Growth']);
  assert.equal(m.voiceNotes.eligible, true);
  // Founder-facing prose names real responsibilities and no software mechanics.
  const prose = matterNarrative(m);
  assert.match(prose, /Executive Team has accepted/i);
  assert.match(prose, /Creator Relationships/);
  assert.match(prose, /Voice Notes Studio/);
  assert.doesNotMatch(prose, /adapter|runtime|engine|ledger|pipeline|localStorage|work order/i);
  // The next step opens the Voice Notes Studio.
  const next = nextRecommendation(m);
  assert.equal(next.open?.href, '/production-studio/voice-notes/');
});

/* --- completion returns to the record ------------------------------------- */
test('a published matter settles into the House record', () => {
  const m = deriveCreativeMatter(sub({ status: 'published' }))!;
  assert.equal(m.phase, 'settled');
  assert.match(m.disposition, /record/i);
  // No live Voice Notes handoff once settled.
  assert.match(nextRecommendation(m).open?.label || '', /Archive/i);
});

/* --- backward compatibility ----------------------------------------------- */
test('the retained artist_feature pathway activates without new fields', () => {
  const m = deriveCreativeMatter(sub({ fields: { interest: 'Interview', promoting: 'An EP.' } }))!;
  assert.equal(m.type, 'artist_feature');
  assert.equal(m.voiceNotes.eligible, true);
  assert.ok(m.responsibilities.length > 0);
});
