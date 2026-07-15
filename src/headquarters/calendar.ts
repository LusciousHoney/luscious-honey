/* =============================================================================
   HEADQUARTERS CALENDAR — a shared scheduling SERVICE (not a room) (Usability
   sprint). Architecture only: an event model, calendar categories, room-scoped
   filtering, and a scheduling workflow. Architected for future Google Calendar
   integration but NO API is called here. Events the founder schedules are the
   founder's own (never fabricated) and persist client-side in localStorage —
   consistent with the existing Headquarters memory (no backend, DB, or migration).
   ============================================================================= */

import type { RoomId } from './rooms.ts';

/** The eight calendar categories. `room` maps a category to the office whose
    filtered view surfaces it (null = residence-wide, shown everywhere). */
export interface CalendarCategory { id: string; label: string; room: RoomId | null; }
export const CALENDAR_CATEGORIES: CalendarCategory[] = [
  { id: 'founder',     label: 'Founder',      room: 'executive' },
  { id: 'editorial',   label: 'Editorial',    room: 'creative' },
  { id: 'production',  label: 'Production',    room: 'production' },
  { id: 'publishing',  label: 'Publishing',   room: 'operations' },
  { id: 'growth',      label: 'Growth',       room: 'growth' },
  { id: 'business',    label: 'Business',      room: 'business' },
  { id: 'live',        label: 'LIVE Events',  room: null },
  { id: 'focus',       label: 'Focus Time',   room: 'executive' },
];
const CAT_IDS = new Set(CALENDAR_CATEGORIES.map((c) => c.id));

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;       // ISO 'YYYY-MM-DD'
  category: string;   // one of CALENDAR_CATEGORIES ids
  note?: string;
}

/** Categories relevant to a given room's filtered view (its own + residence-wide). */
export function categoriesForRoom(room: RoomId): CalendarCategory[] {
  return CALENDAR_CATEGORIES.filter((c) => c.room === room || c.room === null);
}

/** Events for a room's view: those whose category maps to the room (or is shared). */
export function eventsForRoom(events: CalendarEvent[], room: RoomId): CalendarEvent[] {
  const ids = new Set(categoriesForRoom(room).map((c) => c.id));
  return sortByDate(events.filter((e) => ids.has(e.category)));
}

export function sortByDate(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

/** Upcoming events on or after `today` (ISO), soonest first. */
export function upcoming(events: CalendarEvent[], today: string, limit = 20): CalendarEvent[] {
  return sortByDate(events.filter((e) => e.date >= today)).slice(0, limit);
}

/** Group events by ISO date, in date order. */
export function groupByDay(events: CalendarEvent[]): Array<{ date: string; events: CalendarEvent[] }> {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of sortByDate(events)) (map.get(e.date) ?? map.set(e.date, []).get(e.date)!).push(e);
  return [...map.entries()].map(([date, evs]) => ({ date, events: evs }));
}

/** Validate + normalise a scheduling request into an event (or null if invalid). */
export function makeEvent(input: { title: string; date: string; category: string; note?: string }): CalendarEvent | null {
  const title = (input.title || '').trim();
  const date = (input.date || '').trim();
  if (!title) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const category = CAT_IDS.has(input.category) ? input.category : 'founder';
  const note = (input.note || '').trim() || undefined;
  return { id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, title, date, category, note };
}

/* --- Client persistence (localStorage; no backend) ------------------------- */
const STORE = 'lhc.hq.calendar.v1';

export function loadEvents(): CalendarEvent[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORE) : null;
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(isEvent) : [];
  } catch { return []; }
}
export function saveEvents(events: CalendarEvent[]): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORE, JSON.stringify(events)); } catch { /* ignore */ }
}
function isEvent(e: unknown): e is CalendarEvent {
  const o = e as CalendarEvent;
  return !!o && typeof o.id === 'string' && typeof o.title === 'string'
    && typeof o.date === 'string' && typeof o.category === 'string';
}
