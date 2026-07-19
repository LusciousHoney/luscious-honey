/* =============================================================================
   EOS — Founder Attention v0 (Milestone 1). Pure classification of the existing
   derived Executive Work Queue into the six attention dispositions. Verifies the
   mapping, determinism, safe handling of missing/conflicting signals (no invented
   urgency), stable ordering, and that nothing is mutated or duplicated.
   ============================================================================= */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DISPOSITIONS, classifyAttention, deriveFounderAttention, attentionLineup, dispositionLabel,
} from '../src/headquarters/executive-attention.ts';
import { type QueueItem } from '../src/headquarters/executive-work-queue.ts';

/** A representative QueueItem with safe, non-escalating defaults; override per case. */
function qi(over: Partial<QueueItem> = {}): QueueItem {
  return {
    id: 'recommendation:x', sourceType: 'recommendation', sourceId: 'x',
    owner: 'Chief of Staff', office: 'chief_of_staff', priority: 'normal',
    title: 't', summary: 's', requiredAction: 'Review requested',
    status: 'actionable', dueState: 'none',
    createdAt: '2026-07-17T09:00:00.000Z', updatedAt: '2026-07-17T09:00:00.000Z',
    provenance: { recommendationId: 'x' }, route: '#/chief-of-staff',
    ...over,
  };
}
const cls = (o: Partial<QueueItem>) => classifyAttention(qi(o));

/* --- the six dispositions ------------------------------------------------- */
test('each disposition is produced by its defining condition', () => {
  assert.equal(cls({ status: 'hidden' }), 'ignore', 'absorbed / promoted work is ignored');
  assert.equal(cls({ status: 'completed' }), 'inform', 'finished work is awareness only');
  assert.equal(cls({ status: 'waiting', office: 'production' }), 'inform', 'in-motion work is awareness');
  assert.equal(cls({ office: 'founder', status: 'actionable', priority: 'critical' }), 'urgent');
  assert.equal(cls({ office: 'founder', status: 'actionable', requiredAction: 'Awaiting Founder' }), 'approve');
  assert.equal(cls({ office: 'founder', status: 'actionable', dueState: 'soon' }), 'schedule');
  assert.equal(cls({ office: 'founder', status: 'actionable' }), 'recommend', 'a prepared founder item awaits review');
  assert.equal(cls({ office: 'creative_director', status: 'actionable' }), 'inform', 'work owned by a Chair is awareness');
});

/* --- urgency vs importance / no invented urgency -------------------------- */
test('urgency comes only from critical priority — importance and timing do not fabricate it', () => {
  // due "now" but not critical → still a review, never urgent
  assert.equal(cls({ office: 'founder', status: 'actionable', priority: 'high', dueState: 'now', requiredAction: 'Review requested' }), 'recommend');
  // a founder decision at normal priority is "approve" (a decision), not "urgent"
  assert.equal(cls({ office: 'founder', status: 'actionable', priority: 'normal', requiredAction: 'Awaiting Founder' }), 'approve');
});

test('waiting work stays visible as awareness and is never urgent; completed does not compete with decisions', () => {
  assert.equal(cls({ status: 'waiting', office: 'creative_director', priority: 'high' }), 'inform');
  assert.equal(cls({ status: 'completed', office: 'founder', priority: 'critical' }), 'inform');
});

/* --- conflicting signals resolve conservatively (down, never up) ---------- */
test('conflicting signals never escalate: hidden/completed/waiting win over founder+critical', () => {
  assert.equal(cls({ status: 'hidden', office: 'founder', priority: 'critical', requiredAction: 'Awaiting Founder' }), 'ignore');
  assert.equal(cls({ status: 'waiting', office: 'founder', priority: 'critical' }), 'inform', 'a founder item still in motion is awareness, not urgent');
});

/* --- missing / incomplete data → safest lower disposition ----------------- */
test('a founder-actionable item with no urgency signals defaults to review, not escalation', () => {
  assert.equal(cls({ office: 'founder', status: 'actionable', priority: 'normal', requiredAction: 'No action required', dueState: 'none' }), 'recommend');
  // an item whose only signal is a non-founder office is mere awareness
  assert.equal(cls({ office: 'business', status: 'actionable', priority: 'high' }), 'inform');
});

