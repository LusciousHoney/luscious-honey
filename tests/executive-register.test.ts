/* =============================================================================
   THE EXECUTIVE REGISTER — pure logic + framework tests (no DOM, no I/O).

   These lock the foundation of the Executive Recruitment System: that Chairs are
   identified rather than enumerated (no fixed count); that the Register is
   append-only and a Chair's standing is derived from it (the record can never be
   contradicted); that Dossiers and Appointments are honest and start empty; and
   that the storage architecture is namespaced, versioned, and fails closed.
   ============================================================================= */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  // Phase 1
  CHAIRS, CHAIR_STATUSES, chairStatusLabel, getChair, nextOrdinal,
  CHAIR_CHIEF_OF_STAFF, CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION,
  type ExecutiveChair,
  // Phase 2
  REGISTER_EVENTS, registerEventLabel, makeRegisterEntry, appendRegisterEntry,
  chairHistory, chairStatusFromRegister, FOUNDING_REGISTER,
  type RegisterEntry,
  // Phase 3
  DOSSIERS, DOSSIER_RECOMMENDATIONS, DOSSIER_OUTCOMES,
  dossierRecommendationLabel, dossierOutcomeLabel, makeDossier, dossiersForChair,
  // Phase 4
  APPOINTMENTS, APPOINTMENT_STATUSES, appointmentStatusLabel,
  FOUNDER_DECISIONS, founderDecisionLabel, makeAppointment, isEffective, seatedAppointment,
  // Phase 5
  STORAGE_ROOT, STORAGE_KEYS, loadCollection, saveCollection,
  makeFounderNote, setFounderNote, founderNoteFor, isFounderNote,
  COUNCIL_SESSIONS, isCouncilSession, SUCCESSION, isSuccessionLink,
  chairStanding,
} from '../src/headquarters/executive-register.ts';

/* --- Phase 1: the Chairs -------------------------------------------------- */
test('the approved Chairs are established, numbered, and fully chartered', () => {
  assert.equal(CHAIRS.length, 3);
  const cos = getChair(CHAIR_CHIEF_OF_STAFF)!;
  const cd = getChair(CHAIR_CREATIVE_DIRECTOR)!;
  const hp = getChair(CHAIR_HEAD_OF_PRODUCTION)!;
  assert.equal(cos.ordinal, 1);
  assert.equal(cd.ordinal, 2);
  assert.equal(hp.ordinal, 3);
  assert.equal(hp.title, 'Head of Production');
  assert.equal(hp.status, 'established');
  for (const c of CHAIRS) {
    assert.ok(c.title && c.reasonForBeing && c.purpose && c.charge, `${c.id} carries its charter prose`);
    assert.ok(c.standingResponsibilities.length && c.owns.length && c.prepares.length);
    assert.ok(c.authority.canDecide.length && c.authority.recommends.length && c.authority.mustEscalate.length);
    assert.ok(c.relationships.length >= 1);
    assert.equal(c.status, 'established');
    assert.ok(chairStatusLabel(c.status).length > 0);
  }
});

test('the two seated Chairs know each other by id (a real relationship link)', () => {
  const cos = getChair(CHAIR_CHIEF_OF_STAFF)!;
  const cd = getChair(CHAIR_CREATIVE_DIRECTOR)!;
  assert.ok(cos.relationships.some((r) => r.withChairId === CHAIR_CREATIVE_DIRECTOR));
  assert.ok(cd.relationships.some((r) => r.withChairId === CHAIR_CHIEF_OF_STAFF));
  // Head of Production is now established and linked by id (reciprocal).
  assert.ok(cos.relationships.some((r) => r.withChairId === CHAIR_HEAD_OF_PRODUCTION));
  assert.ok(cd.relationships.some((r) => r.withChairId === CHAIR_HEAD_OF_PRODUCTION));
  const hp = getChair(CHAIR_HEAD_OF_PRODUCTION)!;
  assert.ok(hp.relationships.some((r) => r.withChairId === CHAIR_CHIEF_OF_STAFF));
  assert.ok(hp.relationships.some((r) => r.withChairId === CHAIR_CREATIVE_DIRECTOR));
  // The Director of Growth remains named but unlinked — honest.
  assert.ok(cos.relationships.some((r) => r.with === 'Director of Growth' && !r.withChairId));
});

