/* =============================================================================
   EDITORIAL OFFICE — editorial memory (persistence).
   All interview responses, draft versions, and reflections live in the founder's
   own browser (localStorage). Nothing is synced or sent anywhere. Drafts are
   archived, never overwritten; nothing is permanently removed without an
   explicit purge. This is the seam a real backend later replaces.
   ============================================================================= */

import type { Answer, DraftPacket, DraftVersion, OfficeState, Reflection, Responses } from './types';
import * as core from './core';

const KEY = 'lhc.office.v1';

function empty(): OfficeState {
  return { schemaVersion: 1, docs: {}, drafts: {}, reflections: [], askedQuestionIds: [] };
}

export function load(): OfficeState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as OfficeState;
    return { ...empty(), ...parsed };
  } catch {
    return empty();
  }
}

function save(state: OfficeState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable / full — the session simply won't persist */
  }
}

/* --- Interview responses (autosave) -------------------------------------- */

export function getResponses(docId: string): Responses {
  return load().docs[docId]?.responses ?? {};
}

export function setAnswer(docId: string, questionId: string, answer: Answer): void {
  const state = load();
  const doc = state.docs[docId] ?? { responses: {}, updatedAt: '' };
  doc.responses = { ...doc.responses, [questionId]: answer };
  doc.updatedAt = new Date().toISOString();
  state.docs[docId] = doc;
  save(state);
}

export function lastTouched(docId: string): string | undefined {
  return load().docs[docId]?.updatedAt;
}

/* --- Draft versions ------------------------------------------------------ */

export function getDrafts(docId: string): DraftVersion[] {
  return load().drafts[docId] ?? [];
}

export function saveDraftVersion(docId: string, packet: DraftPacket, notes = ''): DraftVersion {
  const state = load();
  const list = state.drafts[docId] ?? [];
  const version: DraftVersion = { version: core.nextVersionNumber(list), at: new Date().toISOString(), packet, notes };
  state.drafts[docId] = core.addVersion(list, version);
  save(state);
  return version;
}

export function updateDraftNotes(docId: string, version: number, notes: string): void {
  const state = load();
  const list = state.drafts[docId] ?? [];
  state.drafts[docId] = list.map((d) => (d.version === version ? { ...d, notes } : d));
  save(state);
}

export function archiveDraft(docId: string, version: number, archived = true): void {
  mutate(docId, (list) => core.setArchived(list, version, archived));
}

export function softDeleteDraft(docId: string, version: number, deleted = true): void {
  mutate(docId, (list) => core.setDeleted(list, version, deleted));
}

/** The only path that truly discards records — deliberate, explicit. */
export function purgeDeletedDrafts(docId: string): void {
  mutate(docId, (list) => core.purgeDeleted(list));
}

function mutate(docId: string, fn: (list: DraftVersion[]) => DraftVersion[]): void {
  const state = load();
  state.drafts[docId] = fn(state.drafts[docId] ?? []);
  save(state);
}

/* --- Reflections (Ask Me Something Different) ---------------------------- */

export function getReflections(): Reflection[] {
  return load().reflections;
}

export function getAskedIds(): string[] {
  return load().askedQuestionIds;
}

export function markAsked(questionId: string): void {
  const state = load();
  if (!state.askedQuestionIds.includes(questionId)) {
    state.askedQuestionIds = [...state.askedQuestionIds, questionId];
    save(state);
  }
}

export function saveReflection(questionId: string, question: string, answer: string): void {
  const state = load();
  state.reflections = [{ questionId, question, answer, at: new Date().toISOString() }, ...state.reflections];
  save(state);
}
