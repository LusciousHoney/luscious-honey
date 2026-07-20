/* =============================================================================
   Autonomous Execution Bridge (AEB) v1 — the safe seam between the House's
   institutional decision layer and an external execution runtime.

   Headquarters remains the institutional decision authority; an execution agent
   (Claude Code or another approved runtime) is a WORKER that accepts one bounded
   work order, does the authorized work, runs the required checks, and returns a
   structured result. The worker never becomes a source of institutional truth,
   never redefines policy, and never merges or deploys unless the work order
   explicitly grants it (it never does in v1).

   ★ This module is pure derivation + a manual adapter. It composes the
   Institutional Executive Loop (a recommendation) and the safety policy; it does
   not re-decide what to do (that is IEL) and does not store institutional truth
   (that is Institutional Memory). Runtime status lives in the Execution Ledger.

   ★ HONEST SCOPE (v1): this implements decision automation, work-order
   preparation, agent-brief generation, a MANUAL dispatch boundary, structured
   result ingestion, and institutional verification/recovery. It is NOT unattended
   execution — a human runs the Claude Code session and returns the result. See
   docs/headquarters/Autonomous-Execution-Bridge.md.
   ============================================================================= */

import type { NextAction } from './executive-loop.ts';
import type { Initiative } from './executive-workflow.ts';
import type { ExecutionStatus } from './execution-ledger.ts';

/* --- 1. Autonomy safety policy (central, testable) ------------------------- */

export type AuthorizedAction =
  // reversible worker actions — may proceed with safeguards
  | 'prepare_deliverable' | 'implement_reversible' | 'run_verification' | 'write_documentation'
  // Founder-reserved / never-autonomous in v1
  | 'spend_money' | 'change_billing' | 'change_access_policy' | 'expose_private_data'
  | 'destructive_db' | 'delete_production_data' | 'change_legal_privacy'
  | 'irreversible_migration' | 'merge_to_main' | 'production_deploy'
  | 'institutional_decision' | 'creative_decision';

export type AutonomyClass = 'auto' | 'safeguarded' | 'founder_approval' | 'never';

export interface SafetyRule { action: AuthorizedAction; autonomy: AutonomyClass; note: string; }

/** The one place safety is decided. Never scattered across UI handlers. */
export const SAFETY_MATRIX: SafetyRule[] = [
  { action: 'run_verification',      autonomy: 'auto',        note: 'Read-only checks; no side effects.' },
  { action: 'prepare_deliverable',   autonomy: 'safeguarded', note: 'Reversible drafting, bounded to scope, verified.' },
  { action: 'implement_reversible',  autonomy: 'safeguarded', note: 'Reversible technical work, bounded and verified; never merges/deploys.' },
  { action: 'write_documentation',   autonomy: 'safeguarded', note: 'Reversible docs, bounded to scope.' },
  { action: 'spend_money',           autonomy: 'never',       note: 'Financial action — Founder only.' },
  { action: 'change_billing',        autonomy: 'never',       note: 'Billing — Founder only.' },
  { action: 'change_access_policy',  autonomy: 'never',       note: 'Access-control policy — Founder only.' },
  { action: 'expose_private_data',   autonomy: 'never',       note: 'Privacy — never autonomous.' },
  { action: 'destructive_db',        autonomy: 'never',       note: 'Destructive data operation — never autonomous.' },
  { action: 'delete_production_data',autonomy: 'never',       note: 'Production data — never autonomous.' },
  { action: 'change_legal_privacy',  autonomy: 'never',       note: 'Legal/privacy language — Founder only.' },
  { action: 'irreversible_migration',autonomy: 'never',       note: 'Irreversible migration — Founder only.' },
  { action: 'merge_to_main',         autonomy: 'never',       note: 'Merge to main — Founder only.' },
  { action: 'production_deploy',     autonomy: 'never',       note: 'Production deploy — Founder only.' },
  { action: 'institutional_decision',autonomy: 'never',       note: 'Institutional judgment — Founder only.' },
  { action: 'creative_decision',     autonomy: 'never',       note: 'Creative direction — Founder only.' },
];
const AUTONOMY_BY_ACTION = new Map(SAFETY_MATRIX.map((r) => [r.action, r.autonomy]));
export function autonomyOf(action: AuthorizedAction): AutonomyClass {
  return AUTONOMY_BY_ACTION.get(action) ?? 'never';   // unknown ⇒ safest
}

