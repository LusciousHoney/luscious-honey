/* =============================================================================
   Founder Attention System — the House's single institutional decision about
   when it should interrupt the Founder, and when it should continue working on
   its own.

   This is NOT notifications, an inbox, or a badge system. It is the ONE
   authoritative model of Founder attention that every executive capability
   shares — Executive Workflow, the Execution Layer, Executive Memory, the
   Institutional Timeline, any Dashboard, and future autonomous executives.

   ★ Shape of the capability:
     • A closed vocabulary of attention STATES with a fixed priority order.
     • Pure derivation and pure resolution — no persistence, timers, polling,
       APIs, or notifications. State is DERIVED, never assigned or stored.
     • Domain-agnostic core: any capability maps its own objects to a state and
       lets `resolveAttention` pick the single highest across the House. The
       Chief of Staff owns institutional attention; individual executives never
       interrupt the Founder — every signal resolves into one calm voice.
   ============================================================================= */

/** The House's attention, in calm institutional language. Ordered highest → lowest. */
export type AttentionState =
  | 'decision_required'   // the House cannot continue without the Founder's judgment
  | 'review_needed'       // an executive recommends review soon; execution may continue
  | 'completed'           // meaningful work has concluded; the House is ready to brief
  | 'working';            // the House is executing independently; no action required

export interface AttentionKind {
  id: AttentionState;
  /** 0 = highest priority (decision_required) … 3 = lowest (working). */
  rank: number;
  /** The Founder-facing name of the state. */
  label: string;
  /** The House's one calm sentence for this state. */
  line: string;
  /** Whether this state warrants interrupting the Founder now (vs. awaiting her return). */
  interrupts: boolean;
}

/** The authoritative states, in priority order. This table is the single source
    of truth for attention language and precedence across Headquarters. */
export const ATTENTION_STATES: AttentionKind[] = [
  { id: 'decision_required', rank: 0, label: 'Founder Decision Required',
    line: 'The House is ready for your judgment.', interrupts: true },
  { id: 'review_needed', rank: 1, label: 'Review Needed',
    line: 'The Executive Team recommends your review.', interrupts: true },
  { id: 'completed', rank: 2, label: 'Completed',
    line: 'The House has concluded this work and is ready to brief you.', interrupts: false },
  { id: 'working', rank: 3, label: 'Working',
    line: 'The House is continuing its work. No Founder attention is currently required.', interrupts: false },
];

const KIND_BY_ID = new Map(ATTENTION_STATES.map((k) => [k.id, k]));

/** The full descriptor for a state — its label, line, rank, and interrupt rule. */
export function attentionKind(state: AttentionState): AttentionKind {
  return KIND_BY_ID.get(state) ?? ATTENTION_STATES[ATTENTION_STATES.length - 1];
}

/** The rank of a state (0 = highest). Lower wins. */
export function attentionRank(state: AttentionState): number {
  return attentionKind(state).rank;
}

/** The higher-priority of two states (the one that would reach the Founder first). */
export function higherAttention(a: AttentionState, b: AttentionState): AttentionState {
  return attentionRank(a) <= attentionRank(b) ? a : b;
}

/**
 * Resolve many attention signals into the ONE state the House presents. Exactly
 * one highest-priority state exists at a time (the blocking rule) — so the
 * Founder hears a single institutional voice, never a pile of alerts. An empty
 * set means nothing is in motion: the House is 'working' (at rest).
 */
export function resolveAttention(states: AttentionState[]): AttentionState {
  return states.reduce<AttentionState>(higherAttention, 'working');
}
