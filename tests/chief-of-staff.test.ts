/* =============================================================================
   OFFICE OF THE CHIEF OF STAFF — pure logic + content tests (no DOM, no I/O).

   These lock the office's operational foundation (the decision record) and its
   honesty: the Briefing derives its "waiting" line from the same decisions the
   Decisions section shows; the Archive shelves stay honestly empty except the
   Decisions shelf, which reflects the founder's real, recorded answers.
   ============================================================================= */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  COS_SECTIONS, COS_HOME_SECTION, isCosSection,
  BRIEFING, DECISIONS, DOCKET,
  RESPONSES, getResponse,
  makeResponse, responsesById, decisionView, decisionViews,
  openDecisions, recordResponse, clearResponse, archiveShelves,
  docketStatusLabel,
  type DecisionResponse,
} from '../src/headquarters/chief-of-staff.ts';

/* --- sections ------------------------------------------------------------- */
test('the office has its named sections (incl. the Brokerage) and briefing is home', () => {
  assert.deepEqual(
    COS_SECTIONS.map((s) => s.id),
    ['briefing', 'inbox', 'decisions', 'docket', 'brokerage', 'chairs', 'leadership', 'archive'],
  );
  assert.equal(COS_HOME_SECTION, 'briefing');
  assert.ok(COS_SECTIONS.every((s) => s.label.length > 0 && s.note.length > 0));
});

test('isCosSection validates known sub-routes only', () => {
  assert.ok(isCosSection('decisions'));
  assert.ok(!isCosSection('nonsense'));
  assert.ok(!isCosSection(null));
  assert.ok(!isCosSection(''));
});

/* --- briefing ------------------------------------------------------------- */
test('the Briefing carries every prepared section with content', () => {
  assert.ok(BRIEFING.goodMorning.length > 0);
  assert.ok(BRIEFING.todaysPriorities.length > 0);
  assert.ok(BRIEFING.progressSinceYesterday.length > 0);
  assert.ok(BRIEFING.risks.length > 0);
  assert.ok(BRIEFING.lookingAhead.length > 0);
  assert.ok(BRIEFING.chiefOfStaffNote.length > 0);
});

/* --- decision responses --------------------------------------------------- */
test('there are exactly the six approved founder responses', () => {
  assert.deepEqual(
    RESPONSES.map((r) => r.id),
    ['approved', 'approved_with_changes', 'not_yet', 'rework', 'discuss', 'archive'],
  );
  // Only Approved / Approved-with-changes / Archive resolve the item off the
  // waiting count; only Archive retires it.
  assert.deepEqual(RESPONSES.filter((r) => r.resolves).map((r) => r.id),
    ['approved', 'approved_with_changes', 'archive']);
  assert.deepEqual(RESPONSES.filter((r) => r.archives).map((r) => r.id), ['archive']);
});

test('makeResponse validates the decision id and the response id', () => {
  const now = new Date('2026-07-15T09:00:00.000Z');
  assert.equal(makeResponse({ decisionId: 'nope', response: 'approved' }, now), null);
  assert.equal(makeResponse({ decisionId: DECISIONS[0].id, response: 'bogus' }, now), null);
  const ok = makeResponse({ decisionId: DECISIONS[0].id, response: 'approved', note: '  keep it  ' }, now);
  assert.ok(ok);
  assert.equal(ok!.response, 'approved');
  assert.equal(ok!.note, 'keep it'); // trimmed
  assert.equal(ok!.respondedAt, now.toISOString());
});

test('an empty note is normalised away', () => {
  const r = makeResponse({ decisionId: DECISIONS[0].id, response: 'not_yet', note: '   ' });
  assert.ok(r);
  assert.equal(r!.note, undefined);
});

test('responsesById keeps the latest answer per decision', () => {
  const id = DECISIONS[0].id;
  const early: DecisionResponse = { decisionId: id, response: 'not_yet', respondedAt: '2026-07-15T09:00:00.000Z' };
  const late: DecisionResponse  = { decisionId: id, response: 'approved', respondedAt: '2026-07-15T11:00:00.000Z' };
  const map = responsesById([early, late]);
  assert.equal(map.get(id)!.response, 'approved');
});