/* --- 2. Execution eligibility --------------------------------------------- */

export type Eligibility =
  | 'auto_executable' | 'executable_with_safeguards' | 'founder_approval_required'
  | 'not_executable' | 'in_progress' | 'awaiting_verification' | 'blocked';

/** Map an IEL recommendation to the authorized action it would require. A
    Founder-facing recommendation is never worker-executable. */
export function authorizedActionFor(action: NextAction): AuthorizedAction {
  switch (action.kind) {
    case 'continue_execution':   return 'prepare_deliverable';
    case 'advance_documentation':return 'write_documentation';
    case 'begin_review':         return 'run_verification';
    case 'assign_executive':     return 'implement_reversible';
    case 'escalate_to_founder':  return 'institutional_decision';
    case 'await_founder':        return 'institutional_decision';
    case 'return_for_revision':  return 'creative_decision';   // a fresh recommendation is the House's, not a worker's
    case 'archive_to_memory':    return 'institutional_decision';
    case 'at_rest':              return 'run_verification';
  }
}

/** Whether the House's recommendation can be executed by a worker now — derived
    from the safety policy and the current runtime status (never re-deciding). */
export function deriveEligibility(action: NextAction, ledgerStatus?: ExecutionStatus): Eligibility {
  if (ledgerStatus === 'dispatched' || ledgerStatus === 'running') return 'in_progress';
  if (ledgerStatus === 'verification_required') return 'awaiting_verification';
  if (ledgerStatus === 'failed_recoverable' || ledgerStatus === 'failed_escalated') return 'blocked';
  if (ledgerStatus === 'succeeded') return 'not_executable';   // done; nothing to dispatch
  switch (autonomyOf(authorizedActionFor(action))) {
    case 'auto':            return 'auto_executable';
    case 'safeguarded':     return 'executable_with_safeguards';
    case 'founder_approval':return 'founder_approval_required';
    case 'never':           return 'not_executable';
  }
}

/* --- 3. The institutional work order (typed, machine-readable) -------------- */

export interface WorkOrder {
  id: string;                       // stable: `wo:${initiativeId}:${createdAt}`
  initiativeId: string;             // the authoritative matter
  objective: string;                // institutional objective
  authorizedAction: AuthorizedAction;
  role: string;                     // assigned executive / execution role
  scope: { inspect: string[]; forbidModify: string[] };
  acceptanceCriteria: string[];
  requiredChecks: string[];         // tests / audits the worker must run
  stopConditions: string[];
  escalationConditions: string[];
  mergeAuthority: boolean;          // ALWAYS false in v1
  deployAuthority: boolean;         // ALWAYS false in v1
  contextRefs: string[];            // institutional context references
  createdAt: string;
  status: ExecutionStatus;
}

export type Prepared<T> = { ok: true; value: T } | { ok: false; escalation: string };

/** The checks every bounded work order must pass, matching the repo's own gate. */
export const DEFAULT_CHECKS = ['tsc --noEmit', 'npm test', 'npm run build', 'npm run check:prod'];

/**
 * Derive a bounded work order from a matter and its IEL recommendation. Only
 * safeguarded/auto-eligible recommendations yield an order; anything reserved for
 * the Founder returns an escalation instead of a work order. The order never
 * grants merge or deploy authority.
 */
export function prepareWorkOrder(
  initiative: Initiative, action: NextAction, now: Date = new Date(),
): Prepared<WorkOrder> {
  const eligibility = deriveEligibility(action);
  if (eligibility === 'founder_approval_required' || eligibility === 'not_executable') {
    return { ok: false, escalation: `Reserved for the Founder — ${action.statement}` };
  }
  const authorizedAction = authorizedActionFor(action);
  const objective = `${action.statement} (for “${initiative.title}”)`.trim();
  if (!initiative.title || !action.statement) {
    return { ok: false, escalation: 'Insufficient institutional context to prepare a bounded work order.' };
  }
  const at = now.toISOString();
  return {
    ok: true,
    value: {
      id: `wo:${initiative.id}:${at}`,
      initiativeId: initiative.id,
      objective,
      authorizedAction,
      role: action.owner,
      scope: {
        inspect: ['src/headquarters', 'docs/headquarters'],
        forbidModify: ['functions', 'migrations', '.github', 'wrangler.toml', 'access policy'],
      },
      acceptanceCriteria: [
        'The authorized objective is met within scope.',
        'No prohibited or Founder-reserved action was performed.',
      ],
      requiredChecks: DEFAULT_CHECKS,
      stopConditions: [
        'Scope would need to widen beyond the permitted areas.',
        'A prohibited or Founder-reserved action would be required.',
      ],
      escalationConditions: [
        'Acceptance criteria cannot be met within scope.',
        'Recovery attempts are exhausted.',
      ],
      mergeAuthority: false,
      deployAuthority: false,
      contextRefs: [`initiative:${initiative.id}`],
      createdAt: at,
      status: 'prepared',
    },
  };
}

