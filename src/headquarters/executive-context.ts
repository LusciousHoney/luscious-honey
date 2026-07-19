/* =============================================================================
   EOS — Executive Context v0 (Milestone 3, Cognitive Layer)

   The Executive Manager's working memory of the PRESENT PERIOD: the coherent
   "now" the Founder is in — this week's priorities, the active matter, the
   constraint that lapses on Thursday. Per the Executive Memory & Context
   Constitution (Doc 1), context is temporary and expiring by nature: it exists
   to make the present coherent and is expected to fade.

   This is a pure, read-only DERIVATION over Executive Memory (Milestone 2) —
   exactly as the Work Queue is a derivation over Recommendations. It owns
   nothing, writes nothing, and imports no institutional store. Models before
   surfaces: no UI (Roadmap Phase II is pure logic).

   ★ Invariants enforced here:
     • Owns no store — reads only the Founder-owned Executive Memory store.
     • Reads no institution — knows nothing of Recommendations/Register/Archive.
     • The present period is exactly the two classes Doc 1 names for it —
       'temporary' and 'expiring'; durable facts ('long_term'/'preference')
       frame it but are not the working set.
     • Stale context misleads: nothing expired is ever surfaced, and what is
       about to lapse is surfaced BEFORE it does.
     • Pure and idempotent: deriving twice yields identical output.
   ============================================================================= */

import {
  activeMemory, isExpired, loadMemory,
  type MemoryEntry, type MemoryClass,
} from './executive-memory.ts';

/* --- what "the present period" is (Doc 1) --------------------------------- */

/** The classes that constitute the working memory of the current period. */
export const WORKING_CLASSES: readonly MemoryClass[] = ['temporary', 'expiring'];
/** The durable classes that FRAME the present without being part of it. */
export const STANDING_CLASSES: readonly MemoryClass[] = ['preference', 'long_term'];

/** Default horizon for "about to lapse": 72 hours. Passed explicitly in tests. */
export const EXPIRING_SOON_MS = 72 * 60 * 60 * 1000;

const isWorking = (e: MemoryEntry) => WORKING_CLASSES.includes(e.class);
const isStanding = (e: MemoryEntry) => STANDING_CLASSES.includes(e.class);
const byCapturedDesc = (a: MemoryEntry, b: MemoryEntry) => b.capturedAt.localeCompare(a.capturedAt);
const byExpiryAsc = (a: MemoryEntry, b: MemoryEntry) => (a.expiresAt ?? '').localeCompare(b.expiresAt ?? '');

/**
 * True when an active working entry carries an expiry that falls within the
 * horizon — surfaced so it is seen before it lapses (Doc 1: "retaining it past
 * its life is itself an error, because stale context misleads").
 */
export function isExpiringSoon(e: MemoryEntry, now: Date = new Date(), windowMs: number = EXPIRING_SOON_MS): boolean {
  if (!e.expiresAt || isExpired(e, now)) return false;
  return e.expiresAt <= new Date(now.getTime() + windowMs).toISOString();
}

/* --- the present context view --------------------------------------------- */

export interface PresentContext {
  now: string;                   // the moment this context was derived
  working: MemoryEntry[];        // active temporary + expiring, most-recent first
  expiringSoon: MemoryEntry[];   // working entries lapsing within the horizon, soonest first
  standing: MemoryEntry[];       // active preferences + long-term facts that frame the present
  counts: { working: number; expiringSoon: number; standing: number };
}

/**
 * Assemble the working context of the present period from Executive Memory.
 * Pure: filters/sorts over the input; deriving twice yields deep-equal output.
 * Nothing expired appears; what is about to lapse is called out separately.
 */
export function presentContext(
  entries: MemoryEntry[], now: Date = new Date(), windowMs: number = EXPIRING_SOON_MS,
): PresentContext {
  const live = activeMemory(entries, now);
  const working = live.filter(isWorking).sort(byCapturedDesc);
  const expiringSoon = working.filter((e) => isExpiringSoon(e, now, windowMs)).sort(byExpiryAsc);
  const standing = live.filter(isStanding).sort(byCapturedDesc);
  return {
    now: now.toISOString(),
    working, expiringSoon, standing,
    counts: { working: working.length, expiringSoon: expiringSoon.length, standing: standing.length },
  };
}

/**
 * Convenience: derive the present context from the live Executive Memory store.
 * Reads the Founder-owned store only; no institutional store is touched. The
 * pure core (presentContext) is what unit tests exercise, with no storage.
 */
export function loadPresentContext(now: Date = new Date(), windowMs: number = EXPIRING_SOON_MS): PresentContext {
  return presentContext(loadMemory(), now, windowMs);
}
