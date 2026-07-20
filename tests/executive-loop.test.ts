/* =============================================================================
   Institutional Executive Loop (IEL) v1. The House's behavior layer: a pure
   derivation that classifies the HOS institutional picture into exactly one
   executive action per matter and one institutional recommendation overall.
   Verifies action derivation, the single-recommendation priority, executive
   handoff, the recovery model, and that the Loop owns no state (deterministic,
   composes HOS/Attention without recomputing them).
   ============================================================================= */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  openInitiative, decide, completeInitiative,
} from '../src/headquarters/executive-workflow.ts';
import { matterStanding } from '../src/headquarters/headquarters-os.ts';
import {
  nextActionFor, nextResponsible, assessRecovery, deriveExecutiveLoop,
} from '../src/headquarters/executive-loop.ts';

const T0 = new Date('2026-07-19T09:00:00.000Z');
const T1 = new Date('2026-07-19T12:00:00.000Z');
const T2 = new Date('2026-07-20T10:00:00.000Z');
const JK = 'I attended a signing yesterday. I’d like to turn it into content.';

/* --- one matter → one derived action -------------------------------------- */
test('each matter derives exactly one executive action from its stage', () => {
  const brief = openInitiative(JK, T0);
  assert.equal(nextActionFor(brief).kind, 'escalate_to_founder');       // awaits the Founder's word
  assert.equal(nextActionFor(brief).requiresFounder, true);

  const executing = decide(brief, 'approve', undefined, T1);
  assert.equal(nextActionFor(executing).kind, 'continue_execution');    // the House proceeds
  assert.equal(nextActionFor(executing).requiresFounder, false);        // routine work never interrupts

  assert.equal(nextActionFor(completeInitiative(executing, T2)).kind, 'archive_to_memory');
  assert.equal(nextActionFor(decide(brief, 'revise', undefined, T1)).kind, 'return_for_revision');
  assert.equal(nextActionFor(decide(brief, 'decline', undefined, T1)).kind, 'at_rest');
});

/* --- paused holds at the Founder's word, without interrupting -------------- */
test('a paused matter awaits the Founder without demanding her attention', () => {
  const paused = decide(openInitiative(JK, T0), 'pause', undefined, T1);
  const a = nextActionFor(paused);
  assert.equal(a.kind, 'await_founder');
  assert.equal(a.requiresFounder, false);   // consistent with Founder Attention (paused = working)
});

/* --- executive handoff is derived, never self-assigned -------------------- */
test('the next responsible party is derived from institutional state', () => {
  assert.equal(nextResponsible(openInitiative(JK, T0)), 'The Founder');
  assert.equal(nextResponsible(decide(openInitiative(JK, T0), 'approve', undefined, T1)), 'The Executive Team');
});

/* --- exactly one institutional recommendation ----------------------------- */
test('the House resolves to a single highest-priority recommendation', () => {
  const brief = openInitiative('Decide this.', T0);                             // escalate (rank 0)
  const executing = decide(openInitiative(JK, T0), 'approve', undefined, T1);   // continue (rank 1)
  const completed = completeInitiative(decide(openInitiative('Done.', T0), 'approve', undefined, T1), T2); // archive (rank 3)

  const loop = deriveExecutiveLoop([executing, completed, brief]);
  assert.equal(loop.recommendation.kind, 'escalate_to_founder');   // the Founder-needed matter wins
  assert.equal(loop.founderRequired, true);
  assert.equal(loop.matters.length, 3);

  // with no Founder-needed matter, active work is the recommendation
  const working = deriveExecutiveLoop([executing, completed]);
  assert.equal(working.recommendation.kind, 'continue_execution');
  assert.equal(working.founderRequired, false);

  // an empty House is at rest
  assert.equal(deriveExecutiveLoop([]).recommendation.kind, 'at_rest');
});

/* --- deterministic; composes HOS without recomputing ---------------------- */
test('the loop is pure and deterministic; the picture is HOS, reused', () => {
  const set = [decide(openInitiative(JK, T0), 'approve', undefined, T1)];
  assert.deepEqual(deriveExecutiveLoop(set), deriveExecutiveLoop(set));
  // the loop carries the HOS state, not a recomputed one
  const loop = deriveExecutiveLoop(set);
  assert.ok(loop.state.attention && Array.isArray(loop.state.standings));
});

/* --- recovery model: established, not fabricated -------------------------- */
test('recovery reports not-blocked in v1, and escalates only after recovery', () => {
  const m = matterStanding(decide(openInitiative(JK, T0), 'approve', undefined, T1));
  assert.deepEqual(assessRecovery(m), { blocked: false, recoverable: false, escalate: false });
  // the model derives correctly when a blocked state exists (synthetic)
  const blocked = assessRecovery({ ...m, blocked: true });
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.recoverable, true);
  assert.equal(blocked.escalate, false);   // escalate only once autonomous recovery is exhausted
});