/* --- 4. Agent brief (deterministic renderer) ------------------------------- */

/**
 * Render a copy-ready execution brief from the structural work order. Begins with
 * TARGET / PURPOSE / TOKEN POLICY. Invents no missing decisions: an underspecified
 * order returns an escalation rather than an executable prompt.
 */
export function renderAgentBrief(order: WorkOrder): Prepared<string> {
  if (order.acceptanceCriteria.length === 0 || !order.objective) {
    return { ok: false, escalation: 'Work order lacks an objective or acceptance criteria — escalate for definition.' };
  }
  const list = (xs: string[]) => xs.map((x) => `- ${x}`).join('\n');
  const brief =
`TARGET
Claude Code — execution worker for the Luscious Honey Collective Headquarters.
Work order: ${order.id}
Matter: ${order.initiativeId}

PURPOSE
${order.objective}
Authorized action: ${order.authorizedAction}. Assigned role: ${order.role}.

TOKEN POLICY
- Conserve tokens. Inspect only the permitted scope. Prefer targeted reads.

ALLOWED SCOPE (inspect only these areas)
${list(order.scope.inspect)}

FORBIDDEN — do not modify, and never perform
${list(order.scope.forbidModify)}
- Merge to main: ${order.mergeAuthority ? 'permitted' : 'PROHIBITED'}
- Production deploy: ${order.deployAuthority ? 'permitted' : 'PROHIBITED'}
- Any Founder-reserved action (spend, billing, access policy, legal/privacy, irreversible migration, destructive data).

ACCEPTANCE CRITERIA
${list(order.acceptanceCriteria)}

REQUIRED VERIFICATION (run all; report pass/fail)
${list(order.requiredChecks)}

STOP CONDITIONS
${list(order.stopConditions)}

RETURN — a structured result only (no free prose as the result):
{ workOrderId, outcome: completed|partial|failed, summary, filesChanged[], testsRun[],
  verification: [{check, passed}], unresolved[], scopeDeviations[], recoveryAttempts,
  recommendedNextAction, commit?, pr?, prohibitedActionsAvoidedConfirmed: true|false }

Do NOT merge. Do NOT deploy. Do NOT widen scope. Return the structured result.`;
  return { ok: true, value: brief };
}

/* --- 5. Structured agent result ------------------------------------------- */

export type ResultOutcome = 'completed' | 'partial' | 'failed';

export interface AgentResult {
  workOrderId: string;
  outcome: ResultOutcome;
  summary: string;
  filesChanged: string[];
  testsRun: string[];
  verification: { check: string; passed: boolean }[];
  unresolved: string[];
  scopeDeviations: string[];
  recoveryAttempts: number;
  recommendedNextAction: string;
  commit?: string;
  pr?: string;
  prohibitedActionsAvoidedConfirmed: boolean;
}

/* --- 6. Verification gate -------------------------------------------------- */

export type Verdict =
  | 'accepted' | 'verification_required' | 'recoverable_failure'
  | 'founder_review_required' | 'rejected_scope_violation';

export interface VerificationResult { verdict: Verdict; reasons: string[]; }

/**
 * Compare a returned result against its work order. The House never marks work
 * complete merely because the agent says so — it evaluates the required checks,
 * scope boundaries, and prohibited-action confirmation.
 */
