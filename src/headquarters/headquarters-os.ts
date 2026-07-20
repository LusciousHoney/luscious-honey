/* =============================================================================
   Headquarters Operating System (HOS) v1 — the institutional layer.

   HOS introduces NO new orchestration engine and NO new store. It is a pure
   derivation OVER the derivations that already exist — Founder Attention,
   Executive Workflow, Execution ownership, and Institutional Memory — composing
   them into one continuously-derived institutional picture. Whenever any matter
   changes state, re-deriving `deriveHeadquartersState` yields the new picture:
   continuous operation by pure derivation, with no polling, timers, or backend.

   ★ HOS answers, in one place, the standing institutional questions:
       what requires attention · who owns it · what happens next · what is blocked
       · what can proceed in parallel · what has completed · what to remember ·
       what should reach the Founder.
   ★ It defers to the authoritative engines it composes and never recomputes them:
       attention comes from Founder Attention; ownership from the Execution model;
       history and status from Institutional Memory.
   ============================================================================= */

import {
  attentionForInitiative, executionResponsibilities, houseAttention, executiveLabel,
  type Initiative, type HouseAttention,
} from './executive-workflow.ts';
import { attentionKind, type AttentionKind } from './founder-attention.ts';
import { institutionalStatus, partitionInitiatives } from './institutional-memory.ts';

/* --- the institutional flow (the canonical lifecycle vocabulary) ----------- */

export type FlowStage =
  | 'direction' | 'recommendation' | 'founder_decision' | 'executive_assignment'
  | 'execution' | 'verification' | 'design_review' | 'accessibility_review'
  | 'architecture_review' | 'documentation' | 'institutional_memory'
  | 'house_register' | 'founder_briefing';

export interface FlowStageKind {
  id: FlowStage;
  label: string;
  /** Whether HOS v1 derives this stage from the live workflow. Inactive stages
      are the roadmap — defined here as the intended flow, never fabricated as
      events until the workflow genuinely produces them. */
  active: boolean;
}

/** The full institutional flow, in order. The review/documentation stages are
    defined but not yet active — they are the autonomous-operation roadmap. */
export const FLOW_STAGES: FlowStageKind[] = [
  { id: 'direction',            label: 'Direction',             active: true },
  { id: 'recommendation',       label: 'Recommendation',        active: true },
  { id: 'founder_decision',     label: 'Founder Decision',      active: true },
  { id: 'executive_assignment', label: 'Executive Assignment',  active: true },
  { id: 'execution',            label: 'Execution',             active: true },
  { id: 'verification',         label: 'Verification',          active: false },
  { id: 'design_review',        label: 'Design Review',         active: false },
  { id: 'accessibility_review', label: 'Accessibility Review',  active: false },
  { id: 'architecture_review',  label: 'Architecture Review',   active: false },
  { id: 'documentation',        label: 'Documentation',         active: false },
  { id: 'institutional_memory', label: 'Institutional Memory',  active: true },
  { id: 'house_register',       label: 'House Register',        active: true },
  { id: 'founder_briefing',     label: 'Founder Briefing',      active: true },
];

/** Where a matter stands in the institutional flow today — derived from its
    workflow status, using only stages the workflow actually reaches. */
export function currentStage(i: Initiative): FlowStage {
  switch (i.status) {
    case 'brief_ready': return 'founder_decision';
    case 'revising':    return 'recommendation';
    case 'paused':      return 'founder_decision';
    case 'executing':   return 'execution';
    case 'completed':   return 'institutional_memory';
    case 'declined':    return 'house_register';
    case 'archived':    return 'house_register';
    default:            return 'direction';
  }
}

/* --- the Founder interruption policy --------------------------------------- */

export type FounderReason =
  | 'strategic_decision' | 'creative_direction' | 'institutional_policy'
  | 'financial_approval' | 'legal_privacy' | 'irreversible_action'
  | 'conflicting_recommendations';

export interface FounderReasonKind { id: FounderReason; label: string; }

/** The only reasons Headquarters interrupts the Founder. Routine technical
    execution is never among them. */
export const FOUNDER_REASONS: FounderReasonKind[] = [
  { id: 'strategic_decision',          label: 'A strategic decision or approval' },
  { id: 'creative_direction',          label: 'Creative direction' },
  { id: 'institutional_policy',        label: 'Institutional policy' },
  { id: 'financial_approval',          label: 'Financial approval' },
  { id: 'legal_privacy',               label: 'A legal or privacy concern' },
  { id: 'irreversible_action',         label: 'An irreversible action' },
  { id: 'conflicting_recommendations', label: 'Conflicting executive recommendations' },
];

