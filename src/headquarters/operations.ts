/* =============================================================================
   OPERATIONS OFFICE — the flow derivation (pure, testable, no DOM).

   Milestone 4. The Operations Office answers a DIFFERENT executive question than
   the Executive Office / Founder's Desk. The Desk asks "what do I decide?" — one
   item at a time. Operations asks "is the House's work flowing well, and what is
   stalling?" — the system view, not the item view. It is the room of ALIGNMENT
   and TRACKING, not decision: it summarises and escalates; it never re-decides an
   item here (no duplicate workflow — that lives at the Desk / Editorial Office).

   This module holds ONLY the pure shaping of the existing Daily Briefing into a
   physical "standup board": the pipeline of work as a small set of ordered stages
   with counts. It reads no data and performs no I/O — main.ts fetches the briefing
   (the SAME `GET /api/headquarters/briefing` the scene already uses) and passes it
   here. No new endpoint, source of truth, or submission system is introduced.
   ============================================================================= */

import type { SubmissionStatus } from '../../shared/workflow.js';
import type { Briefing, BriefingItem } from './adapters.ts';

/**
 * The operations board's lanes. A COMPLETE, lifecycle-ordered partition of the
 * eight workflow statuses into five readable stages — every submission lands in
 * exactly one lane, so the board's total equals the spine's total (nothing is
 * silently dropped). This is a presentation grouping over the existing statuses,
 * distinct from the founder's decision groupings on the Desk: the board reads as
 * FLOW (left → right, as work advances through the House), not as a queue to act
 * on. The single "awaiting a decision" escalation is surfaced separately and
 * routes to the Desk — Operations points at the work; it does not perform it.
 */
export interface OperationsStage {
  id: string;
  label: string;
  /** One quiet line naming the phase (furniture, not a tooltip of jargon). */
  note: string;
  statuses: SubmissionStatus[];
}

export const OPERATIONS_STAGES: OperationsStage[] = [
  { id: 'arriving',      label: 'Arriving',      note: 'Newly through the door',
    statuses: ['draft', 'sent_for_review'] },
  { id: 'in_review',     label: 'Being Considered', note: 'In the editors’ hands',
    statuses: ['under_review'] },
  { id: 'with_creators', label: 'With the Maker', note: 'Out for revisions',
    statuses: ['changes_requested'] },
  { id: 'ready',         label: 'Ready',         note: 'Cleared for publication',
    statuses: ['approved', 'scheduled'] },
  { id: 'resolved',      label: 'At Rest',       note: 'Published or gently closed',
    statuses: ['published', 'not_accepted'] },
];

/** A single lane, with its resolved count for the board. */
export interface FlowStage {
  id: string;
  label: string;
  note: string;
  count: number;
}

/** The whole board, derived. Everything here comes from the existing briefing. */
export interface OperationsFlow {
  stages: FlowStage[];
  /** Total across all lanes — equals the spine total for a complete partition. */
  total: number;
  /** In motion (open) vs. resolved — the "is work flowing" summary. */
  inMotion: number;
  resolved: number;
  /** How many need a founder decision now — the single escalation → the Desk. */
  awaiting: number;
  /** The longest-waiting item among those awaiting a decision (or null). */
  oldest: BriefingItem | null;
  /** The busiest lane's id (most work sitting in it), or null when the board is empty. */
  busiestId: string | null;
}

/**
 * Shape the briefing into the operations board. Pure: no I/O, no clock, no DOM.
 * Counts come from `briefing.counts.byStatus`; `inMotion`/`resolved`/`awaiting`
 * and `oldest` are read straight from the briefing's own explicit categories, so
 * the board can never disagree with the scene's Daily Briefing.
 */
export function operationsFlow(briefing: Briefing): OperationsFlow {
  const byStatus = briefing?.counts?.byStatus ?? {};

  const stages: FlowStage[] = OPERATIONS_STAGES.map((stage) => ({
    id: stage.id,
    label: stage.label,
    note: stage.note,
    count: stage.statuses.reduce((sum, status) => sum + (byStatus[status] ?? 0), 0),
  }));

  const total = stages.reduce((sum, s) => sum + s.count, 0);

  // The busiest lane (ties resolve to the earlier lane in lifecycle order); null
  // when there is no work at all, so the render can stay honestly empty.
  let busiestId: string | null = null;
  let busiestCount = 0;
  for (const s of stages) {
    if (s.count > busiestCount) { busiestCount = s.count; busiestId = s.id; }
  }

  return {
    stages,
    total,
    inMotion: briefing?.open ?? 0,
    resolved: briefing?.resolved ?? 0,
    awaiting: briefing?.awaitingReview ?? 0,
    oldest: briefing?.oldestAwaiting ?? null,
    busiestId,
  };
}
