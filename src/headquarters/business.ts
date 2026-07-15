/* =============================================================================
   BUSINESS OFFICE — "a private counsel's study where what the House has built is
   kept safe" (Milestone 8 — the wing that completes the residence).

   The residence's most rooted, permanent room. It answers one executive question
   — "How do we preserve what the House has built?" — with PROTECTION BEFORE
   ADMINISTRATION. It exists to preserve the institution, never to operate
   financial or legal software.

   The hero is THE ARCHIVE: a wall of archival records naming the subjects the
   House keeps and protects. Per founder canon these are ARCHIVAL SUBJECTS ONLY —
   never records, never a database, never statistics. There is no current-priority
   task (the room is timeless, not active), no figures, balances, dates, statuses,
   dashboards, or fabricated legal/financial information. Like the Growth Studio,
   the architecture itself carries the meaning; this module holds only the
   editorial content, and the walnut counsel's study (the shared residence) is the
   grounded, permanent room around it. No fetch, no data, no numbers.
   ============================================================================= */

/** One subject the House keeps and protects — an archival subject, never a record. */
export interface Safeguard {
  /** The subject held in the archive. */
  name: string;
  /** One editorial line on what is kept safe. Never a number, status, or record. */
  note: string;
}

/**
 * The Archive — the subjects the House protects so the creative work endures.
 * Curated, founder-blessed content (like the Growth Studio's relationships):
 * additive presentation, not data. Order reads from what is owned, through how it
 * is held and defended, to what outlasts us. No figures, ever.
 */
export const SAFEGUARDS: Safeguard[] = [
  { name: 'Rights',      note: 'The work belongs to those who made it — and that stays true.' },
  { name: 'Contracts',   note: 'Agreements kept in good faith, and kept for good.' },
  { name: 'Licensing',   note: 'How the work travels the world, always on the House’s terms.' },
  { name: 'Publishing',  note: 'The imprint that makes the work permanent.' },
  { name: 'Finance',     note: 'The means that keep the House standing, tended quietly.' },
  { name: 'Legal',       note: 'The counsel that guards everything that has been built.' },
  { name: 'Legacy',      note: 'What outlasts us — held in trust for whoever comes next.' },
  { name: 'Continuity',  note: 'The House goes on; nothing essential is ever lost.' },
];

/** The room's opening line — the counsel's study and its purpose, before any card. */
export const STUDY_LEDE =
  'A private counsel’s study where what the House has built is kept safe — protection before administration, held in warm walnut, brass, and the low light of a library at evening.';

/** The closing inscription — permanence and legacy; the room's quiet reassurance. */
export const CONTINUITY_NOTE =
  'Everything made in this House is protected so that it endures — built to last, and to be handed on.';
