/* =============================================================================
   APPROVED CREATIVE MATTER — the activation derivation (Milestone: Approved
   Creative Matter Activation, V1).

   When the Founder ACCEPTS a submission, the House should not stop at "Approved."
   An accepted submission becomes a coordinated CREATIVE MATTER across the
   Collective's existing areas of responsibility — and the House should derive the
   next appropriate institutional recommendation, so the Founder never has to
   re-enter the work elsewhere or decide which department receives it.

   ★ This module is a PURE DERIVATION — a projection over existing authoritative
     state (the submissions spine + the canonical workflow status). It is NOT a
     new engine, NOT a new workflow, and NOT a new source of truth:
       • it holds no data and no I/O;
       • it never copies the submission — it keeps a durable REFERENCE
         (submissionId) plus only the institutional fields needed to coordinate;
       • it reads the existing status; it invents no new states;
       • one submission derives exactly ONE matter (idempotent by construction),
         so re-processing the same submission never activates it twice.

   Ownership is preserved (see docs/Collective-Architecture-Baseline.md §14):
   Artist Submission owns intake; Editorial owns review; the Founder owns the
   decision; Executive Workflow owns advancing accepted matters; the areas below
   own their existing responsibilities. This module only DERIVES and PRESENTS —
   it claims no work has occurred and fabricates no executive activity.
   ============================================================================= */

import type { Submission } from './adapters.ts';
import { VOICE_NOTES_STUDIO } from './production.ts';

/** The Collective's existing areas of responsibility (institutions, not engines). */
export type CollectiveArea =
  | 'Creator Relationships'
  | 'Editorial'
  | 'Production'
  | 'Publishing'
  | 'Growth';

/** The accepted workflow statuses that constitute a live/settled creative matter.
    Derived from the canonical workflow — no new state is introduced. */
const ACCEPTED_STATUSES = ['approved', 'scheduled', 'published'];
const SETTLED_STATUSES = ['published'];

/** Whether a submission's status means it has become an accepted creative matter. */
export function isAcceptedMatter(status: string): boolean {
  return ACCEPTED_STATUSES.includes(status);
}

