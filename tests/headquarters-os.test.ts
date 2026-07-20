/* =============================================================================
   Headquarters Operating System (HOS) v1 — the institutional derivation layer.
   Verifies that HOS composes the authoritative engines (never recomputing them),
   maps matters onto the institutional flow, applies the Founder-interruption
   boundary, resolves the one institutional picture, and assembles the arrival
   brief — all as pure, deterministic derivation.
   ============================================================================= */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  openInitiative, decide, completeInitiative, houseAttention, attentionForInitiative,
} from '../src/headquarters/executive-workflow.ts';
import { attentionKind } from '../src/headquarters/founder-attention.ts';
import {
  FLOW_STAGES, currentStage, nextStep, founderReasonsFor, matterStanding,
  deriveHeadquartersState, arrivalBrief,
} from '../src/headquarters/headquarters-os.ts';

const T0 = new Date('2026-07-19T09:00:00.000Z');
const T1 = new Date('2026-07-19T12:00:00.000Z');
const T2 = new Date('2026-07-20T10:00:00.000Z');
const JK = 'I attended a signing yesterday. I’d like to turn it into content.';

/* --- the institutional flow is the canonical, ordered vocabulary ----------- */
test('the institutional flow lists every stage, marking active vs. roadmap', () => {
  const ids = FLOW_STAGES.map((s) => s.id);
  assert.ok(ids.includes('direction') && ids.includes('execution') && ids.includes('founder_briefing'));
  // the review/documentation stages are defined but not yet active (not fabricated)
  const inactive = FLOW_STAGES.filter((s) => !s.active).map((s) => s.id);
  assert.deepEqual(inactive.sort(),
    ['accessibility_review', 'architecture_review', 'design_review', 'documentation', 'verification']);
});

test('a matter maps onto the flow stage its status has reached', () => {
  const brief = openInitiative(JK, T0);
  assert.equal(currentStage(brief), 'founder_decision');
  assert.equal(currentStage(decide(brief, 'approve', undefined, T1)), 'execution');
  assert.equal(currentStage(completeInitiative(decide(brief, 'approve', undefined, T1), T2)), 'institutional_memory');
  assert.equal(currentStage(decide(brief, 'decline', undefined, T1)), 'house_register');
});

/* --- the Founder is interrupted only at the boundary ---------------------- */
test('only a matter awaiting a decision reaches the Founder — execution never does', () => {
  const brief = openInitiative(JK, T0);
  assert.deepEqual(founderReasonsFor(brief), ['strategic_decision']);
  assert.equal(matterStanding(brief).requiresFounder, true);

  const executing = decide(brief, 'approve', undefined, T1);
  assert.deepEqual(founderReasonsFor(executing), []);
  assert.equal(matterStanding(executing).requiresFounder, false);   // routine execution never interrupts
  assert.equal(nextStep(executing).owner, 'The Executive Team');
});

/* --- HOS composes the authoritative engines, never recomputing them -------- */
test('a matter standing defers to Founder Attention and the Execution model', () => {
  const executing = decide(openInitiative(JK, T0), 'approve', undefined, T1);
  const s = matterStanding(executing);
  assert.deepEqual(s.attention, attentionKind(attentionForInitiative(executing)));  // reused, not recomputed
  assert.ok(s.owners.includes('Creative Director'));                                // Execution ownership reused
  assert.equal(s.blocked, false);                                                   // no failure state in v1
});

/* --- the one institutional picture ---------------------------------------- */
test('deriveHeadquartersState resolves the whole House into one picture', () => {
  const awaiting = openInitiative('A matter for your decision.', T0);              // brief_ready
  const executing = decide(openInitiative(JK, T0), 'approve', undefined, T1);       // executing
  const completed = completeInitiative(decide(openInitiative('Done.', T0), 'approve', undefined, T1), T2);
  const state = deriveHeadquartersState([awaiting, executing, completed]);

  assert.deepEqual(state.attention, houseAttention([awaiting, executing, completed])); // the one voice, reused
  assert.deepEqual(state.awaitingJudgment.map((s) => s.initiative.id), [awaiting.id]);
  assert.deepEqual(state.inMotion.map((s) => s.initiative.id), [executing.id]);        // parallel, non-blocking
  assert.deepEqual(state.readyToBrief.map((s) => s.initiative.id), [completed.id]);
  assert.deepEqual(state.record.map((s) => s.initiative.id), [completed.id]);          // settled record
  // deterministic: deriving twice is identical
  assert.deepEqual(state, deriveHeadquartersState([awaiting, executing, completed]));
});

/* --- the arrival brief: what the House already knows ----------------------- */
test('the arrival brief summarises judgment, completed, and continuing matters', () => {
  const awaiting = openInitiative('Decide this.', T0);
  const executing = decide(openInitiative(JK, T0), 'approve', undefined, T1);
  const brief = arrivalBrief(deriveHeadquartersState([awaiting, executing]));
  assert.equal(brief.headline, houseAttention([awaiting, executing]).kind.line);     // one voice
  assert.deepEqual(brief.awaitingJudgment, ['Decide this.']);
  assert.equal(brief.continuing.length, 1);
  assert.equal(brief.readyToBrief.length, 0);
  // an empty House yields an empty brief (no matters to surface)
  const empty = arrivalBrief(deriveHeadquartersState([]));
  assert.deepEqual([empty.awaitingJudgment, empty.readyToBrief, empty.continuing], [[], [], []]);
});
