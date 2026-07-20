/* =============================================================================
   Autonomous Execution Bridge (AEB) v1. The safe seam between the House's
   decision layer and an execution worker. Verifies the autonomy safety policy,
   execution eligibility, work-order derivation, deterministic brief rendering
   with escalation on missing context, structured-result verification (checks,
   scope, prohibited actions), bounded recovery, the ledger's duplicate-dispatch
   guard, and that the institutional engines remain authoritative.
   ============================================================================= */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { openInitiative, decide } from '../src/headquarters/executive-workflow.ts';
import { nextActionFor } from '../src/headquarters/executive-loop.ts';
import {
  autonomyOf, deriveEligibility, authorizedActionFor, prepareWorkOrder, renderAgentBrief,
  verifyResult, prepareRepairOrder, MAX_RECOVERY_ATTEMPTS, manualClaudeCodeAdapter,
  type WorkOrder, type AgentResult,
} from '../src/headquarters/execution-bridge.ts';
import { advance, isLive, statusOf } from '../src/headquarters/execution-ledger.ts';

const T0 = new Date('2026-07-19T09:00:00.000Z');
const T1 = new Date('2026-07-19T12:00:00.000Z');
const JK = 'I attended a signing yesterday. I’d like to turn it into content.';

const executingAction = () => nextActionFor(decide(openInitiative(JK, T0), 'approve', undefined, T1)); // continue_execution
const briefAction = () => nextActionFor(openInitiative(JK, T0));                                        // escalate_to_founder
const goodOrder = (): WorkOrder => {
  const p = prepareWorkOrder(decide(openInitiative(JK, T0), 'approve', undefined, T1), executingAction(), T1);
  assert.ok(p.ok); return p.value;
};
const passingResult = (o: WorkOrder): AgentResult => ({
  workOrderId: o.id, outcome: 'completed', summary: 'Done.', filesChanged: ['src/headquarters/x.ts'],
  testsRun: o.requiredChecks, verification: o.requiredChecks.map((c) => ({ check: c, passed: true })),
  unresolved: [], scopeDeviations: [], recoveryAttempts: 0, recommendedNextAction: 'Continue.',
  prohibitedActionsAvoidedConfirmed: true,
});

/* --- routine reversible work is executable; Founder-reserved is not -------- */
test('routine reversible work is safeguarded-executable; the never-list stays never', () => {
  assert.equal(deriveEligibility(executingAction()), 'executable_with_safeguards');
  assert.equal(deriveEligibility(briefAction()), 'not_executable');   // escalate → institutional_decision → never
  for (const a of ['spend_money', 'merge_to_main', 'production_deploy', 'change_access_policy',
    'delete_production_data', 'change_legal_privacy', 'irreversible_migration'] as const) {
    assert.equal(autonomyOf(a), 'never', `${a} must never auto-run`);
  }
  assert.equal(autonomyOf('run_verification'), 'auto');
});

/* --- prohibited work never yields a work order ---------------------------- */
test('a Founder-reserved recommendation escalates instead of producing a work order', () => {
  const p = prepareWorkOrder(openInitiative(JK, T0), briefAction(), T1);
  assert.equal(p.ok, false);
  if (!p.ok) assert.match(p.escalation, /Reserved for the Founder/);
});

/* --- work orders never grant merge/deploy authority ----------------------- */
test('a prepared work order is bounded and grants no merge or deploy authority', () => {
  const o = goodOrder();
  assert.equal(o.mergeAuthority, false);
  assert.equal(o.deployAuthority, false);
  assert.ok(o.scope.forbidModify.includes('functions') && o.scope.forbidModify.includes('.github'));
  assert.deepEqual(o.requiredChecks, ['tsc --noEmit', 'npm test', 'npm run build', 'npm run check:prod']);
  assert.equal(authorizedActionFor(executingAction()), 'prepare_deliverable');
});