test('Chairs are identified, not enumerated — nextOrdinal keeps the sequence', () => {
  assert.equal(nextOrdinal(CHAIRS), 4);
  assert.equal(nextOrdinal([]), 1, 'an empty institution starts at #001');
  const withThird: ExecutiveChair[] = [...CHAIRS, { ...CHAIRS[0], id: 'chair_x', ordinal: 7 }];
  assert.equal(nextOrdinal(withThird), 8, 'the next ordinal follows the highest, not the count');
});

test('getChair resolves known ids only', () => {
  assert.ok(getChair(CHAIR_CHIEF_OF_STAFF));
  assert.equal(getChair('nobody'), null);
  assert.equal(getChair(null), null);
});

test('chair statuses are the four named standings', () => {
  assert.deepEqual(CHAIR_STATUSES.map((s) => s.id), ['established', 'preparing', 'vacant', 'retired']);
});

/* --- Phase 2: the Register (append-only, derived standing) ----------------- */
test('the founding Register truthfully records the three establishments only', () => {
  assert.equal(FOUNDING_REGISTER.length, 3);
  assert.ok(FOUNDING_REGISTER.every((e) => e.type === 'established'));
  assert.deepEqual(
    FOUNDING_REGISTER.map((e) => e.chairId).sort(),
    [CHAIR_CHIEF_OF_STAFF, CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION].sort(),
  );
});

test('makeRegisterEntry validates event type and required fields', () => {
  const now = new Date('2026-07-16T10:00:00.000Z');
  assert.equal(makeRegisterEntry({ chairId: 'c', type: 'bogus', event: 'x', on: '2026-07-16' }, now), null);
  assert.equal(makeRegisterEntry({ chairId: '', type: 'established', event: 'x', on: '2026-07-16' }, now), null);
  assert.equal(makeRegisterEntry({ chairId: 'c', type: 'established', event: '', on: '2026-07-16' }, now), null);
  const ok = makeRegisterEntry(
    { chairId: 'c', type: 'appointed', event: 'Seated.', on: '2026-07-16', note: '  kept  ' }, now, 'reg_1',
  );
  assert.ok(ok);
  assert.equal(ok!.id, 'reg_1');
  assert.equal(ok!.note, 'kept');
  assert.equal(ok!.recordedAt, now.toISOString());
});

test('the Register is append-only — appending never touches prior entries', () => {
  const base = [...FOUNDING_REGISTER];
  const entry = makeRegisterEntry(
    { chairId: CHAIR_CREATIVE_DIRECTOR, type: 'amended', event: 'Charter refined.', on: '2026-07-20' },
    new Date('2026-07-20T00:00:00Z'), 'reg_amend',
  )!;
  const next = appendRegisterEntry(base, entry);
  assert.equal(next.length, base.length + 1);
  assert.deepEqual(base, FOUNDING_REGISTER, 'the original array is untouched');
  assert.equal(next[next.length - 1].id, 'reg_amend');
});

test('a Chair standing is DERIVED from the latest status-changing entry', () => {
  const chair = getChair(CHAIR_CREATIVE_DIRECTOR)!;
  // With only the founding "established" entry, standing is established.
  assert.equal(chairStatusFromRegister(FOUNDING_REGISTER, chair), 'established');

  const mk = (type: string, on: string, id: string): RegisterEntry =>
    makeRegisterEntry({ chairId: chair.id, type, event: type, on }, new Date(`${on}T00:00:00Z`), id)!;

  const log = [
    ...FOUNDING_REGISTER,
    mk('vacated', '2026-08-01', 'r2'),
    mk('amended', '2026-08-05', 'r3'), // an amendment does not change standing
    mk('preparing', '2026-08-10', 'r4'),
  ];
  assert.equal(chairStatusFromRegister(log, chair), 'preparing',
    'the amendment is skipped; the latest status-changing entry wins');
});

test('a Chair with no record falls back to its charter status', () => {
  const chair = getChair(CHAIR_CHIEF_OF_STAFF)!;
  assert.equal(chairStatusFromRegister([], chair), 'established');
});

test('chairHistory reads oldest-first and only for that Chair', () => {
  const hist = chairHistory(FOUNDING_REGISTER, CHAIR_CHIEF_OF_STAFF);
  assert.equal(hist.length, 1);
  assert.equal(hist[0].chairId, CHAIR_CHIEF_OF_STAFF);
});

test('every register event has a label and a defined standing implication', () => {
  assert.ok(REGISTER_EVENTS.length > 0);
  for (const e of REGISTER_EVENTS) {
    assert.ok(registerEventLabel(e.id).length > 0);
    assert.ok(e.impliesStatus === null || typeof e.impliesStatus === 'string');
  }
  assert.equal(REGISTER_EVENTS.find((e) => e.id === 'amended')!.impliesStatus, null);
});

