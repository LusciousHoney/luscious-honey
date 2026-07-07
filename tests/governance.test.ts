/* =============================================================================
   Content-governance tests — the truthful operational rules.
   Pure functions with in-memory fixtures; no Vite, no DOM.  npm test
   ============================================================================= */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  selectLatestJournal, selectJournalArchive,
  selectActiveFragment, selectCurrentHeldFrame, selectPublishedWorks,
  selectRecordingState, inWindow,
} from '../src/lib/governance.ts';
import type { JournalEntry, Fragment, HeldFrame, Work, BodyBlock, RecordingFlag } from '../src/lib/content-types.ts';

const journal: JournalEntry[] = [
  { date: '2026-06-28', week: 26, body: 'older', signed: 'L.H.', status: 'published' },
  { date: '2026-07-05', week: 27, body: 'newer', signed: 'L.H.', status: 'published' },
  { date: '2026-07-12', week: 28, body: 'draft', signed: 'L.H.', status: 'draft' },
];

test('Journal: only published entries, newest first; drafts never show', () => {
  const archive = selectJournalArchive(journal);
  assert.equal(archive.length, 2);
  assert.equal(archive[0].date, '2026-07-05');
  assert.equal(selectLatestJournal(journal)?.body, 'newer');
  assert.ok(!archive.some((e) => e.status === 'draft'));
});

test('Journal: with nothing published, the desk rests (undefined)', () => {
  const none = journal.map((e) => ({ ...e, status: 'draft' as const }));
  assert.equal(selectLatestJournal(none), undefined);
});

test('Writing Wall: manual active fragment wins over a scheduled one', () => {
  const frags: Fragment[] = [
    { id: 'a', text: 'manual', status: 'published', active: true },
    { id: 'b', text: 'scheduled', status: 'published', showFrom: '2026-07-01', showUntil: '2026-12-31' },
  ];
  assert.equal(selectActiveFragment(frags, new Date('2026-07-15T12:00:00'))?.id, 'a');
});

test('Writing Wall: scheduled window applies when no manual active; else rests', () => {
  const frags: Fragment[] = [
    { id: 'b', text: 'scheduled', status: 'published', showFrom: '2026-07-20', showUntil: '2026-07-27' },
    { id: 'd', text: 'draft', status: 'draft', active: true },
  ];
  // inside the window
  assert.equal(selectActiveFragment(frags, new Date('2026-07-22T09:00:00'))?.id, 'b');
  // outside the window → the wall rests
  assert.equal(selectActiveFragment(frags, new Date('2026-07-10T09:00:00')), undefined);
  // a draft is never selected even if flagged active
  assert.equal(selectActiveFragment([frags[1]], new Date('2026-07-22')), undefined);
});

test('inWindow: bounds inclusive; a fragment with no window is not scheduled', () => {
  assert.equal(inWindow('2026-07-22', '2026-07-20', '2026-07-27'), true);
  assert.equal(inWindow('2026-07-20', '2026-07-20', '2026-07-27'), true);
  assert.equal(inWindow('2026-07-28', '2026-07-20', '2026-07-27'), false);
  assert.equal(inWindow('2026-07-22', undefined, undefined), false);
});

test('Held Frame: single latest published; none → rests', () => {
  const frames: HeldFrame[] = [
    { id: 'w26', week: 26, status: 'published', media: { id: 'm26', kind: 'image', poster: '/p.svg', alt: 'a', aspect: '16/9' } },
    { id: 'w27', week: 27, status: 'published', media: { id: 'm27', kind: 'image', poster: '/p.svg', alt: 'b', aspect: '16/9' } },
    { id: 'w28', week: 28, status: 'draft', media: { id: 'm28', kind: 'image', poster: '/p.svg', alt: 'c', aspect: '16/9' } },
  ];
  assert.equal(selectCurrentHeldFrame(frames)?.id, 'w27');
  assert.equal(selectCurrentHeldFrame([]), undefined);
});

test('Works: published only, featured first', () => {
  const base = { creator: 'Luscious Honey', medium: 'essay' as const, year: 2026, body: [] as BodyBlock[] };
  const works: Work[] = [
    { ...base, id: '1', slug: 'a', title: 'A', date: '2026-07-01', status: 'published' },
    { ...base, id: '2', slug: 'b', title: 'B', date: '2026-07-05', status: 'published', featured: true },
    { ...base, id: '3', slug: 'c', title: 'C', date: '2026-07-09', status: 'draft' },
  ];
  const pub = selectPublishedWorks(works);
  assert.equal(pub.length, 2);
  assert.equal(pub[0].slug, 'b'); // featured first
});

/* --- Now Recording ------------------------------------------------------- */

const NOW = new Date('2026-07-07T20:00:00');

test('Now Recording: default / not live → Studio dark', () => {
  assert.deepEqual(selectRecordingState({ live: false }, NOW), { active: false, label: 'Studio dark' });
  assert.equal(selectRecordingState(undefined, NOW).active, false);
});

test('Now Recording: live and fresh → Recording now (with detail)', () => {
  const flag: RecordingFlag = {
    live: true,
    since: '2026-07-07T19:45:00',
    detail: 'a conversation at the hearth',
    staleAfterMinutes: 240,
  };
  const s = selectRecordingState(flag, NOW);
  assert.equal(s.active, true);
  assert.equal(s.label, 'Recording now');
  assert.equal(s.detail, 'a conversation at the hearth');
});

test('Now Recording: a forgotten live flag past its window fails to dark', () => {
  const stale: RecordingFlag = { live: true, since: '2026-07-07T10:00:00', staleAfterMinutes: 240 };
  assert.equal(selectRecordingState(stale, NOW).active, false); // 10h old > 4h window
  // live with no staleness configured stays active
  const openEnded: RecordingFlag = { live: true, since: '2026-07-07T10:00:00' };
  assert.equal(selectRecordingState(openEnded, NOW).active, true);
});

/* --- Journal archive ----------------------------------------------------- */

test('Journal archive: published only, newest first, drafts excluded', () => {
  const entries: JournalEntry[] = [
    { date: '2026-06-14', week: 24, body: 'oldest', signed: 'L.H.', status: 'published' },
    { date: '2026-07-05', week: 27, body: 'newest', signed: 'L.H.', status: 'published' },
    { date: '2026-06-28', week: 26, body: 'middle', signed: 'L.H.', status: 'published' },
    { date: '2026-07-12', week: 28, body: 'hidden draft', signed: 'L.H.', status: 'draft' },
    { date: '2026-07-19', week: 29, body: 'hidden scheduled', signed: 'L.H.', status: 'scheduled' },
  ];
  const archive = selectJournalArchive(entries);
  assert.deepEqual(archive.map((e) => e.body), ['newest', 'middle', 'oldest']);
  assert.ok(!archive.some((e) => e.status !== 'published'));
});
