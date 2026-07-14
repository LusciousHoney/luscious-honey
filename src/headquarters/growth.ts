/* =============================================================================
   GROWTH STUDIO — "a sunlit publishing salon overlooking the horizon" (M7).

   The residence's most outward-looking room. It answers one executive question —
   "Where is the House finding resonance?" — and it answers it in RELATIONSHIPS,
   never metrics. Growth here means stewardship of audience, publishing rhythm,
   partnerships, and cultural conversation; it is a salon, not a console.

   Per founder canon this room reuses NO workflow data — not the submissions
   spine, not published works, not arrivals (those belong to Creative Director and
   Operations). It has no fetch and no numbers. The channels below are treated as
   ONGOING CONVERSATIONS the House keeps with the world — never platforms,
   statistics, analytics, or dashboards. This module holds only that editorial
   content; the horizon (the shared residence) is the room's true hero.
   ============================================================================= */

/** One relationship the House keeps — a standing conversation, never a metric. */
export interface Relationship {
  /** The correspondent (a relationship, not a platform). */
  name: string;
  /** One editorial line on the conversation. Never a number, never a statistic. */
  note: string;
}

/**
 * The correspondence the House maintains with the world. Curated, founder-blessed
 * content (like the Creative Director's reference volumes) — additive presentation,
 * not data. Order reads from the House outward to the wider culture, closing on
 * the room to grow. No counts, ever.
 */
export const RELATIONSHIPS: Relationship[] = [
  { name: 'Publishing',   note: 'The House’s own imprint — where the work becomes permanent.' },
  { name: 'Readers',      note: 'The people the work is for; kept close, and written to directly.' },
  { name: 'Substack',     note: 'The weekly letter — a standing correspondence with those who follow along.' },
  { name: 'TikTok',       note: 'Where new voices first find the House; a doorway kept open.' },
  { name: 'Partnerships', note: 'Houses and makers we build alongside — conversations, never deals.' },
  { name: 'Press',        note: 'The wider cultural conversation, and where the work is discussed.' },
  { name: 'Community',    note: 'The gathering around the work — tended, and never counted.' },
];

/** The room's opening line — the salon and its horizon, before any card is read. */
export const SALON_LEDE =
  'A sunlit publishing salon overlooking the horizon — where the House keeps its conversations with the world, and reach is measured in relationships, not numbers.';

/** A quiet closing note: the room is built for expansion; the horizon is the point. */
export const HORIZON_NOTE =
  'The horizon is the point. New conversations open here as the House reaches further into the world.';