/* --- Phase 3: the Dossier (honest, empty until real) ---------------------- */
test('no dossiers are fabricated — the shelf starts honestly empty', () => {
  assert.deepEqual(DOSSIERS, []);
});

test('makeDossier requires a Chair and candidate, and defaults the rest honestly', () => {
  assert.equal(makeDossier({ id: 'd1', chairId: 'c', candidate: '   ' }), null);
  const d = makeDossier({ id: 'd1', chairId: CHAIR_CREATIVE_DIRECTOR, candidate: '  A. Name  ' })!;
  assert.equal(d.candidate, 'A. Name');
  assert.equal(d.biography, '');
  assert.deepEqual(d.strengths, []);
  assert.deepEqual(d.interviewHistory, []);
  assert.equal(d.recommendation, 'undecided');
  assert.equal(d.outcome, 'pending');
});

test('makeDossier carries through what is genuinely known', () => {
  const d = makeDossier({
    id: 'd2', chairId: CHAIR_CREATIVE_DIRECTOR, candidate: 'B',
    strengths: ['taste'], recommendation: 'appoint',
    interviewHistory: [{ id: 'i1', on: '2026-07-20', stage: 'First conversation', summary: 'Warm.' }],
  })!;
  assert.deepEqual(d.strengths, ['taste']);
  assert.equal(d.recommendation, 'appoint');
  assert.equal(d.interviewHistory.length, 1);
});

test('dossiersForChair filters to the Chair', () => {
  const a = makeDossier({ id: 'da', chairId: 'chair_a', candidate: 'A' })!;
  const b = makeDossier({ id: 'db', chairId: 'chair_b', candidate: 'B' })!;
  assert.deepEqual(dossiersForChair([a, b], 'chair_a'), [a]);
});

test('dossier recommendation and outcome labels resolve', () => {
  assert.ok(DOSSIER_RECOMMENDATIONS.length > 0 && DOSSIER_OUTCOMES.length > 0);
  assert.equal(dossierRecommendationLabel('appoint'), 'Appoint');
  assert.equal(dossierOutcomeLabel('pending'), 'Pending');
  assert.equal(dossierRecommendationLabel('mystery' as never), 'mystery');
});

/* --- Phase 4: the Appointment record -------------------------------------- */
test('no appointments are fabricated — the Founder holds every Chair', () => {
  assert.deepEqual(APPOINTMENTS, []);
});

test('makeAppointment requires Chair, appointee, proposed day; defaults undecided', () => {
  assert.equal(makeAppointment({ id: 'a1', chairId: 'c', appointee: ' ', proposedOn: '2026-07-16' }), null);
  const a = makeAppointment(
    { id: 'a1', chairId: CHAIR_CREATIVE_DIRECTOR, appointee: '  Name  ', proposedOn: '2026-07-16' },
    new Date('2026-07-16T12:00:00Z'),
  )!;
  assert.equal(a.appointee, 'Name');
  assert.equal(a.status, 'proposed');
  assert.equal(a.founderDecision, 'pending');
  assert.equal(a.effectiveDate, undefined);
  assert.equal(a.recordedAt, '2026-07-16T12:00:00.000Z');
});

test('an appointment is in force only when effective AND dated', () => {
  const base = { id: 'a2', chairId: 'c', appointee: 'N', proposedOn: '2026-07-16' };
  assert.ok(!isEffective(makeAppointment(base)!));
  assert.ok(!isEffective(makeAppointment({ ...base, status: 'effective' })!), 'effective but undated is not in force');
  assert.ok(isEffective(makeAppointment({ ...base, status: 'effective', effectiveDate: '2026-08-01' })!));
});

test('seatedAppointment returns the effective holder, latest effective date winning', () => {
  const c = 'chair_z';
  const proposed = makeAppointment({ id: 'p', chairId: c, appointee: 'P', proposedOn: '2026-07-16' })!;
  const early = makeAppointment({ id: 'e', chairId: c, appointee: 'Early', proposedOn: '2026-07-16', status: 'effective', effectiveDate: '2026-08-01' })!;
  const late = makeAppointment({ id: 'l', chairId: c, appointee: 'Late', proposedOn: '2026-07-16', status: 'effective', effectiveDate: '2027-01-01' })!;
  assert.equal(seatedAppointment([proposed], c), null, 'a proposal does not seat anyone');
  assert.equal(seatedAppointment([proposed, early, late], c)!.appointee, 'Late');
});

