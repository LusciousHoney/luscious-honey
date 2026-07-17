/* =============================================================================
   Sprint 12H — The Brokerage. The office's collaboration desk is a VIEW over the
   12G model; these tests cover the derived queues and re-brokering operations it
   depends on (handoffsReturnedToOffice, latestHandoff, chairLabel, and the
   route/hold/withdraw re-brokering that the "Returned to the Office" queue drives).
   The DOM surface itself is exercised in the browser walkthrough.
   ============================================================================= */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  makeSubmission, triage, advance, routeRecommendation, normalizeRecommendation,
  proposeHandoff, authorizeHandoff, acceptHandoff, declineHandoff, withdrawHandoff,
  requestConsultation,
  pendingHandoffProposals, handoffsAwaitingAcceptance, declinedHandoffsForOffice,
  handoffsReturnedToOffice, unansweredConsultations, latestHandoff, chairLabel, collaborationHistory,
  OFFICE_BROKER,
  type Recommendation, type CollaborationResult,
} from '../src/headquarters/chief-of-staff-ops.ts';
import {
  CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION, CHAIR_DIRECTOR_OF_GROWTH,
} from '../src/headquarters/executive-register.ts';

const T = new Date('2026-07-16T09:00:00.000Z');
const sub = (id: string, over: Partial<Recommendation> = {}): Recommendation =>
  ({ ...makeSubmission({ id, type: 'idea', title: 't', description: 'd' }, T)!, ...over });
const owned = (id: string, chair: string): Recommendation =>
  triage(sub(id), 'route', { ownerChairId: chair }, T);
function ok(r: CollaborationResult): Recommendation {
  assert.equal(r.ok, true, `expected ok, got ${r.ok === false ? r.reason : ''}`);
  return (r as { ok: true; rec: Recommendation }).rec;
}

// A handoff carried to a given state.
const proposedTo = (id: string, from: string, to: string, hid: string): Recommendation =>
  ok(proposeHandoff(owned(id, from), from, to, 'reason', T, hid));
const authorizedTo = (id: string, from: string, to: string, hid: string): Recommendation =>
  ok(authorizeHandoff(proposedTo(id, from, to, hid), hid, T));
const declinedTo = (id: string, from: string, to: string, hid: string): Recommendation =>
  ok(declineHandoff(authorizedTo(id, from, to, hid), hid, to, 'not ready', T));

/* --- chairLabel & latestHandoff ------------------------------------------- */
test('chairLabel resolves Register titles, falls back to id, and handles null', () => {
  assert.equal(chairLabel(CHAIR_CREATIVE_DIRECTOR), 'Creative Director');
  assert.equal(chairLabel(CHAIR_HEAD_OF_PRODUCTION), 'Head of Production');
  assert.equal(chairLabel('nobody'), 'nobody');
  assert.equal(chairLabel(null), 'Unassigned');
});

test('latestHandoff returns the most recent handoff, or null', () => {
  assert.equal(latestHandoff(owned('l0', CHAIR_CREATIVE_DIRECTOR)), null);
  const two = ok(proposeHandoff(
    ok(withdrawHandoff(proposedTo('l1', CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION, 'A'), 'A', OFFICE_BROKER, T)),
    CHAIR_CREATIVE_DIRECTOR, CHAIR_DIRECTOR_OF_GROWTH, 'reason', T, 'B'));
  assert.equal(latestHandoff(two)!.id, 'B');
});

/* --- the four Brokerage queues across a full flow -------------------------- */
test('the Brokerage queues track a handoff through every state', () => {
  // proposed → shows in pending only
  const p = proposedTo('q1', CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION, 'Q1');
  assert.deepEqual(pendingHandoffProposals([p]).map((v) => v.handoff.id), ['Q1']);
  assert.deepEqual(handoffsAwaitingAcceptance([p]), []);

  // authorized → awaiting acceptance only
  const a = ok(authorizeHandoff(p, 'Q1', T));
  assert.deepEqual(pendingHandoffProposals([a]), []);
  assert.deepEqual(handoffsAwaitingAcceptance([a]).map((v) => v.handoff.id), ['Q1']);
  assert.deepEqual(handoffsReturnedToOffice([a]), []);

  // accepted → drops out of every office queue (it's the receiving Chair's now)
  const acc = ok(acceptHandoff(a, 'Q1', CHAIR_HEAD_OF_PRODUCTION, T));
  assert.deepEqual(pendingHandoffProposals([acc]), []);
  assert.deepEqual(handoffsAwaitingAcceptance([acc]), []);
  assert.deepEqual(handoffsReturnedToOffice([acc]), []);
});

