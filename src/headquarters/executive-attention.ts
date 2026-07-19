/* =============================================================================
   EOS — Founder Attention v0 (Milestone 1)

   The Executive Manager's signature faculty: deciding *what reaches the Founder*.
   A pure, read-only PROJECTION over the already-derived Executive Work Queue —
   it classifies existing queue items into the six attention dispositions of the
   Founder Attention Model (Executive Manager Constitution, Article VII).

   ★ Like the Work Queue itself, this layer OWNS NOTHING and STORES NOTHING.
   It reads the queue, never a store; it mutates no Recommendation; it creates
   no parallel queue and no parallel decision record. Provenance rides along
   unchanged on each item. Deriving twice from the same queue yields identical
   output.

   Institution-only for Milestone 1: the worlds (Personal / WEA / Travel /
   cross-world) are NOT here — they arrive in the Roadmap's World Layer.
   ============================================================================= */

import { loadWorkQueue, type QueueItem } from './executive-work-queue.ts';

/* --- the six dispositions ------------------------------------------------- */

/** The Founder Attention Model's six dispositions, most-salient first.
    Ordering is stable and meaningful: urgent → approve → recommend → schedule →
    inform → ignore. It never runs the other way. */
export type Disposition = 'urgent' | 'approve' | 'recommend' | 'schedule' | 'inform' | 'ignore';

export interface DispositionKind {
  id: Disposition;
  rank: number;          // 0 = most salient (urgent) … 5 = least (ignore)
  /** Founder-facing label — calm, residence tone; never alarming. */
  label: string;
  /** Whether this disposition is surfaced in the Executive Office summary.
      'ignore' is absorbed by design and never shown. */
  surface: boolean;
}

export const DISPOSITIONS: DispositionKind[] = [
  { id: 'urgent',    rank: 0, label: 'Need you now',          surface: true  },
  { id: 'approve',   rank: 1, label: 'For your decision',     surface: true  },
  { id: 'recommend', rank: 2, label: 'For your review',       surface: true  },
  { id: 'schedule',  rank: 3, label: 'For when you have time', surface: true  },
  { id: 'inform',    rank: 4, label: 'For your awareness',    surface: true  },
  { id: 'ignore',    rank: 5, label: 'No action needed',      surface: false },
];

const DISPOSITION_BY_ID = new Map(DISPOSITIONS.map((d) => [d.id, d]));
export function dispositionLabel(id: Disposition): string { return DISPOSITION_BY_ID.get(id)?.label ?? id; }
function dispositionRank(id: Disposition): number { return DISPOSITION_BY_ID.get(id)?.rank ?? 9; }

/* --- classification ------------------------------------------------------- */

/**
 * Classify a single queue item into a Founder Attention disposition — PURE and
 * deterministic, derived only from fields the item already carries (status,
 * office, priority, requiredAction, dueState). It never reads a store, never
 * invents urgency from missing data, and never escalates on ambiguity: the
 * defaults move *down* the salience order, never up.
 *
 * The mapping is exactly the Milestone 1 specification:
 *   - hidden                                   → ignore (absorbed, never surfaced)
 *   - completed                                → inform (recently finished; FYI)
 *   - waiting (in motion elsewhere)            → inform (awareness, not action)
 *   - actionable & office=founder & critical   → urgent
 *   - actionable & office=founder & 'Awaiting Founder' → approve (a decision)
 *   - actionable & office=founder & due 'soon' → schedule
 *   - actionable & office=founder (otherwise)  → recommend (prepared; needs judgement)
 *   - actionable & owned by another office     → inform (someone else acts)
 *
 * Note on urgency vs importance: only a *critical* item the Founder must act on
 * now becomes 'urgent'. A merely important decision is 'approve' or 'recommend'.
 * Waiting work stays visible as 'inform' and is never treated as urgent.
 */
export function classifyAttention(item: QueueItem): Disposition {
  // Absorbed / already-represented work is never Founder-facing noise.
  if (item.status === 'hidden') return 'ignore';
  if (item.status === 'completed') return 'inform';
  if (item.status === 'waiting') return 'inform';

  // status === 'actionable' from here.
  if (item.office === 'founder') {
    if (item.priority === 'critical') return 'urgent';
    if (item.requiredAction === 'Awaiting Founder') return 'approve';
    if (item.dueState === 'soon') return 'schedule';
    return 'recommend';
  }

  // Actionable, but owned by a Chair/office — the Founder is only made aware.
  return 'inform';
}

/* --- the derived Founder-facing view -------------------------------------- */

export interface AttentionGroup {
  disposition: Disposition;
  label: string;
  items: QueueItem[];
}

export interface FounderAttentionView {
  /** Groups in stable salience order (urgent → ignore); empty groups omitted. */
  groups: AttentionGroup[];
  /** Every classified item, ordered by disposition salience then the queue's own
      order (priority then recency, as the Work Queue already sorts). */
  items: (QueueItem & { disposition: Disposition })[];
  /** Count of items the Founder is actually surfaced (excludes 'ignore'). */
  surfacedTotal: number;
}

/**
 * Derive the whole Founder Attention view from a set of queue items — PURE and
 * idempotent. The incoming order is preserved within each disposition (the Work
 * Queue has already sorted by priority then recency), and provenance rides along
 * untouched. No item is mutated; a shallow tag is added to the flattened list.
 */
export function deriveFounderAttention(queueItems: QueueItem[]): FounderAttentionView {
  const byDisposition = new Map<Disposition, QueueItem[]>();
  for (const d of DISPOSITIONS) byDisposition.set(d.id, []);
  for (const item of queueItems) {
    byDisposition.get(classifyAttention(item))!.push(item);
  }

  const groups: AttentionGroup[] = DISPOSITIONS
    .filter((d) => byDisposition.get(d.id)!.length > 0)
    .map((d) => ({ disposition: d.id, label: d.label, items: byDisposition.get(d.id)! }));

  const items = groups.flatMap((g) => g.items.map((it) => ({ ...it, disposition: g.disposition })));

  const surfacedTotal = groups
    .filter((g) => DISPOSITION_BY_ID.get(g.disposition)!.surface)
    .reduce((n, g) => n + g.items.length, 0);

  return { groups, items, surfacedTotal };
}

/* --- concise summary line-up (for the Executive Office readout) ------------ */

export interface AttentionLine { disposition: Disposition; label: string; count: number; }

/**
 * The surfaced dispositions with a positive count, in salience order — the exact
 * shape the Executive Office summary renders. Keeps classification/ordering logic
 * out of the rendering code. 'ignore' is never included.
 */
export function attentionLineup(view: FounderAttentionView): AttentionLine[] {
  return view.groups
    .filter((g) => DISPOSITION_BY_ID.get(g.disposition)!.surface)
    .sort((a, b) => dispositionRank(a.disposition) - dispositionRank(b.disposition))
    .map((g) => ({ disposition: g.disposition, label: g.label, count: g.items.length }));
}

/** Convenience: derive the Founder Attention view from the live Work Queue
    (which reads Recommendations and the pipeline). Read-only, owns nothing. */
export function loadFounderAttention(): FounderAttentionView {
  return deriveFounderAttention(loadWorkQueue());
}
