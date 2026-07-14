/* =============================================================================
   EXECUTIVE TEAM HEADQUARTERS — time-of-day foundation (pure).

   The residence is permanently set to the first morning of summer — the WARMTH
   never changes. Time of day is an ambient inflection only: it shifts the
   quality of light and the greeting, and NOTHING functional. It must never
   change text contrast, control visibility, access to work, or data meaning
   (Build Bible §10.1).

   This module is pure and DOM-free so it can be unit-tested. The presentation
   layer reads the returned state and reflects it on <html data-tod>.
   ============================================================================= */

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'late';

/**
 * Map a local hour (0–23) to an ambient light state.
 *   morning   05–11  · the canonical first-of-summer light; the daily default
 *   afternoon 12–16  · high, even light — the Afternoon Reset
 *   evening   17–21  · Golden Hour; limestone turns amber
 *   late      22–04  · lamplight; the residence in quiet standby
 */
export function timeOfDay(date: Date = new Date()): TimeOfDay {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'late';
}

/** The warm greeting for each light state (presentation copy only). */
export function greeting(tod: TimeOfDay): string {
  switch (tod) {
    case 'morning':   return 'Good morning';
    case 'afternoon': return 'Good afternoon';
    case 'evening':   return 'Good evening';
    case 'late':      return 'Still here';
  }
}

/** A calendar-day key (local time) — the unit the once-a-day arrival is keyed to. */
export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
