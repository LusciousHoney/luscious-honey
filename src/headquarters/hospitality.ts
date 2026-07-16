/* =============================================================================
   HOSPITALITY — the editorial cards of the morning scene (Sprint 10).

   Executive hospitality, not productivity. Following the approved composition,
   the cards are split by PLACEMENT:
     • suspended — two cards that float high in the scene (Today's Intention,
       Thought of the Day);
     • lower     — five cards along the sill (Today's Briefing, Priorities,
       From the House, Mindful Moment, Atmosphere).

   Version 1 content is elegant, manual PLACEHOLDER — no AI, no data feeds, and
   (per House principle P11) no fabricated activity or counts. The Today's Briefing
   card is filled by the real, honest Daily Briefing; the Atmosphere card opens the
   room-soundtrack control (see atmosphere.ts). All copy is original House voice —
   no third-party quotations are reproduced.
   ============================================================================= */

export type HospitalityPlacement = 'suspended' | 'lower';
export type HospitalityKind =
  | 'intention' | 'thought'          // suspended
  | 'briefing' | 'priorities' | 'from-house' | 'mindful' | 'atmosphere'; // lower

export interface HospitalityCard {
  id: string;
  kind: HospitalityKind;
  placement: HospitalityPlacement;
  /** Small overline shown above the card body. */
  eyebrow: string;
  /** The card's editorial line(s). Empty for cards whose body is filled live. */
  body: string;
  /** Optional attribution beneath the body (House voice only). */
  attribution?: string;
  /** When set, the card carries an action button: 'atmosphere' opens the
      Soundscape control; the rest are real navigation to honest House routes. */
  action?: 'atmosphere' | 'briefing' | 'priorities' | 'house' | 'mindful';
  /** The label for an action card's affordance. */
  actionLabel?: string;
  /** When true, the render fills the body from a live House source (the Daily
      Briefing) rather than static copy — never fabricated. */
  live?: boolean;
}

export const HOSPITALITY: HospitalityCard[] = [
  /* --- suspended (float high in the scene) --- */
  {
    id: 'intention',
    kind: 'intention',
    placement: 'suspended',
    eyebrow: 'Today’s Intention',
    body: 'Protect your attention before you protect your schedule.',
  },
  {
    id: 'thought',
    kind: 'thought',
    placement: 'suspended',
    eyebrow: 'Thought of the Day',
    body: 'What is built quietly, and kept, becomes the thing no one can take.',
    attribution: 'The House',
  },

  /* --- lower (along the sill) --- */
  {
    id: 'briefing',
    kind: 'briefing',
    placement: 'lower',
    eyebrow: 'Today’s Briefing',
    body: '',                 // filled live from the Daily Briefing (honest)
    live: true,
    action: 'briefing',
    actionLabel: 'Open the Desk',
  },
  {
    id: 'priorities',
    kind: 'priorities',
    placement: 'lower',
    eyebrow: 'Priorities',
    body: 'Chosen with intention, and kept few. The day is yours to set.',
    action: 'priorities',
    actionLabel: 'View the Docket',
  },
  {
    id: 'from-house',
    kind: 'from-house',
    placement: 'lower',
    eyebrow: 'From the House',
    body: 'A word from each wing arrives here — quietly, only when it matters.',
    action: 'house',
    actionLabel: 'Enter the House',
  },
  {
    id: 'mindful',
    kind: 'mindful',
    placement: 'lower',
    eyebrow: 'Mindful Moment',
    body: 'Three slow breaths. You do not have to carry all of it at once.',
    action: 'mindful',
    actionLabel: 'Take a minute',
  },
  {
    id: 'atmosphere',
    kind: 'atmosphere',
    placement: 'lower',
    eyebrow: 'Atmosphere',
    body: 'The sound of each room, waiting for your arrival.',
    action: 'atmosphere',
    actionLabel: 'Choose Sounds',
  },
];

/** The two suspended cards, in order. */
export const SUSPENDED_CARDS = HOSPITALITY.filter((c) => c.placement === 'suspended');
/** The five lower cards, in order. */
export const LOWER_CARDS = HOSPITALITY.filter((c) => c.placement === 'lower');

/** The Founder identity treatment shown at the upper right (display only —
    no account management). */
export const FOUNDER_IDENTITY = { name: 'Luscious Honey', role: 'Founder' } as const;
