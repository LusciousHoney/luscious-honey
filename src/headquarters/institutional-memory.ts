/* =============================================================================
   Institutional Timeline + Executive Memory v1 — how the House remembers its
   own work.

   This is institutional memory, not an activity log. It does NOT store a second
   copy of the initiative: it is a pure DERIVATION over the one initiative record
   (executive-workflow.ts), reusing the authoritative Founder Attention model and
   the Execution ownership derivation. It records facts (event kind + timestamp),
   never rendered sentences — Founder-facing language is derived on read.

   ★ Persistence boundary (V1): initiatives live in browser localStorage, the
   same store the workflow already uses. This is local-first, per-browser memory
   — NOT cross-device institutional persistence. A durable store (e.g. D1) is a
   later decision; nothing here pretends otherwise.

   ★ Schema: the timeline is derived from data the initiative already holds —
   createdAt, the Founder decision, and (added minimally) completedAt/archivedAt,
   the two milestone times the lifecycle would otherwise overwrite. Legacy
   records that predate those fields fall back to updatedAt, so every stored
   initiative — old or new — still yields a full, ordered chronology.
   ============================================================================= */

import {
  attentionForInitiative, executionResponsibilities,
  type Initiative, type InitiativeStatus, type ExecutiveResponsibility,
} from './executive-workflow.ts';
import { attentionKind, type AttentionKind } from './founder-attention.ts';

/* --- the lifecycle vocabulary (only milestones the real workflow produces) -- */

export type TimelineEventKind =
  | 'received' | 'coordinated' | 'brief_prepared'
  | 'approved' | 'revision_requested' | 'paused' | 'declined'
  | 'assumed_responsibility' | 'completed' | 'archived';

export interface TimelineEvent {
  kind: TimelineEventKind;
  at: string;            // ISO timestamp of the milestone
  detail?: string;       // a factual note (the Founder's note, the disposition) — never rendered copy
}

/* --- the institutional status, in calm House language --------------------- */

const STATUS_LABEL: Record<InitiativeStatus, string> = {
  brief_ready: 'Awaiting your judgment',
  approved:    'Approved',
  revising:    'With the Executive Team for revision',
  paused:      'Paused at your word',
  declined:    'Declined',
  executing:   'In motion',
  completed:   'Completed — ready to brief you',
  archived:    'In the House’s history',
};
export function institutionalStatus(i: Initiative): string { return STATUS_LABEL[i.status]; }

/* --- the chronology: derived, ordered, deterministic ---------------------- */

/**
 * The ordered institutional timeline of an initiative — derived, never stored as
 * a growing log, so it cannot duplicate on reload. Intake is three real acts of
 * the House at the moment it received the matter; the decision and the tail come
 * from the recorded times (with updatedAt as the legacy fallback).
 */
export function initiativeTimeline(i: Initiative): TimelineEvent[] {
  const events: TimelineEvent[] = [
    { kind: 'received', at: i.createdAt },
    { kind: 'coordinated', at: i.createdAt },
    { kind: 'brief_prepared', at: i.createdAt },
  ];

  if (i.decision) {
    const at = i.decision.at;
    const note = i.decision.note;
    switch (i.decision.decision) {
      case 'approve':
        events.push({ kind: 'approved', at });
        events.push({ kind: 'assumed_responsibility', at });
        break;
      case 'revise':  events.push({ kind: 'revision_requested', at, detail: note }); break;
      case 'pause':   events.push({ kind: 'paused', at, detail: note }); break;
      case 'decline': events.push({ kind: 'declined', at, detail: note }); break;
    }
  }

  if (i.status === 'completed' || i.status === 'archived') {
    events.push({ kind: 'completed', at: i.completedAt ?? i.updatedAt, detail: completionOutcome(i) });
  }
  if (i.status === 'archived') {
    events.push({ kind: 'archived', at: i.archivedAt ?? i.updatedAt, detail: i.history?.chosen });
  }

  // Stable order by time; ties keep the order above (received → … → archived).
  return events
    .map((e, idx) => ({ e, idx }))
    .sort((a, b) => a.e.at.localeCompare(b.e.at) || a.idx - b.idx)
    .map(({ e }) => e);
}

