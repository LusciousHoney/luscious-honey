/* =============================================================================
   Founder Attention System — the House's one authoritative model of when to
   interrupt the Founder. Covers the closed vocabulary, the fixed priority order,
   the blocking rule (one highest state wins), the interrupt boundary, and the
   Workflow adapter that maps initiatives to the shared states.
   ============================================================================= */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ATTENTION_STATES, attentionKind, attentionRank, higherAttention, resolveAttention,
} from '../src/headquarters/founder-attention.ts';
import { openInitiative, decide, completeInitiative, advanceToExecution, houseAttention, attentionForInitiative }
  from '../src/headquarters/executive-workflow.ts';

const NOW = new Date('2026-07-19T09:00:00.000Z');
const JK = 'I attended a signing yesterday. I’d like to turn it into content.';

/* --- the closed vocabulary, in priority order ----------------------------- */
test('the four states are ordered decision → review → completed → working', () => {
  assert.deepEqual(ATTENTION_STATES.map((s) => s.id),
    ['decision_required', 'review_needed', 'completed', 'working']);
  // ranks are strictly increasing and unique
  ATTENTION_STATES.forEach((s, idx) => assert.equal(s.rank, idx));
  // every state carries calm institutional language — never software words
  for (const s of ATTENTION_STATES) {
    assert.ok(s.label.length > 0 && s.line.length > 0);
    assert.ok(!/pending|processing|queue|running|loading|dispatch/i.test(s.label + s.line));
  }
});

/* --- the interrupt boundary ----------------------------------------------- */
test('only decision_required and review_needed interrupt the Founder', () => {
  assert.equal(attentionKind('decision_required').interrupts, true);
  assert.equal(attentionKind('review_needed').interrupts, true);
  assert.equal(attentionKind('completed').interrupts, false);
  assert.equal(attentionKind('working').interrupts, false);
});

/* --- the blocking rule: one highest state wins ---------------------------- */
test('resolveAttention returns the single highest-priority state', () => {
  assert.equal(resolveAttention(['working', 'completed', 'decision_required', 'review_needed']), 'decision_required');
  assert.equal(resolveAttention(['working', 'completed', 'review_needed']), 'review_needed');
  assert.equal(resolveAttention(['working', 'completed']), 'completed');
  assert.equal(resolveAttention(['working', 'working']), 'working');
  // nothing in motion → the House is at rest ('working')
  assert.equal(resolveAttention([]), 'working');
});

test('higherAttention / attentionRank agree with the table', () => {
  assert.equal(higherAttention('completed', 'working'), 'completed');
  assert.equal(higherAttention('review_needed', 'decision_required'), 'decision_required');
  assert.ok(attentionRank('decision_required') < attentionRank('working'));
});

/* --- the Workflow adapter: initiative → shared state ---------------------- */
test('an initiative maps to the shared attention state by its stage', () => {
  const brief = openInitiative(JK, NOW);
  assert.equal(attentionForInitiative(brief), 'decision_required');           // awaiting the Founder's word
  const executing = decide(brief, 'approve', undefined, NOW);
  assert.equal(attentionForInitiative(executing), 'working');                 // House executes independently
  const done = completeInitiative(advanceToExecution(brief, NOW), NOW);
  assert.equal(attentionForInitiative(done), 'completed');                    // concluded; ready to brief
  assert.equal(attentionForInitiative(decide(brief, 'pause', undefined, NOW)), 'working');
});

/* --- the House speaks with one voice across many initiatives --------------- */
test('houseAttention resolves all initiatives into one voice and names the driver', () => {
  const executing = decide(openInitiative(JK, NOW), 'approve', undefined, NOW);
  const awaiting = openInitiative('A note for the House to consider.', NOW);   // brief_ready
  const house = houseAttention([executing, awaiting]);
  assert.equal(house.state, 'decision_required');                             // the highest wins
  assert.deepEqual(house.driving.map((i) => i.id), [awaiting.id]);            // names the matter under judgment
  // a purely working House names no driver
  const working = houseAttention([executing]);
  assert.equal(working.state, 'working');
  assert.deepEqual(working.driving, []);
});
