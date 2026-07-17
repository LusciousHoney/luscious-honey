/* =============================================================================
   Sprint 12G — Executive Collaboration foundations (Council Phase II).

   Doctrine under test: THE CHAIR PROPOSES; THE OFFICE DISPOSES. Two primitives —
   handoff (ownership moves, office-brokered) and consultation (ownership stays) —
   as annotations on the ONE shared record. Guards, provenance, normalization, and
   backward compatibility with Sprints 12A–12F.
   ============================================================================= */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  makeSubmission, triage, advance,
  prepareRecommendation, presentToFounder, recordFounderDecision,
  normalizeRecommendation,
  // Chair workflows that must remain intact
  creativeAccept, creativeStart, creativeComplete,
  productionAccept, productionPlanning, productionReady, productionInProduction,
  productionDeliveryReady, productionComplete,
  growthAccept, growthComplete,
  // 12G — collaboration
  OFFICE_BROKER, isCollaborable, openHandoff,
  proposeHandoff, authorizeHandoff, acceptHandoff, declineHandoff, withdrawHandoff,
  requestConsultation, answerConsultation, withdrawConsultation,
  pendingHandoffProposals, handoffsAwaitingAcceptance, declinedHandoffsForOffice,
  unansweredConsultations, collaborationHistory, collaborationWaiting,
  type Recommendation, type CollaborationResult,
} from '../src/headquarters/chief-of-staff-ops.ts';
import {
  CHAIR_CHIEF_OF_STAFF, CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION, CHAIR_DIRECTOR_OF_GROWTH,
} from '../src/headquarters/executive-register.ts';

const T = new Date('2026-07-16T09:00:00.000Z');
const at = (s: string): Date => new Date(`2026-07-16T${s}:00.000Z`);

const sub = (id: string, over: Partial<Recommendation> = {}): Recommendation =>
  ({ ...makeSubmission({ id, type: 'idea', title: 't', description: 'd' }, T)!, ...over });

// A collaborable record: executing, owned by a Chair (the triage-route path).
const owned = (id: string, chair: string): Recommendation =>
  triage(sub(id), 'route', { ownerChairId: chair }, T);

// Narrow a result to success (fails the test otherwise) and return the record.
function ok(r: CollaborationResult): Recommendation {
  assert.equal(r.ok, true, `expected ok, got ${r.ok === false ? r.reason : ''}`);
  return (r as { ok: true; rec: Recommendation }).rec;
}
function denied(r: CollaborationResult): string {
  assert.equal(r.ok, false, 'expected a denial');
  return (r as { ok: false; reason: string }).reason;
}

/* --- new records carry empty collaboration collections -------------------- */
test('a new record starts with empty, honest collaboration collections', () => {
  const r = sub('n');
  assert.deepEqual(r.collaborationTrail, []);
  assert.deepEqual(r.consultations, []);
  assert.equal(isCollaborable(r), false, 'a preparing record is not collaborable');
  assert.equal(isCollaborable(owned('o', CHAIR_CREATIVE_DIRECTOR)), true, 'executing + owned is');
});

/* --- HANDOFF: the valid office-brokered path ------------------------------ */
test('a valid handoff: propose → office authorizes → receiving Chair accepts, ownership moves', () => {
  const r0 = owned('h1', CHAIR_CREATIVE_DIRECTOR);
  const r1 = ok(proposeHandoff(r0, CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION, 'ready to produce', at('09:01'), 'H1'));
  assert.equal(r1.ownerChairId, CHAIR_CREATIVE_DIRECTOR, 'proposing moves nothing');
  assert.equal(openHandoff(r1)!.status, 'proposed');

  const r2 = ok(authorizeHandoff(r1, 'H1', at('09:02')));
  assert.equal(r2.ownerChairId, CHAIR_CREATIVE_DIRECTOR, 'authorizing still moves nothing');
  const h2 = openHandoff(r2)!;
  assert.equal(h2.status, 'authorized');
  assert.equal(h2.authorizedBy, OFFICE_BROKER);
  assert.ok(h2.authorizedAt);

  const r3 = ok(acceptHandoff(r2, 'H1', CHAIR_HEAD_OF_PRODUCTION, at('09:03')));
  assert.equal(r3.ownerChairId, CHAIR_HEAD_OF_PRODUCTION, 'ownership moves only on acceptance');
  assert.equal(r3.status, 'executing', 'the shared lifecycle is untouched');
  const h3 = r3.collaborationTrail[0];
  assert.equal(h3.status, 'accepted');
  assert.ok(h3.acceptedAt && h3.resolvedAt);
  assert.equal(openHandoff(r3), null, 'no open handoff remains');
});

