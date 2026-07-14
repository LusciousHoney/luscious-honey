/* =============================================================================
   DAILY BRIEFING — category-definition tests (pure, no DB).
   Locks the explicit definitions: awaiting review, open, resolved, oldest
   waiting (by created_at), and recent (by updated_at). Guards against collapsing
   all non-final statuses into "awaiting review".
   ============================================================================= */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { composeBriefing } from '../functions/_lib/briefing.js'
import { AWAITING_REVIEW, FINAL_STATUSES } from '../shared/workflow.js'

// One submission fixture. created_at older = waited longer.
const sub = (id, status, created_at, updated_at = created_at, name = `S${id}`) =>
  ({ id, type: 'artist_feature', status, name, email: `${id}@x.com`, fields: {}, created_at, updated_at })

const NOW = new Date('2026-07-13T00:00:00Z')

test('awaiting review = sent_for_review + under_review ONLY (not all non-final)', () => {
  const b = composeBriefing([
    sub(1, 'sent_for_review', '2026-07-10 09:00:00'),
    sub(2, 'under_review',    '2026-07-11 09:00:00'),
    sub(3, 'changes_requested','2026-07-11 09:00:00'), // open, but NOT awaiting founder
    sub(4, 'approved',         '2026-07-12 09:00:00'), // open, but NOT awaiting
    sub(5, 'draft',            '2026-07-12 09:00:00'), // open, but NOT awaiting
  ], NOW)
  assert.equal(b.awaitingReview, 2)
  assert.deepEqual(AWAITING_REVIEW.slice().sort(), ['sent_for_review', 'under_review'].sort())
})

test('open = every status that is not a final outcome (superset of awaiting)', () => {
  const b = composeBriefing([
    sub(1, 'sent_for_review', '2026-07-10 09:00:00'),
    sub(2, 'changes_requested','2026-07-10 09:00:00'),
    sub(3, 'approved',         '2026-07-10 09:00:00'),
    sub(4, 'published',        '2026-07-10 09:00:00'), // final → not open
    sub(5, 'not_accepted',     '2026-07-10 09:00:00'), // final → not open
  ], NOW)
  assert.equal(b.open, 3)
  assert.ok(b.open >= b.awaitingReview, 'open is a superset of awaiting')
})

test('resolved = final statuses only', () => {
  const b = composeBriefing([
    sub(1, 'published',    '2026-07-10 09:00:00'),
    sub(2, 'not_accepted', '2026-07-10 09:00:00'),
    sub(3, 'approved',     '2026-07-10 09:00:00'),
  ], NOW)
  assert.equal(b.resolved, 2)
  assert.deepEqual(FINAL_STATUSES.slice().sort(), ['not_accepted', 'published'].sort())
})

test('oldest waiting = earliest created_at among awaiting items, with wait days', () => {
  const b = composeBriefing([
    sub(3, 'under_review',    '2026-07-08 00:00:00', '2026-07-12 00:00:00', 'Oldest'),
    sub(1, 'sent_for_review', '2026-07-11 00:00:00', '2026-07-11 00:00:00', 'Newer'),
    sub(2, 'approved',        '2026-07-01 00:00:00', '2026-07-01 00:00:00', 'NotAwaiting'), // older but not awaiting
  ], NOW)
  assert.equal(b.oldestAwaiting.name, 'Oldest')
  assert.equal(b.oldestAwaiting.waitingDays, 5) // 2026-07-08 → 2026-07-13
})

test('oldest waiting is null when nothing is awaiting', () => {
  const b = composeBriefing([sub(1, 'published', '2026-07-10 00:00:00')], NOW)
  assert.equal(b.oldestAwaiting, null)
})

test('recent = most recently updated first, capped at 5', () => {
  const many = []
  for (let i = 1; i <= 7; i++) many.push(sub(i, 'approved', '2026-07-01 00:00:00', `2026-07-${String(i + 1).padStart(2, '0')} 00:00:00`))
  const b = composeBriefing(many, NOW)
  assert.equal(b.recent.length, 5)
  assert.equal(b.recent[0].id, 7) // updated 07-08, newest
  assert.equal(b.recent[4].id, 3) // 5th newest
})

test('empty input yields zeroes and nulls (honest empty)', () => {
  const b = composeBriefing([], NOW)
  assert.deepEqual(
    { a: b.awaitingReview, o: b.open, r: b.resolved, t: b.counts.total, oldest: b.oldestAwaiting, recent: b.recent.length },
    { a: 0, o: 0, r: 0, t: 0, oldest: null, recent: 0 },
  )
})

test('counts.byStatus tallies each status', () => {
  const b = composeBriefing([
    sub(1, 'sent_for_review', '2026-07-10 00:00:00'),
    sub(2, 'sent_for_review', '2026-07-10 00:00:00'),
    sub(3, 'approved',        '2026-07-10 00:00:00'),
  ], NOW)
  assert.equal(b.counts.byStatus.sent_for_review, 2)
  assert.equal(b.counts.byStatus.approved, 1)
  assert.equal(b.counts.byStatus.published, 0)
})
