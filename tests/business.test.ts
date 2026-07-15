/* =============================================================================
   BUSINESS OFFICE — content tests (pure, no DOM).

   Protection before administration. These tests lock the room's honesty: the
   Archive is a curated set of ARCHIVAL SUBJECTS (never records), each with an
   editorial line and NEVER a number, figure, balance, date, status, or record.
   ============================================================================= */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SAFEGUARDS, STUDY_LEDE, CONTINUITY_NOTE } from '../src/headquarters/business.ts';

test('the Archive holds exactly the eight approved safeguard subjects, in order', () => {
  assert.deepEqual(
    SAFEGUARDS.map((s) => s.name),
    ['Rights', 'Contracts', 'Licensing', 'Publishing', 'Finance', 'Legal', 'Legacy', 'Continuity'],
  );
});

test('every safeguard has a subject name and an editorial note', () => {
  for (const s of SAFEGUARDS) {
    assert.ok(s.name.length > 0);
    assert.ok(s.note.length > 0);
  }
});

test('NO safeguard note contains a number, figure, date, status, or record', () => {
  const forbidden = /\b(\d|balance|revenue|figure|amount|invoice|dollar|usd|filing|status|record|database|kpi|metric|percent|%|fee|payment|valuation)\b/i;
  for (const s of SAFEGUARDS) {
    assert.ok(!forbidden.test(s.note), `safeguard "${s.name}" leaks administration: ${s.note}`);
    assert.ok(!/\d/.test(s.note), `safeguard "${s.name}" contains a digit`);
  }
});

test('the room copy names the counsel’s study + permanence and carries no numbers', () => {
  assert.ok(STUDY_LEDE.length > 0 && CONTINUITY_NOTE.length > 0);
  assert.ok(/counsel|kept safe|protection/i.test(STUDY_LEDE), 'the lede should frame protection');
  assert.ok(/endure|last|handed on|permanen/i.test(CONTINUITY_NOTE), 'the closing line should name permanence');
  assert.ok(!/\d/.test(STUDY_LEDE) && !/\d/.test(CONTINUITY_NOTE), 'no digits in the room copy');
});
