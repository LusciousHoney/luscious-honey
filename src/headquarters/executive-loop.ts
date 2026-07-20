/* =============================================================================
   Institutional Executive Loop (IEL) v1 — the House's behavior layer.

   The Executive Loop is not a workflow, a data model, or another executive. It
   is the institutional behavior that continuously determines WHAT THE HOUSE
   SHOULD DO NEXT, derived entirely from existing institutional state. It owns
   nothing, stores nothing, and produces recommendations only.

   It composes — and never duplicates — the Headquarters Operating System:
   `currentStage`, `nextStep`, `matterStanding`, and `deriveHeadquartersState`
   already turn raw workflow status into an institutional picture; the Loop
   classifies that picture into a single, typed executive action. Every state
   change simply changes what the Loop derives — continuous operation with no
   polling, timers, backend, or duplicate state.
   ============================================================================= */

import {
  currentStage, nextStep, matterStanding, deriveHeadquartersState,
  type HeadquartersState, type MatterStanding,
} from './headquarters-os.ts';
import { type Initiative } from './executive-workflow.ts';

/* --- the executive action vocabulary --------------------------------------- */

export type NextActionKind =
  | 'escalate_to_founder'   // the House cannot proceed without the Founder's judgment
  | 'return_for_revision'   // back to the Executive Team for a fresh recommendation
  | 'continue_execution'    // the House proceeds on its own
  | 'assign_executive'      // hand to the next responsible executive  [roadmap]
  | 'begin_review'          // enter the review stages                 [roadmap]
  | 'advance_documentation' // record what was done                    [roadmap]
  | 'archive_to_memory'     // concluded; enter Institutional Memory / the Register
  | 'await_founder'         // held at the Founder's word; resumes at her will (no interruption)
  | 'at_rest';              // settled; nothing further

/** Priority of the single institutional recommendation — 0 wins. The Founder's
    judgment ranks first; active House work next; the reviews (roadmap) then;
    concluding work last. */
const ACTION_RANK: Record<NextActionKind, number> = {
  escalate_to_founder: 0,
  return_for_revision: 1,
  continue_execution: 1,
  assign_executive: 1,
  begin_review: 2,
  advance_documentation: 2,
  archive_to_memory: 3,
  await_founder: 4,
  at_rest: 5,
};

export interface NextAction {
  kind: NextActionKind;
  rank: number;
  owner: string;         // who acts next — reused from HOS nextStep
  statement: string;     // the calm recommendation — reused from HOS nextStep
  requiresFounder: boolean;
}

/**
 * The one action the House should take on a matter — DERIVED by classifying the
 * HOS-derived stage and interrupt boundary into the executive-action vocabulary.
 * The owner and statement come straight from HOS `nextStep`; the interrupt
 * decision straight from the authoritative Founder Attention (via matterStanding).
 * Nothing here re-derives status.
 */
export function nextActionFor(i: Initiative): NextAction {
  const stage = currentStage(i);
  const step = nextStep(i);
  const requiresFounder = matterStanding(i).requiresFounder; // = Founder Attention interrupt boundary
  let kind: NextActionKind;
  switch (stage) {
    case 'founder_decision':     kind = requiresFounder ? 'escalate_to_founder' : 'await_founder'; break;
    case 'recommendation':       kind = 'return_for_revision'; break;
    case 'execution':            kind = 'continue_execution'; break;
    case 'institutional_memory': kind = 'archive_to_memory'; break;
    case 'house_register':       kind = 'at_rest'; break;
    default:                     kind = 'continue_execution'; break;
  }
  return { kind, rank: ACTION_RANK[kind], owner: step.owner, statement: step.action, requiresFounder };
}

/** The next responsible party for a matter — the executive handoff, derived (no
    executive ever names its own successor). Reuses HOS `nextStep`. */
export function nextResponsible(i: Initiative): string { return nextStep(i).owner; }

/**
 * Exactly ONE institutional recommendation at any given moment: the
 * highest-priority action across all matters. Ties keep the first (the matters'
 * own order). An empty House is at rest.
 */
export function nextInstitutionalAction(actions: NextAction[]): NextAction {
  return actions.reduce<NextAction | null>((best, a) => (best === null || a.rank < best.rank ? a : best), null)
    ?? { kind: 'at_rest', rank: ACTION_RANK.at_rest, owner: 'The House', statement: 'The House is at rest.', requiresFounder: false };
}

/* --- recovery: the institutional model (no events fabricated) -------------- */

export interface RecoveryAssessment {
  blocked: boolean;
  recoverable: boolean;
  /** Escalate to the Founder only once autonomous recovery is exhausted. */
  escalate: boolean;
  reason?: string;
}

/**
 * Assess whether a matter that cannot advance can recover on its own. v1 has no
 * failure state (`matterStanding.blocked` is always false), so this reports
 * "not blocked" and fabricates nothing. When a genuine blocked state is
 * introduced (roadmap), the cause and recoverability are derived here, escalating
 * to the Founder only after autonomous recovery is exhausted.
 */
export function assessRecovery(m: MatterStanding): RecoveryAssessment {
  if (!m.blocked) return { blocked: false, recoverable: false, escalate: false };
  return { blocked: true, recoverable: true, escalate: false, reason: 'awaiting-recovery' };
}

/* --- the loop: what the House should do next ------------------------------- */

export interface LoopMatter { initiative: Initiative; action: NextAction; }

export interface ExecutiveLoop {
  /** The institutional picture (HOS — reused, not recomputed). */
  state: HeadquartersState;
  /** The next action for each matter. */
  matters: LoopMatter[];
  /** The single institutional recommendation the House would act on now. */
  recommendation: NextAction;
  /** Whether that recommendation genuinely needs the Founder. */
  founderRequired: boolean;
}

/**
 * Run the Executive Loop over the current matters — pure and deterministic.
 * Deriving twice yields identical output; there is no stored loop, only this
 * derivation over institutional state.
 */
export function deriveExecutiveLoop(initiatives: Initiative[]): ExecutiveLoop {
  const state = deriveHeadquartersState(initiatives);
  const matters = initiatives.map((i) => ({ initiative: i, action: nextActionFor(i) }));
  const recommendation = nextInstitutionalAction(matters.map((m) => m.action));
  return { state, matters, recommendation, founderRequired: recommendation.requiresFounder };
}