/** The reasons this matter genuinely needs the Founder. v1 derives the strategic
    decision from the authoritative attention interrupt boundary; the remaining
    reasons are the policy vocabulary, surfaced when the workflow raises them. */
export function founderReasonsFor(i: Initiative): FounderReason[] {
  return attentionKind(attentionForInitiative(i)).interrupts && i.status === 'brief_ready'
    ? ['strategic_decision'] : [];
}

/* --- a matter's standing: the composed institutional read ------------------ */

export interface NextStep { owner: string; action: string; }

/** Who moves next and what they do — the House coordinating itself, so the
    Founder never has to. */
export function nextStep(i: Initiative): NextStep {
  switch (i.status) {
    case 'brief_ready': return { owner: 'The Founder', action: 'Give your decision on the recommendation.' };
    case 'revising':    return { owner: 'The Executive Team', action: 'Preparing a fresh recommendation.' };
    case 'paused':      return { owner: 'The Founder', action: 'Resume the matter when you return.' };
    case 'executing':   return { owner: 'The Executive Team', action: 'Coordinating execution across the House.' };
    case 'completed':   return { owner: 'The Chief of Staff', action: 'Ready to brief you; confirm how it enters the House’s history.' };
    case 'declined':    return { owner: 'The House', action: 'Set aside, and kept in the record.' };
    case 'archived':    return { owner: 'The House', action: 'Recorded in the House’s history.' };
    default:            return { owner: 'The House', action: 'Underway.' };
  }
}

export interface MatterStanding {
  initiative: Initiative;
  stage: FlowStage;
  status: string;                 // institutional status (Institutional Memory — reused)
  attention: AttentionKind;       // Founder Attention — reused, never recomputed
  owners: string[];               // Execution ownership — reused
  next: NextStep;
  requiresFounder: boolean;       // the attention interrupt boundary
  founderReasons: FounderReason[];
  /** v1 has no failure/blocked state to recover from; recovery is on the roadmap. */
  blocked: boolean;
}

/** The full standing of one matter — composed from the authoritative engines. */
export function matterStanding(i: Initiative): MatterStanding {
  const attention = attentionKind(attentionForInitiative(i));
  return {
    initiative: i,
    stage: currentStage(i),
    status: institutionalStatus(i),
    attention,
    owners: executionResponsibilities(i).map((r) => executiveLabel(r.executive)),
    next: nextStep(i),
    requiresFounder: attention.interrupts,
    founderReasons: founderReasonsFor(i),
    blocked: false,
  };
}

/* --- the Headquarters state: the one institutional picture ------------------ */

export interface HeadquartersState {
  /** The single institutional voice (Founder Attention — reused). */
  attention: HouseAttention;
  standings: MatterStanding[];
  /** Matters genuinely needing the Founder now (the interrupt boundary). */
  awaitingJudgment: MatterStanding[];
  /** Matters proceeding independently — all parallel, none blocking another. */
  inMotion: MatterStanding[];
  /** Completed work the House is ready to brief. */
  readyToBrief: MatterStanding[];
  /** Settled institutional record (Institutional Memory partition). */
  record: MatterStanding[];
}

/**
 * The whole institutional picture, derived from the current matters. Pure and
 * recomputed on demand — deriving twice yields identical output. This is HOS
 * "continuously operating": every state change simply changes what this derives.
 */
export function deriveHeadquartersState(initiatives: Initiative[]): HeadquartersState {
  const { active, record } = partitionInitiatives(initiatives);
  const standings = initiatives.map(matterStanding);
  const activeStandings = active.map(matterStanding);
  return {
    attention: houseAttention(initiatives),
    standings,
    awaitingJudgment: activeStandings.filter((s) => s.requiresFounder),
    inMotion: activeStandings.filter((s) => !s.requiresFounder),
    readyToBrief: standings.filter((s) => s.initiative.status === 'completed'),
    record: record.map(matterStanding),
  };
}

/* --- the arrival brief: what the House already knows when the Founder enters - */

export interface ArrivalBrief {
  headline: string;              // the House's one calm line
  awaitingJudgment: string[];    // matters needing the Founder's word
  readyToBrief: string[];        // completed work ready to present
  continuing: string[];          // matters proceeding without her
}

/** The calm brief the Founder receives on arrival — assembled, never demanded.
    Titles only; the full story lives in the House Register. */
export function arrivalBrief(state: HeadquartersState): ArrivalBrief {
  const titles = (xs: MatterStanding[]) => xs.map((s) => s.initiative.title);
  return {
    headline: state.attention.kind.line,
    awaitingJudgment: titles(state.awaitingJudgment),
    readyToBrief: titles(state.readyToBrief),
    continuing: titles(state.inMotion),
  };
}
