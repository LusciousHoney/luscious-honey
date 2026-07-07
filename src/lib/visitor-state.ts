/* =============================================================================
   VISITOR STATE — first arrival vs returning.
   Sprint 04 · Part V: first visit gets the 4–5s Spine Reveal; returning skips
   the light-up and settles at the desk. This is presentation only — it is NOT
   identity, auth, or tracking. A single local flag, nothing more.
   ============================================================================= */

const KEY = 'lhc.visited';

export type Visitor = 'first' | 'returning';

/** Pure: decide from a raw stored value. Testable without storage. */
export function visitorFrom(stored: string | null): Visitor {
  return stored ? 'returning' : 'first';
}

export function getVisitor(): Visitor {
  try {
    return visitorFrom(localStorage.getItem(KEY));
  } catch {
    // Private mode / storage blocked → treat as first, never crash arrival.
    return 'first';
  }
}

export function markVisited(): void {
  try {
    localStorage.setItem(KEY, new Date().toISOString());
  } catch {
    /* no-op: storage unavailable */
  }
}
