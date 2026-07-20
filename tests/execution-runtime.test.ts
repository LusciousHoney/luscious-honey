/* =============================================================================
   Execution Runtime Boundary (ERB) v1. The runtime is a passive participant: it
   dispatches a brief, returns evidence, and reports liveness — and never forms a
   verdict, owns state, or updates institutional truth. Verifies the transport-
   independent contract, the pass-through of results, loop discipline (every
   execution re-enters Headquarters verification → ledger), and that no runtime
   decision-making or duplicate state was introduced.
   ============================================================================= */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { openInitiative, decide } from '../src/headquarters/executive-workflow.ts';
import { nextActionFor } from '../src/headquarters/executive-loop.ts';
import { prepareWorkOrder, type WorkOrder, type AgentResult } from '../src/headquarters/execution-bridge.ts';
import { statusOf } from '../src/headquarters/execution-ledger.ts';
import {
  manualClaudeCodeRuntime, manualTransport, TRANSPORTS, runtimeStateOf, ingestExecution,
} from '../src/headquarters/execution-runtime.ts';

const T0 = new Date('2026-07-19T09:00:00.000Z');
const T1 = new Date('2026-07-19T12:00:00.000Z');
const JK = 'I attended a signing yesterday. I’d like to turn it into content.';

const order = (): WorkOrder => {
  const p = prepareWorkOrder(decide(openInitiative(JK, T0), 'approve', undefined, T1), nextActionFor(decide(openInitiative(JK, T0), 'approve', undefined, T1)), T1);
  assert.ok(p.ok); return p.value;
};
const passing = (o: WorkOrder): AgentResult => ({
  workOrderId: o.id, outcome: 'completed', summary: 'Done.', filesChanged: ['src/headquarters/x.ts'],
  testsRun: o.requiredChecks, verification: o.requiredChecks.map((c) => ({ check: c, passed: true })),
  unresolved: [], scopeDeviations: [], recoveryAttempts: 0, recommendedNextAction: 'Continue.',
  prohibitedActionsAvoidedConfirmed: true,
});

/* --- the runtime contract is transport-independent and evidence-only ------- */
test('the runtime dispatches a brief and returns evidence unchanged', () => {
  const o = order();
  const d = manualClaudeCodeRuntime.dispatch(o);
  assert.ok(d.ok);
  if (d.ok) { assert.equal(d.value.workOrderId, o.id); assert.match(d.value.brief, /^TARGET/); }
  // receiveResult is a pass-through: the runtime forms NO verdict
  const r = passing(o);
  assert.deepEqual(manualClaudeCodeRuntime.receiveResult(r), r);
  assert.equal(manualClaudeCodeRuntime.unattended, false);
});

test('cancel / heartbeat / status are structural and own no store', () => {
  assert.deepEqual(manualClaudeCodeRuntime.cancel('wo:1'), { workOrderId: 'wo:1', state: 'cancelled' });
  const h = manualClaudeCodeRuntime.heartbeat('wo:1', 'working', T1);
  assert.deepEqual(h, { workOrderId: 'wo:1', state: 'working', at: T1.toISOString() });
  // status maps the operational ledger status → a runtime liveness state; it derives, owns nothing
  assert.equal(manualClaudeCodeRuntime.status('wo:1', 'running').state, 'working');
  assert.equal(manualClaudeCodeRuntime.status('wo:1', 'verification_required').state, 'returned');
  assert.equal(manualClaudeCodeRuntime.status('wo:1').state, 'idle');
});

test('runtimeStateOf maps every operational status without inventing one', () => {
  assert.equal(runtimeStateOf('dispatched'), 'accepted');
  assert.equal(runtimeStateOf('succeeded'), 'returned');
  assert.equal(runtimeStateOf('cancelled'), 'cancelled');
  assert.equal(runtimeStateOf(undefined), 'idle');
});

/* --- the transport abstraction carries no institutional knowledge ---------- */
test('the manual transport is attended and inert; the roster is designed not faked', () => {
  assert.equal(manualTransport.unattended, false);
  assert.equal(manualTransport.poll('wo:1'), null);         // nothing until a human returns it
  const implemented = TRANSPORTS.filter((t) => t.implemented).map((t) => t.id);
  assert.deepEqual(implemented, ['manual']);                // only manual is claimed
  assert.ok(TRANSPORTS.some((t) => t.id === 'github-actions' && !t.implemented));
});

/* --- LOOP DISCIPLINE: every execution re-enters Headquarters --------------- */
test('an accepted execution re-enters verification and advances the ledger', () => {
  const o = order();
  const ing = ingestExecution(o, passing(o), [], T1);
  assert.equal(ing.verdict, 'accepted');           // AEB verified it — not the runtime
  assert.equal(ing.nextStatus, 'succeeded');
  assert.equal(ing.reentersLoop, true);
  assert.equal(statusOf(ing.ledger, o.id), 'succeeded');
});

test('a scope violation or failure is routed by Headquarters, never accepted by the runtime', () => {
  const o = order();
  // scope violation → escalated (the runtime cannot bless it)
  const bad = ingestExecution(o, { ...passing(o), filesChanged: ['functions/api/x.js'] }, [], T1);
  assert.equal(bad.verdict, 'rejected_scope_violation');
  assert.equal(bad.nextStatus, 'failed_escalated');
  // failure → recoverable, held by Headquarters (recovery is not the runtime's)
  const failed = ingestExecution(o, { ...passing(o), outcome: 'failed', verification: [{ check: 'npm test', passed: false }] }, [], T1);
  assert.equal(failed.verdict, 'recoverable_failure');
  assert.equal(failed.nextStatus, 'failed_recoverable');
  assert.equal(failed.reentersLoop, true);          // no execution ends outside Headquarters
});
