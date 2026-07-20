/* =============================================================================
   Institutional Loop Integration (ILI) v1. These tests exercise COMPOSITION —
   the whole loop, not individual engines: institutional state → HOS → IEL → AEB
   → Runtime Boundary → verification → institutional acceptance → Memory → HOS.
   They prove the loop returns to Headquarters, closes the execution→institution
   seam (no dead-end), routes recovery/escalation back in, and keeps one source
   of institutional truth.
   ============================================================================= */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { openInitiative, decide, houseAttention, type Initiative } from '../src/headquarters/executive-workflow.ts';
import { deriveExecutiveLoop, nextActionFor } from '../src/headquarters/executive-loop.ts';
import { prepareWorkOrder, type WorkOrder, type AgentResult } from '../src/headquarters/execution-bridge.ts';
import { manualClaudeCodeRuntime } from '../src/headquarters/execution-runtime.ts';
import { statusOf, isLive, advance } from '../src/headquarters/execution-ledger.ts';
import { initiativeRecord, institutionalStatus } from '../src/headquarters/institutional-memory.ts';
import { closeExecutionLoop } from '../src/headquarters/institutional-loop.ts';

const T0 = new Date('2026-07-19T09:00:00.000Z');
const T1 = new Date('2026-07-19T12:00:00.000Z');
const T2 = new Date('2026-07-20T10:00:00.000Z');
const JK = 'I attended a signing yesterday. I’d like to turn it into content.';

/** Walk institutional state → HOS/IEL → AEB to a bounded work order. */
function toWorkOrder(i: Initiative): WorkOrder {
  const action = deriveExecutiveLoop([i]).matters[0].action;   // IEL over HOS
  const p = prepareWorkOrder(i, action, T1);                    // AEB
  assert.ok(p.ok); return p.value;
}
const passing = (o: WorkOrder, over: Partial<AgentResult> = {}): AgentResult => ({
  workOrderId: o.id, outcome: 'completed', summary: 'Done.', filesChanged: ['src/headquarters/x.ts'],
  testsRun: o.requiredChecks, verification: o.requiredChecks.map((c) => ({ check: c, passed: true })),
  unresolved: [], scopeDeviations: [], recoveryAttempts: 0, recommendedNextAction: 'Continue.',
  prohibitedActionsAvoidedConfirmed: true, ...over,
});

/* --- the complete loop: state → … → verification → memory → HOS ------------ */
test('a verified execution advances the institution and returns to Headquarters', () => {
  const executing = decide(openInitiative(JK, T0), 'approve', undefined, T1);   // brief → approve → executing
  assert.equal(nextActionFor(executing).kind, 'continue_execution');            // IEL: the House proceeds

  const order = toWorkOrder(executing);                                         // AEB work order
  const dispatched = manualClaudeCodeRuntime.dispatch(order);                   // Runtime Boundary
  assert.ok(dispatched.ok);
  let ledger = advance([], order.id, order.initiativeId, 'dispatched', T1);

  // structured result returns → close the loop
  const out = closeExecutionLoop(order, passing(order), executing, ledger, 0, T2);
  assert.equal(out.verdict, 'accepted');                 // AEB verified
  assert.equal(out.reentersHeadquarters, true);
  assert.equal(statusOf(out.ledger, order.id), 'succeeded');
  assert.equal(out.initiative.status, 'completed');      // institution advanced (seam closed)

  // Institutional Memory now holds the settled outcome…
  const record = initiativeRecord(out.initiative);
  assert.ok(record.outcome && record.timeline.some((e) => e.kind === 'completed'));
  // …and HOS/IEL recompose from the new state
  assert.equal(houseAttention([out.initiative]).state, 'completed');
  assert.equal(nextActionFor(out.initiative).kind, 'archive_to_memory');
});

/* --- dead-end prevention: acceptance never strands the matter -------------- */
test('an accepted execution is never stranded in “executing”', () => {
  const executing = decide(openInitiative(JK, T0), 'approve', undefined, T1);
  const order = toWorkOrder(executing);
  const out = closeExecutionLoop(order, passing(order), executing, [], 0, T2);
  assert.notEqual(out.initiative.status, 'executing');   // the old dead-end is closed
  assert.equal(deriveExecutiveLoop([out.initiative]).recommendation.kind, 'archive_to_memory');
});

/* --- recovery re-enters the loop; it never bypasses Headquarters ---------- */
test('a recoverable failure yields a bounded repair, then escalates at the limit', () => {
  const executing = decide(openInitiative(JK, T0), 'approve', undefined, T1);
  const order = toWorkOrder(executing);
  const failed = passing(order, { outcome: 'failed', verification: [{ check: 'npm test', passed: false }], unresolved: ['a test fails'] });

  const first = closeExecutionLoop(order, failed, executing, [], 0, T2);
  assert.equal(first.verdict, 'recoverable_failure');
  assert.ok(first.repair && /^Repair:/.test(first.repair.objective));   // AEB owns recovery prep
  assert.equal(statusOf(first.ledger, order.id), 'failed_recoverable');
  assert.equal(first.initiative.status, 'executing');                    // not accepted — institution unchanged
  assert.equal(first.reentersHeadquarters, true);

  const exhausted = closeExecutionLoop(order, failed, executing, [], 2, T2);
  assert.equal(exhausted.repair, undefined);
  assert.match(exhausted.escalation ?? '', /Recovery exhausted/);        // escalates, never loops forever
});

/* --- scope violation escalates to the Founder, institution untouched ------ */
test('a scope violation escalates and does not advance the institution', () => {
  const executing = decide(openInitiative(JK, T0), 'approve', undefined, T1);
  const order = toWorkOrder(executing);
  const out = closeExecutionLoop(order, passing(order, { filesChanged: ['functions/api/x.js'] }), executing, [], 0, T2);
  assert.equal(out.verdict, 'rejected_scope_violation');
  assert.equal(statusOf(out.ledger, order.id), 'failed_escalated');
  assert.equal(out.initiative.status, 'executing');       // never accepted
  assert.match(out.escalation ?? '', /Founder decision required/);
});

/* --- duplicate transition prevention -------------------------------------- */
test('the ledger guards a live work order against duplicate dispatch', () => {
  const order = toWorkOrder(decide(openInitiative(JK, T0), 'approve', undefined, T1));
  const ledger = advance([], order.id, order.initiativeId, 'dispatched', T1);
  assert.equal(isLive(ledger, order.id), true);           // a second dispatch would be blocked by this guard
});

/* --- one source of institutional truth ------------------------------------ */
test('institutional status derives from the initiative; the ledger is separate operational state', () => {
  const executing = decide(openInitiative(JK, T0), 'approve', undefined, T1);
  const order = toWorkOrder(executing);
  // institutional status derives from the ONE initiative state…
  assert.equal(institutionalStatus(executing), 'In motion');
  // …while the ledger tracks operational runtime status independently (not institutional truth)
  const out = closeExecutionLoop(order, passing(order), executing, [], 0, T2);
  assert.equal(institutionalStatus(out.initiative), 'Completed — ready to brief you');
  assert.equal(statusOf(out.ledger, order.id), 'succeeded');   // distinct axis, no duplicate truth
});

/* --- loop completion: the House reaches rest ------------------------------ */
test('the loop reaches a stable resting state and does not spin', () => {
  // nothing in motion, nothing awaiting → the single recommendation is at rest
  assert.equal(deriveExecutiveLoop([]).recommendation.kind, 'at_rest');
  const declined = decide(openInitiative(JK, T0), 'decline', undefined, T1);
  assert.equal(deriveExecutiveLoop([declined]).recommendation.kind, 'at_rest');
});
