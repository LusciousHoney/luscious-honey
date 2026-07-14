/* =============================================================================
   EXECUTIVE TEAM HEADQUARTERS — Headquarters Memory.

   Returning to the Headquarters should feel like returning to a place, not
   reopening software. Memory is what remembers where the founder was.

   BOUNDARY (invariant): Memory owns PRESENTATION / SESSION state only — never
   operational data and never a source of truth. It stores a POINTER (which room
   was last visited), not any work. Everything authoritative stays in its
   existing system. This is the same local-only seam the Editorial Office uses
   (src/office/store.ts) — a real backend can replace it later without touching
   callers.

   Milestone 1 scope: room restoration only. Later milestones may extend the
   stored shape (last work surface, open manuscript pointer, notebook draft) —
   always as pointers/ephemeral state, never as copied records.
   ============================================================================= */

import { isRoomId, type RoomId } from './rooms.ts';
import { dayKey } from './time.ts';

const KEY = 'lhc.hq.v1';
const SCHEMA_VERSION = 1;

interface HqMemory {
  schemaVersion: number;
  /** The last room the founder was in — a pointer, restored on return. */
  lastRoom: RoomId | null;
  /** Calendar-day key of the last arrival sequence seen — so it plays once a day. */
  arrivalSeen: string | null;
}

function empty(): HqMemory {
  return { schemaVersion: SCHEMA_VERSION, lastRoom: null, arrivalSeen: null };
}

function read(): HqMemory {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<HqMemory>;
    // Validate the restored room against the live registry: a renamed or removed
    // department must never strand the founder in a room that no longer exists.
    const lastRoom = isRoomId(parsed.lastRoom) ? parsed.lastRoom : null;
    const arrivalSeen = typeof parsed.arrivalSeen === 'string' ? parsed.arrivalSeen : null;
    return { schemaVersion: SCHEMA_VERSION, lastRoom, arrivalSeen };
  } catch {
    // Storage unavailable, blocked, or corrupt — start with a clean memory.
    return empty();
  }
}

function write(state: HqMemory): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable / full — the session simply won't be remembered */
  }
}

/** The last room visited, or null if there is nothing (valid) to restore. */
export function loadLastRoom(): RoomId | null {
  return read().lastRoom;
}

/** Remember the room the founder is now in, so a return lands them back here. */
export function saveLastRoom(id: RoomId): void {
  const state = read();
  if (state.lastRoom === id) return;
  state.lastRoom = id;
  write(state);
}

/**
 * The Morning Arrival ceremony plays only on the FIRST open of the day — never
 * on every navigation. `today` is injected so this stays testable and honours
 * the founder's local calendar day.
 */
export function shouldPlayArrival(today: string = dayKey()): boolean {
  return read().arrivalSeen !== today;
}

/** Record that today's arrival has been seen, so it will not replay until tomorrow. */
export function markArrivalSeen(today: string = dayKey()): void {
  const state = read();
  if (state.arrivalSeen === today) return;
  state.arrivalSeen = today;
  write(state);
}
