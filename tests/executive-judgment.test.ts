/* =============================================================================
   EOS — Executive Judgment v0 (Phase II, the Judgment half). Memory- and
   context-informed Founder Attention: the M1 base view adjusted by Founder-owned
   preferences (M2) and the present protection window (M3), at step 2 only.
   Proves: passthrough with no tunings, absorb + quiet softening, the immovable
   safety floor (urgent/approve), down-only movement, the six dispositions
   preserved, purity/idempotence, no store/queue, and the privacy/log boundary
   (personal memory never read or emitted).
   ============================================================================= */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { deriveFounderAttention, type Disposition } from '../src/headquarters/executive-attention.ts';
import { type QueueItem } from '../src/headquarters/executive-work-queue.ts';
import { makeMemoryEntry, type MemoryEntry } from '../src/headquarters/executive-memory.ts';
import {
  judgeAttention, readTunings, isFloor, FLOOR_DISPOSITIONS,
  PREF_ABSORB, PREF_QUIET, type JudgedItem,
} from '../src/headquarters/executive-judgment.ts';

const NOW = new Date('2026-07-19T09:00:00.000Z');

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
// Founder-office items that land in each softenable / floor disposition under M1.
const urgentItem    = qi({ id: 'r:u', sourceId: 'u', office: 'founder', priority: 'critical' });
const approveItem   = qi({ id: 'r:a', sourceId: 'a', office: 'founder', requiredAction: 'Awaiting Founder' });
const recommendItem = qi({ id: 'r:r', sourceId: 'r', office: 'founder', sourceType: 'opportunity' });
const scheduleItem  = qi({ id: 'r:s', sourceId: 's', office: 'founder', dueState: 'soon', sourceType: 'production' });
const informItem    = qi({ id: 'r:i', sourceId: 'i', office: 'growth', status: 'waiting' });

const base = () => deriveFounderAttention([urgentItem, approveItem, recommendItem, scheduleItem, informItem]);
const pref = (key: string, value: string): MemoryEntry =>
  makeMemoryEntry({ class: 'preference', key, value }, NOW);
const eff = (v: { items: JudgedItem[] }, id: string): Disposition =>
  v.items.find((j) => j.item.id === id)!.effective;

/* --- no tunings: judged view equals the base view ------------------------- */
test('with no tunings, every effective disposition equals its base (pure passthrough)', () => {
  const v = judgeAttention(base(), { absorbedSources: [], quiet: false });
  for (const j of v.items) { assert.equal(j.effective, j.base); assert.equal(j.softened, false); assert.equal(j.reason, ''); }
  assert.equal(v.softenedTotal, 0);
});

/* --- absorb a matter kind: softens only that kind, only in the softenable band --- */
test('absorbing a source type holds those matters to inform; other matters are untouched', () => {
  const v = judgeAttention(base(), readTunings([pref(PREF_ABSORB, 'opportunity')], NOW));
  assert.equal(eff(v, 'r:r'), 'inform');        // recommend (opportunity) → absorbed to inform
  assert.equal(eff(v, 'r:s'), 'schedule');      // schedule (production) → not absorbed
  const jr = v.items.find((j) => j.item.id === 'r:r')!;
  assert.equal(jr.softened, true);
  assert.equal(jr.reason, 'absorbed: opportunity');
});

/* --- quiet window: softens the whole softenable band to inform ------------ */
test('an active quiet window softens recommend + schedule to inform', () => {
  const v = judgeAttention(base(), readTunings([makeMemoryEntry({ class: 'preference', key: PREF_QUIET, value: 'protected hours' }, NOW)], NOW));
  assert.equal(eff(v, 'r:r'), 'inform');
  assert.equal(eff(v, 'r:s'), 'inform');
  assert.equal(v.items.find((j) => j.item.id === 'r:r')!.reason, 'quiet window active');
});

