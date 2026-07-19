/* =============================================================================
   EOS — Executive Memory v0 (Milestone 2, Cognitive Layer)

   The Executive Manager's memory of the FOUNDER: classed, Founder-owned,
   expiring, and correctable — kept permanently separate from Headquarters'
   institutional memory (Register / Archive / Recommendations). Pure, testable
   logic, no UI, per the Executive Memory & Context Constitution (Doc 1).

   ★ Invariants enforced here:
     • The Founder owns every entry (owner is always 'founder'); no fact has two owners.
     • Institutional stores are never imported or written — this module knows nothing
       of Recommendations/Register/Archive.
     • Personal knowledge is the strictest class and never leaves this store as content;
       secrets are held as "a secret exists", never as value.
     • The store forgets on purpose: expiring facts are discarded past their date;
       corrections are visible (retire/restore), never silent erasure; least memory.
   ============================================================================= */

import { loadCollection, saveCollection } from './executive-register.ts';

const MEMORY_KEY = 'lhc.hq.executive-memory.v1';

/* --- the seven classes (Doc 1) -------------------------------------------- */

export type MemoryClass =
  | 'long_term' | 'temporary' | 'expiring' | 'preference'
  | 'institutional' | 'personal' | 'cross_domain';

export interface MemoryClassKind {
  id: MemoryClass;
  label: string;
  durable: boolean;              // survives without an expiry (retired only deliberately)
  privacy: 'standard' | 'personal' | 'secret';
}

export const MEMORY_CLASSES: MemoryClassKind[] = [
  { id: 'long_term',     label: 'Long-term',           durable: true,  privacy: 'standard' },
  { id: 'temporary',     label: 'Temporary context',   durable: false, privacy: 'standard' },
  { id: 'expiring',      label: 'Expiring information', durable: false, privacy: 'standard' },
  { id: 'preference',    label: 'Founder preference',   durable: true,  privacy: 'standard' },
  { id: 'institutional', label: 'Institutional (thin)', durable: false, privacy: 'standard' },
  { id: 'personal',      label: 'Personal',             durable: true,  privacy: 'personal' },
  { id: 'cross_domain',  label: 'Cross-domain',         durable: true,  privacy: 'personal' },
];
const CLASS_BY_ID = new Map(MEMORY_CLASSES.map((c) => [c.id, c]));
export function memoryClassLabel(id: MemoryClass): string { return CLASS_BY_ID.get(id)?.label ?? id; }

/* --- the entry ------------------------------------------------------------ */

export interface MemoryEntry {
  id: string;                    // deterministic: `mem:${class}:${key}:${capturedAt}`
  class: MemoryClass;
  key: string;                   // what this fact is about (recall handle)
  value: string;                 // the fact itself (never a credential/secret — see isSecret)
  owner: 'founder';              // EM memory is Founder-owned; the ONLY owner
  capturedAt: string;
  expiresAt?: string;            // required-in-spirit for 'expiring'; discarded past this
  retiredAt?: string;            // visible retirement (not deletion)
  supersedes?: string;          // id of the entry a correction replaced
  dependsOn?: string[];          // ids this fact was derived from (for correction propagation)
  secret?: boolean;             // true ⇒ value holds only a placeholder, never the secret
}

export interface MemoryInput {
  class: MemoryClass; key: string; value: string;
  expiresAt?: string; dependsOn?: string[]; secret?: boolean;
}

/** Build a Founder-owned entry. Secrets never store their value — only the fact one exists. */
export function makeMemoryEntry(input: MemoryInput, now: Date = new Date()): MemoryEntry {
  const capturedAt = now.toISOString();
  const secret = input.secret === true;
  return {
    id: `mem:${input.class}:${input.key}:${capturedAt}`,
    class: input.class, key: input.key,
    value: secret ? '[secret held — not stored]' : input.value,
    owner: 'founder', capturedAt,
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
    ...(input.dependsOn && input.dependsOn.length ? { dependsOn: input.dependsOn } : {}),
    ...(secret ? { secret: true } : {}),
  };
}

function isMemoryEntry(x: unknown): x is MemoryEntry {
  const e = x as MemoryEntry;
  return !!e && typeof e.id === 'string' && typeof e.key === 'string'
    && typeof e.value === 'string' && e.owner === 'founder'
    && CLASS_BY_ID.has(e.class) && typeof e.capturedAt === 'string';
}

/* --- lifecycle: hold, expire, recall -------------------------------------- */