/* --- HANDOFF guards ------------------------------------------------------- */
test('handoff targets are validated through the Register', () => {
  const r = owned('h2', CHAIR_CREATIVE_DIRECTOR);
  assert.equal(denied(proposeHandoff(r, CHAIR_CREATIVE_DIRECTOR, 'nobody', 'x', T)), 'unknown_chair');
  assert.equal(denied(proposeHandoff({ ...r, ownerChairId: 'ghost' }, 'ghost', CHAIR_HEAD_OF_PRODUCTION, 'x', T)), 'unknown_chair');
});

test('a Chair cannot hand off to itself', () => {
  const r = owned('h3', CHAIR_CREATIVE_DIRECTOR);
  assert.equal(denied(proposeHandoff(r, CHAIR_CREATIVE_DIRECTOR, CHAIR_CREATIVE_DIRECTOR, 'x', T)), 'self_handoff');
});

test('only the current owning Chair may propose a handoff', () => {
  const r = owned('h4', CHAIR_CREATIVE_DIRECTOR);
  assert.equal(denied(proposeHandoff(r, CHAIR_HEAD_OF_PRODUCTION, CHAIR_DIRECTOR_OF_GROWTH, 'x', T)), 'not_owner');
});

test('only owned, executing work is collaborable — held / complete / withdrawn / awaiting-Founder cannot begin a handoff', () => {
  const held = triage(sub('c1'), 'hold', {}, T);
  assert.equal(denied(proposeHandoff(held, CHAIR_CHIEF_OF_STAFF, CHAIR_CREATIVE_DIRECTOR, 'x', T)), 'record_not_collaborable');

  const complete = advance(owned('c2', CHAIR_CREATIVE_DIRECTOR), 'complete', T);
  assert.equal(denied(proposeHandoff(complete, CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION, 'x', T)), 'record_not_collaborable');

  const withdrawn = advance(owned('c3', CHAIR_CREATIVE_DIRECTOR), 'withdrawn', T);
  assert.equal(denied(proposeHandoff(withdrawn, CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION, 'x', T)), 'record_not_collaborable');

  const preparing = sub('c4', { ownerChairId: CHAIR_CREATIVE_DIRECTOR });
  assert.equal(denied(proposeHandoff(preparing, CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION, 'x', T)), 'record_not_collaborable');
});

test('existing Founder approval requirements are never bypassed — an awaiting-Founder record is not collaborable', () => {
  const waiting = presentToFounder(prepareRecommendation(sub('fg'), { recommendation: 'r', decisionRequested: 'd' }, T)!, T);
  assert.equal(waiting.status, 'awaiting_founder');
  assert.equal(denied(proposeHandoff(waiting, CHAIR_CHIEF_OF_STAFF, CHAIR_CREATIVE_DIRECTOR, 'x', T)), 'record_not_collaborable');
  // And collaboration never fabricates a Founder decision on an executing item.
  const r = ok(acceptHandoff(ok(authorizeHandoff(ok(proposeHandoff(owned('fg2', CHAIR_CREATIVE_DIRECTOR), CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION, 'x', T, 'HF')), 'HF', T)), 'HF', CHAIR_HEAD_OF_PRODUCTION, T));
  assert.equal(r.founderDecision, 'pending', 'the Founder is not addressed by a handoff');
});

test('only one open handoff at a time', () => {
  const r1 = ok(proposeHandoff(owned('h5', CHAIR_CREATIVE_DIRECTOR), CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION, 'x', T, 'A'));
  assert.equal(denied(proposeHandoff(r1, CHAIR_CREATIVE_DIRECTOR, CHAIR_DIRECTOR_OF_GROWTH, 'y', T, 'B')), 'existing_open_handoff');
});

test('a receiving Chair cannot take ownership silently — acceptance requires a prior office authorization', () => {
  const proposed = ok(proposeHandoff(owned('h6', CHAIR_CREATIVE_DIRECTOR), CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION, 'x', T, 'H6'));
  // accept before authorize → refused, ownership unchanged
  assert.equal(denied(acceptHandoff(proposed, 'H6', CHAIR_HEAD_OF_PRODUCTION, T)), 'not_authorized');
  const authorized = ok(authorizeHandoff(proposed, 'H6', T));
  // only the named receiving Chair may accept
  assert.equal(denied(acceptHandoff(authorized, 'H6', CHAIR_DIRECTOR_OF_GROWTH, T)), 'not_receiving_chair');
});

