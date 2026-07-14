/* =============================================================================
   GROWTH STUDIO — content tests (pure, no DOM).

   Growth is measured in relationships, not metrics. These tests lock the room's
   honesty: the correspondence is a small, curated set of NAMED relationships,
   each with an editorial line and NEVER a number, statistic, or metric word.
   ============================================================================= */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { RELATIONSHIPS, SALON_LEDE, HORIZON_NOTE } from '../src/headquarters/growth.ts';

test('the correspondence is a curated set of named relationships', () => {
  assert.ok(RELATIONSHIPS.length >= 5 && RELATIONSHIPS.length <= 9);
  const names = RELATIONSHIPS.map((r) => r.name);
  for (const expected of ['Publishing', 'Readers', 'Substack', 'TikTok', 'Partnerships', 'Press', 'Community']) {
    assert.ok(names.includes(expected), `missing relationship: ${expected}`);
  }
  assert.equal(new Set(names).size, names.length, 'relationship names must be unique');
});

test('every relationship has a name and an editorial note', () => {
  for (const r of RELATIONSHIPS) {
    assert.ok(r.name.length > 0);
    assert.ok(r.note.length > 0);
  }
});

test('NO relationship note contains a number, statistic, or metric word', () => {
  const metric = /\b(\d|follower|subscriber|view|reach|engagement|impression|metric|analytic|kpi|rate|percent|%|growth rate|audience size|conversion|click|revenue)\b/i;
  for (const r of RELATIONSHIPS) {
    assert.ok(!metric.test(r.note), `relationship "${r.name}" leaks a metric: ${r.note}`);
    assert.ok(!/\d/.test(r.note), `relationship "${r.name}" contains a digit`);
  }
});

test('the room copy names the salon + horizon and carries no numbers', () => {
  assert.ok(SALON_LEDE.length > 0 && HORIZON_NOTE.length > 0);
  assert.ok(/relationship/i.test(SALON_LEDE), 'the lede should frame growth as relationships');
  assert.ok(/horizon/i.test(HORIZON_NOTE), 'the closing line should name the horizon');
  assert.ok(!/\d/.test(SALON_LEDE) && !/\d/.test(HORIZON_NOTE), 'no digits in the room copy');
});