export function isExpired(e: MemoryEntry, now: Date): boolean {
  return !!e.expiresAt && e.expiresAt <= now.toISOString();
}
export function isActive(e: MemoryEntry, now: Date = new Date()): boolean {
  return !e.retiredAt && !isExpired(e, now);
}

/** The living memory — not retired, not past its expiry. Pure. */
export function activeMemory(entries: MemoryEntry[], now: Date = new Date()): MemoryEntry[] {
  return entries.filter((e) => isActive(e, now));
}

/** Forget on purpose: drop entries whose expiry has lapsed (retaining them misleads). */
export function expireDue(entries: MemoryEntry[], now: Date = new Date()): MemoryEntry[] {
  return entries.filter((e) => !isExpired(e, now));
}

/** Recall active entries by class and/or key, most-recent first. Pure. */
export function recall(
  entries: MemoryEntry[], q: { class?: MemoryClass; key?: string } = {}, now: Date = new Date(),
): MemoryEntry[] {
  return activeMemory(entries, now)
    .filter((e) => (!q.class || e.class === q.class) && (!q.key || e.key === q.key))
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}

/* --- capture, correction, retirement -------------------------------------- */

/** Add or replace an entry by id — idempotent (capturing the same entry twice is a no-op). */
export function capture(entries: MemoryEntry[], entry: MemoryEntry): MemoryEntry[] {
  return [...entries.filter((e) => e.id !== entry.id), entry];
}

export interface CorrectionResult { entries: MemoryEntry[]; corrected: MemoryEntry; dependents: MemoryEntry[]; }

/**
 * Correct a fact VISIBLY: retire the old entry (kept, never erased) and insert a new
 * superseding one. Returns the dependents — active entries derived from the corrected id —
 * so the caller can surface what the correction affects (propagation, Doc 1).
 */
export function correct(
  entries: MemoryEntry[], id: string, patch: { value?: string; expiresAt?: string },
  now: Date = new Date(),
): CorrectionResult {
  const old = entries.find((e) => e.id === id);
  if (!old) return { entries, corrected: undefined as unknown as MemoryEntry, dependents: [] };
  const replacement = makeMemoryEntry(
    { class: old.class, key: old.key, value: patch.value ?? old.value, expiresAt: patch.expiresAt ?? old.expiresAt, secret: old.secret },
    now,
  );
  replacement.supersedes = id;
  const next = capture(entries.map((e) => (e.id === id ? { ...e, retiredAt: now.toISOString() } : e)), replacement);
  const dependents = activeMemory(next, now).filter((e) => e.dependsOn?.includes(id));
  return { entries: next, corrected: replacement, dependents };
}

/** Retire an entry — visible, reversible, never a silent erasure. */
export function retire(entries: MemoryEntry[], id: string, now: Date = new Date()): MemoryEntry[] {
  return entries.map((e) => (e.id === id ? { ...e, retiredAt: now.toISOString() } : e));
}
/** Restore a retired entry (the Founder can bring it back). */
export function restore(entries: MemoryEntry[], id: string): MemoryEntry[] {
  return entries.map((e) => { if (e.id === id) { const { retiredAt, ...rest } = e; return rest as MemoryEntry; } return e; });
}
/** The ONLY true deletion — an explicit, Founder-driven purge. */
export function purge(entries: MemoryEntry[], id: string): MemoryEntry[] {
  return entries.filter((e) => e.id !== id);
}

/* --- privacy boundaries --------------------------------------------------- */

export function isPersonal(e: MemoryEntry): boolean {
  return CLASS_BY_ID.get(e.class)?.privacy === 'personal';
}
export function isSecret(e: MemoryEntry): boolean { return e.secret === true; }

/**
 * The permanent boundary: NO Executive-memory entry may ever cross into an institution.
 * This is always false — modelled explicitly so the rule is testable and no export path
 * can be added by accident. (Personal/cross-domain are merely the strictest instances.)
 */
export function mayInformInstitution(_e: MemoryEntry): false { return false; }

/** A log-safe shadow: personal and secret values are never emitted. */
export function redactForLog(e: MemoryEntry): { id: string; class: MemoryClass; key: string; value: string } {
  const hidden = isSecret(e) || isPersonal(e);
  return { id: e.id, class: e.class, key: e.key, value: hidden ? '[withheld]' : e.value };
}

/* --- persistence (own key; never an institutional store) ------------------ */

export function loadMemory(): MemoryEntry[] {
  return loadCollection(MEMORY_KEY, isMemoryEntry);
}
export function saveMemory(entries: MemoryEntry[]): void {
  saveCollection(MEMORY_KEY, entries);
}
