/* =============================================================================
   EDITORIAL OFFICE — logic tests (pure core + engine). No DOM, no storage.
   ============================================================================= */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as core from '../src/office/core.ts';
import { localPacketEngine, curatedFollowups, FOLLOWUP_BANK } from '../src/office/engine.ts';
import { getDocType } from '../src/office/schema.ts';
import type { Responses, DraftVersion } from '../src/office/types.ts';

const doc = getDocType('founders-note')!;

test('schema loads and flattens into questions', () => {
  assert.ok(doc);
  assert.equal(core.allQuestions(doc).length > 8, true);
});

test('isAnswered handles each input type', () => {
  assert.equal(core.isAnswered({ type: 'open', text: '  ' }), false);
  assert.equal(core.isAnswered({ type: 'open', text: 'yes' }), true);
  assert.equal(core.isAnswered({ type: 'choice', value: 'A' }), true);
  assert.equal(core.isAnswered({ type: 'choice', value: '', other: 'x' }), true);
  assert.equal(core.isAnswered({ type: 'choice', value: '', other: '' }), false);
  assert.equal(core.isAnswered({ type: 'multi', values: [] }), false);
  assert.equal(core.isAnswered({ type: 'multi', values: ['A'] }), true);
});

test('resume: firstUnansweredIndex points at the first gap', () => {
  const qs = core.allQuestions(doc);
  const responses: Responses = { [qs[0].id]: { type: 'open', text: 'a' } };
  assert.equal(core.firstUnansweredIndex(qs, responses), 1);
  assert.equal(core.firstUnansweredIndex(qs, {}), 0);
});

test('progress + canGenerate gate on real answers', () => {
  const qs = core.allQuestions(doc);
  const responses: Responses = {};
  assert.equal(core.canGenerate(doc, responses), false);
  for (let i = 0; i < 3; i++) responses[qs[i].id] = { type: 'open', text: 'x' };
  assert.equal(core.overallProgress(doc, responses).answered, 3);
  assert.equal(core.canGenerate(doc, responses), true);
});

test('answerToText normalizes each type (including Other)', () => {
  assert.equal(core.answerToText({ type: 'open', text: ' hi ' }), 'hi');
  assert.equal(core.answerToText({ type: 'choice', value: 'The work' }), 'The work');
  assert.equal(core.answerToText({ type: 'choice', value: '', other: 'my way' }), 'Other: my way');
  assert.equal(core.answerToText({ type: 'multi', values: ['Warm', 'Exacting'], other: 'Wry' }),
    'Warm, Exacting, Other: Wry');
});

test('packet + markdown assemble from responses (no invented content)', () => {
  const qs = core.allQuestions(doc);
  const responses: Responses = { [qs[0].id]: { type: 'open', text: 'Because the work needs a home.' } };
  const packet = core.buildPacket(doc, responses, 'local-packet', '2026-07-07T00:00:00Z');
  assert.equal(packet.docTypeId, 'founders-note');
  assert.equal(packet.stages.length, doc.stages.length);
  const md = core.packetToMarkdown(packet);
  assert.match(md, /Because the work needs a home\./);
  assert.match(md, /not AI-written/i);
});

test('draft engine produces a packet via the DraftEngine interface', () => {
  const qs = core.allQuestions(doc);
  const responses: Responses = { [qs[0].id]: { type: 'open', text: 'real answer' } };
  const packet = localPacketEngine.generate(doc, responses, '2026-07-07T00:00:00Z');
  assert.equal(packet.engine, 'local-packet');
  assert.equal(packet.answered, 1);
});

test('version history: add, archive, soft-delete, restore, purge', () => {
  const mk = (v: number): DraftVersion => ({
    version: v, at: '2026-07-07', notes: '',
    packet: core.buildPacket(doc, {}, 'local-packet', '2026-07-07'),
  });
  let list: DraftVersion[] = [];
  assert.equal(core.nextVersionNumber(list), 1);
  list = core.addVersion(list, mk(1));
  list = core.addVersion(list, mk(core.nextVersionNumber(list)));
  assert.equal(list.length, 2);
  assert.equal(core.liveVersions(list).length, 2);

  list = core.setArchived(list, 1, true);
  assert.equal(core.liveVersions(list).length, 1);
  assert.equal(core.archivedVersions(list).length, 1);

  list = core.setDeleted(list, 2, true);
  assert.equal(core.liveVersions(list).length, 0);
  assert.equal(core.deletedVersions(list).length, 1);

  list = core.setDeleted(list, 2, false); // restore
  assert.equal(core.liveVersions(list).length, 1);

  list = core.setDeleted(list, 1, true);
  const purged = core.purgeDeleted(list); // explicit, deliberate
  assert.equal(purged.some((d) => d.version === 1), false);
});

test('curated follow-ups: no repeats, then loops', () => {
  const first = curatedFollowups.next([]);
  assert.equal(first?.id, FOLLOWUP_BANK[0].id);
  const second = curatedFollowups.next([FOLLOWUP_BANK[0].id]);
  assert.equal(second?.id, FOLLOWUP_BANK[1].id);
  const allAsked = FOLLOWUP_BANK.map((q) => q.id);
  assert.equal(curatedFollowups.next(allAsked)?.id, FOLLOWUP_BANK[0].id); // loops
});

test("Founder's Interview: ~30–40 questions across the five named stages", () => {
  assert.deepEqual(doc.stages.map((s) => s.name),
    ['The Foundation', 'The Philosophy', 'The Community', 'The Voice', 'The Legacy']);
  const n = core.allQuestions(doc).length;
  assert.ok(n >= 30 && n <= 40, `expected 30–40 questions, got ${n}`);
});

test('packet also groups answers by editorial theme (category)', () => {
  const responses: Responses = { 'fn-line': { type: 'open', text: 'The dark makes the lit rooms matter.' } };
  const packet = core.buildPacket(doc, responses, 'local-packet', '2026-07-09');
  const names = packet.themes.map((t) => t.name);
  for (const cat of ['Origin story', 'Why the House exists', 'Who it serves', 'What it protects',
                     'Editorial standards', 'Community values', 'Tone and voice', 'Legacy vision',
                     'Phrases worth preserving', 'Possible pull quotes', 'Possible Writing Wall fragments']) {
    assert.ok(names.includes(cat), `packet missing theme: ${cat}`);
  }
  const pull = packet.themes.find((t) => t.name === 'Possible pull quotes')!;
  assert.match(pull.items.map((i) => i.answer).join(' '), /lit rooms matter/);
  // Document types without categories produce no themes (backward compatible).
  assert.equal(core.buildPacket(getDocType('editorial-charter')!, {}, 'local-packet', 'x').themes.length, 0);
});
