/* =============================================================================
   EOS — Executive Judgment v0 (Phase II, Cognitive Layer — the Judgment half)

   Founder Attention v0 (M1) classifies institutional matters into the six
   dispositions from the queue's own fields. Judgment completes Phase II's
   Judgment faculty: "the reasoning that turns what is known about the FOUNDER
   into what reaches the Founder." It takes the M1 base view and adjusts *how*
   each matter reaches the Founder using the Founder's OWN preferences (Executive
   Memory, M2) and the present protection context (Executive Context, M3).

   ★ Boundaries (Executive Decision Constitution + Memory & Context Constitution):
     • Step 2 only — timing/framing. Judgment changes how/when a matter reaches
       the Founder, NEVER what the decision is. It mutates no Recommendation,
       creates no store and no parallel queue, and preserves provenance.
     • The six dispositions are preserved; an item can only move to another of the
       same six (always DOWN the salience order — softening, never escalation).
     • SAFETY FLOOR: 'urgent' (a critical matter) and 'approve' (a decision only
       the Founder may give) are IMMOVABLE. Personal state can never hide a
       decision or a critical matter (boundary: personal knowledge never justifies
       an institutional action).
     • The Founder OWNS the tuning; Judgment only APPLIES declared preferences —
       it never invents thresholds. Unrecognized preferences are inert.
     • Privacy: reads only Founder-owned preferences (standard privacy) and the
       present-period context (which already excludes personal/cross-domain).
       Reasons carry rule names + office tokens only — never a memory value — so
       the judged view is log-safe and no personal fact can leak.
   ============================================================================= */

import {
  deriveFounderAttention, attentionLineup, dispositionLabel, DISPOSITIONS,
  type Disposition, type FounderAttentionView, type AttentionGroup, type AttentionLine,
} from './executive-attention.ts';
import { loadWorkQueue, type QueueItem, type QueueSourceType } from './executive-work-queue.ts';
import { recall, type MemoryEntry } from './executive-memory.ts';
import { presentContext, type PresentContext } from './executive-context.ts';

/* --- the safety floor: dispositions Judgment may never suppress ------------ */

/** A critical matter and a Founder decision always reach the Founder, whatever
    the Founder's preferences or present context say. */
export const FLOOR_DISPOSITIONS: readonly Disposition[] = ['urgent', 'approve'];
export function isFloor(d: Disposition): boolean { return FLOOR_DISPOSITIONS.includes(d); }

/** Where a softened matter lands: aware, but no longer surfaced for action.
    Never 'ignore' — an institutional matter is never fully hidden by preference. */
const SOFTEN_TO: Disposition = 'inform';

/** The only band a tuning may soften: non-floor dispositions strictly more
    salient than the softening target. 'inform'/'ignore' are already at/below it,
    so softening them would ESCALATE — forbidden (softening only ever moves down). */
const SOFTENABLE: readonly Disposition[] = ['recommend', 'schedule'];

/* --- the Founder-declared tunings (data the Founder owns) ------------------ */

/** Recognized preference keys. Anything else in memory is inert here. */
export const PREF_ABSORB = 'attention.absorb'; // value = a QueueSourceType to hold back
export const PREF_QUIET  = 'attention.quiet';  // an active quiet/protected window

/** The tunings in force right now, distilled from Founder memory + present context. */
export interface AttentionTunings {
  absorbedSources: QueueSourceType[]; // matter kinds the Founder chose to absorb (awareness only)
  quiet: boolean;                     // a protected/low-availability window is active
}

/**
 * Read the active Founder tunings. Preferences and any active quiet window are
 * Founder-owned memory the Executive Manager merely applies. Pure over inputs.
 */
export function readTunings(entries: MemoryEntry[], now: Date = new Date()): AttentionTunings {
  const activePrefs = recall(entries, { class: 'preference' }, now);
  const absorbedSources = activePrefs
    .filter((e) => e.key === PREF_ABSORB)
    .map((e) => e.value as QueueSourceType);
  // A quiet window is any ACTIVE memory entry keyed as such (a durable preference
  // or an expiring "low energy through Thursday" — the present context governs its life).
  const ctx: PresentContext = presentContext(entries, now);
  const quiet = [...ctx.working, ...ctx.standing].some((e) => e.key === PREF_QUIET);
  return { absorbedSources, quiet };
}

/* --- the judged item and view --------------------------------------------- */

export interface JudgedItem {
  item: QueueItem;
  base: Disposition;       // what M1 derived from the institution alone
  effective: Disposition;  // what actually reaches the Founder after tuning
  softened: boolean;       // effective moved down from base
  /** Log-safe rule note — never a memory value. '' when unchanged. */
  reason: string;
}

export interface JudgedAttentionView {
  items: JudgedItem[];
  /** The Founder-facing line-up recomputed on EFFECTIVE dispositions (six, salience order). */
  lineup: AttentionLine[];
  /** Count of matters softened away from active surfacing by the Founder's own tunings. */
  softenedTotal: number;
}

/**
 * Decide the EFFECTIVE disposition for one base disposition under the tunings.
 * Softening only ever moves DOWN to 'inform', and never past the safety floor.
 */
function applyTunings(base: Disposition, item: QueueItem, t: AttentionTunings): { effective: Disposition; reason: string } {
  if (!SOFTENABLE.includes(base)) return { effective: base, reason: '' }; // floor / already low: untouched
  if (t.quiet)       return { effective: SOFTEN_TO, reason: 'quiet window active' };
  if (t.absorbedSources.includes(item.sourceType))
    return { effective: SOFTEN_TO, reason: `absorbed: ${item.sourceType}` };
  return { effective: base, reason: '' };
}

/**
 * Produce the memory-and-context-informed Founder Attention view — PURE and
 * idempotent. Reuses M1 for the base classification (never re-implements it),
 * regroups on the effective dispositions, and recomputes the line-up. Owns
 * nothing; mutates no item (a shallow judged wrapper is returned).
 */
export function judgeAttention(
  base: FounderAttentionView, tunings: AttentionTunings,
): JudgedAttentionView {
  const items: JudgedItem[] = base.items.map((it) => {
    const baseDisp = it.disposition;
    const { effective, reason } = applyTunings(baseDisp, it, tunings);
    // strip the M1 disposition tag; JudgedItem carries base/effective explicitly
    const { disposition: _drop, ...plain } = it;
    return { item: plain as QueueItem, base: baseDisp, effective, softened: effective !== baseDisp, reason };
  });

  // Group by EFFECTIVE disposition and hand M1's own line-up code the grouped
  // view — attentionLineup applies the canonical rank order and surface filter,
  // so there is no second ordering path here.
  const groups: AttentionGroup[] = DISPOSITIONS
    .map((d): AttentionGroup => ({
      disposition: d.id, label: dispositionLabel(d.id),
      items: items.filter((j) => j.effective === d.id).map((j) => j.item),
    }))
    .filter((g) => g.items.length > 0);
  const effectiveView: FounderAttentionView = { groups, items: [], surfacedTotal: 0 };

  return { items, lineup: attentionLineup(effectiveView), softenedTotal: items.filter((j) => j.softened).length };
}

/**
 * Convenience: the live judged view from the Work Queue (M1), Founder memory
 * (M2), and present context (M3). Read-only; touches no institutional store
 * directly and no personal-class memory value.
 */
export function loadJudgedAttention(entries: MemoryEntry[], now: Date = new Date()): JudgedAttentionView {
  const base = deriveFounderAttention(loadWorkQueue());
  return judgeAttention(base, readTunings(entries, now));
}