export function verifyResult(order: WorkOrder, result: AgentResult): VerificationResult {
  const reasons: string[] = [];

  // Scope / safety first — a violation is never "verify later".
  const touchedForbidden = result.filesChanged.some((f) =>
    order.scope.forbidModify.some((bad) => f.includes(bad)));
  if (!result.prohibitedActionsAvoidedConfirmed || result.scopeDeviations.length > 0 || touchedForbidden) {
    return { verdict: 'rejected_scope_violation',
      reasons: ['A scope boundary or prohibited-action confirmation failed.'] };
  }

  // A Founder-reserved next action must reach the Founder, not auto-continue.
  if (/founder|approv|billing|legal|privacy|deploy|merge|creative|policy/i.test(result.recommendedNextAction)) {
    reasons.push('The recommended next action is reserved for the Founder.');
    return { verdict: 'founder_review_required', reasons };
  }

  if (result.outcome === 'failed') return { verdict: 'recoverable_failure', reasons: ['The agent reported failure.'] };

  // Every required check must be present and passing.
  const byCheck = new Map(result.verification.map((v) => [v.check, v.passed]));
  const missingOrFailed = order.requiredChecks.filter((c) => byCheck.get(c) !== true);
  if (missingOrFailed.length > 0) {
    return { verdict: 'recoverable_failure',
      reasons: [`Required checks not confirmed passing: ${missingOrFailed.join(', ')}`] };
  }

  if (result.outcome === 'partial' || result.unresolved.length > 0) {
    return { verdict: 'verification_required', reasons: ['Work is partial or has unresolved items.'] };
  }
  return { verdict: 'accepted', reasons: ['All acceptance criteria and required checks satisfied within scope.'] };
}

/* --- 7. Recovery loop (bounded) ------------------------------------------- */

export const MAX_RECOVERY_ATTEMPTS = 2;

/**
 * From a recoverable failure, derive a bounded repair work order — the failed
 * criterion, the observed evidence, a permitted repair scope, and a required
 * retest. After the configured limit, escalate with a concise Founder brief
 * rather than looping forever.
 */
export function prepareRepairOrder(
  order: WorkOrder, result: AgentResult, priorAttempts: number, now: Date = new Date(),
): Prepared<WorkOrder> {
  if (priorAttempts >= MAX_RECOVERY_ATTEMPTS) {
    return { ok: false,
      escalation: `Recovery exhausted after ${priorAttempts} attempt(s) on “${order.objective}”. Founder decision needed: ${result.unresolved.join('; ') || result.summary}` };
  }
  const failed = result.verification.filter((v) => !v.passed).map((v) => v.check);
  const at = now.toISOString();
  return {
    ok: true,
    value: {
      ...order,
      id: `wo:${order.initiativeId}:${at}:repair${priorAttempts + 1}`,
      objective: `Repair: ${order.objective}`,
      acceptanceCriteria: [
        `Resolve the failed criteria: ${failed.join(', ') || 'reported failure'}.`,
        'No prohibited or Founder-reserved action was performed.',
      ],
      escalationConditions: [`Escalate if unresolved after attempt ${priorAttempts + 1} of ${MAX_RECOVERY_ATTEMPTS}.`],
      createdAt: at,
      status: 'prepared',
    },
  };
}

/* --- 8. Runtime adapter boundary ------------------------------------------ */

/** An external execution runtime. Runtime-specific behavior lives here, never in
    the institutional engines. */
export interface RuntimeAdapter {
  id: string;
  label: string;
  /** Whether this adapter can run without a human present. */
  unattended: boolean;
  /** Turn a work order into whatever the runtime consumes (v1: a copy-ready brief). */
  dispatch(order: WorkOrder): Prepared<string>;
}

/** v1's only real adapter: a human copies the brief into a Claude Code session
    and returns the structured result by hand. Attended by design. */
export const manualClaudeCodeAdapter: RuntimeAdapter = {
  id: 'claude-code-manual',
  label: 'Claude Code (manual)',
  unattended: false,
  dispatch: (order) => renderAgentBrief(order),
};

/* Designed but NOT implemented (would require infrastructure that does not exist
   in this environment — no CI, no headless runtime, no scheduler): a headless
   Claude Code adapter, a GitHub Actions adapter, and scheduled cloud routines.
   See the AEB roadmap for the exact path and prerequisites. */
export const PLANNED_ADAPTERS = [
  { id: 'claude-code-headless', label: 'Claude Code (unattended/headless)', unattended: true },
  { id: 'github-actions',       label: 'GitHub Actions workflow',           unattended: true },
  { id: 'cloud-routine',        label: 'Scheduled cloud routine',           unattended: true },
] as const;
