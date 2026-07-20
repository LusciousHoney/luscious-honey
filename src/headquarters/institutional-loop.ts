/* =============================================================================
   Institutional Loop Integration (ILI) v1 — the seam-closing composition.

   This introduces NO engine, executive, workflow, runtime, policy, or source of
   truth. It is a thin COMPOSITION that closes the one seam between the execution
   layer and the institution, so the loop always returns to Headquarters:

     institutional state → HOS → IEL → AEB → Runtime Boundary → Runtime →
     verification → institutional acceptance → Institutional Memory → HOS …

   Each transition keeps its single owner:
     • verification .......... AEB  (verifyResult, via ingestExecution)
     • operational status .... Execution Ledger (via ingestExecution)
     • institutional accept ... Executive Workflow (completeInitiative)
     • recovery preparation ... AEB  (prepareRepairOrder)
     • settled memory ......... Institutional Memory (derived from the initiative)
     • loop continuation ...... HOS / IEL (re-derive from the returned initiative)

   The dead-end this repairs: a verified-accepted execution used to advance only
   the operational ledger, leaving the initiative stuck in 'executing' — so it
   never reached memory and HOS/IEL never recomposed. Closing it here means no
   institutional action terminates outside Headquarters.
   ============================================================================= */

import { completeInitiative, type Initiative } from './executive-workflow.ts';
import {
  prepareRepairOrder, type WorkOrder, type AgentResult, type Verdict,
} from './execution-bridge.ts';
import { ingestExecution } from './execution-runtime.ts';
import type { ExecutionRecord } from './execution-ledger.ts';

/** The outcome of one full pass around the loop. The initiative is the single
    institutional state; the ledger is the operational state; nothing else is
    stored. HOS/IEL recompose from `initiative`. */
export interface LoopResult {
  verdict: Verdict;
  ledger: ExecutionRecord[];
  /** The institutional state after acceptance — advanced to completed when the
      execution is accepted, otherwise unchanged. */
  initiative: Initiative;
  /** A bounded repair order, present on a recoverable failure within the limit. */
  repair?: WorkOrder;
  /** A Founder decision is required — present on escalation / scope violation /
      exhausted recovery. */
  escalation?: string;
  /** Every pass returns to Headquarters — the loop never terminates outside it. */
  reentersHeadquarters: true;
}

/**
 * Close the execution loop for one returned result. Verification and the ledger
 * advance through the AEB/ERB owner (`ingestExecution`); on acceptance the
 * institution advances through its owner (`completeInitiative`) so the matter
 * reaches Institutional Memory and HOS/IEL recompose; a recoverable failure
 * yields a bounded repair (or escalates at the limit) through the AEB owner.
 * Pure composition — deriving the same inputs yields the same result.
 */
export function closeExecutionLoop(
  order: WorkOrder, result: AgentResult, initiative: Initiative,
  ledger: ExecutionRecord[], priorAttempts = 0, now: Date = new Date(),
): LoopResult {
  const ing = ingestExecution(order, result, ledger, now);
  const base = { verdict: ing.verdict, ledger: ing.ledger, initiative, reentersHeadquarters: true as const };

  switch (ing.verdict) {
    case 'accepted':
      // Institutional acceptance — Executive Workflow advances the matter; it now
      // flows to Institutional Memory, and HOS/IEL recompose from it.
      return { ...base, initiative: completeInitiative(initiative, now) };

    case 'recoverable_failure': {
      const repair = prepareRepairOrder(order, result, priorAttempts, now);
      return repair.ok ? { ...base, repair: repair.value } : { ...base, escalation: repair.escalation };
    }

    case 'founder_review_required':
    case 'rejected_scope_violation':
      return { ...base, escalation: `Founder decision required — ${ing.verdict.replace(/_/g, ' ')}.` };

    case 'verification_required':
      // Work stays in execution, awaiting further verification; still in the loop.
      return base;
  }
}
