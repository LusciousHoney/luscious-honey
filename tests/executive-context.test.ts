/* =============================================================================
   EOS — Executive Context v0 (Milestone 3). Pure, read-only derivation over
   Executive Memory that assembles the working context of the present period.
   Covers: the working set (temporary + expiring only), the standing frame
   (preference + long_term), expiring-soon surfacing before lapse, exclusion of
   expired and retired entries, idempotence, and the store-only boundary.
   ============================================================================= */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makeMemoryEntry, retire, type MemoryClass } from '../src/headquarters/executive-memory.ts';
import {
  presentContext, isExpiringSoon, WORKING_CLASSES, STANDING_CLASSES, EXPIRING_SOON_MS,
} from '../src/headquarters/executive-context.ts';

const NOW = new Date('2026-07-19T09:00:00.000Z');
const iso = (ms: number) => new Date(NOW.getTime() + ms).toISOString();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const mk = (o: { class: MemoryClass; key: string; value?: string; expiresAt?: string }, now = NOW) =>
  makeMemoryEntry({ value: 'v', ...o }, now);

/* --- the present period is exactly temporary + expiring (Doc 1) ----------- */
test('the working classes are temporary + expiring; standing frame is preference + long_term', () => {
  assert.deepEqual([...WORKING_CLASSES], ['temporary', 'expiring']);
  assert.deepEqual([...STANDING_CLASSES], ['preference', 'long_term']);
});

test('working holds only temporary + expiring; durable facts go to standing; others are excluded', () => {
  const entries = [
    mk({ class: 'temporary', key: 'this-week' }),
    mk({ class: 'expiring', key: 'trip', expiresAt: iso(2 * DAY) }),
    mk({ class: 'preference', key: 'protected-hours' }),
    mk({ class: 'long_term', key: 'north-star' }),
    mk({ class: 'personal', key: 'private' }),
    mk({ class: 'institutional', key: 'thin-summary' }),
    mk({ class: 'cross_domain', key: 'thursday-collision' }),
  ];
  const ctx = presentContext(entries, NOW);
  assert.deepEqual(ctx.working.map((e) => e.class).sort(), ['expiring', 'temporary']);
  assert.deepEqual(ctx.standing.map((e) => e.class).sort(), ['long_term', 'preference']);
  assert.equal(ctx.counts.working, 2);
  assert.equal(ctx.counts.standing, 2);
  // personal / institutional / cross_domain are not part of the present-period view
  assert.ok(![...ctx.working, ...ctx.standing].some((e) =>
    ['personal', 'institutional', 'cross_domain'].includes(e.class)));
});

/* --- stale context misleads: expired never surfaces ----------------------- */
test('an expired working entry never appears in the present context', () => {
  const entries = [
    mk({ class: 'expiring', key: 'lapsed', expiresAt: iso(-HOUR) }),   // already past
    mk({ class: 'temporary', key: 'live' }),
  ];
  const ctx = presentContext(entries, NOW);
  assert.deepEqual(ctx.working.map((e) => e.key), ['live']);
  assert.equal(ctx.counts.working, 1);
});

test('a retired entry never appears (visible correction, not a working fact)', () => {
  const e = mk({ class: 'temporary', key: 'dropped' });
  const ctx = presentContext(retire([e], e.id, NOW), NOW);
  assert.equal(ctx.counts.working, 0);
});

/* --- surfaced before it lapses -------------------------------------------- */
test('expiringSoon flags working entries lapsing within the horizon, soonest first', () => {
  const soon = mk({ class: 'expiring', key: 'thursday', expiresAt: iso(2 * DAY) });
  const sooner = mk({ class: 'temporary', key: 'today', expiresAt: iso(6 * HOUR) });
  const far = mk({ class: 'expiring', key: 'next-week', expiresAt: iso(10 * DAY) });
  const noExpiry = mk({ class: 'temporary', key: 'open-ended' });
  const ctx = presentContext([soon, far, sooner, noExpiry], NOW);
  assert.deepEqual(ctx.expiringSoon.map((e) => e.key), ['today', 'thursday']); // soonest → later
  assert.equal(ctx.counts.expiringSoon, 2);
  // expiringSoon is a subset of working
  assert.ok(ctx.expiringSoon.every((e) => ctx.working.includes(e)));
});

test('isExpiringSoon: true within window, false past expiry, false with no expiry', () => {
  assert.equal(isExpiringSoon(mk({ class: 'expiring', key: 'k', expiresAt: iso(DAY) }), NOW), true);
  assert.equal(isExpiringSoon(mk({ class: 'expiring', key: 'k', expiresAt: iso(-HOUR) }), NOW), false);
  assert.equal(isExpiringSoon(mk({ class: 'temporary', key: 'k' }), NOW), false);
  // a custom (tighter) horizon excludes a farther expiry
  assert.equal(isExpiringSoon(mk({ class: 'expiring', key: 'k', expiresAt: iso(2 * DAY) }), NOW, HOUR), false);
  assert.ok(EXPIRING_SOON_MS > 0);
});

/* --- ordering: most-recent working first ---------------------------------- */
test('working is ordered most-recently-captured first', () => {
  const older = mk({ class: 'temporary', key: 'older' }, new Date(NOW.getTime() - 2 * DAY));
  const newer = mk({ class: 'temporary', key: 'newer' }, new Date(NOW.getTime() - HOUR));
  const ctx = presentContext([older, newer], NOW);
  assert.deepEqual(ctx.working.map((e) => e.key), ['newer', 'older']);
});

/* --- pure and idempotent -------------------------------------------------- */
test('presentContext is pure and idempotent (deriving twice is deep-equal)', () => {
  const entries = [
    mk({ class: 'temporary', key: 'a' }),
    mk({ class: 'expiring', key: 'b', expiresAt: iso(DAY) }),
    mk({ class: 'preference', key: 'c' }),
  ];
  const once = presentContext(entries, NOW);
  const twice = presentContext(entries, NOW);
  assert.deepEqual(once, twice);
  // input is not mutated
  assert.equal(entries.length, 3);
});

/* --- empty store yields a calm, honest present ---------------------------- */
test('an empty memory yields an empty present context with honest zero counts', () => {
  const ctx = presentContext([], NOW);
  assert.deepEqual(ctx, {
    now: NOW.toISOString(),
    working: [], expiringSoon: [], standing: [],
    counts: { working: 0, expiringSoon: 0, standing: 0 },
  });
});
