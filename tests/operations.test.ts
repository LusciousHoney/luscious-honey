/* =============================================================================
   OPERATIONS OFFICE — flow-derivation tests (pure, no DOM).

   Locks the operations board's shaping of the existing Daily Briefing:
     • the stage lanes are a COMPLETE, lifecycle-ordered partition of the eight
       statuses (nothing dropped, nothing double-counted) — the board total must
       equal the spine total;
     • counts come from `byStatus`; in-motion / resolved / awaiting / oldest are
       passed through from the briefing's own explicit categories, so the board
       can never disagree with the scene's briefing;
     • the busiest lane and the empty board behave honestly.
   These guard against Operations quietly re-deriving (and drifting from) the spine.
   ============================================================================= */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { operationsFlow, OPERATIONS_STAGES } from '../src/headquarters/operations.ts';
import { STATUSES } from '../shared/workflow.js';
import type { Briefing } from '../src/headquarters/adapters.ts';

// Build a Briefing from a byStatus map, filling the rest with sensible defaults.
function briefingOf(
  byStatus: Record<string, number>,
  extra: Partial<Briefing> = {},
): Briefing {
  const full = Object.fromEntries(STATUSES.map((s) => [s, byStatus[s] ?? 0]));
  const total = Object.values(full).reduce((a, b) => a + b, 0);
  return {
    generatedAt: '2026-07-14T09:00:00Z',
    statusLabels: {},
    counts: { byStatus: full, awaitingReview: 0, open: 0, resolved: 0, total },
    awaitingReview: 0,
    open: 0,
    resolved: 0,
    oldestAwaiting: null,
    recent: [],
    ...extra,
  };
}

// ── Stage partition ──────────────────────────────────────────────────────────
test('the stages are a complete, non-overlapping partition of every status', () => {
  const covered = OPERATIONS_STAGES.flatMap((s) => s.statuses);
  // No status appears twice.
  assert.equal(new Set(covered).size, covered.length, 'a status is claimed by two lanes');
  // Every workflow status is covered, and nothing extra is invented.
  assert.deepEqual(covered.slice().sort(), STATUSES.slice().sort());
});

test('stages read in lifecycle (flow) order, arriving → resolved', () => {
  assert.deepEqual(
    OPERATIONS_STAGES.map((s) => s.id),
    ['arriving', 'in_review', 'with_creators', 'ready', 'resolved'],
  );
});

// ── Counts ───────────────────────────────────────────────────────────────────
test('lane counts sum the underlying statuses, and total equals the spine total', () => {
  const b = briefingOf({
    draft: 1, sent_for_review: 2, under_review: 3, changes_requested: 1,
    approved: 2, scheduled: 1, published: 4, not_accepted: 2,
  });
  const flow = operationsFlow(b);
  const byId = Object.fromEntries(flow.stages.map((s) => [s.id, s.count]));
  assert.equal(byId.arriving, 3);       // draft + sent_for_review
  assert.equal(byId.in_review, 3);      // under_review
  assert.equal(byId.with_creators, 1);  // changes_requested
  assert.equal(byId.ready, 3);          // approved + scheduled
  assert.equal(byId.resolved, 6);       // published + not_accepted
  assert.equal(flow.total, 16);
  assert.equal(flow.total, b.counts.total, 'board total must equal spine total');
});

// ── Pass-through of the briefing's own categories ────────────────────────────
test('in-motion / resolved / awaiting / oldest are passed through unchanged', () => {
  const oldest = { id: 7, name: 'Wren', type: 'artist_feature', status: 'under_review' as const, waitingDays: 5 };
  const b = briefingOf(
    { under_review: 2, published: 1 },
    { open: 4, resolved: 1, awaitingReview: 2, oldestAwaiting: oldest },
  );
  const flow = operationsFlow(b);
  assert.equal(flow.inMotion, 4);
  assert.equal(flow.resolved, 1);
  assert.equal(flow.awaiting, 2);
  assert.equal(flow.oldest, oldest);
});

// ── Busiest lane + empty board ───────────────────────────────────────────────
test('busiest lane is the fullest; ties resolve to the earlier (upstream) lane', () => {
  // arriving and ready both hold 2 — arriving is upstream, so it wins the tie.
  const flow = operationsFlow(briefingOf({ sent_for_review: 2, approved: 2, under_review: 1 }));
  assert.equal(flow.busiestId, 'arriving');
});

test('an empty spine yields a zeroed board and a null busiest lane (honest empty)', () => {
  const flow = operationsFlow(briefingOf({}));
  assert.equal(flow.total, 0);
  assert.equal(flow.busiestId, null);
  assert.ok(flow.stages.every((s) => s.count === 0));
  assert.equal(flow.stages.length, 5);
});
