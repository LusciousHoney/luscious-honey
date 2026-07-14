/* =============================================================================
   EXECUTIVE TEAM HEADQUARTERS — shell logic tests. No DOM.
   Covers the two pieces of real, testable logic in Milestone 1:
     • the room registry (six departments, one atrium, valid routes/ids)
     • Headquarters Memory (round-trip, registry validation, corruption safety)
   ============================================================================= */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ROOMS, HOME_ROOM, getRoom, isRoomId } from '../src/headquarters/rooms.ts';
import { timeOfDay, greeting, dayKey } from '../src/headquarters/time.ts';

// ── Registry ────────────────────────────────────────────────────────────────
test('registry has exactly the six approved departments', () => {
  assert.equal(ROOMS.length, 6);
  assert.deepEqual(
    ROOMS.map((r) => r.id),
    ['executive', 'operations', 'creative', 'production', 'growth', 'business'],
  );
});

test('exactly one atrium, and it is the home room', () => {
  const atria = ROOMS.filter((r) => r.kind === 'atrium');
  assert.equal(atria.length, 1);
  assert.equal(atria[0].id, HOME_ROOM);
  assert.equal(getRoom(HOME_ROOM)!.kind, 'atrium');
});

test('every room has a hash route matching its id, and unique ids', () => {
  const ids = new Set(ROOMS.map((r) => r.id));
  assert.equal(ids.size, ROOMS.length);
  for (const r of ROOMS) assert.equal(r.route, `#/${r.id}`);
});

test('reserved departments are Growth and Business only', () => {
  const reserved = ROOMS.filter((r) => r.status === 'reserved').map((r) => r.id);
  assert.deepEqual(reserved.sort(), ['business', 'growth']);
});

test('the Production wing is named Production Suite (residential canon)', () => {
  assert.equal(getRoom('production')!.name, 'Production Suite');
});

test('getRoom / isRoomId reject unknown ids', () => {
  assert.equal(getRoom('nope'), null);
  assert.equal(getRoom(null), null);
  assert.equal(isRoomId('executive'), true);
  assert.equal(isRoomId('denied'), false);
  assert.equal(isRoomId(undefined), false);
});

// ── Time of day (pure, ambient foundation) ───────────────────────────────────
test('timeOfDay maps local hours to the four light states', () => {
  const at = (h: number) => timeOfDay(new Date(2026, 6, 12, h, 0, 0));
  assert.equal(at(5), 'morning');
  assert.equal(at(9), 'morning');
  assert.equal(at(11), 'morning');
  assert.equal(at(12), 'afternoon');
  assert.equal(at(16), 'afternoon');
  assert.equal(at(17), 'evening');
  assert.equal(at(21), 'evening');
  assert.equal(at(22), 'late');
  assert.equal(at(3), 'late');
});

test('greeting is provided for every light state', () => {
  for (const tod of ['morning', 'afternoon', 'evening', 'late'] as const) {
    assert.equal(typeof greeting(tod), 'string');
    assert.ok(greeting(tod).length > 0);
  }
});

test('dayKey is a stable local YYYY-MM-DD', () => {
  assert.equal(dayKey(new Date(2026, 6, 5, 23, 30)), '2026-07-05');
});

// ── Headquarters Memory (localStorage stub) ──────────────────────────────────
// memory.ts reads `localStorage` at call time, so a minimal in-memory stub set
// before import is sufficient. Node has no DOM; we provide just what's used.
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();

const { loadLastRoom, saveLastRoom, shouldPlayArrival, markArrivalSeen } =
  await import('../src/headquarters/memory.ts');

test('memory: empty by default', () => {
  localStorage.clear();
  assert.equal(loadLastRoom(), null);
});

test('memory: round-trips the last room', () => {
  localStorage.clear();
  saveLastRoom('operations');
  assert.equal(loadLastRoom(), 'operations');
  saveLastRoom('creative');
  assert.equal(loadLastRoom(), 'creative');
});

test('memory: a stored room that no longer exists is not restored', () => {
  localStorage.clear();
  localStorage.setItem('lhc.hq.v1', JSON.stringify({ schemaVersion: 1, lastRoom: 'ghost-room' }));
  assert.equal(loadLastRoom(), null);
});

test('memory: corrupt storage is tolerated (returns null)', () => {
  localStorage.clear();
  localStorage.setItem('lhc.hq.v1', '{not valid json');
  assert.equal(loadLastRoom(), null);
});

// ── Morning Arrival (once per calendar day) ──────────────────────────────────
test('arrival: plays on a fresh day, then not again until tomorrow', () => {
  localStorage.clear();
  assert.equal(shouldPlayArrival('2026-07-12'), true);
  markArrivalSeen('2026-07-12');
  assert.equal(shouldPlayArrival('2026-07-12'), false);
  assert.equal(shouldPlayArrival('2026-07-13'), true); // a new day
});

test('arrival: seeing it does not disturb the remembered room', () => {
  localStorage.clear();
  saveLastRoom('creative');
  markArrivalSeen('2026-07-12');
  assert.equal(loadLastRoom(), 'creative');
});
