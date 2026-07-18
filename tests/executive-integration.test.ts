/* =============================================================================
   SPRINT 11B — Executive Recruitment Integration (Open Chairs + Leadership
   Records) tests. These lock that the Chief of Staff workspace DERIVES its
   Chair and leadership data from the Executive Register (the single source of
   truth), keeps no duplicate Chair store, stays honest about empty appointments
   and Founder content, neutralises "canon" language for the Creative Director,
   scales to more Chairs without rendering changes, and leaves the six-room
   Headquarters architecture and the Decision System untouched.
   ============================================================================= */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as cos from '../src/headquarters/chief-of-staff.ts';
import {
  openChairViews, leadershipViews, appointmentsOnRecord, leadershipHistoryView,
  neutralizeCanon,
} from '../src/headquarters/chief-of-staff.ts';
import {
  CHAIRS, CHAIR_CHIEF_OF_STAFF, CHAIR_CREATIVE_DIRECTOR, FOUNDING_REGISTER,
  chairStandings, openChairStandings, makeRegisterEntry, makeFounderNote,
  type ExecutiveRecords, type ExecutiveChair,
} from '../src/headquarters/executive-register.ts';
import { ROOMS } from '../src/headquarters/rooms.ts';

/* --- single source of truth ----------------------------------------------- */
test('no duplicate Chair source remains in the Chief of Staff module', () => {
  // The old placeholder exports are gone; Chair data lives only in the Register.
  assert.ok(!('CHAIRS' in cos), 'chief-of-staff no longer exports CHAIRS');
  assert.ok(!('LEADERSHIP' in cos), 'chief-of-staff no longer exports LEADERSHIP');
  assert.ok(!('CHAIR_STATUSES' in cos), 'chief-of-staff no longer defines its own Chair statuses');
});

/* --- Open Chairs derives from the Register -------------------------------- */
test('Open Chairs derives from the Executive Register (order, titles, ordinals)', () => {
  const views = openChairViews();
  // The approved Chairs are established-but-unseated → all are openings.
  assert.deepEqual(views.map((v) => v.ordinal), [1, 2, 3, 4]);
  assert.deepEqual(views.map((v) => v.title), ['Chief of Staff', 'Creative Director', 'Head of Production', 'Director of Growth']);
  for (const v of views) {
    assert.ok(v.purpose && v.charge && v.responsibilities.length > 0);
    assert.equal(v.statusLabel, 'Established');
    assert.ok(v.establishedOn, 'establishment date comes from Register history');
  }
});

test('a retired or seated Chair is not shown as an opening (derived filter)', () => {
  const chair = CHAIRS.find((c) => c.id === CHAIR_CREATIVE_DIRECTOR)!;
  const retired = makeRegisterEntry(
    { chairId: chair.id, type: 'retired', event: 'Closed.', on: '2026-10-01' },
    new Date('2026-10-01T00:00:00Z'), 'r_ret',
  )!;
  const records: ExecutiveRecords = { register: [...FOUNDING_REGISTER, retired] };
  const openIds = openChairStandings(CHAIRS, records).map((s) => s.chair.id);
  assert.ok(!openIds.includes(CHAIR_CREATIVE_DIRECTOR), 'retired Chair drops out of openings');
  assert.ok(openIds.includes(CHAIR_CHIEF_OF_STAFF), 'the other Chair remains');
});

/* --- Leadership Records derives from Register history ---------------------- */
test('Leadership Records shows truthful derived standing, not stored status', () => {
  // Default: all established, not appointed, not seated.
  const base = leadershipViews();
  assert.equal(base.length, 4);
  for (const v of base) {
    assert.equal(v.standing, 'Established — not yet appointed');
    assert.equal(v.seated, false);
    assert.equal(v.founderNote, null);
  }
  // Vacate #002 in the Register → standing follows the record, not a stored field.
  const vacated = makeRegisterEntry(
    { chairId: CHAIR_CREATIVE_DIRECTOR, type: 'vacated', event: 'Vacated.', on: '2026-09-01' },
    new Date('2026-09-01T00:00:00Z'), 'r_vac',
  )!;
  const cd = leadershipViews({ register: [...FOUNDING_REGISTER, vacated] })
    .find((v) => v.title === 'Creative Director')!;
  assert.equal(cd.standing, 'Vacant', 'derived from Register history');
});

test('Leadership history is the preserved Register record, oldest first', () => {
  const hist = leadershipHistoryView();
  assert.equal(hist.length, FOUNDING_REGISTER.length);
  assert.ok(hist[0].on <= hist[hist.length - 1].on, 'oldest first');
  assert.ok(hist.every((e) => e.event.length > 0));
});

