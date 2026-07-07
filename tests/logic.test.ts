/* =============================================================================
   Pure-logic tests — Living Clock state + visitor state.
   Run with Node's built-in test runner (no extra framework):  npm test
   Node 24 runs TypeScript directly via type stripping.
   ============================================================================= */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { stateForHour, clockStateFor } from '../src/lib/living-clock.ts';
import { visitorFrom } from '../src/lib/visitor-state.ts';

test('Living Clock: hour → time state boundaries', () => {
  assert.equal(stateForHour(5), 'morning');
  assert.equal(stateForHour(11), 'morning');
  assert.equal(stateForHour(12), 'afternoon');
  assert.equal(stateForHour(16), 'afternoon');
  assert.equal(stateForHour(17), 'evening');
  assert.equal(stateForHour(22), 'evening');
  assert.equal(stateForHour(23), 'late');
  assert.equal(stateForHour(0), 'late');
  assert.equal(stateForHour(4), 'late');
});

test('Living Clock: state carries a greeting, warmth, and label', () => {
  const evening = clockStateFor(new Date('2026-07-05T20:00:00'));
  assert.equal(evening.tod, 'evening');
  assert.match(evening.greeting, /studio is still lit/i);
  assert.ok(evening.warmth > 0 && evening.warmth <= 1);
  assert.match(evening.label, /·/);

  const late = clockStateFor(new Date('2026-07-05T02:00:00'));
  assert.equal(late.tod, 'late');
  assert.equal(late.warmth, 1); // warmest at night
});

test('Visitor state: first vs returning from stored flag', () => {
  assert.equal(visitorFrom(null), 'first');
  assert.equal(visitorFrom(''), 'first');
  assert.equal(visitorFrom('2026-07-05T00:00:00.000Z'), 'returning');
});
