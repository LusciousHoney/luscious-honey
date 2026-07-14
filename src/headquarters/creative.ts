/* =============================================================================
   CREATIVE DIRECTOR — "the library where the making lives" (Milestone 5).

   The residence's warmest, most interior room: a private editorial library, never
   a design studio, mood-board app, or dashboard. Where the Executive Office asks
   "what do I decide?" and the Operations Office asks "is the work flowing?", the
   Creative Director room asks a generative, curatorial question — "what is the
   House making, and does the body of work hold together?" It is the room of
   creative stewardship: it invites making (permission, not pressure) and reads the
   shape of the work; it never adjudicates or operates the pipeline.

   This module holds ONLY the pure shaping of EXISTING data into the room's two
   living objects, plus the room's environmental content. It reads no data and
   performs no I/O — main.ts fetches and passes it in.

     • The open manuscript — the single piece left in motion, from the existing
       Daily Briefing's `recent` (already enriched with an editorial summary).
       Only ONE ever appears: the most-recently-touched work still in progress,
       "left open exactly where she stopped."
     • The Collection — the House's MADE body of work (published pieces), from the
       existing `GET /api/submissions?status=published`, read as bound volumes on
       a shelf rather than a queue.

   No new endpoint, table, workflow, or submission system. The Editorial Office
   remains the operational review workspace; this room never routes into it.
   ============================================================================= */

import { isOpen } from '../../shared/workflow.js';
import type { Briefing, Submission } from './adapters.ts';

/** The one manuscript left open on the reading table (or none — the table clear). */
export interface OpenManuscript {
  name: string;
  type: string;
  summary: string;
  status: string;
}

/** A single bound work standing in the Collection. */
export interface CollectionVolume {
  name: string;
  type: string;
  summary: string;
}

export interface CreativeStudio {
  /** Exactly one open piece, or null when nothing is in motion (the table is clear). */
  manuscript: OpenManuscript | null;
  /** The made body of work, curated and newest-first (never the whole archive). */
  collection: CollectionVolume[];
  /** How many works are actually published (may exceed what the shelf shows). */
  collectionTotal: number;
}

// The shelf is CURATED, not exhaustive — a library reads as a few chosen spines
// with room to breathe, never a wall of everything (the founder rejected clutter).
const COLLECTION_LIMIT = 6;

/**
 * Shape existing Headquarters data into the library's living objects. Pure: no
 * I/O, no clock, no DOM. Tolerant of either input being absent, so the two
 * objects can degrade independently (an offline shelf never blanks the manuscript).
 */
export function creativeStudio(
  briefing: Briefing | null,
  published: Submission[] | null,
): CreativeStudio {
  // The one manuscript: the most-recently-touched piece STILL in motion. `recent`
  // is already newest-first and carries status + an editorial summary, so this is
  // simply the first open item — "the page she last had open."
  const recent = briefing?.recent ?? [];
  const open = recent.find((r) => isOpen(r.status)) ?? null;
  const manuscript: OpenManuscript | null = open
    ? { name: open.name, type: open.type, summary: open.summary ?? '', status: open.status }
    : null;

  const made = Array.isArray(published) ? published : [];
  const collection = made.slice(0, COLLECTION_LIMIT).map((s) => ({
    name: s.name,
    type: s.type,
    summary: s.summary ?? '',
  }));

  return { manuscript, collection, collectionTotal: made.length };
}

/* --- Environmental content (architecture, not interface) --------------------
   The room's furniture: a restrained personal reference library, and one line
   engraved into the oak. These are decorative objects — furniture the way the
   scene's plants and flowers are furniture — never controls, never live data. */

export interface ReferenceVolume {
  title: string;
  /** Drives the spine treatment only (cloth / notebook / binder). Presentation. */
  kind: 'bible' | 'notebook' | 'binder' | 'reference';
}

/** A few chosen volumes leaning on the reference shelf. Environmental only. */
export const REFERENCE_VOLUMES: ReferenceVolume[] = [
  { title: 'The House Story Bible', kind: 'bible' },
  { title: 'Voice & Tone', kind: 'notebook' },
  { title: 'Field Notes', kind: 'notebook' },
  { title: 'The Standards', kind: 'reference' },
  { title: 'Editorial Binder', kind: 'binder' },
];

/**
 * The direction plate — quietly engraved into the oak, discovered rather than
 * announced. Not a mission statement; a timeless editorial inscription.
 */
export const DIRECTION_INSCRIPTION = 'What is made here is made to last.';