test('appointment status and founder decision labels resolve', () => {
  assert.deepEqual(APPOINTMENT_STATUSES.map((s) => s.id),
    ['proposed', 'under_review', 'decided', 'effective', 'declined', 'withdrawn']);
  assert.deepEqual(FOUNDER_DECISIONS.map((d) => d.id),
    ['pending', 'approved', 'approved_with_changes', 'declined', 'deferred']);
  assert.equal(appointmentStatusLabel('effective'), 'Effective');
  assert.equal(founderDecisionLabel('approved'), 'Approved');
});

/* --- Phase 5: storage architecture ---------------------------------------- */
test('storage keys are namespaced under one root and versioned', () => {
  assert.equal(STORAGE_ROOT, 'lhc.hq.executive');
  for (const key of Object.values(STORAGE_KEYS)) {
    assert.ok(key.startsWith(STORAGE_ROOT + '.'), `${key} lives under the root`);
    assert.ok(/\.v\d+$/.test(key), `${key} is versioned`);
  }
  // Distinct homes for every kind of record.
  const keys = Object.values(STORAGE_KEYS);
  assert.equal(new Set(keys).size, keys.length, 'no two stores share a key');
});

test('loadCollection fails closed with no localStorage and filters invalid rows', () => {
  // No localStorage in the test environment → an honest empty array, never a throw.
  assert.deepEqual(loadCollection(STORAGE_KEYS.founderNotes, isFounderNote), []);
  // saveCollection likewise must not throw without a store.
  assert.doesNotThrow(() => saveCollection(STORAGE_KEYS.founderNotes, []));
});

test('Founder notes: one per Chair, mutable, validated', () => {
  assert.equal(makeFounderNote('', 'x'), null);
  const n1 = makeFounderNote(CHAIR_CREATIVE_DIRECTOR, '  a first thought  ', new Date('2026-07-16T00:00:00Z'))!;
  assert.equal(n1.note, 'a first thought');
  let notes = setFounderNote([], n1);
  const n2 = makeFounderNote(CHAIR_CREATIVE_DIRECTOR, 'a revised thought', new Date('2026-07-17T00:00:00Z'))!;
  notes = setFounderNote(notes, n2);
  assert.equal(notes.length, 1, 'one note per Chair');
  assert.equal(founderNoteFor(notes, CHAIR_CREATIVE_DIRECTOR)!.note, 'a revised thought');
  assert.equal(founderNoteFor(notes, 'nobody'), null);
  assert.ok(isFounderNote(n1) && !isFounderNote({}));
});

test('future shelves (Council, Succession) stand ready and honestly empty', () => {
  assert.deepEqual(COUNCIL_SESSIONS, []);
  assert.deepEqual(SUCCESSION, []);
  assert.ok(isCouncilSession({ id: 's', on: '2026-07-16', present: [], subject: 'x', resolutions: [] }));
  assert.ok(!isCouncilSession({ id: 's' }));
  assert.ok(isSuccessionLink({ id: 'l', chairId: 'c', from: 'A', to: 'B', on: '2026-07-16' }));
  assert.ok(!isSuccessionLink({ id: 'l' }));
});

/* --- the assembled standing ----------------------------------------------- */
test('chairStanding composes the truthful present from the separate records', () => {
  const chair = getChair(CHAIR_CREATIVE_DIRECTOR)!;
  // Bare institution: only the charter, no records → established, unseated, empty.
  const bare = chairStanding(chair);
  assert.equal(bare.status, 'established');
  assert.equal(bare.seatedBy, null);
  assert.deepEqual(bare.dossiers, []);
  assert.equal(bare.founderNote, null);

  // With records: vacated in the register, a candidacy prepared, a note written.
  const vacated = makeRegisterEntry(
    { chairId: chair.id, type: 'vacated', event: 'Vacated.', on: '2026-09-01' },
    new Date('2026-09-01T00:00:00Z'), 'rv',
  )!;
  const dossier = makeDossier({ id: 'dz', chairId: chair.id, candidate: 'Candidate' })!;
  const note = makeFounderNote(chair.id, 'promising', new Date('2026-09-02T00:00:00Z'))!;
  const standing = chairStanding(chair, {
    register: [...FOUNDING_REGISTER, vacated],
    dossiers: [dossier],
    founderNotes: [note],
  });
  assert.equal(standing.status, 'vacant', 'standing follows the record, not the charter');
  assert.equal(standing.dossiers.length, 1);
  assert.equal(standing.founderNote!.note, 'promising');
  assert.equal(standing.history.length, 2, 'founding + vacated, in order');
});
