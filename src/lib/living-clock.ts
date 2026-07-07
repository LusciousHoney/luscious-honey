/* =============================================================================
   THE LIVING CLOCK — Sprint 04 · Part V + Part VIII.
   Reflects the visitor's REAL time of day. Changes atmosphere only — never
   architecture or content truth. Time-state logic is kept separate from
   presentation (this module returns data; presentation reads it).
   ============================================================================= */

export type TimeState = 'morning' | 'afternoon' | 'evening' | 'late';

export interface ClockState {
  tod: TimeState;
  /** 0..1 warmth scalar the presentation layer maps to light temperature. */
  warmth: number;
  /** Time-aware greeting, in the house voice (Newsreader italic). */
  greeting: string;
  /** Machine label for meta lines, e.g. "Sunday · evening". */
  label: string;
}

/** Pure: hour (0–23) → TimeState. Testable without a clock. */
export function stateForHour(hour: number): TimeState {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 23) return 'evening';
  return 'late'; // 23:00–04:59
}

/** Greetings are micro-copy within the established voice (Part IX permits). */
const GREETINGS: Record<TimeState, string> = {
  morning: 'Good morning. The house is waking.',
  afternoon: 'Good afternoon. The work is underway.',
  evening: 'Good evening. The studio is still lit.',
  late: 'It’s late. A lamp is still on.',
};

/** Warmth scalar per state — warmest at night, coolest at midday. */
const WARMTH: Record<TimeState, number> = {
  morning: 0.55,
  afternoon: 0.35,
  evening: 0.85,
  late: 1,
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Pure: build a full ClockState from a Date. Testable by passing a fixed Date. */
export function clockStateFor(date: Date): ClockState {
  const tod = stateForHour(date.getHours());
  return {
    tod,
    warmth: WARMTH[tod],
    greeting: GREETINGS[tod],
    label: `${WEEKDAYS[date.getDay()]} · ${tod}`,
  };
}

export function currentClockState(): ClockState {
  return clockStateFor(new Date());
}

/**
 * Apply the clock to the document as atmosphere only. Sets a data attribute
 * (for CSS state hooks) and the warmth scalar variable. Never moves geometry.
 */
export function applyClock(state: ClockState, root: HTMLElement = document.documentElement): void {
  root.dataset.tod = state.tod;
  root.style.setProperty('--clock-warmth', String(state.warmth));
}