test('decisionView reflects awaiting / answered / archived correctly', () => {
  const d = DECISIONS[0];
  assert.ok(decisionView(d, null).awaiting, 'no response → awaiting');
  assert.ok(!decisionView(d, null).archived);

  const approved = makeResponse({ decisionId: d.id, response: 'approved' })!;
  assert.ok(!decisionView(d, approved).awaiting, 'approved → resolved, not awaiting');

  const held = makeResponse({ decisionId: d.id, response: 'not_yet' })!;
  assert.ok(decisionView(d, held).awaiting, 'not_yet → still awaiting');

  const archived = makeResponse({ decisionId: d.id, response: 'archive' })!;
  assert.ok(decisionView(d, archived).archived, 'archive → archived');
});

test('archived decisions sort to the end of the views', () => {
  const first = DECISIONS[0].id;
  const archived = makeResponse({ decisionId: first, response: 'archive' })!;
  const views = decisionViews(DECISIONS, [archived]);
  assert.equal(views[views.length - 1].decision.id, first, 'the archived one is last');
  assert.ok(!views[0].archived, 'the first shown is active');
});

test('openDecisions counts only what genuinely still awaits the founder', () => {
  assert.equal(openDecisions(DECISIONS, []).length, DECISIONS.length, 'all open at first');
  const approved = makeResponse({ decisionId: DECISIONS[0].id, response: 'approved' })!;
  assert.equal(openDecisions(DECISIONS, [approved]).length, DECISIONS.length - 1);
  const held = makeResponse({ decisionId: DECISIONS[1].id, response: 'not_yet' })!;
  // "Not yet" is still awaiting, so it stays counted.
  assert.equal(openDecisions(DECISIONS, [approved, held]).length, DECISIONS.length - 1);
});

test('recordResponse replaces a prior answer; clearResponse withdraws it', () => {
  const id = DECISIONS[0].id;
  const a = makeResponse({ decisionId: id, response: 'not_yet' }, new Date('2026-07-15T09:00:00Z'))!;
  const b = makeResponse({ decisionId: id, response: 'approved' }, new Date('2026-07-15T10:00:00Z'))!;
  let store = recordResponse([], a);
  store = recordResponse(store, b);
  assert.equal(store.length, 1, 'one answer per decision');
  assert.equal(store[0].response, 'approved');
  store = clearResponse(store, id);
  assert.equal(store.length, 0, 'withdrawn');
});

test('getResponse resolves labels and echoes for known ids only', () => {
  assert.equal(getResponse('approved')!.label, 'Approved');
  assert.ok(getResponse('approved')!.echo.length > 0);
  assert.equal(getResponse('mystery'), null);
});

/* --- docket --------------------------------------------------------------- */
test('every docket item is a question with background, recommendation, owner, status', () => {
  assert.ok(DOCKET.length > 0);
  for (const d of DOCKET) {
    assert.ok(d.question.includes('?'), `docket "${d.id}" should pose a question`);
    assert.ok(d.background.length > 0 && d.recommendation.length > 0 && d.owner.length > 0);
    assert.ok(docketStatusLabel(d.status).length > 0);
  }
});

// Open Chairs and Leadership Records are no longer held in this module — they are
// derived from the Executive Register. Their behaviour is covered by
// tests/executive-integration.test.ts.

/* --- archive -------------------------------------------------------------- */
test('archive prepares the five categories, honestly empty except recorded decisions', () => {
  const shelves = archiveShelves(0);
  assert.deepEqual(
    shelves.map((s) => s.id),
    ['briefings', 'decisions', 'appointment_letters', 'meeting_records', 'leadership_documents'],
  );
  assert.ok(shelves.every((s) => s.count === 0), 'all empty with no recorded decisions');
  assert.ok(shelves.every((s) => s.emptyLine.length > 0));

  const withThree = archiveShelves(3);
  const decisions = withThree.find((s) => s.id === 'decisions')!;
  assert.equal(decisions.count, 3, 'the Decisions shelf reflects real recorded answers');
  assert.ok(withThree.filter((s) => s.id !== 'decisions').every((s) => s.count === 0),
    'no other shelf fabricates a count');
});