/* --- honest empties + no fabricated Founder content ----------------------- */
test('appointments remain honestly empty; no Chair is shown as appointed', () => {
  assert.deepEqual(appointmentsOnRecord(), []);
  assert.ok(leadershipViews().every((v) => !v.seated), 'no fabricated seating');
});

test('no fabricated Founder content — notes appear only when genuinely written', () => {
  // With no notes, every Chair's founderNote is null.
  assert.ok(leadershipViews({ register: FOUNDING_REGISTER }).every((v) => v.founderNote === null));
  // With a genuine note, it surfaces truthfully (and only for that Chair).
  const note = makeFounderNote(CHAIR_CHIEF_OF_STAFF, 'a real observation', new Date('2026-08-01T00:00:00Z'))!;
  const views = leadershipViews({ register: FOUNDING_REGISTER, founderNotes: [note] });
  assert.equal(views.find((v) => v.title === 'Chief of Staff')!.founderNote, 'a real observation');
  assert.equal(views.find((v) => v.title === 'Creative Director')!.founderNote, null);
});

/* --- Chair #001 honest distinction ---------------------------------------- */
test('Chair #001 is established and operating as the live workspace, not appointed', () => {
  const cofs = leadershipViews().find((v) => v.title === 'Chief of Staff')!;
  assert.equal(cofs.ordinal, 1);
  assert.equal(cofs.standing, 'Established — not yet appointed');
  assert.equal(cofs.seated, false);
  assert.ok(cofs.operatingNote && /live workspace/i.test(cofs.operatingNote),
    'the workspace/appointment distinction is presented honestly');
  // No other Chair claims the live-workspace distinction.
  assert.equal(leadershipViews().find((v) => v.title === 'Creative Director')!.operatingNote, null);
});

/* --- Chair #002 canon language removed ------------------------------------ */
test('Chair #002 exposes creative-standards language, with no "canon" in this section', () => {
  const cd = openChairViews().find((v) => v.title === 'Creative Director')!;
  const exposed = [cd.purpose, cd.charge, ...cd.responsibilities].join(' ');
  assert.ok(!/canon/i.test(exposed), 'no "canon" or variant is exposed in Open Chairs');
  assert.ok(/creative standards|creative identity|editorial standards/i.test(exposed),
    'plain creative-standards language is used instead');
});

test('neutralizeCanon replaces canon language without leaving the word', () => {
  assert.equal(neutralizeCanon('Keep the accumulating creative canon.'),
    'Keep the accumulating body of creative standards.');
  assert.ok(!/canon/i.test(neutralizeCanon('additions to the permanent canon; the canons endure')));
  assert.equal(neutralizeCanon('no such word here'), 'no such word here');
});

/* --- extensibility: more Chairs, same rendering logic --------------------- */
test('additional Chairs flow through the derived selectors with no logic change', () => {
  // A future, not-yet-established Chair beyond the Founding Council, appended to
  // the real four — proving the selectors stay count-agnostic as the House grows.
  const fifth: ExecutiveChair = { ...CHAIRS[1], id: 'chair_future_seat', ordinal: 5, title: 'A Future Seat', status: 'preparing' };
  const chairs = [...CHAIRS, fifth];
  const standings = chairStandings(chairs, { register: FOUNDING_REGISTER });
  assert.deepEqual(standings.map((s) => s.chair.ordinal), [1, 2, 3, 4, 5], 'ordered by ordinal, no fixed count');
  // The fifth Chair has no establishment entry yet → falls back to its charter status.
  assert.equal(standings.find((s) => s.chair.ordinal === 5)!.status, 'preparing');
  assert.equal(openChairStandings(chairs, { register: FOUNDING_REGISTER }).length, 5, 'all five are openings');
});

/* --- Headquarters architecture + Decision System unchanged ---------------- */
test('Headquarters remains six architectural rooms', () => {
  assert.equal(ROOMS.length, 6);
});

test('the Decision System is untouched — its responses and decisions remain', () => {
  // The Executive Inbox (12B) and the Brokerage (12H) are additive sections; the
  // rest are intact.
  assert.deepEqual(cos.COS_SECTIONS.map((s) => s.id),
    ['briefing', 'work-queue', 'inbox', 'decisions', 'docket', 'brokerage', 'opportunities', 'chairs', 'leadership', 'archive']);
  assert.deepEqual(cos.RESPONSES.map((r) => r.id),
    ['approved', 'approved_with_changes', 'not_yet', 'rework', 'discuss', 'archive']);
  assert.equal(cos.DECISIONS.length > 0, true);
});