test('a declined handoff returns the work to the office — never straight to the sender', () => {
  const authorized = ok(authorizeHandoff(ok(proposeHandoff(owned('h7', CHAIR_CREATIVE_DIRECTOR), CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION, 'x', T, 'H7')), 'H7', T));
  assert.equal(denied(declineHandoff(authorized, 'H7', CHAIR_DIRECTOR_OF_GROWTH, '', T)), 'not_receiving_chair');
  const declined = ok(declineHandoff(authorized, 'H7', CHAIR_HEAD_OF_PRODUCTION, 'not ready', at('09:05')));
  assert.equal(declined.ownerChairId, null, 'returned to the office, unowned');
  assert.equal(declined.status, 'preparing', 're-opened for the office');
  assert.equal(declined.triage, null);
  const h = declined.collaborationTrail[0];
  assert.equal(h.status, 'declined');
  assert.equal(h.declineReason, 'not ready');
  assert.deepEqual(declinedHandoffsForOffice([declined]).map((v) => v.handoff.id), ['H7']);
});

test('withdraw removes an unaccepted handoff — only by the proposer or the office, never after acceptance', () => {
  const proposed = ok(proposeHandoff(owned('h8', CHAIR_CREATIVE_DIRECTOR), CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION, 'x', T, 'H8'));
  assert.equal(denied(withdrawHandoff(proposed, 'H8', CHAIR_DIRECTOR_OF_GROWTH, T)), 'not_proposer_or_office');
  const byOffice = ok(withdrawHandoff(proposed, 'H8', OFFICE_BROKER, T));
  assert.equal(byOffice.collaborationTrail[0].status, 'withdrawn');
  assert.equal(byOffice.ownerChairId, CHAIR_CREATIVE_DIRECTOR, 'the work stays put on withdrawal');
  // cannot withdraw an accepted handoff
  const accepted = ok(acceptHandoff(ok(authorizeHandoff(ok(proposeHandoff(owned('h9', CHAIR_CREATIVE_DIRECTOR), CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION, 'x', T, 'H9')), 'H9', T)), 'H9', CHAIR_HEAD_OF_PRODUCTION, T));
  assert.equal(denied(withdrawHandoff(accepted, 'H9', CHAIR_CREATIVE_DIRECTOR, T)), 'handoff_wrong_state');
});

test('authorize / accept / not-found state guards', () => {
  const proposed = ok(proposeHandoff(owned('h10', CHAIR_CREATIVE_DIRECTOR), CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION, 'x', T, 'H10'));
  assert.equal(denied(authorizeHandoff(proposed, 'nope', T)), 'handoff_not_found');
  const authorized = ok(authorizeHandoff(proposed, 'H10', T));
  assert.equal(denied(authorizeHandoff(authorized, 'H10', T)), 'handoff_wrong_state', 'cannot authorize twice');
  assert.equal(denied(acceptHandoff(authorized, 'ghost', CHAIR_HEAD_OF_PRODUCTION, T)), 'handoff_not_found');
});

test("a handoff preserves the sending Chair's stage history (a Chair hands off instead of closing)", () => {
  // Creative has taken up the work (stage in_progress) and, rather than close the
  // record with creativeComplete, hands it off to Production — the record stays
  // executing throughout. The sending Chair's stage must survive the ownership move.
  const creativeWorking = creativeStart(creativeAccept(owned('h11', CHAIR_CREATIVE_DIRECTOR), T), T);
  assert.equal(creativeWorking.creativeStage, 'in_progress');
  assert.equal(creativeWorking.status, 'executing');
  const accepted = ok(acceptHandoff(ok(authorizeHandoff(ok(proposeHandoff(creativeWorking, CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION, 'produce it', T, 'H11')), 'H11', T)), 'H11', CHAIR_HEAD_OF_PRODUCTION, T));
  assert.equal(accepted.ownerChairId, CHAIR_HEAD_OF_PRODUCTION);
  assert.equal(accepted.creativeStage, 'in_progress', "the sending Chair's stage history is NOT erased");
  assert.equal(accepted.productionStage, null, 'the receiving Chair begins fresh');
  assert.equal(accepted.collaborationTrail[0].fromStageAtProposal, 'in_progress', 'provenance captured');
});