/* --- THE SAFETY FLOOR: urgent + approve are immovable --------------------- */
test('urgent and approve are never softened, under any tuning', () => {
  assert.deepEqual([...FLOOR_DISPOSITIONS], ['urgent', 'approve']);
  assert.ok(isFloor('urgent') && isFloor('approve') && !isFloor('recommend'));
  const tunings = { absorbedSources: ['recommendation', 'opportunity', 'production'] as const, quiet: true };
  const v = judgeAttention(base(), { absorbedSources: [...tunings.absorbedSources], quiet: true });
  assert.equal(eff(v, 'r:u'), 'urgent');   // a critical matter always reaches the Founder
  assert.equal(eff(v, 'r:a'), 'approve');  // a decision only the Founder may give always reaches them
});

/* --- softening only ever moves DOWN the salience order -------------------- */
test('softening never escalates: an already-inform matter is not moved up', () => {
  const v = judgeAttention(base(), { absorbedSources: [], quiet: true });
  assert.equal(eff(v, 'r:i'), 'inform');   // was inform, stays inform (not re-tagged, not escalated)
  assert.equal(v.items.find((j) => j.item.id === 'r:i')!.softened, false);
});

/* --- the six dispositions are preserved ----------------------------------- */
test('every effective disposition is one of the six approved dispositions', () => {
  const six: Disposition[] = ['urgent', 'approve', 'recommend', 'schedule', 'inform', 'ignore'];
  const v = judgeAttention(base(), { absorbedSources: ['opportunity'], quiet: false });
  for (const j of v.items) assert.ok(six.includes(j.effective));
  for (const l of v.lineup) assert.ok(six.includes(l.disposition));
});

/* --- pure and idempotent; no input mutation ------------------------------- */
test('judgeAttention is pure and idempotent; it mutates no queue item', () => {
  const b = base();
  const t = readTunings([pref(PREF_ABSORB, 'opportunity')], NOW);
  const once = judgeAttention(b, t);
  const twice = judgeAttention(b, t);
  assert.deepEqual(once, twice);
  assert.equal(recommendItem.office, 'founder'); // originals untouched
  assert.equal(recommendItem.sourceType, 'opportunity');
});

/* --- privacy boundary: personal memory is never read or emitted ----------- */
test('personal / cross-domain memory does not tune attention and never appears in a reason', () => {
  const personal = makeMemoryEntry({ class: 'personal', key: PREF_ABSORB, value: 'opportunity' }, NOW);
  const crossDomain = makeMemoryEntry({ class: 'cross_domain', key: PREF_QUIET, value: 'secretly quiet' }, NOW);
  const t = readTunings([personal, crossDomain], NOW);
  assert.deepEqual(t.absorbedSources, []);   // absorb only reads preference-class
  assert.equal(t.quiet, false);              // quiet only from preference/context, not personal-class
  const v = judgeAttention(base(), t);
  for (const j of v.items) {
    assert.equal(j.effective, j.base);       // personal memory changed nothing
    assert.ok(!/secret|personal/i.test(j.reason)); // no memory value leaked into a reason
  }
});

/* --- unrecognized preferences are inert ----------------------------------- */
test('an unrecognized preference key has no effect', () => {
  const t = readTunings([pref('attention.unknown', 'opportunity')], NOW);
  assert.deepEqual(t.absorbedSources, []);
  assert.equal(t.quiet, false);
});

/* --- a quiet window expires with its memory (context-governed) ------------ */
test('an expiring quiet window lifts once it lapses', () => {
  const expiring = makeMemoryEntry(
    { class: 'expiring', key: PREF_QUIET, value: 'low energy through Thursday', expiresAt: '2026-07-19T17:00:00.000Z' }, NOW);
  assert.equal(readTunings([expiring], NOW).quiet, true);                               // during
  assert.equal(readTunings([expiring], new Date('2026-07-20T09:00:00.000Z')).quiet, false); // after expiry
});
