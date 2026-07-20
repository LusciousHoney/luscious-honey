/* =============================================================================
   Institutional Timeline + Executive Memory v1. A pure derivation over the one
   initiative record — no second source of truth. Covers timeline derivation and
   ordering, lifecycle-event uniqueness, legacy (pre-milestone) compatibility,
   the derived completion outcome, the decline/pause/revise paths, integration
   with Founder Attention and Execution ownership, deterministic reload, and the
   active/record partition.
   ============================================================================= */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  openInitiative, decide, completeInitiative, archiveInitiative,
  executionResponsibilities, attentionForInitiative, type Initiative,
} from '../src/headquarters/executive-workflow.ts';
import { attentionKind } from '../src/headquarters/founder-attention.ts';
import {
  initiativeTimeline, timelineEventLine, completionOutcome, initiativeRecord,
  partitionInitiatives, institutionalStatus,
} from '../src/headquarters/institutional-memory.ts';

const T0 = new Date('2026-07-19T09:00:00.000Z');
const T1 = new Date('2026-07-19T12:00:00.000Z');
const T2 = new Date('2026-07-20T10:00:00.000Z');
const T3 = new Date('2026-07-21T10:00:00.000Z');
const JK = 'I attended a signing yesterday. I’d like to turn it into content.';

const kinds = (i: Initiative) => initiativeTimeline(i).map((e) => e.kind);

/* --- the chronology derives from real transitions, in order --------------- */
test('a full lifecycle yields an ordered chronology of real milestones', () => {
  const brief = openInitiative(JK, T0);
  const executing = decide(brief, 'approve', undefined, T1);
  const completed = completeInitiative(executing, T2);
  const archived = archiveInitiative(completed, 'journal_entry', T3);

  assert.deepEqual(kinds(brief), ['received', 'coordinated', 'brief_prepared']);
  assert.deepEqual(kinds(executing),
    ['received', 'coordinated', 'brief_prepared', 'approved', 'assumed_responsibility']);
  assert.deepEqual(kinds(archived),
    ['received', 'coordinated', 'brief_prepared', 'approved', 'assumed_responsibility', 'completed', 'archived']);
  // strictly non-decreasing timestamps
  const times = initiativeTimeline(archived).map((e) => e.at);
  assert.deepEqual(times, [...times].sort());
});

/* --- uniqueness + deterministic reload ------------------------------------ */
test('deriving the timeline twice is identical, and never duplicates events', () => {
  const completed = completeInitiative(decide(openInitiative(JK, T0), 'approve', undefined, T1), T2);
  assert.deepEqual(initiativeTimeline(completed), initiativeTimeline(completed));   // deterministic
  const ks = kinds(completed);
  assert.equal(new Set(ks).size, ks.length);                                        // no duplicate kinds
});

/* --- legacy records (no completedAt/archivedAt) still derive fully --------- */
test('a legacy completed record with no milestone timestamps falls back to updatedAt', () => {
  const legacy = completeInitiative(decide(openInitiative(JK, T0), 'approve', undefined, T1), T2);
  delete (legacy as { completedAt?: string }).completedAt;   // simulate a pre-memory record
  const tl = initiativeTimeline(legacy);
  const done = tl.find((e) => e.kind === 'completed')!;
  assert.equal(done.at, legacy.updatedAt);                    // fell back, still present and ordered
  assert.equal(tl[tl.length - 1].kind, 'completed');
});

/* --- decline / pause / revise pathways ------------------------------------ */
test('held decisions each record their milestone, with the note as factual detail', () => {
  for (const [d, kind] of [['decline', 'declined'], ['pause', 'paused'], ['revise', 'revision_requested']] as const) {
    const i = decide(openInitiative(JK, T0), d, 'a reason', T1);
    const ev = initiativeTimeline(i).find((e) => e.kind === kind)!;
    assert.ok(ev, `${d} recorded`);
    assert.equal(ev.detail, 'a reason');
  }
});

/* --- the outcome is derived, never written by the Founder ----------------- */
test('completion outcome is derived from what the House prepared', () => {
  const completed = completeInitiative(decide(openInitiative(JK, T0), 'approve', undefined, T1), T2);
  const outcome = completionOutcome(completed);
  assert.ok(/prepared for your review/i.test(outcome));
  assert.ok(!/creative direction/i.test(outcome));   // internal direction is not a deliverable line
});

/* --- Founder-facing language derives from structural events --------------- */
test('timeline lines read as calm House language, never software terms', () => {
  const archived = archiveInitiative(completeInitiative(decide(openInitiative(JK, T0), 'approve', undefined, T1), T2), 'journal_entry', T3);
  for (const e of initiativeTimeline(archived)) {
    const line = timelineEventLine(e);
    assert.ok(line.length > 0);
    assert.ok(!/task|queue|process|dispatch|log|status/i.test(line));
  }
});

/* --- the record reuses attention + execution derivations (no duplication) -- */
test('the memory record consumes the authoritative attention and execution models', () => {
  const executing = decide(openInitiative(JK, T0), 'approve', undefined, T1);
  const r = initiativeRecord(executing);
  assert.deepEqual(r.attention, attentionKind(attentionForInitiative(executing)));
  assert.deepEqual(r.responsibilities, executionResponsibilities(executing));
  assert.equal(r.direction, JK);
  assert.equal(r.status, institutionalStatus(executing));
  assert.equal(r.outcome, undefined);                 // not completed → no outcome yet

  const completed = completeInitiative(executing, T2);
  const rc = initiativeRecord(completed);
  assert.equal(rc.attention.id, 'completed');         // resolves to the completed attention state
  assert.ok(rc.outcome && rc.outcome.length > 0);
});

/* --- the two modes: matters in motion vs. the institutional record -------- */
test('partition splits active matters from the settled record', () => {
  const executing = decide(openInitiative(JK, T0), 'approve', undefined, T1);
  const paused = decide(openInitiative('A held matter.', T0), 'pause', undefined, T1);
  const completed = completeInitiative(decide(openInitiative('Done work.', T0), 'approve', undefined, T1), T2);
  const declined = decide(openInitiative('A no.', T0), 'decline', undefined, T1);

  const { active, record } = partitionInitiatives([executing, paused, completed, declined]);
  assert.deepEqual(active.map((i) => i.status).sort(), ['executing', 'paused']);
  assert.deepEqual(record.map((i) => i.status).sort(), ['completed', 'declined']);
});
