/* =============================================================================
   USABILITY & LIVING SYSTEMS — pure tests for the Archive, Calendar, Dictation.
   No DOM, no I/O. Reuses existing data shapes; asserts honest, deterministic logic.
   ============================================================================= */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { archiveTree, archiveFilters, ARCHIVE_TAXONOMY } from '../src/headquarters/archive.ts';
import {
  CALENDAR_CATEGORIES, categoriesForRoom, eventsForRoom, upcoming, groupByDay, makeEvent,
} from '../src/headquarters/calendar.ts';
import { DICTATION_DESTINATIONS, makeDraft } from '../src/headquarters/dictation.ts';
import type { Submission } from '../src/headquarters/adapters.ts';

const pub = (id: number, name: string, interest: string, summary = ''): Submission => ({
  id, type: 'artist_feature', status: 'published' as any, name, email: `${id}@x.com`,
  fields: { interest }, created_at: '2026-07-01 09:00:00', updated_at: '2026-07-01 09:00:00', summary,
});

// ── Archive ───────────────────────────────────────────────────────────────
test('archive groups works into a taxonomy category, then by interest facet', () => {
  const t = archiveTree([pub(1, 'A', 'Interview'), pub(2, 'B', 'Interview'), pub(3, 'C', 'Live Performance')]);
  assert.equal(t.categories.length, 1);
  assert.equal(t.categories[0].label, 'Interviews'); // artist_feature → Interviews taxon
  const facets = t.categories[0].groups.map((g) => g.label).sort();
  assert.deepEqual(facets, ['Interview', 'Live Performance']);
  assert.equal(t.grandTotal, 3);
});
test('the archive taxonomy is future-ready and only populated categories appear', () => {
  const labels = ARCHIVE_TAXONOMY.map((t) => t.label);
  for (const c of ['Books', 'Interviews', 'Characters', 'Narration', 'Production', 'Marketing', 'Assets', 'Research', 'Universe', 'Residents', 'Templates'])
    assert.ok(labels.includes(c), `taxonomy missing ${c}`);
  // With only artist_features, only the Interviews category is shown (no fabricated empties).
  const t = archiveTree([pub(1, 'A', 'Interview')]);
  assert.deepEqual(t.categories.map((c) => c.label), ['Interviews']);
});
test('archive search narrows by name/summary; filter narrows by facet', () => {
  const items = [pub(1, 'Marigold', 'Interview', 'a debut record'), pub(2, 'Harbor', 'Live Performance', 'a residency')];
  assert.equal(archiveTree(items, 'debut').total, 1);
  assert.equal(archiveTree(items, '', 'Live Performance').total, 1);
  assert.equal(archiveTree(items, 'nothingmatches').total, 0);
  assert.equal(archiveTree(items, 'nothingmatches').grandTotal, 2);
});
test('archiveFilters returns the honest facet set present in the data', () => {
  assert.deepEqual(archiveFilters([pub(1, 'A', 'Interview'), pub(2, 'B', 'Interview')]), ['Interview']);
  assert.deepEqual(archiveFilters([]), []);
});

// ── Calendar ──────────────────────────────────────────────────────────────
test('there are eight calendar categories mapped to rooms', () => {
  assert.equal(CALENDAR_CATEGORIES.length, 8);
  assert.deepEqual(CALENDAR_CATEGORIES.map((c) => c.label),
    ['Founder', 'Editorial', 'Production', 'Publishing', 'Growth', 'Business', 'LIVE Events', 'Focus Time']);
});
test('a room view includes its own categories plus residence-wide (LIVE)', () => {
  const cats = categoriesForRoom('creative').map((c) => c.id);
  assert.ok(cats.includes('editorial'));   // creative's own
  assert.ok(cats.includes('live'));        // residence-wide
  assert.ok(!cats.includes('business'));   // another room's
});
test('eventsForRoom filters by the room’s categories', () => {
  const evs = [makeEvent({ title: 'Edit', date: '2026-07-20', category: 'editorial' })!,
               makeEvent({ title: 'Ship', date: '2026-07-21', category: 'business' })!];
  const view = eventsForRoom(evs, 'creative');
  assert.equal(view.length, 1); assert.equal(view[0].title, 'Edit');
});
test('makeEvent validates date + title; upcoming/groupByDay order by date', () => {
  assert.equal(makeEvent({ title: '', date: '2026-07-01', category: 'founder' }), null);
  assert.equal(makeEvent({ title: 'x', date: 'nope', category: 'founder' }), null);
  const evs = ['2026-07-30', '2026-07-10', '2026-07-20'].map((d, i) => makeEvent({ title: `E${i}`, date: d, category: 'founder' })!);
  assert.deepEqual(upcoming(evs, '2026-07-15').map((e) => e.date), ['2026-07-20', '2026-07-30']);
  assert.deepEqual(groupByDay(evs).map((d) => d.date), ['2026-07-10', '2026-07-20', '2026-07-30']);
});

// ── Dictation ─────────────────────────────────────────────────────────────
test('dictation offers the nine destinations including Calendar', () => {
  const ids = DICTATION_DESTINATIONS.map((d) => d.id);
  assert.equal(ids.length, 9);
  for (const id of ['briefing', 'archive', 'manuscript', 'project', 'production', 'operations', 'growth', 'business', 'calendar'])
    assert.ok(ids.includes(id), `missing destination ${id}`);
});
test('makeDraft trims, requires text, and defaults an unknown destination', () => {
  assert.equal(makeDraft('   ', 'archive'), null);
  const d = makeDraft('  a note  ', 'archive')!;
  assert.equal(d.text, 'a note'); assert.equal(d.destination, 'archive');
  assert.equal(makeDraft('x', 'bogus')!.destination, 'briefing');
});