/* --- CONSULTATION --------------------------------------------------------- */
test('a valid consultation: one question, one answer, ownership never changes', () => {
  const r0 = owned('k1', CHAIR_DIRECTOR_OF_GROWTH);
  const r1 = ok(requestConsultation(r0, CHAIR_DIRECTOR_OF_GROWTH, CHAIR_CREATIVE_DIRECTOR, 'On voice?', at('09:01'), 'K1'));
  assert.equal(r1.ownerChairId, CHAIR_DIRECTOR_OF_GROWTH, 'ownership unchanged by a request');
  assert.equal(r1.consultations[0].status, 'open');
  const r2 = ok(answerConsultation(r1, 'K1', CHAIR_CREATIVE_DIRECTOR, 'Yes — on voice.', at('09:02')));
  assert.equal(r2.ownerChairId, CHAIR_DIRECTOR_OF_GROWTH, 'ownership unchanged by an answer');
  assert.equal(r2.consultations[0].status, 'answered');
  assert.equal(r2.consultations[0].answer, 'Yes — on voice.');
  assert.ok(r2.consultations[0].answeredAt);
});

test('consultation guards: self, ownership, empty question / answer, wrong answerer, double-answer', () => {
  const r = owned('k2', CHAIR_DIRECTOR_OF_GROWTH);
  assert.equal(denied(requestConsultation(r, CHAIR_DIRECTOR_OF_GROWTH, CHAIR_DIRECTOR_OF_GROWTH, 'q', T)), 'self_consultation');
  assert.equal(denied(requestConsultation(r, CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION, 'q', T)), 'not_owner');
  assert.equal(denied(requestConsultation(r, CHAIR_DIRECTOR_OF_GROWTH, CHAIR_CREATIVE_DIRECTOR, '   ', T)), 'empty_question');
  const open = ok(requestConsultation(r, CHAIR_DIRECTOR_OF_GROWTH, CHAIR_CREATIVE_DIRECTOR, 'q', T, 'K2'));
  assert.equal(denied(answerConsultation(open, 'K2', CHAIR_HEAD_OF_PRODUCTION, 'a', T)), 'not_consulted_chair');
  assert.equal(denied(answerConsultation(open, 'K2', CHAIR_CREATIVE_DIRECTOR, '  ', T)), 'empty_answer');
  const answered = ok(answerConsultation(open, 'K2', CHAIR_CREATIVE_DIRECTOR, 'a', T));
  assert.equal(denied(answerConsultation(answered, 'K2', CHAIR_CREATIVE_DIRECTOR, 'again', T)), 'consultation_wrong_state');
});

test('an owner or the office may withdraw an open consultation', () => {
  const open = ok(requestConsultation(owned('k3', CHAIR_DIRECTOR_OF_GROWTH), CHAIR_DIRECTOR_OF_GROWTH, CHAIR_CREATIVE_DIRECTOR, 'q', T, 'K3'));
  assert.equal(denied(withdrawConsultation(open, 'K3', CHAIR_HEAD_OF_PRODUCTION, T)), 'not_owner');
  assert.equal(ok(withdrawConsultation(open, 'K3', OFFICE_BROKER, T)).consultations[0].status, 'withdrawn');
});

/* --- derived views -------------------------------------------------------- */
test('derived views surface the office’s pending work honestly', () => {
  const proposed = ok(proposeHandoff(owned('v1', CHAIR_CREATIVE_DIRECTOR), CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION, 'x', at('09:01'), 'V1'));
  const authorized = ok(authorizeHandoff(ok(proposeHandoff(owned('v2', CHAIR_HEAD_OF_PRODUCTION), CHAIR_HEAD_OF_PRODUCTION, CHAIR_DIRECTOR_OF_GROWTH, 'x', at('09:02'), 'V2')), 'V2', at('09:03')));
  const consulted = ok(requestConsultation(owned('v3', CHAIR_DIRECTOR_OF_GROWTH), CHAIR_DIRECTOR_OF_GROWTH, CHAIR_CREATIVE_DIRECTOR, 'q', at('09:04'), 'V3'));
  const store = [proposed, authorized, consulted];
  assert.deepEqual(pendingHandoffProposals(store).map((v) => v.handoff.id), ['V1']);
  assert.deepEqual(handoffsAwaitingAcceptance(store).map((v) => v.handoff.id), ['V2']);
  assert.deepEqual(unansweredConsultations(store).map((v) => v.consultation.id), ['V3']);
  assert.equal(collaborationWaiting(store).length, 3, 'all three are waiting on a collaboration');
});

test('collaboration history is ordered provenance, oldest first, across both primitives', () => {
  let r = owned('hist', CHAIR_CREATIVE_DIRECTOR);
  r = ok(requestConsultation(r, CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION, 'q', at('09:01'), 'C'));
  r = ok(proposeHandoff(r, CHAIR_CREATIVE_DIRECTOR, CHAIR_DIRECTOR_OF_GROWTH, 'x', at('09:02'), 'H'));
  const hist = collaborationHistory(r);
  assert.deepEqual(hist.map((e) => e.kind), ['consultation', 'handoff']);
  assert.deepEqual(hist.map((e) => e.at), ['2026-07-16T09:01:00.000Z', '2026-07-16T09:02:00.000Z']);
});

