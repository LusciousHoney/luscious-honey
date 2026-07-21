/* =============================================================================
   PRODUCTION SUITE — studio-sprint derivation tests (pure, no DOM).

   Locks the finishing tail the studio shapes from EXISTING data:
     • three lanes — In Production (scheduled), Preparing (approved), Recently
       Finished (published) — in the founder's order;
     • each lane curates the newest few pieces but reports an honest total;
     • lanes degrade independently (a failed/missing list never blanks the others);
     • an empty spine yields a quiet studio, not a fabricated queue.
   ============================================================================= */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { productionSprint, PRODUCTION_LANES, RECORDING_NOTE, REVIEW_NOTE, VOICE_NOTES_STUDIO } from '../src/headquarters/production.ts';
import type { Submission } from '../src/headquarters/adapters.ts';

const sub = (id: number, name: string, status: string): Submission => ({
  id, type: 'artist_feature', status: status as any, name, email: `${id}@x.com`,
  fields: {}, created_at: '2026-07-01 09:00:00', updated_at: '2026-07-01 09:00:00',
});

// ── Lane definitions ─────────────────────────────────────────────────────────
test('lanes are In Production / Preparing / Recently Finished, in order', () => {
  assert.deepEqual(PRODUCTION_LANES.map((l) => l.label),
    ['In Production', 'Preparing', 'Recently Finished']);
});

test('lanes map to the finishing statuses scheduled / approved / published', () => {
  assert.deepEqual(PRODUCTION_LANES.map((l) => l.status),
    ['scheduled', 'approved', 'published']);
  // No project-management vocabulary leaks into the labels.
  for (const l of PRODUCTION_LANES) {
    assert.ok(!/\b(now|next|done|todo|backlog|sprint)\b/i.test(l.label));
  }
});

// ── Sprint shaping ───────────────────────────────────────────────────────────
test('each lane draws from its own status; totals are honest', () => {
  const s = productionSprint({
    scheduled: [sub(1, 'A', 'scheduled'), sub(2, 'B', 'scheduled')],
    approved:  [sub(3, 'C', 'approved')],
    published: [sub(4, 'D', 'published'), sub(5, 'E', 'published'), sub(6, 'F', 'published')],
  });
  const byId = Object.fromEntries(s.lanes.map((l) => [l.id, l]));
  assert.deepEqual(byId.in_production.items.map((i) => i.name), ['A', 'B']);
  assert.deepEqual(byId.preparing.items.map((i) => i.name), ['C']);
  assert.equal(byId.recently_finished.total, 3);
  assert.equal(s.total, 6);
});

test('a lane is curated to a few pieces but reports the true total', () => {
  const many = Array.from({ length: 9 }, (_, i) => sub(i + 1, `P${i + 1}`, 'published'));
  const s = productionSprint({ scheduled: null, approved: null, published: many });
  const finished = s.lanes.find((l) => l.id === 'recently_finished')!;
  assert.equal(finished.total, 9);
  assert.ok(finished.items.length <= 4 && finished.items.length >= 1, 'shows a curated few');
  assert.equal(finished.items[0].name, 'P1'); // order preserved (caller passes newest-first)
});

test('lanes degrade independently — a missing list only empties its own lane', () => {
  const s = productionSprint({
    scheduled: [sub(1, 'Live', 'scheduled')],
    approved: null,       // failed/absent
    published: undefined, // absent
  });
  assert.equal(s.lanes[0].items.length, 1);
  assert.equal(s.lanes[1].items.length, 0);
  assert.equal(s.lanes[2].items.length, 0);
  assert.equal(s.total, 1);
});

test('an empty spine yields a quiet studio (three empty lanes, zero total)', () => {
  const s = productionSprint({ scheduled: [], approved: [], published: [] });
  assert.equal(s.total, 0);
  assert.equal(s.lanes.length, 3);
  assert.ok(s.lanes.every((l) => l.items.length === 0 && l.empty.length > 0));
});

// ── In-residence copy ────────────────────────────────────────────────────────
test('the recording note is honest — a real entrance, never a running take', () => {
  assert.ok(RECORDING_NOTE.length > 0);
  // Still never simulates a live recording…
  assert.ok(!/recording now|on air|on-air|live now/i.test(RECORDING_NOTE));
  // …but now names the working Voice Notes Studio entrance (Milestone: Intake Activation).
  assert.ok(/voice notes studio/i.test(RECORDING_NOTE));
});

test('the review note is a short environmental line', () => {
  assert.ok(REVIEW_NOTE.length > 0 && REVIEW_NOTE.length < 80);
});

// ── The Production → Voice Notes Studio entrance (links, never rebuilds) ──────
test('the Voice Notes Studio entrance links to the existing private surface', () => {
  assert.equal(VOICE_NOTES_STUDIO.href, '/production-studio/voice-notes/');
  assert.ok(VOICE_NOTES_STUDIO.label.length > 0);
});

test('the entrance preserves the institutional breadcrumb hierarchy', () => {
  assert.deepEqual(VOICE_NOTES_STUDIO.breadcrumb,
    ['The Luscious Honey Collective', 'Production', 'Voice Notes Studio']);
});