/* --- brief rendering: deterministic, with the required header + escalation -- */
test('the agent brief is deterministic and begins TARGET / PURPOSE / TOKEN POLICY', () => {
  const o = goodOrder();
  const b1 = renderAgentBrief(o), b2 = renderAgentBrief(o);
  assert.ok(b1.ok && b2.ok);
  if (b1.ok && b2.ok) {
    assert.equal(b1.value, b2.value);                    // deterministic
    assert.match(b1.value, /^TARGET[\s\S]*PURPOSE[\s\S]*TOKEN POLICY/);
    assert.match(b1.value, /Production deploy: PROHIBITED/);
    assert.match(b1.value, /Do NOT merge\. Do NOT deploy/);
  }
  // an underspecified order escalates rather than fabricating a prompt
  const bad = renderAgentBrief({ ...o, objective: '', acceptanceCriteria: [] });
  assert.equal(bad.ok, false);
});

/* --- verification gate: evaluates evidence, not the agent's word ----------- */
test('verification accepts only when checks pass within scope', () => {
  const o = goodOrder();
  assert.equal(verifyResult(o, passingResult(o)).verdict, 'accepted');

  // a scope violation is rejected outright
  assert.equal(verifyResult(o, { ...passingResult(o), filesChanged: ['functions/api/x.js'] }).verdict, 'rejected_scope_violation');
  assert.equal(verifyResult(o, { ...passingResult(o), prohibitedActionsAvoidedConfirmed: false }).verdict, 'rejected_scope_violation');

  // a failing/missing required check is a recoverable failure, not acceptance
  const failing = { ...passingResult(o), verification: o.requiredChecks.map((c, i) => ({ check: c, passed: i !== 0 })) };
  assert.equal(verifyResult(o, failing).verdict, 'recoverable_failure');

  // a Founder-reserved next action routes to the Founder
  assert.equal(verifyResult(o, { ...passingResult(o), recommendedNextAction: 'Merge to main and deploy.' }).verdict, 'founder_review_required');

  // partial work needs verification, never silent acceptance
  assert.equal(verifyResult(o, { ...passingResult(o), outcome: 'partial', unresolved: ['x'] }).verdict, 'verification_required');
});

/* --- recovery is bounded and then escalates ------------------------------- */
test('recovery produces a bounded repair order, then escalates at the limit', () => {
  const o = goodOrder();
  const failed: AgentResult = { ...passingResult(o), outcome: 'failed',
    verification: [{ check: 'npm test', passed: false }], unresolved: ['a test fails'] };

  const first = prepareRepairOrder(o, failed, 0, T1);
  assert.ok(first.ok);
  if (first.ok) {
    assert.match(first.value.objective, /^Repair:/);
    assert.match(first.value.acceptanceCriteria[0], /npm test/);
    assert.equal(first.value.mergeAuthority, false);
  }
  // at the configured limit, escalate instead of looping forever
  const exhausted = prepareRepairOrder(o, failed, MAX_RECOVERY_ATTEMPTS, T1);
  assert.equal(exhausted.ok, false);
  if (!exhausted.ok) assert.match(exhausted.escalation, /Recovery exhausted/);
});

/* --- ledger: duplicate dispatch is prevented; in-progress is derived ------- */
test('the ledger guards duplicate dispatch and reflects in-progress state', () => {
  const o = goodOrder();
  let ledger = advance([], o.id, o.initiativeId, 'dispatched', T1);
  assert.equal(isLive(ledger, o.id), true);
  assert.equal(statusOf(ledger, o.id), 'dispatched');
  // eligibility reflects the runtime status, not a fresh re-decision
  assert.equal(deriveEligibility(executingAction(), 'dispatched'), 'in_progress');
  assert.equal(deriveEligibility(executingAction(), 'verification_required'), 'awaiting_verification');
  assert.equal(deriveEligibility(executingAction(), 'succeeded'), 'not_executable');
  // advancing to failure counts the recovery attempt
  ledger = advance(ledger, o.id, o.initiativeId, 'failed_recoverable', T1);
  assert.equal(ledger.find((r) => r.id === o.id)!.attempts, 1);
});

/* --- the manual adapter is attended and exports the brief ----------------- */
test('the v1 manual adapter is attended and dispatches the brief', () => {
  assert.equal(manualClaudeCodeAdapter.unattended, false);
  const d = manualClaudeCodeAdapter.dispatch(goodOrder());
  assert.ok(d.ok && /TARGET/.test(d.value));
});