/** Derive the Founder-facing line for a structural event. Language lives here,
    on read — never in the stored data. */
export function timelineEventLine(e: TimelineEvent): string {
  switch (e.kind) {
    case 'received':               return 'You brought this to the House.';
    case 'coordinated':            return 'The Chief of Staff coordinated the Executive Team.';
    case 'brief_prepared':         return 'The Executive Team prepared its recommendation.';
    case 'approved':               return 'You approved the direction.';
    case 'revision_requested':     return e.detail ? `You requested a revision — “${e.detail}”.` : 'You requested a revision.';
    case 'paused':                 return 'You paused the matter.';
    case 'declined':               return 'You declined.';
    case 'assumed_responsibility': return 'The House assumed responsibility.';
    case 'completed':              return e.detail ? `The House completed the work — ${e.detail}` : 'The House completed the work.';
    case 'archived':               return 'Entered into the House’s history.';
  }
}

/* --- the completion outcome: derived from what the House actually prepared -- */

/**
 * A concise institutional outcome, derived from the work the House prepared —
 * the Founder never writes a report. Falls back to the executives who held
 * responsibility when there are no concrete deliverables.
 */
export function completionOutcome(i: Initiative): string {
  const d = i.brief.recommendedDeliverables.filter((x) => x.toLowerCase() !== 'creative direction');
  if (d.length > 0) return `${joinHouse(d)} prepared for your review.`;
  const held = executionResponsibilities(i).map((r) => r.executive);
  return held.length > 0 ? 'Direction and coordination completed by the Executive Team.' : 'Work concluded.';
}

function joinHouse(xs: string[]): string {
  if (xs.length === 1) return xs[0];
  if (xs.length === 2) return `${xs[0]} and ${xs[1]}`;
  return `${xs.slice(0, -1).join(', ')}, and ${xs[xs.length - 1]}`;
}

/* --- the executive memory record (a read model, not a second source) ------- */

export interface MemoryRecord {
  initiative: Initiative;
  title: string;
  direction: string;                       // the Founder's original words
  status: string;                          // calm institutional status
  attention: AttentionKind;                // the authoritative attention state (not recomputed here)
  responsibilities: ExecutiveResponsibility[]; // reuse of the live execution derivation
  timeline: TimelineEvent[];
  outcome?: string;                        // present once completed
  disposition?: string;                    // the chosen entry into history, once archived
}

/** Assemble one initiative into a readable institutional record — the whole
    story in one place. Purely derived; owns nothing. */
export function initiativeRecord(i: Initiative): MemoryRecord {
  const completed = i.status === 'completed' || i.status === 'archived';
  return {
    initiative: i,
    title: i.title,
    direction: i.founderInput,
    status: institutionalStatus(i),
    attention: attentionKind(attentionForInitiative(i)),
    responsibilities: executionResponsibilities(i),
    timeline: initiativeTimeline(i),
    outcome: completed ? completionOutcome(i) : undefined,
    disposition: i.status === 'archived' ? i.history?.chosen : undefined,
  };
}

/* --- the two modes: matters in motion vs. the institutional record --------- */

const RECORD_STATUSES = new Set<InitiativeStatus>(['completed', 'archived', 'declined']);

/** Split initiatives into the two calm modes the Founder encounters: matters
    still moving through the House, and the settled institutional record. */
export function partitionInitiatives(initiatives: Initiative[]): { active: Initiative[]; record: Initiative[] } {
  const active: Initiative[] = [];
  const record: Initiative[] = [];
  for (const i of initiatives) (RECORD_STATUSES.has(i.status) ? record : active).push(i);
  return { active, record };
}
