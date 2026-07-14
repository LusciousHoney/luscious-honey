/* =============================================================================
   CREATIVE DIRECTOR — library derivation tests (pure, no DOM).

   Locks the two living objects the room shapes from EXISTING data:
     • the open manuscript — exactly ONE piece, the most-recently-touched work
       still in motion (from the briefing's `recent`); null when nothing is open;
     • the Collection — the made body of work (published), curated newest-first,
       capped, with an honest total that can exceed what the shelf shows.
   These guard the room's honesty: never more than one manuscript, never a
   fabricated shelf, never disagreeing with the spine.
   ============================================================================= */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { creativeStudio, REFERENCE_VOLUMES, DIRECTION_INSCRIPTION } from '../src/headquarters/creative.ts';
import type { Briefing, Submission } from '../src/headquarters/adapters.ts';

function briefingWithRecent(recent: Array<{ name: string; status: string; summary?: string }>): Briefing {
  return {
    generatedAt: '2026-07-14T09:00:00Z',
    statusLabels: {},
    counts: { byStatus: {}, awaitingReview: 0, open: 0, resolved: 0, total: 0 },
    awaitingReview: 0, open: 0, resolved: 0, oldestAwaiting: null,
    // `recent` is newest-first, as the briefing produces it.
    recent: recent.map((r, i) => ({ id: i + 1, name: r.name, type: 'artist_feature', status: r.status as any, summary: r.summary })),
  };
}

const pub = (id: number, name: string, summary = ''): Submission => ({
  id, type: 'artist_feature', status: 'published' as any, name, email: `${id}@x.com`,
  fields: {}, created_at: '2026-07-01 09:00:00', updated_at: '2026-07-01 09:00:00', summary,
});

// ── The open manuscript ──────────────────────────────────────────────────────
test('manuscript is the FIRST (most recent) in-motion piece in recent', () => {
  const b = briefingWithRecent([
    { name: 'Published One', status: 'published' },      // final → skip
    { name: 'Under Review Now', status: 'under_review', summary: 'A profile mid-edit.' }, // open → this
    { name: 'Older Draft', status: 'draft' },            // also open, but older
  ]);
  const { manuscript } = creativeStudio(b, null);
  assert.ok(manuscript);
  assert.equal(manuscript.name, 'Under Review Now');
  assert.equal(manuscript.summary, 'A profile mid-edit.');
});

test('only ONE manuscript ever — the result is a single object, not a list', () => {
  const b = briefingWithRecent([
    { name: 'A', status: 'sent_for_review' },
    { name: 'B', status: 'under_review' },
    { name: 'C', status: 'changes_requested' },
  ]);
  const { manuscript } = creativeStudio(b, null);
  assert.ok(manuscript && !Array.isArray(manuscript));
  assert.equal(manuscript.name, 'A'); // the most recent open one
});

test('manuscript is null when nothing in recent is in motion (the table rests)', () => {
  const b = briefingWithRecent([
    { name: 'Done', status: 'published' },
    { name: 'Closed', status: 'not_accepted' },
  ]);
  assert.equal(creativeStudio(b, null).manuscript, null);
});

test('a null briefing yields no manuscript (offline shelf never fabricates a page)', () => {
  assert.equal(creativeStudio(null, [pub(1, 'X')]).manuscript, null);
});

// ── The Collection ───────────────────────────────────────────────────────────
test('collection is the published works, newest-first, capped at six', () => {
  const many = Array.from({ length: 9 }, (_, i) => pub(i + 1, `Work ${i + 1}`));
  const { collection, collectionTotal } = creativeStudio(null, many);
  assert.equal(collectionTotal, 9);         // honest total
  assert.equal(collection.length, 6);       // curated, not exhaustive
  assert.equal(collection[0].name, 'Work 1'); // order preserved (caller passes newest-first)
});

test('collection carries each work’s editorial summary', () => {
  const { collection } = creativeStudio(null, [pub(1, 'A Feature', 'A luminous profile.')]);
  assert.equal(collection[0].summary, 'A luminous profile.');
});

test('empty / null published yields an empty shelf and zero total (honest bare shelf)', () => {
  assert.deepEqual(creativeStudio(null, []).collection, []);
  assert.equal(creativeStudio(null, null).collectionTotal, 0);
});

// ── Environmental content ────────────────────────────────────────────────────
test('the reference library is a small, restrained set of bound volumes', () => {
  assert.ok(REFERENCE_VOLUMES.length >= 3 && REFERENCE_VOLUMES.length <= 6);
  for (const v of REFERENCE_VOLUMES) {
    assert.ok(v.title.length > 0);
    assert.ok(['bible', 'notebook', 'binder', 'reference'].includes(v.kind));
  }
});

test('the direction inscription is a short, non-empty engraved line', () => {
  assert.equal(typeof DIRECTION_INSCRIPTION, 'string');
  assert.ok(DIRECTION_INSCRIPTION.length > 0 && DIRECTION_INSCRIPTION.length < 80);
});
