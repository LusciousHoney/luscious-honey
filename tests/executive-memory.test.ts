/* =============================================================================
   EOS — Executive Memory v0 (Milestone 2). Pure, Founder-owned, classed memory
   kept separate from institutional memory. Covers the seven classes, expiry,
   recall, idempotent capture, visible correction with propagation, retire/
   restore/purge, ownership, and the privacy boundaries of Doc 1.
   ============================================================================= */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  MEMORY_CLASSES, makeMemoryEntry, capture, activeMemory, expireDue, recall,
  correct, retire, restore, purge, isActive, isExpired, isPersonal, isSecret,
  mayInformInstitution, redactForLog, memoryClassLabel,
  type MemoryClass,
} from '../src/headquarters/executive-memory.ts';

const T0 = new Date('2026-07-19T09:00:00.000Z');
const LATER = new Date('2026-07-20T09:00:00.000Z');
const mk = (o: { class: MemoryClass; key: string; value?: string; expiresAt?: string; secret?: boolean; dependsOn?: string[] }, now = T0) =>
  makeMemoryEntry({ value: 'v', ...o }, now);

/* --- the seven classes ---------------------------------------------------- */
test('the seven memory classes are complete and labelled', () => {
  assert.deepEqual(MEMORY_CLASSES.map((c) => c.id),
    ['long_term', 'temporary', 'expiring', 'preference', 'institutional', 'personal', 'cross_domain']);
  assert.equal(memoryClassLabel('preference'), 'Founder preference');
});

/* --- ownership: no fact has two owners ------------------------------------ */
test('every entry is Founder-owned; ownership is fixed', () => {
  for (const c of MEMORY_CLASSES) assert.equal(mk({ class: c.id, key: 'k' }).owner, 'founder');
});

/* --- capture is idempotent ------------------------------------------------ */
test('capturing the same entry twice is a no-op (idempotent)', () => {
  const e = mk({ class: 'long_term', key: 'priority' });
  const once = capture([], e);
  const twice = capture(once, e);
  assert.equal(twice.length, 1);
  assert.deepEqual(twice, once);
});

/* --- expiry: forgets on purpose ------------------------------------------- */
test('expiring information is discarded past its expiry; expireDue drops it', () => {
  const e = mk({ class: 'expiring', key: 'trip', expiresAt: '2026-07-19T18:00:00.000Z' });
  assert.equal(isExpired(e, T0), false);
  assert.equal(isActive(e, T0), true);
  assert.equal(isExpired(e, LATER), true);
  assert.equal(activeMemory([e], LATER).length, 0, 'expired is not active');
  assert.equal(expireDue([e], LATER).length, 0, 'expired is forgotten');
  assert.equal(expireDue([e], T0).length, 1, 'still-valid is kept');
});

/* --- recall --------------------------------------------------------------- */
test('recall returns active matches, most-recent first, filtered by class/key', () => {
  const older = mk({ class: 'preference', key: 'deep-work', value: 'mornings' }, T0);
  const newer = mk({ class: 'preference', key: 'deep-work', value: 'early mornings' }, LATER);
  const other = mk({ class: 'long_term', key: 'goal' }, T0);
  const all = [older, newer, other];
  const pref = recall(all, { class: 'preference', key: 'deep-work' }, LATER);
  assert.equal(pref[0].value, 'early mornings', 'latest wins on recall');
  assert.equal(recall(all, { key: 'goal' }, LATER).length, 1);
  assert.equal(recall(all, {}, LATER).length, 3);
});

/* --- correction: visible + propagates ------------------------------------- */
test('correction retires the old entry, adds a superseding one, and surfaces dependents', () => {
  const base = mk({ class: 'long_term', key: 'venue', value: 'Hall A' }, T0);
  const derived = mk({ class: 'cross_domain', key: 'plan', value: 'depends on venue', dependsOn: [base.id] }, T0);
  const start = [base, derived];
  const r = correct(start, base.id, { value: 'Hall B' }, LATER);
  assert.equal(r.corrected.value, 'Hall B');
  assert.equal(r.corrected.supersedes, base.id);
  // old is retired (kept, not erased) and no longer active
  const oldNow = r.entries.find((e) => e.id === base.id)!;
  assert.ok(oldNow.retiredAt, 'old entry retired, not deleted');
  assert.equal(isActive(oldNow, LATER), false);
  // dependent is surfaced (propagation)
  assert.deepEqual(r.dependents.map((d) => d.id), [derived.id]);
  // nothing lost: the retired original is still present in the store
  assert.ok(r.entries.some((e) => e.id === base.id));
});

/* --- retire / restore / purge --------------------------------------------- */
test('retire is reversible; purge is the only true deletion', () => {
  const e = mk({ class: 'temporary', key: 'now' });
  const retired = retire([e], e.id, LATER);
  assert.ok(retired[0].retiredAt);
  assert.equal(isActive(retired[0], LATER), false);
  const restored = restore(retired, e.id);
  assert.equal(restored[0].retiredAt, undefined);
  assert.equal(isActive(restored[0], LATER), true);
  assert.equal(purge(restored, e.id).length, 0, 'purge removes entirely');
});

/* --- privacy boundaries --------------------------------------------------- */
test('personal & cross-domain are personal-privacy; secrets never store their value', () => {
  assert.equal(isPersonal(mk({ class: 'personal', key: 'health' })), true);
  assert.equal(isPersonal(mk({ class: 'cross_domain', key: 'x' })), true);
  assert.equal(isPersonal(mk({ class: 'long_term', key: 'k' })), false);
  const secret = mk({ class: 'preference', key: 'passphrase', value: 'hunter2', secret: true });
  assert.equal(isSecret(secret), true);
  assert.equal(secret.value.includes('hunter2'), false, 'secret value is never stored');
});

test('no entry may ever inform an institution; personal/secret are withheld from logs', () => {
  for (const c of MEMORY_CLASSES) assert.equal(mayInformInstitution(mk({ class: c.id, key: 'k' })), false);
  assert.equal(redactForLog(mk({ class: 'personal', key: 'h', value: 'private' })).value, '[withheld]');
  assert.equal(redactForLog(mk({ class: 'preference', key: 's', value: 'x', secret: true })).value, '[withheld]');
  assert.equal(redactForLog(mk({ class: 'long_term', key: 'g', value: 'ship the book' })).value, 'ship the book');
});

/* --- separation from institutional memory (structural) -------------------- */
test('the module imports no institutional store (Register/Archive/Recommendations)', () => {
  const src = readFileSync(new URL('../src/headquarters/executive-memory.ts', import.meta.url), 'utf8');
  const imports = src.match(/^import .*$/gm) ?? [];
  for (const line of imports) {
    assert.ok(!/chief-of-staff-ops|content-opportunity|creative-|production-readiness|growth-intelligence|executive-work-queue/.test(line),
      `unexpected institutional import: ${line}`);
  }
  // only the shared storage helper is imported
  assert.ok(imports.some((l) => l.includes('executive-register.ts')) && imports.length === 1);
});

/* --- determinism ---------------------------------------------------------- */
test('makeMemoryEntry is deterministic for a fixed clock', () => {
  const a = makeMemoryEntry({ class: 'long_term', key: 'k', value: 'v' }, T0);
  const b = makeMemoryEntry({ class: 'long_term', key: 'k', value: 'v' }, T0);
  assert.deepEqual(a, b);
});
