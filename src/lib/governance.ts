/* =============================================================================
   CONTENT GOVERNANCE — the truthful operational rules, as pure functions.
   Sprint 04 · Part VIII. No data, no Vite, no DOM here — so these rules are
   unit-testable in plain Node. The House never fakes activity:
     • Journal      — manual publishing only; if none new, the last published stays.
     • Writing Wall — manual curation; exactly one fragment; else the wall rests.
     • Held Frame   — manual selection; one frame; else it rests.
     • Everything   — only `status: 'published'` is ever shown. Default to rest.
   ============================================================================= */

import type { JournalEntry, Fragment, HeldFrame, Work, Governed } from './content-types';

export function isPublished(item: Governed): boolean {
  return item.status === 'published';
}

/** Convert a Date to a local "YYYY-MM-DD" string for window comparisons. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Inclusive window test; an open-ended bound is treated as unbounded. */
export function inWindow(iso: string, from?: string, until?: string): boolean {
  if (from && iso < from) return false;
  if (until && iso > until) return false;
  return Boolean(from || until); // a scheduled fragment must define a window
}

/* --- House Journal ------------------------------------------------------- */

/** All published entries, newest first. Supports archive growth. */
export function selectJournalArchive(entries: JournalEntry[]): JournalEntry[] {
  return entries.filter(isPublished).sort((a, b) => b.date.localeCompare(a.date));
}

/** The latest published entry; if none new, the last published one stays. */
export function selectLatestJournal(entries: JournalEntry[]): JournalEntry | undefined {
  return selectJournalArchive(entries)[0];
}

/* --- Writing Wall -------------------------------------------------------- */

/**
 * Exactly one fragment, or none (the wall rests). Manual `active` wins; else a
 * scheduled fragment whose window contains `now`. Draft/unpublished never show.
 */
export function selectActiveFragment(fragments: Fragment[], now: Date): Fragment | undefined {
  const published = fragments.filter(isPublished);
  const manual = published.find((f) => f.active);
  if (manual) return manual;
  const today = toISODate(now);
  return published.find((f) => inWindow(today, f.showFrom, f.showUntil));
}

/* --- Held Frame ---------------------------------------------------------- */

/** The single manually-selected held frame (latest published week), or none. */
export function selectCurrentHeldFrame(frames: HeldFrame[]): HeldFrame | undefined {
  return frames
    .filter(isPublished)
    .sort((a, b) => b.week - a.week || (b.date ?? '').localeCompare(a.date ?? ''))[0];
}

/* --- Editorial works ----------------------------------------------------- */

/** Published works — featured first, then newest. */
export function selectPublishedWorks(works: Work[]): Work[] {
  return works
    .filter(isPublished)
    .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) ||
                    b.date.localeCompare(a.date));
}

/**
 * Format an ISO date-only string ("YYYY-MM-DD") as a house date in LOCAL time.
 * `new Date("2026-07-05")` parses as UTC midnight and can render as the previous
 * day in western timezones — so we build the date from its parts.
 */
export function formatHouseDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}