/* --- Returned to the Office ------------------------------------------------ */
test('a declined handoff appears in Returned to the Office — unowned, re-opened', () => {
  const d = declinedTo('r1', CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION, 'R1');
  assert.equal(d.ownerChairId, null);
  assert.equal(d.status, 'preparing');
  assert.deepEqual(handoffsReturnedToOffice([d]).map((v) => v.handoff.id), ['R1']);
  // and it is also in the raw declined view (unfiltered)
  assert.deepEqual(declinedHandoffsForOffice([d]).map((v) => v.handoff.id), ['R1']);
});

test('re-routing a declined item to a Chair clears it from the queue and PRESERVES the trail', () => {
  const d = declinedTo('r2', CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION, 'R2');
  // The office re-brokers by assigning the unowned work (route + executing).
  const rerouted = advance(routeRecommendation(d, CHAIR_DIRECTOR_OF_GROWTH), 'executing');
  assert.equal(rerouted.ownerChairId, CHAIR_DIRECTOR_OF_GROWTH);
  assert.equal(rerouted.status, 'executing');
  assert.deepEqual(handoffsReturnedToOffice([rerouted]), [], 'no longer awaiting the office');
  // The declined handoff is NOT erased — it remains as provenance.
  assert.equal(rerouted.collaborationTrail.length, 1);
  assert.equal(rerouted.collaborationTrail[0].status, 'declined');
});

test('holding or withdrawing a returned item also clears the office queue', () => {
  const held = advance(declinedTo('r3', CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION, 'R3'), 'held');
  assert.equal(held.status, 'held');
  assert.deepEqual(handoffsReturnedToOffice([held]), []);
  const withdrawn = advance(declinedTo('r4', CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION, 'R4'), 'withdrawn');
  assert.deepEqual(handoffsReturnedToOffice([withdrawn]), []);
});

/* --- office "Decline Proposal" (withdraw by the office) -------------------- */
test('the office declining a proposal removes it from pending; ownership is untouched', () => {
  const p = proposedTo('w1', CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION, 'W1');
  const declined = ok(withdrawHandoff(p, 'W1', OFFICE_BROKER, T));
  assert.equal(declined.collaborationTrail[0].status, 'withdrawn');
  assert.equal(declined.ownerChairId, CHAIR_CREATIVE_DIRECTOR, 'the work stays with the proposing Chair');
  assert.deepEqual(pendingHandoffProposals([declined]), []);
  assert.deepEqual(handoffsReturnedToOffice([declined]), [], 'a withdrawn proposal is not "returned"');
});

/* --- open consultations queue --------------------------------------------- */
test('open consultations show until answered, then leave the queue', () => {
  const open = ok(requestConsultation(owned('c1', CHAIR_DIRECTOR_OF_GROWTH), CHAIR_DIRECTOR_OF_GROWTH, CHAIR_CREATIVE_DIRECTOR, 'On voice?', T, 'C1'));
  assert.deepEqual(unansweredConsultations([open]).map((v) => v.consultation.id), ['C1']);
});

/* --- history for the Brokerage cards -------------------------------------- */
test('collaboration history feeds the Brokerage card straight from the trail', () => {
  const d = declinedTo('h1', CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION, 'H1');
  const hist = collaborationHistory(d);
  assert.equal(hist.length, 1);
  assert.equal(hist[0].kind, 'handoff');
  assert.equal(hist[0].status, 'declined');
});

/* --- robustness ----------------------------------------------------------- */
test('malformed collaboration data does not break the Brokerage queues', () => {
  const junk = normalizeRecommendation({
    ...owned('j1', CHAIR_CREATIVE_DIRECTOR),
    collaborationTrail: ['x', null, { id: 'z' }] as never,
    consultations: [42] as never,
  } as Recommendation);
  assert.doesNotThrow(() => {
    pendingHandoffProposals([junk]);
    handoffsAwaitingAcceptance([junk]);
    handoffsReturnedToOffice([junk]);
    unansweredConsultations([junk]);
    collaborationHistory(junk);
  });
  assert.deepEqual(junk.collaborationTrail, []);
  assert.deepEqual(junk.consultations, []);
});