/* --- chain completion (decision #5) --------------------------------------- */
test('the final Chair completing closes the record and preserves all collaboration history', () => {
  // Creative → (handoff) → Growth, which carries it to complete.
  const toGrowth = ok(acceptHandoff(ok(authorizeHandoff(ok(proposeHandoff(owned('chain', CHAIR_CREATIVE_DIRECTOR), CHAIR_CREATIVE_DIRECTOR, CHAIR_DIRECTOR_OF_GROWTH, 'carry it out', T, 'CH')), 'CH', T)), 'CH', CHAIR_DIRECTOR_OF_GROWTH, T));
  const done = growthComplete(growthAccept(toGrowth, T), T);
  assert.equal(done.status, 'complete', 'the shared record closes');
  assert.equal(done.collaborationTrail.length, 1, 'the handoff trail is preserved as provenance');
  assert.equal(done.collaborationTrail[0].status, 'accepted');
});

/* --- normalization & backward compatibility ------------------------------- */
test('malformed collaboration data is normalized away safely', () => {
  const bad = {
    ...owned('bad', CHAIR_CREATIVE_DIRECTOR),
    collaborationTrail: [
      { id: 'good', fromChairId: 'a', toChairId: 'b', createdAt: 'z', status: 'proposed' },
      { id: 'nostatus', fromChairId: 'a', toChairId: 'b', createdAt: 'z' },      // dropped
      'junk', null, 42,                                                           // dropped
      { id: 'badstatus', fromChairId: 'a', toChairId: 'b', createdAt: 'z', status: 'nonsense' }, // dropped
    ] as never,
    consultations: [
      { id: 'ok', owningChairId: 'a', consultedChairId: 'b', question: 'q', requestedAt: 'z', status: 'open' },
      { id: 'noq', owningChairId: 'a', consultedChairId: 'b', requestedAt: 'z', status: 'open' }, // dropped
    ] as never,
  } as Recommendation;
  const n = normalizeRecommendation(bad);
  assert.deepEqual(n.collaborationTrail.map((h) => h.id), ['good']);
  assert.deepEqual(n.consultations.map((c) => c.id), ['ok']);
});

test('a pre-12G record (no collaboration fields) normalizes to empty collections without data loss', () => {
  const legacy = { ...owned('leg', CHAIR_CREATIVE_DIRECTOR) } as Recommendation;
  delete (legacy as { collaborationTrail?: unknown }).collaborationTrail;
  delete (legacy as { consultations?: unknown }).consultations;
  const n = normalizeRecommendation(legacy);
  assert.deepEqual(n.collaborationTrail, []);
  assert.deepEqual(n.consultations, []);
  assert.equal(n.ownerChairId, CHAIR_CREATIVE_DIRECTOR, 'existing fields survive');
  assert.equal(n.status, 'executing');
});

test('a clean record passes normalization unchanged (same reference)', () => {
  const clean = owned('clean', CHAIR_CREATIVE_DIRECTOR);
  assert.equal(normalizeRecommendation(clean), clean, 'no needless copy');
});

/* --- the existing Council remains intact ---------------------------------- */
test('Creative, Production, and Growth workflows are untouched by collaboration', () => {
  const c = creativeComplete(creativeStart(creativeAccept(owned('wc', CHAIR_CREATIVE_DIRECTOR), T), T), T);
  assert.equal(c.creativeStage, 'complete');
  assert.deepEqual(c.collaborationTrail, [], 'no collaboration invented by the creative flow');

  let p = productionAccept(owned('wp', CHAIR_HEAD_OF_PRODUCTION), T);
  p = productionComplete(productionDeliveryReady(productionInProduction(productionReady(productionPlanning(p, T), T), T), T), T);
  assert.equal(p.productionStage, 'complete');

  const g = growthComplete(growthAccept(owned('wg', CHAIR_DIRECTOR_OF_GROWTH), T), T);
  assert.equal(g.growthStage, 'complete');
  assert.deepEqual(g.consultations, []);
});

test('the Founder decision loop remains intact alongside collaboration', () => {
  const waiting = presentToFounder(prepareRecommendation(sub('fl'), { recommendation: 'r', decisionRequested: 'd' }, T)!, T);
  const decided = recordFounderDecision(waiting, 'approved', '', T);
  assert.equal(decided.status, 'decided');
  assert.deepEqual(decided.collaborationTrail, []);
});
