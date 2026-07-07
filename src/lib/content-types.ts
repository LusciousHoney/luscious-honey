/* =============================================================================
   CONTENT TYPES — Sprint 04 · Part VIII, refined for operational governance.
   Pure type declarations only (no data, no Vite APIs) so both the content
   loader and the governance tests can import them.

   Governance separates two axes:
     • `status`  — the publish state a human controls (published / scheduled / draft)
     • `fixture` — marks temporary content; drives the development-only flag.
   Nothing publishes itself: only `status: 'published'` is ever shown.
   ============================================================================= */

export type PublishState = 'published' | 'scheduled' | 'draft';

/** Fields every governed item carries. */
export interface Governed {
  status: PublishState;
  fixture?: boolean;
}

export interface Media {
  id: string;
  kind: 'image' | 'audio' | 'video';
  /** Poster/fallback always present so layout reserves space before load. */
  poster: string;
  /** Optional heavy source, loaded on intent only. */
  src?: string;
  alt: string;
  aspect: string; // e.g. "16/9"
  caption?: string;
}

export type BodyBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'pull'; text: string }          // pull-quote
  | { type: 'qa'; q: string; a: string }     // interview turn
  | { type: 'note'; text: string };          // margin note

/** Work { id, slug, title, creator, medium, year, body, media, relations[] } */
export interface Work extends Governed {
  id: string;
  slug: string;
  title: string;
  creator: string;      // public identity only — never a legal name
  medium: 'interview' | 'essay' | 'letter' | 'audio' | 'film';
  year: number;
  date: string;         // ISO — real publication date
  dek?: string;
  body: BodyBlock[];
  media?: Media;
  relations?: string[]; // Archive threads, later
  featured?: boolean;
}

/** JournalEntry { date, week, body, signed } — manual publishing only. */
export interface JournalEntry extends Governed {
  date: string;   // ISO — real, dated, never auto-generated
  week: number;
  body: string;
  signed: string; // "L.H." — never a legal name
}

/**
 * Fragment — one curated Writing Wall WIP, unattributed.
 * `active: true` = manually curated as the one on the wall now.
 * `showFrom`/`showUntil` = an optional scheduled window (manual still wins).
 */
export interface Fragment extends Governed {
  id: string;
  text: string;
  active?: boolean;
  showFrom?: string;  // ISO date
  showUntil?: string; // ISO date
}

/** The Single Held Frame — one curated real shot of the house / its work. */
export interface HeldFrame extends Governed {
  id: string;
  week: number;
  date?: string;
  media: Media;
}
