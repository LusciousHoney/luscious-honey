/* =============================================================================
   Executive Workflow Engine v1. The Founder brings one initiative; the Chief of
   Staff conducts; the Executive Team contributes within charter; the Founder
   receives ONE Brief; approval routes work into offices; completion proposes how
   it enters institutional history. Pure, deterministic, no external publishing.
   ============================================================================= */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  EXECUTIVES, selectParticipants, openInitiative, deriveTitle, decide,
  advanceToExecution, recommendHistory, completeInitiative, archiveInitiative,
  upsertInitiative, HISTORY_DISPOSITIONS, executiveLabel,
} from '../src/headquarters/executive-workflow.ts';

const NOW = new Date('2026-07-19T09:00:00.000Z');
const JK = "I went to J.K. Hernandez's book signing yesterday. I met another creator. "
  + "J.K. complimented my narration voice. I'd like to turn this experience into content.";

/* --- the conductor chooses; the Founder chooses none of it ----------------- */
test('core executives are always enlisted; others join by domain — Founder picks no one', () => {
  const minimal = selectParticipants('a quiet thought');
  assert.ok(minimal.includes('creative_director') && minimal.includes('director_of_growth'));

  const jk = selectParticipants(JK);
  // the signing/creator meeting, the narration voice, and "content" mobilize the House
  assert.ok(jk.includes('creative_director'));
  assert.ok(jk.includes('director_of_growth'));
  assert.ok(jk.includes('head_of_production'), 'narration/voice calls Production');
  assert.ok(jk.includes('business_office'), 'meeting a creator at a signing calls the Business Office');
});

/* --- one initiative in → one Brief out ------------------------------------ */
test('openInitiative returns a single assembled Brief ready for the Founder', () => {
  const i = openInitiative(JK, NOW);
  assert.equal(i.status, 'brief_ready');
  assert.equal(i.title, "I went to J.K. Hernandez's book signing yesterday.");
  const b = i.brief;
  // the eight sections are all present and populated
  assert.ok(b.purpose.length > 0);
  assert.ok(b.recommendedDeliverables.length > 0);
  assert.ok(['normal', 'high'].includes(b.priority));
  assert.ok(b.suggestedTimeline.length > 0);
  assert.ok(b.recommendedPlatforms.length > 0);
  assert.ok(b.requiredFounderDecisions.includes('Approve the overall direction'));
  assert.ok(b.nextActions.length === b.recommendedDeliverables.length);
  // each participant contributed strictly within its charter areas
  for (const c of i.contributions) {
    const charter = EXECUTIVES.find((e) => e.id === c.executive)!.charter;
    for (const n of c.notes) assert.ok(charter.includes(n.area), `${c.executive} spoke within charter`);
  }
});

test('deriveTitle takes the Founder\'s own first sentence', () => {
  assert.equal(deriveTitle('Launch the winter series. Then rest.'), 'Launch the winter series.');
});

/* --- deterministic & idempotent ------------------------------------------- */
test('opening the same initiative twice yields an identical Brief (deterministic)', () => {
  assert.deepEqual(openInitiative(JK, NOW), openInitiative(JK, NOW));
});

/* --- the Founder's one decision ------------------------------------------- */
test('approve advances into execution and routes work into the correct offices', () => {
  const i = decide(openInitiative(JK, NOW), 'approve', undefined, NOW);
  assert.equal(i.status, 'executing');
  assert.equal(i.decision!.decision, 'approve');
  assert.equal(i.execution.length, i.brief.recommendedDeliverables.length);
  // every work item is internal-only; the automation seam stays inert (no publishing)
  for (const w of i.execution) {
    assert.equal(w.status, 'routed');
    assert.equal(w.automationHook, 'none');
    assert.ok(w.office.length > 0 && w.platform.length > 0);
  }
  // a TikTok script routes to a TikTok platform; a Journal entry to the House Journal
  const tt = i.execution.find((w) => w.title.includes('TikTok'));
  if (tt) assert.equal(tt.platform, 'TikTok');
  const jrnl = i.execution.find((w) => w.title.includes('Journal'));
  if (jrnl) assert.equal(jrnl.platform, 'House Journal');
});

test('revise / pause / decline hold the initiative without routing any work', () => {
  for (const d of ['revise', 'pause', 'decline'] as const) {
    const i = decide(openInitiative(JK, NOW), d, 'a note', NOW);
    assert.equal(i.execution.length, 0, `${d} routes nothing`);
    assert.notEqual(i.status, 'executing');
    assert.equal(i.decision!.note, 'a note');
  }
});

/* --- priority is derived, not asked --------------------------------------- */
test('a time-sensitive initiative is raised to high priority automatically', () => {
  const normal = openInitiative('A reflection on craft.', NOW);
  const urgent = openInitiative('An opportunity to launch this today.', NOW);
  assert.equal(normal.brief.priority, 'normal');
  assert.equal(urgent.brief.priority, 'high');
});

/* --- institutional history: the workflow proposes, not the Founder's memory - */
test('completion proposes a history disposition; archiving records the choice', () => {
  const done = completeInitiative(advanceToExecution(openInitiative(JK, NOW), NOW), NOW);
  assert.equal(done.status, 'completed');
  assert.ok(done.execution.every((w) => w.status === 'done'));
  assert.ok(HISTORY_DISPOSITIONS.some((h) => h.id === done.history!.recommended));
  // a Journal-bound initiative is proposed as a journal entry
  assert.equal(recommendHistory(openInitiative(JK, NOW)), 'journal_entry');

  const archived = archiveInitiative(done, 'institutional_milestone', NOW);
  assert.equal(archived.status, 'archived');
  assert.equal(archived.history!.chosen, 'institutional_milestone');
  assert.equal(archived.history!.recommended, done.history!.recommended);
});

/* --- persistence is its own store; upsert is idempotent ------------------- */
test('upsertInitiative replaces by id and never duplicates', () => {
  const i = openInitiative(JK, NOW);
  const once = upsertInitiative([], i);
  const twice = upsertInitiative(once, { ...i, status: 'paused' });
  assert.equal(twice.length, 1);
  assert.equal(twice[0].status, 'paused');
});

/* --- labels resolve seated Chairs through the Register -------------------- */
test('executive labels resolve seated Chairs from the Register', () => {
  assert.equal(executiveLabel('creative_director'), 'Creative Director');
  assert.equal(executiveLabel('publishing'), 'Publishing');
});
