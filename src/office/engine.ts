/* =============================================================================
   EDITORIAL OFFICE — swappable engines.
   Sprint 1A implements the WORKFLOW, not AI. Both features below sit behind an
   interface so a real AI service (Claude / OpenAI, via a backend proxy) can be
   dropped in a later sprint by implementing the same interface — the UI and the
   founder's workflow do not change.
   ============================================================================= */

import type { DocType, Responses, DraftPacket } from './types';
import { buildPacket } from './core.ts';

/* --- "Generate First Draft" — the draft engine --------------------------- */

export interface DraftEngine {
  id: string;
  label: string;
  /** Produce a draft artifact from the founder's responses. */
  generate(doc: DocType, responses: Responses, at?: string): DraftPacket;
}

/**
 * The on-device engine for Sprint 1A. It does NOT write prose or invent beliefs.
 * It assembles the founder's own answers into a structured editorial packet —
 * exactly the input a future AI engine will consume to draft the document.
 */
export const localPacketEngine: DraftEngine = {
  id: 'local-packet',
  label: 'Structured packet · on-device',
  generate(doc, responses, at = new Date().toISOString()) {
    return buildPacket(doc, responses, 'local-packet', at);
  },
};

/**
 * The active draft engine. To connect real AI later, implement DraftEngine
 * (returning a DraftPacket whose stages/notes carry AI drafts) and assign it
 * here. Nothing else in the Office needs to change.
 */
export const activeDraftEngine: DraftEngine = localPacketEngine;

/* --- "Ask Me Something Different" — the follow-up source ------------------ */

export interface Followup { id: string; prompt: string; }

export interface FollowupSource {
  id: string;
  label: string;
  /** The next question the founder hasn't seen; loops once the bank is spent. */
  next(askedIds: string[]): Followup | null;
}

/** Editor-written questions — the voice of an experienced editor, not a survey. */
export const FOLLOWUP_BANK: Followup[] = [
  { id: 'q-changed-mind', prompt: 'What belief have you changed your mind about?' },
  { id: 'q-less-alone', prompt: 'Which creator made you feel less alone?' },
  { id: 'q-outlive', prompt: 'What kind of work deserves to outlive you?' },
  { id: 'q-avoiding', prompt: 'What conversation are people avoiding?' },
  { id: 'q-first-reader', prompt: 'Who is the one reader you are really writing for?' },
  { id: 'q-refuse-money', prompt: 'What would you refuse to publish even if it paid for everything?' },
  { id: 'q-envy', prompt: 'Whose work do you envy — and what does that envy tell you?' },
  { id: 'q-quiet', prompt: 'What is the quietest thing the House does that matters most?' },
  { id: 'q-wrong', prompt: 'Where might the House be wrong, and how would you know?' },
  { id: 'q-keep-secret', prompt: 'What are you not saying yet because it is not ready?' },
  { id: 'q-ten-years', prompt: 'What will embarrass you about today’s House in ten years?' },
  { id: 'q-one-piece', prompt: 'If the House could publish only one piece a year, how would it choose?' },
  { id: 'q-inheritance', prompt: 'What did you inherit — from a person or a place — that the House carries?' },
  { id: 'q-cost', prompt: 'What has making real work cost you, and was it worth it?' },
  { id: 'q-permission', prompt: 'What are you giving a creator permission to do that no one else will?' },
  { id: 'q-ending', prompt: 'How should the House end, if it must — and what does that tell you about now?' },
];

export const curatedFollowups: FollowupSource = {
  id: 'curated',
  label: 'Curated by an editor',
  next(askedIds) {
    if (FOLLOWUP_BANK.length === 0) return null;
    const unseen = FOLLOWUP_BANK.find((q) => !askedIds.includes(q.id));
    // When the bank is exhausted, loop back to the start rather than stall.
    return unseen ?? FOLLOWUP_BANK[0];
  },
};

/** The active follow-up source. Swap to an AI source later — same interface. */
export const activeFollowupSource: FollowupSource = curatedFollowups;