/** Institutional titles for the creative types (kept in step with the registry). */
const TYPE_TITLES: Record<string, string> = {
  artist_feature: 'Interview / Artist Feature',
  music: 'Music',
  book: 'Book or Literary Work',
  podcast: 'Podcast or Audio Program',
  visual_art: 'Visual Art or Photography',
  event: 'Event or Live Experience',
  other_proposal: 'Other Creative Proposal',
};
export function typeTitle(type: string): string {
  return TYPE_TITLES[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The requested-involvement signal that means a spoken/recorded element is wanted. */
const SPOKEN_SIGNAL = 'Interview or live presentation';
/** Types that are inherently audio work (a Voice Notes session always fits). */
const AUDIO_TYPES = new Set(['artist_feature', 'music', 'podcast']);

/* --- Responsibility derivation ------------------------------------------------
   Derived from the creative type, the requested Collective involvement, and the
   editorial signal — NEVER a claim that the work has happened. "Other Creative
   Proposal" deliberately does not auto-assign every area; it needs a clear
   institutional recommendation (the requested involvement, or the Founder's
   direction). */

const BASE_RESPONSIBILITIES: Record<string, CollectiveArea[]> = {
  artist_feature: ['Creator Relationships', 'Editorial', 'Production', 'Publishing', 'Growth'],
  music:          ['Creator Relationships', 'Editorial', 'Production', 'Publishing', 'Growth'],
  book:           ['Creator Relationships', 'Editorial', 'Publishing', 'Growth'],
  podcast:        ['Creator Relationships', 'Editorial', 'Production', 'Publishing', 'Growth'],
  visual_art:     ['Creator Relationships', 'Editorial', 'Publishing', 'Growth'],
  event:          ['Creator Relationships', 'Production', 'Growth'],
  other_proposal: [],
};

const AREA_ORDER: CollectiveArea[] = ['Creator Relationships', 'Editorial', 'Production', 'Publishing', 'Growth'];

/**
 * Derive the responsible Collective areas for a matter. Base areas come from the
 * creative type; the requested involvement can add areas (e.g. Production for a
 * book only when a recording/reading is wanted, or Editorial/Publishing coverage
 * for an event). Areas are returned in a stable institutional order.
 */
export function matterResponsibilities(type: string, involvement: string[]): CollectiveArea[] {
  const want = new Set<CollectiveArea>(BASE_RESPONSIBILITIES[type] || []);
  const requested = new Set(involvement);

  // Requested involvement can bring in a named area explicitly.
  for (const area of AREA_ORDER) if (requested.has(area)) want.add(area);

  // A spoken/recorded element pulls Production in for otherwise text/visual types.
  if (requested.has(SPOKEN_SIGNAL)) { want.add('Production'); want.add('Editorial'); }

  return AREA_ORDER.filter((a) => want.has(a));
}

/** One institutional line for what an area holds — no software mechanics. */
export function responsibilityRole(area: CollectiveArea): string {
  switch (area) {
    case 'Creator Relationships': return 'will hold the relationship with the artist and their context';
    case 'Editorial':             return 'will prepare and shape the feature';
    case 'Production':            return 'will coordinate the recording and finishing';
    case 'Publishing':            return 'will plan how and where it reaches readers';
    case 'Growth':                return 'will carry it to the wider audience';
  }
}

/* --- Voice Notes Studio eligibility ------------------------------------------
   A Voice Notes session fits an audio matter (interview, narration, voice memo,
   reading, spoken introduction, audio commentary). Text/visual matters are NOT
   routed to the Studio unless a spoken/recorded element was actually requested. */
export interface VoiceNotesFit { eligible: boolean; purpose: string | null; }

export function voiceNotesEligibility(
  type: string, involvement: string[], interest?: string | null,
): VoiceNotesFit {
  const requestedSpoken = involvement.includes(SPOKEN_SIGNAL);
  const eligible = AUDIO_TYPES.has(type) || requestedSpoken;
  if (!eligible) return { eligible: false, purpose: null };

  let purpose: string;
  if (type === 'artist_feature') {
    purpose = interest && /performance/i.test(interest)
      ? 'the interview and any spoken performance'
      : 'the interview recording';
  } else if (type === 'music') purpose = 'the artist interview or spoken introduction';
  else if (type === 'podcast') purpose = 'the episode or segment recording';
  else if (type === 'book') purpose = 'the author reading or interview';
  else if (type === 'event') purpose = 'a spoken introduction or segment';
  else purpose = 'the spoken segment';
  return { eligible: true, purpose };
}

/* --- The creative matter (a reference + coordination fields, never a copy) ---- */
export interface CreativeMatter {
  /** Durable reference to the originating submission (the source of truth). */
  submissionId: number;
  type: string;
  typeTitle: string;
  /** The artist or creator the matter is about (the submission's subject). */
  artist: string;
  /** Who brought it, and how they relate to the artist. */
  requester: string;
  requesterRelation: string;
  /** The approved opportunity / direction, in one line. */
  direction: string;
  /** Relevant links and assets carried from the submission (references only). */
  assets: string[];
  /** The involvement the submitter requested (a proposal, not a claim). */
  involvementRequested: string[];
  /** The Founder decision that activated the matter. */
  decision: 'accepted';
  /** The current authoritative workflow status. */
  status: string;
  /** Live coordination vs settled into the record. */
  phase: 'active' | 'settled';
  /** Derived responsible Collective areas. */
  responsibilities: CollectiveArea[];
  /** Whether the Voice Notes Studio fits, and for what. */
  voiceNotes: VoiceNotesFit;
  /** Key dates / timing carried from the submission, if any. */
  keyDates: string | null;
  /** A human disposition line for the matter's current standing. */
  disposition: string;
}

function str(v: unknown): string { return typeof v === 'string' ? v.trim() : ''; }

function collectAssets(fields: Record<string, unknown>): string[] {
  const out: string[] = [];
  const push = (v: unknown) => { const s = str(v); if (s) out.push(s); };
  // Free-form links (one per line) + known link-bearing keys across all types.
  for (const line of str(fields.links).split('\n')) { const s = line.trim(); if (s) out.push(s); }
  push(fields.musicUrl); push(fields.listeningLink); push(fields.listenLink);
  push(fields.bookLink); push(fields.portfolioLink); push(fields.social);
  push(fields.assets);
  return Array.from(new Set(out));
}

/**
 * Derive the one creative matter for an accepted submission, or null if the
 * submission is not (yet) accepted. Pure and idempotent: the same submission
 * always yields the same single matter, keyed by its id.
 */
export function deriveCreativeMatter(s: Submission): CreativeMatter | null {
  if (!isAcceptedMatter(s.status)) return null;

  const fields = (s.fields || {}) as Record<string, unknown>;
  const involvement = Array.isArray(fields.involvement) ? (fields.involvement as string[]) : [];
  const interest = str(fields.interest) || null;

  const responsibilities = matterResponsibilities(s.type, involvement);
  const voiceNotes = voiceNotesEligibility(s.type, involvement, interest);

  const requester = str(fields.submitterName) || s.name;
  const requesterRelation = str(fields.submittedBy) || 'The artist, submitting their own work';
  const direction = str(fields.title) || str(s.summary) || interest || typeTitle(s.type);
  const phase: 'active' | 'settled' = SETTLED_STATUSES.includes(s.status) ? 'settled' : 'active';

  return {
    submissionId: s.id,
    type: s.type,
    typeTitle: typeTitle(s.type),
    artist: s.name,
    requester,
    requesterRelation,
    direction,
    assets: collectAssets(fields),
    involvementRequested: involvement,
    decision: 'accepted',
    status: s.status,
    phase,
    responsibilities,
    voiceNotes,
    keyDates: str(fields.timing) || null,
    disposition: dispositionLine(s.status, responsibilities),
  };
}

/**
 * Activate all accepted submissions into creative matters, keyed by submission id
 * so the same submission can never be activated twice (duplicate prevention).
 */
export function activateMatters(submissions: Submission[]): CreativeMatter[] {
  const byId = new Map<number, CreativeMatter>();
  for (const s of submissions) {
    const m = deriveCreativeMatter(s);
    if (m && !byId.has(m.submissionId)) byId.set(m.submissionId, m);
  }
  return Array.from(byId.values());
}

function dispositionLine(status: string, responsibilities: CollectiveArea[]): string {
  if (status === 'published') return 'Settled — finished and kept in the House’s record.';
  if (status === 'scheduled') return 'Being readied for release.';
  // approved
  if (responsibilities.length === 0) return 'Accepted — awaiting your direction on which areas of the House should carry it.';
  return 'Accepted — in coordination across the House.';
}

/* --- Founder-facing language (institutional, no software mechanics) ------------
   The House communicates what is TRUE: which areas are responsible and what the
   next step is. It never says an area has completed work without evidence, and it
   never exposes implementation words (adapter, runtime, engine, work order…). */

/** The stewardship narrative shown after acceptance — only named responsibilities. */
export function matterNarrative(m: CreativeMatter): string {
  if (m.phase === 'settled') {
    return 'The House has finished this and kept it in its record.';
  }
  if (m.responsibilities.length === 0) {
    return 'The Executive Team has accepted your direction. Tell the House which areas should carry it, and it will coordinate from there.';
  }
  const parts = m.responsibilities.map((a) => {
    const role = a === 'Production' && m.voiceNotes.eligible
      ? `will coordinate ${m.voiceNotes.purpose} in the Voice Notes Studio`
      : responsibilityRole(a);
    return `${a} ${role}`;
  });
  const joined = parts.length === 1
    ? parts[0]
    : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
  return `The Executive Team has accepted your direction. ${joined}.`;
}

/** The next institutional recommendation, and the existing workspace it opens. */
export interface NextStep { line: string; open?: { label: string; href: string }; }

export function nextRecommendation(m: CreativeMatter): NextStep {
  if (m.phase === 'settled') {
    return { line: 'It is finished and kept in the House’s record.', open: { label: 'Open the Archive', href: '#/creative' } };
  }
  if (m.status === 'scheduled') {
    return { line: 'It is being readied for release; Publishing holds the schedule.' };
  }
  // approved / in coordination
  if (m.voiceNotes.eligible && m.responsibilities.includes('Production')) {
    return {
      line: `Production is ready to coordinate ${m.voiceNotes.purpose}.`,
      open: { label: VOICE_NOTES_STUDIO.label, href: VOICE_NOTES_STUDIO.href },
    };
  }
  if (m.responsibilities.includes('Editorial')) {
    return {
      line: 'Editorial will prepare the feature; the full review lives in the Editorial Office.',
      open: { label: 'Open the Editorial Office', href: '/editorial-office/' },
    };
  }
  if (m.responsibilities.length === 0) {
    return { line: 'This proposal awaits your direction on which areas of the House should carry it.' };
  }
  return { line: 'The responsible areas will carry it from here.' };
}