/* --- determinism & purity (no mutation) ----------------------------------- */
test('classification is deterministic and never mutates the item (Recommendations unchanged)', () => {
  const item = qi({ office: 'founder', status: 'actionable', requiredAction: 'Awaiting Founder' });
  const snapshot = structuredClone(item);
  const a = classifyAttention(item);
  const b = classifyAttention(item);
  assert.equal(a, b, 'same input → same output');
  assert.deepEqual(item, snapshot, 'the item (a Recommendation projection) is not modified');
  assert.doesNotThrow(() => classifyAttention(Object.freeze(qi()) as QueueItem), 'pure read works on a frozen item');
});

/* --- the derived view: grouping, ordering, idempotence -------------------- */
test('deriveFounderAttention groups in stable salience order and is idempotent', () => {
  const items: QueueItem[] = [
    qi({ id: 'r:inform', status: 'waiting', office: 'growth' }),
    qi({ id: 'r:urgent', office: 'founder', status: 'actionable', priority: 'critical' }),
    qi({ id: 'r:ignore', status: 'hidden' }),
    qi({ id: 'r:approve', office: 'founder', status: 'actionable', requiredAction: 'Awaiting Founder' }),
    qi({ id: 'r:recommend', office: 'founder', status: 'actionable' }),
  ];
  const view = deriveFounderAttention(items);
  assert.deepEqual(view.groups.map((g) => g.disposition), ['urgent', 'approve', 'recommend', 'inform', 'ignore'],
    'groups follow urgent → ignore, empty groups omitted, schedule absent here');
  // idempotent
  assert.deepEqual(deriveFounderAttention(items), view);
  // input is not mutated
  const before = structuredClone(items);
  deriveFounderAttention(items);
  assert.deepEqual(items, before, 'the Work Queue items are untouched (queue stays derived, owns nothing)');
});

test('provenance rides along unchanged through the view', () => {
  const view = deriveFounderAttention([qi({ id: 'recommendation:p', office: 'founder', status: 'actionable',
    provenance: { intelId: 'i', opportunityId: 'o', productionId: 'p', recommendationId: 'p' } })]);
  assert.deepEqual(view.items[0].provenance, { intelId: 'i', opportunityId: 'o', productionId: 'p', recommendationId: 'p' });
});

/* --- the summary line-up -------------------------------------------------- */
test('attentionLineup excludes ignore, keeps salience order, counts honestly', () => {
  const items: QueueItem[] = [
    qi({ id: '1', status: 'hidden' }), qi({ id: '2', status: 'hidden' }),          // ignore ×2 (not surfaced)
    qi({ id: '3', office: 'founder', status: 'actionable', priority: 'critical' }), // urgent
    qi({ id: '4', status: 'completed' }),                                           // inform
    qi({ id: '5', office: 'founder', status: 'actionable', requiredAction: 'Awaiting Founder' }), // approve
  ];
  const view = deriveFounderAttention(items);
  const lineup = attentionLineup(view);
  assert.deepEqual(lineup.map((l) => l.disposition), ['urgent', 'approve', 'inform'], 'no ignore, salience order');
  assert.deepEqual(lineup.map((l) => l.count), [1, 1, 1]);
  assert.equal(view.surfacedTotal, 3, 'surfaced total excludes the two ignored items');
});

test('an empty queue yields an empty, truthful view', () => {
  const view = deriveFounderAttention([]);
  assert.deepEqual(view.groups, []);
  assert.deepEqual(attentionLineup(view), []);
  assert.equal(view.surfacedTotal, 0);
});

/* --- the disposition vocabulary ------------------------------------------- */
test('the six dispositions are complete, ranked, and labelled; ignore is never surfaced', () => {
  assert.equal(DISPOSITIONS.length, 6);
  assert.deepEqual(DISPOSITIONS.map((d) => d.id), ['urgent', 'approve', 'recommend', 'schedule', 'inform', 'ignore']);
  assert.deepEqual(DISPOSITIONS.map((d) => d.rank), [0, 1, 2, 3, 4, 5]);
  assert.equal(DISPOSITIONS.find((d) => d.id === 'ignore')!.surface, false);
  assert.equal(DISPOSITIONS.filter((d) => d.surface).length, 5);
  assert.equal(dispositionLabel('approve'), 'For your decision');
});
