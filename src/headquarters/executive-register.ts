/* =============================================================================
   THE EXECUTIVE REGISTER — the institutional framework for the Executive Team.
   (Sprint 11A — Executive Recruitment System, Foundation.)

   This is the House's permanent architecture for how Chairs are defined,
   recruited, appointed, held, vacated, and — one day — passed on. It is the
   foundation beneath the Office of the Chief of Staff's future recruitment work:
   the data structures and the pure logic that let the institution carry an
   Executive Team across decades without ever rebuilding its bones.

   It implements the approved governance standards — the Executive Operating
   Model and the two seated Chairs (Chief of Staff, Creative Director) — as a
   living record, not a redesign of them.

   DISCIPLINE, matching the rest of Headquarters:
     • Pure data + pure logic only. NO DOM, NO fetch, NO backend, NO AI.
     • The Founder's own words (notes, observations, decisions) are the Founder's
       and persist client-side in localStorage; nothing here fabricates them.
     • Append-only where the record is institutional memory: the Register is
       never rewritten and never deleted — amendments and vacancies are new
       entries laid on top, so the House can always read how it arrived here.
     • No fixed Chair count. Chairs are identified, not enumerated; the framework
       supports the third Chair, the tenth, and the ones not yet imagined.
     • Honest empty states. Where the House truthfully holds no record yet — no
       dossiers, no appointments — the structure says so rather than inventing.
   ============================================================================= */

/* =============================================================================
   PHASE 1 — THE INSTITUTIONAL DATA STRUCTURES

   A Chair is an enduring seat within the institution, defined before anyone is
   ever invited to it: why it exists, what it is trusted to do, what it owns,
   what it prepares, and where its authority ends. This is the charter — the
   permanent description a Chair keeps whether it is filled or open.
   ============================================================================= */

/** The standing of a Chair as a seat — its lifecycle within the institution.
    A closed set: a Chair is always in exactly one of these states. (This is the
    Chair's own status; the status of a particular appointment is separate — see
    Phase 4.) */
export type ChairStatus =
  | 'established' // defined and held today — the charter is in force
  | 'preparing'  // defined and open; the House is preparing to fill it
  | 'vacant'     // defined and unfilled, not yet actively being filled
  | 'retired';   // honourably closed; kept in the record, no longer to be filled

export interface ChairStatusKind { id: ChairStatus; label: string; note: string; }

export const CHAIR_STATUSES: ChairStatusKind[] = [
  { id: 'established', label: 'Established', note: 'Defined and held.' },
  { id: 'preparing',   label: 'Preparing',  note: 'Open, and being prepared to fill.' },
  { id: 'vacant',      label: 'Vacant',     note: 'Defined and unfilled.' },
  { id: 'retired',     label: 'Retired',    note: 'Honourably closed; kept in the record.' },
];
const CHAIR_STATUS_BY_ID = new Map(CHAIR_STATUSES.map((s) => [s.id, s]));

/** The label for a Chair status (or the raw id if somehow unknown). */
export function chairStatusLabel(id: ChairStatus): string {
  return CHAIR_STATUS_BY_ID.get(id)?.label ?? id;
}

/** The Chair's decision authority — the three standing categories every Chair is
    given, drawn straight from the leadership profiles. */
export interface DecisionAuthority {
  /** What this Chair may settle on its own. */
  canDecide: string[];
  /** What this Chair prepares for the Founder's word. */
  recommends: string[];
  /** What always belongs to the Founder. */
  mustEscalate: string[];
}

/** How a Chair collaborates with another — by nature, never by hierarchy. The
    other Chair is named, and linked by id once that Chair is itself established;
    a relationship may point to a Chair the House has not yet seated. */
export interface ChairRelationship {
  /** The id of the other Chair, when it exists in the Register. */
  withChairId?: string;
  /** The other Chair, as named in the profile (holds even before it is seated). */
  with: string;
  /** How the two work together. */
  nature: string;
}

/** A Chair — the permanent charter of an executive seat. Identified by a stable
    id and an institutional ordinal (Chair #001, #002 …); never enumerated, so
    the framework never assumes how many Chairs there are. */
export interface ExecutiveChair {
  id: string;
  /** The institutional ordinal — the order in which the seat was created. */
  ordinal: number;
  /** The Chair's title (e.g. 'Chief of Staff'). */
  title: string;
  /** Why this Chair exists — the institutional problem it answers. */
  reasonForBeing: string;
  /** The purpose, in one considered line. */
  purpose: string;
  /** The charge — what whoever sits here is trusted to do. */
  charge: string;
  /** The enduring responsibilities the Chair carries. */
  standingResponsibilities: string[];
  /** The areas this Chair holds primary responsibility for. */
  owns: string[];
  /** The work this Chair develops before it reaches the Founder. */
  prepares: string[];
  /** Where this Chair's authority runs, and where it ends. */
  authority: DecisionAuthority;
  /** How this Chair works with the others. */
  relationships: ChairRelationship[];
  /** The seat's present standing. */
  status: ChairStatus;
}

/* --- the seated Chairs, as approved (institutional standards, not fabricated) --
   Chair #001 — Chief of Staff, and Chair #002 — Creative Director. Their content
   is the condensed charter of the approved leadership profiles and Operating
   Model; both are established (held today by the Founder's own hand until an
   appointee is invited). Founder-authored notes and observations are NOT seeded
   here — they are the Founder's, and live in the persisted layer, honestly empty
   until written. */

export const CHAIR_CHIEF_OF_STAFF = 'chair_chief_of_staff';
export const CHAIR_CREATIVE_DIRECTOR = 'chair_creative_director';
export const CHAIR_HEAD_OF_PRODUCTION = 'chair_head_of_production';
export const CHAIR_DIRECTOR_OF_GROWTH = 'chair_director_of_growth';

export const CHAIRS: ExecutiveChair[] = [
  {
    id: CHAIR_CHIEF_OF_STAFF,
    ordinal: 1,
    title: 'Chief of Staff',
    reasonForBeing:
      'Every growing institution risks spending its rarest asset — the Founder’s attention — on the wrong things. This Chair exists so that what reaches the Founder is only what genuinely requires the Founder, prepared and in order.',
    purpose:
      'To protect the Founder’s attention and keep the institution in order — understanding what enters, clarifying it, engaging the right Chair, and ensuring nothing reaches the Founder half-formed.',
    charge:
      'Prepare the work, keep the record, and coordinate the House on the Founder’s behalf, so that judgement is all the Founder is ever asked to give.',
    standingResponsibilities: [
      'Understand and clarify everything that enters the institution before it travels further.',
      'Engage the right Chair, well-framed and well-timed, and hold back what does not merit fuller attention.',
      'Coordinate execution after a decision, so momentum never depends on returning to the Founder.',
      'Keep the institutional record complete and in order.',
    ],
    owns: [
      'The Founder’s attention, and what is allowed to reach it.',
      'The institution’s operating rhythm — its cadence of review and decision.',
      'The coordination of executive work across the Chairs.',
      'The institutional record and its long memory.',
    ],
    prepares: [
      'The Founder’s briefing — what has been made ready, so attention goes only where it matters.',
      'Prepared decisions — recommendation, reasoning, trade-offs, and the single action requested.',
      'The framing and sequencing of work before a Chair takes it up.',
    ],
    authority: {
      canDecide: [
        'What rises to the Founder and what is handled, held, or closed below.',
        'How work is clarified, framed, and sequenced.',
        'Which Chair carries a matter, and when.',
      ],
      recommends: [
        'The cadence of the institution’s review and decisions.',
        'Which Chair to prepare or fill first, and the timing of a first appointment.',
        'The standing principles by which the record is kept.',
      ],
      mustEscalate: [
        'A genuine split between Chairs that only the Founder can settle.',
        'Any redefinition of the Founder’s own role.',
        'Anything the Founder has reserved as the Founder’s alone.',
      ],
    },
    relationships: [
      { withChairId: CHAIR_CREATIVE_DIRECTOR, with: 'Creative Director',
        nature: 'Order and taste in balance — the Chief of Staff protects the Founder’s attention while the Creative Director protects the Founder’s voice; the two coordinate so ambition and order reinforce one another.' },
      { withChairId: CHAIR_HEAD_OF_PRODUCTION, with: 'Head of Production',
        nature: 'The Chief of Staff sequences and coordinates; Production carries approved work to finished, trusting the office to keep the path clear.' },
      { withChairId: CHAIR_DIRECTOR_OF_GROWTH, with: 'Director of Growth',
        nature: 'The Chief of Staff keeps the House in order as Growth carries its work outward, so reaching further never disturbs the calm within.' },
    ],
    status: 'established',
  },
  {
    id: CHAIR_CREATIVE_DIRECTOR,
    ordinal: 2,
    title: 'Creative Director',
    reasonForBeing:
      'An institution grows faster than its own sense of self; taste drifts when no single mind is responsible for coherence. This Chair exists so the Founder is never the sole guardian of how the work looks, sounds, and feels.',
    purpose:
      'To protect and advance the institution’s creative identity — its voice, its aesthetic, and the stories it tells about itself — so everything it makes is coherent and unmistakably its own.',
    charge:
      'Hold the standard of the whole body of work, and turn the Founder’s instinct into durable, accumulating judgement rather than choices re-argued each time.',
    standingResponsibilities: [
      'Guard the institution’s voice and notice early when it slips.',
      'Maintain and raise the aesthetic standard over time, not merely defend it.',
      'Keep the accumulating creative canon, so taste decided well becomes precedent.',
      'Hold the coherence of the whole body of work, distinct from any single piece.',
    ],
    owns: [
      'The institution’s voice and editorial character.',
      'Its visual and aesthetic standards.',
      'Its narrative strategy and the stories it tells about itself.',
      'Its creative canon, and the coherence of the whole.',
    ],
    prepares: [
      'Creative direction — the considered recommendation, not the menu.',
      'Editorial and narrative strategy, and publishing priorities.',
      'Proposed standards of voice and visual identity, ready to become canon.',
    ],
    authority: {
      canDecide: [
        'Application of established standards to specific work.',
        'Editorial and tonal refinements consistent with the existing voice.',
        'Which creative directions to develop or set aside before they merit the Founder.',
      ],
      recommends: [
        'New or evolved standards of voice, aesthetic, or narrative.',
        'Publishing priorities and the sequencing of creative work.',
        'Additions to the permanent canon.',
      ],
      mustEscalate: [
        'Any redefinition of the institution’s core identity or character.',
        'Directions that would break with, rather than extend, established canon.',
        'Work carrying meaningful reputational weight for the Founder personally.',
      ],
    },
    relationships: [
      { withChairId: CHAIR_CHIEF_OF_STAFF, with: 'Chief of Staff',
        nature: 'Taste and order in balance — the Creative Director protects the Founder’s taste while the Chief of Staff protects the Founder’s attention.' },
      { withChairId: CHAIR_HEAD_OF_PRODUCTION, with: 'Head of Production',
        nature: 'The Creative Director sets the standard; Production realises it at scale and on schedule — the long dialogue between intention and execution.' },
      { withChairId: CHAIR_DIRECTOR_OF_GROWTH, with: 'Director of Growth',
        nature: 'Growth carries the voice outward; the Creative Director ensures what travels stays true to what it represents.' },
    ],
    status: 'established',
  },
  {
    id: CHAIR_HEAD_OF_PRODUCTION,
    ordinal: 3,
    title: 'Head of Production',
    reasonForBeing:
      'Between an approved idea and a finished, delivered work lies a chain of moving parts. This Chair exists so the Founder never carries execution — so approved work becomes finished work without her coordinating a single hand-off.',
    purpose:
      'To turn approved and directed work into finished, delivered work — reliably and to standard — so nothing unfinished reaches the Founder and no execution detail requires her attention.',
    charge:
      'Carry work from decision to delivery with discipline: plan it, produce it, and see it finished on a cadence the House can rely on.',
    standingResponsibilities: [
      'Own delivery from approved to finished across the institution’s work.',
      'Protect the quality and the schedule of what is produced.',
      'Keep the path from decision to delivery clear, and hand-offs clean.',
      'Surface risk to delivery early, before it reaches the Founder.',
    ],
    owns: [
      'The production of approved and directed work.',
      'Delivery readiness and the standard of the finished result.',
      'The cadence and reliability of execution.',
      'The health of work in progress, and what is blocking it.',
    ],
    prepares: [
      'Delivery plans — how approved work will be carried to finished.',
      'Readiness assessments before production begins.',
      'Honest status of what is in production, and what stands in its way.',
    ],
    authority: {
      canDecide: [
        'How approved work is planned, sequenced, and produced.',
        'When work is ready for production and when it is delivery-ready.',
        'The day-to-day handling of production within the standard.',
      ],
      recommends: [
        'Delivery cadence and the order in which approved work is produced.',
        'Trade-offs between scope, quality, and time when they arise.',
        'When a delivery risk warrants the Founder’s attention.',
      ],
      mustEscalate: [
        'Work that cannot be delivered to standard without a Founder decision.',
        'A delivery risk that would affect a commitment the Founder has made.',
        'Anything the Founder has reserved as the Founder’s alone.',
      ],
    },
    relationships: [
      { withChairId: CHAIR_CHIEF_OF_STAFF, with: 'Chief of Staff',
        nature: 'The Chief of Staff routes and coordinates; Production receives approved work and carries it to finished, returning status and clarification through the office — never around it.' },
      { withChairId: CHAIR_CREATIVE_DIRECTOR, with: 'Creative Director',
        nature: 'The Creative Director sets the standard; Production realises it faithfully, at scale and on schedule — intention met by execution.' },
      { withChairId: CHAIR_DIRECTOR_OF_GROWTH, with: 'Director of Growth',
        nature: 'Production delivers finished work; Growth carries it to the world, each trusting the other to hold its own craft.' },
    ],
    status: 'established',
  },
  {
    id: CHAIR_DIRECTOR_OF_GROWTH,
    ordinal: 4,
    title: 'Director of Growth',
    reasonForBeing:
      'Finished work only matters if it reaches the people it is for. This Chair exists so the Founder never has to carry the House’s work outward herself — so reaching further never depends on her attention, and never disturbs the calm within.',
    purpose:
      'To carry the House’s finished work to the world and grow its audience — deliberately and to standard — so the institution’s reach widens without the Founder coordinating a single campaign.',
    charge:
      'Take finished work outward with intent: study where it resonates, plan how it travels, launch it, and measure what it earns — so growth is chosen, not left to chance.',
    standingResponsibilities: [
      'Own how the House’s finished work reaches the world, and how its audience grows.',
      'Protect the voice and the standard of the House in everything that travels outward.',
      'Study where the work resonates, and carry that understanding back to the House.',
      'Surface a growth risk or opportunity early, before it reaches the Founder.',
    ],
    owns: [
      'The outward reach of the institution’s finished work.',
      'Audience growth and the relationships the House keeps with the world.',
      'The planning and launch of campaigns, and the standard they hold to.',
      'The measurement of what growth earns, honestly read.',
    ],
    prepares: [
      'Growth strategy — how finished work will travel, and to whom.',
      'Campaign plans, ready to launch, before anything reaches the world.',
      'Honest measurement of what growth has earned, and what it has not.',
    ],
    authority: {
      canDecide: [
        'How finished work is carried outward, planned, and launched.',
        'When a campaign is ready to launch and when it is complete.',
        'The day-to-day handling of growth within the standard.',
      ],
      recommends: [
        'Which audiences to reach for, and the sequencing of growth work.',
        'Trade-offs between reach, voice, and timing when they arise.',
        'When a growth opportunity or risk warrants the Founder’s attention.',
      ],
      mustEscalate: [
        'Growth that cannot proceed to standard without a Founder decision.',
        'A commitment to the world that would bind the Founder personally.',
        'Anything the Founder has reserved as the Founder’s alone.',
      ],
    },
    relationships: [
      { withChairId: CHAIR_CHIEF_OF_STAFF, with: 'Chief of Staff',
        nature: 'The Chief of Staff routes and coordinates; Growth receives finished work and carries it outward, returning status and clarification through the office — never around it.' },
      { withChairId: CHAIR_CREATIVE_DIRECTOR, with: 'Creative Director',
        nature: 'The Creative Director protects what the work says; Growth carries it outward, trusting the voice to stay true wherever it travels.' },
      { withChairId: CHAIR_HEAD_OF_PRODUCTION, with: 'Head of Production',
        nature: 'Production delivers finished work; Growth carries it to the world, each trusting the other to hold its own craft.' },
    ],
    status: 'established',
  },
];

const CHAIR_BY_ID = new Map(CHAIRS.map((c) => [c.id, c]));

/** A Chair by id, or null if unknown. */
export function getChair(id: string | null | undefined): ExecutiveChair | null {
  if (!id) return null;
  return CHAIR_BY_ID.get(id) ?? null;
}

/** The next institutional ordinal — so a newly created Chair takes its place in
    sequence without any fixed count being assumed. */
export function nextOrdinal(chairs: ExecutiveChair[]): number {
  return chairs.reduce((max, c) => Math.max(max, c.ordinal), 0) + 1;
}

/* =============================================================================
   PHASE 2 — THE EXECUTIVE REGISTER (the permanent institutional record)

   The Register is the House's long memory of its leadership: how each Chair was
   established, amended, filled, vacated, and retired. It is APPEND-ONLY. Nothing
   is edited in place and nothing is deleted; an amendment or a vacancy is a new
   entry laid over the old, so the whole history can always be read in order.

   A Chair's current standing is therefore never stored twice — it is DERIVED
   from the entries, which cannot disagree with the record.
   ============================================================================= */

/** The kinds of thing the Register remembers about a Chair. */
export type RegisterEventType =
  | 'established'  // a Chair was created and its charter set
  | 'amended'      // a Chair's charter was amended
  | 'preparing'    // the House began preparing to fill the Chair
  | 'appointed'    // an appointee was seated
  | 'vacated'      // the Chair became vacant
  | 'retired'      // the Chair was honourably closed
  | 'restored';    // a retired Chair was reopened

export interface RegisterEventKind {
  id: RegisterEventType;
  label: string;
  /** The Chair standing this event implies once it is the latest for a Chair.
      `null` means the event does not itself change standing (an amendment). */
  impliesStatus: ChairStatus | null;
}

export const REGISTER_EVENTS: RegisterEventKind[] = [
  { id: 'established', label: 'Established', impliesStatus: 'established' },
  { id: 'amended',     label: 'Amended',     impliesStatus: null },
  { id: 'preparing',   label: 'Preparing',   impliesStatus: 'preparing' },
  { id: 'appointed',   label: 'Appointed',   impliesStatus: 'established' },
  { id: 'vacated',     label: 'Vacated',     impliesStatus: 'vacant' },
  { id: 'retired',     label: 'Retired',     impliesStatus: 'retired' },
  { id: 'restored',    label: 'Restored',    impliesStatus: 'preparing' },
];
const REGISTER_EVENT_BY_ID = new Map(REGISTER_EVENTS.map((e) => [e.id, e]));

export function registerEventLabel(id: RegisterEventType): string {
  return REGISTER_EVENT_BY_ID.get(id)?.label ?? id;
}

/** A single, permanent line in the Register. Once recorded it is never altered
    and never removed — this is what makes the Register institutional memory. */
export interface RegisterEntry {
  id: string;
  chairId: string;
  type: RegisterEventType;
  /** What happened, in the House's record voice. */
  event: string;
  /** ISO 'YYYY-MM-DD' — the day it took effect institutionally. */
  on: string;
  /** ISO datetime it was written into the record — never edited. */
  recordedAt: string;
  /** An optional note kept with the entry. */
  note?: string;
}

/** Validate + stamp a Register entry (or null if the event type is unknown or
    the required fields are missing). `now`/`id` are injected for testability. */
export function makeRegisterEntry(
  input: { chairId: string; type: string; event: string; on: string; note?: string },
  now: Date = new Date(),
  id: string = `reg_${now.getTime()}`,
): RegisterEntry | null {
  if (!REGISTER_EVENT_BY_ID.has(input.type as RegisterEventType)) return null;
  if (!input.chairId || !input.event || !input.on) return null;
  const note = (input.note || '').trim() || undefined;
  return {
    id,
    chairId: input.chairId,
    type: input.type as RegisterEventType,
    event: input.event,
    on: input.on,
    recordedAt: now.toISOString(),
    note,
  };
}

/** Append an entry to the Register. Append-only by construction: the existing
    entries are never touched, and nothing is ever removed. */
export function appendRegisterEntry(existing: RegisterEntry[], entry: RegisterEntry): RegisterEntry[] {
  return [...existing, entry];
}

/** A Chair's entries, oldest first — its history, read in the order it happened.
    Ties on the effective day fall back to the order recorded. */
export function chairHistory(entries: RegisterEntry[], chairId: string): RegisterEntry[] {
  return entries
    .filter((e) => e.chairId === chairId)
    .sort((a, b) => (a.on === b.on ? a.recordedAt.localeCompare(b.recordedAt) : a.on.localeCompare(b.on)));
}

/** A Chair's current standing, DERIVED from the record — the standing implied by
    the latest status-changing entry. Chairs with no history yet fall back to the
    charter's own status. Returns null if the Chair is unknown and has no record. */
export function chairStatusFromRegister(
  entries: RegisterEntry[],
  chair: ExecutiveChair | { id: string; status: ChairStatus },
): ChairStatus {
  const history = chairHistory(entries, chair.id);
  for (let i = history.length - 1; i >= 0; i--) {
    const implied = REGISTER_EVENT_BY_ID.get(history[i].type)?.impliesStatus;
    if (implied) return implied;
  }
  return chair.status;
}

/** The founding entries of the Register — the truthful record that the two
    approved Chairs were established. Honest: it records only what has genuinely
    happened, and nothing more. */
export const FOUNDING_REGISTER: RegisterEntry[] = [
  {
    id: 'reg_founding_cos',
    chairId: CHAIR_CHIEF_OF_STAFF,
    type: 'established',
    event: 'The Chair of the Chief of Staff was established as the first seat of the Executive Team.',
    on: '2026-07-15',
    recordedAt: '2026-07-15T00:00:00.000Z',
  },
  {
    id: 'reg_founding_creative',
    chairId: CHAIR_CREATIVE_DIRECTOR,
    type: 'established',
    event: 'The Chair of the Creative Director was established as the second seat of the Executive Team.',
    on: '2026-07-16',
    recordedAt: '2026-07-16T00:00:00.000Z',
  },
  {
    id: 'reg_founding_production',
    chairId: CHAIR_HEAD_OF_PRODUCTION,
    type: 'established',
    event: 'The Chair of the Head of Production was established as the third seat of the Executive Team.',
    on: '2026-07-16',
    recordedAt: '2026-07-16T00:00:01.000Z',
  },
  {
    id: 'reg_founding_growth',
    chairId: CHAIR_DIRECTOR_OF_GROWTH,
    type: 'established',
    event: 'The Chair of the Director of Growth was established as the fourth seat of the Executive Team, completing the Founding Executive Council.',
    on: '2026-07-16',
    recordedAt: '2026-07-16T00:00:02.000Z',
  },
];

/* =============================================================================
   PHASE 3 — THE DOSSIER (how a candidate for a Chair is understood)

   A Dossier is the considered understanding of one person against one Chair,
   assembled before an appointment is ever made. It holds the leadership picture
   and the Founder's own observations, and it ends in a recommendation and,
   eventually, an outcome. It contains NO generated content and NO sample lives:
   until the House genuinely prepares one, there are none — an honest empty shelf.
   ============================================================================= */

/** The recommendation a Dossier reaches — prepared for the Founder's word. */
export type DossierRecommendation =
  | 'undecided'
  | 'appoint'
  | 'appoint_with_reservations'
  | 'continue_search'
  | 'decline';

/** What became of the candidacy in the end. */
export type DossierOutcome = 'pending' | 'appointed' | 'declined' | 'withdrawn';

export interface DossierRecommendationKind { id: DossierRecommendation; label: string; }
export const DOSSIER_RECOMMENDATIONS: DossierRecommendationKind[] = [
  { id: 'undecided',                 label: 'Undecided' },
  { id: 'appoint',                   label: 'Appoint' },
  { id: 'appoint_with_reservations', label: 'Appoint with Reservations' },
  { id: 'continue_search',           label: 'Continue the Search' },
  { id: 'decline',                   label: 'Decline' },
];
const DOSSIER_REC_BY_ID = new Map(DOSSIER_RECOMMENDATIONS.map((r) => [r.id, r]));
export function dossierRecommendationLabel(id: DossierRecommendation): string {
  return DOSSIER_REC_BY_ID.get(id)?.label ?? id;
}

export interface DossierOutcomeKind { id: DossierOutcome; label: string; }
export const DOSSIER_OUTCOMES: DossierOutcomeKind[] = [
  { id: 'pending',    label: 'Pending' },
  { id: 'appointed',  label: 'Appointed' },
  { id: 'declined',   label: 'Declined' },
  { id: 'withdrawn',  label: 'Withdrawn' },
];
const DOSSIER_OUTCOME_BY_ID = new Map(DOSSIER_OUTCOMES.map((o) => [o.id, o]));
export function dossierOutcomeLabel(id: DossierOutcome): string {
  return DOSSIER_OUTCOME_BY_ID.get(id)?.label ?? id;
}

/** One conversation in a candidacy — kept as an honest note, never a transcript. */
export interface InterviewNote {
  id: string;
  /** ISO 'YYYY-MM-DD' of the conversation. */
  on: string;
  /** Which conversation this was (a stage, or a plain description). */
  stage: string;
  /** What was understood from it. */
  summary: string;
}

/** The considered understanding of a candidate against a Chair. */
export interface Dossier {
  id: string;
  /** The Chair this candidacy is for. */
  chairId: string;
  /** The candidate — a name, or a working name while a search is quiet. */
  candidate: string;
  biography: string;
  leadershipPhilosophy: string;
  /** How this candidate would hold the Chair — the summary against the charter. */
  chairSummary: string;
  strengths: string[];
  developmentAreas: string[];
  communicationStyle: string;
  /** The Founder's own observations — the Founder's words, never authored for them. */
  founderObservations: string;
  interviewHistory: InterviewNote[];
  recommendation: DossierRecommendation;
  outcome: DossierOutcome;
}

/** Build a Dossier from a partial sketch, with honest empty defaults for
    everything not yet known. A Dossier must at least name its Chair and its
    candidate; otherwise this returns null. No field is ever invented. */
export function makeDossier(
  input: Partial<Dossier> & { id: string; chairId: string; candidate: string },
): Dossier | null {
  if (!input.id || !input.chairId || !input.candidate.trim()) return null;
  return {
    id: input.id,
    chairId: input.chairId,
    candidate: input.candidate.trim(),
    biography: input.biography ?? '',
    leadershipPhilosophy: input.leadershipPhilosophy ?? '',
    chairSummary: input.chairSummary ?? '',
    strengths: input.strengths ?? [],
    developmentAreas: input.developmentAreas ?? [],
    communicationStyle: input.communicationStyle ?? '',
    founderObservations: input.founderObservations ?? '',
    interviewHistory: input.interviewHistory ?? [],
    recommendation: input.recommendation ?? 'undecided',
    outcome: input.outcome ?? 'pending',
  };
}

/** The dossiers prepared for a given Chair. */
export function dossiersForChair(dossiers: Dossier[], chairId: string): Dossier[] {
  return dossiers.filter((d) => d.chairId === chairId);
}

/** The House prepares no candidacies until it genuinely has one. This is the
    honest empty shelf — the framework is ready; the record is truthfully bare. */
export const DOSSIERS: Dossier[] = [];

/* =============================================================================
   PHASE 4 — THE APPOINTMENT RECORD (how a Chair is seated)

   An Appointment is the formal act of seating a candidate in a Chair: proposed
   on a day, carried to a Founder decision, and — if approved — made effective on
   a day. Its status is the state of the appointment itself, distinct from the
   Chair's standing (Phase 1) and from the candidacy (Phase 3).
   ============================================================================= */

/** The state of an appointment as it moves toward being seated. */
export type AppointmentStatus =
  | 'proposed'      // put forward, awaiting the Founder
  | 'under_review'  // the Founder is considering it
  | 'decided'       // the Founder has given a decision
  | 'effective'     // approved and now in force
  | 'declined'      // the Founder declined it
  | 'withdrawn';    // taken back before a decision

export interface AppointmentStatusKind { id: AppointmentStatus; label: string; }
export const APPOINTMENT_STATUSES: AppointmentStatusKind[] = [
  { id: 'proposed',     label: 'Proposed' },
  { id: 'under_review', label: 'Under Review' },
  { id: 'decided',      label: 'Decided' },
  { id: 'effective',    label: 'Effective' },
  { id: 'declined',     label: 'Declined' },
  { id: 'withdrawn',    label: 'Withdrawn' },
];
const APPOINTMENT_STATUS_BY_ID = new Map(APPOINTMENT_STATUSES.map((s) => [s.id, s]));
export function appointmentStatusLabel(id: AppointmentStatus): string {
  return APPOINTMENT_STATUS_BY_ID.get(id)?.label ?? id;
}

/** The Founder's decision on an appointment. */
export type FounderDecision =
  | 'pending'
  | 'approved'
  | 'approved_with_changes'
  | 'declined'
  | 'deferred';

export interface FounderDecisionKind { id: FounderDecision; label: string; }
export const FOUNDER_DECISIONS: FounderDecisionKind[] = [
  { id: 'pending',                label: 'Pending' },
  { id: 'approved',               label: 'Approved' },
  { id: 'approved_with_changes',  label: 'Approved with Changes' },
  { id: 'declined',               label: 'Declined' },
  { id: 'deferred',               label: 'Deferred' },
];
const FOUNDER_DECISION_BY_ID = new Map(FOUNDER_DECISIONS.map((d) => [d.id, d]));
export function founderDecisionLabel(id: FounderDecision): string {
  return FOUNDER_DECISION_BY_ID.get(id)?.label ?? id;
}

/** The record of an appointment — the letter that seats a Chair, in data. */
export interface AppointmentRecord {
  id: string;
  chairId: string;
  /** The dossier this appointment rests on, when there is one. */
  dossierId?: string;
  /** Who is being appointed. */
  appointee: string;
  /** ISO 'YYYY-MM-DD' — the day the appointment was proposed. */
  proposedOn: string;
  status: AppointmentStatus;
  founderDecision: FounderDecision;
  /** The Founder's own note on the decision, when given. */
  founderNotes?: string;
  /** ISO 'YYYY-MM-DD' — the day it takes/took effect; set once effective. */
  effectiveDate?: string;
  /** ISO datetime the record was written. */
  recordedAt: string;
}

/** Build an appointment record, defaulting to freshly proposed and undecided.
    Requires a Chair, an appointee, and the day proposed; otherwise null. */
export function makeAppointment(
  input: {
    id: string; chairId: string; appointee: string; proposedOn: string;
    dossierId?: string; status?: AppointmentStatus; founderDecision?: FounderDecision;
    founderNotes?: string; effectiveDate?: string;
  },
  now: Date = new Date(),
): AppointmentRecord | null {
  if (!input.id || !input.chairId || !input.appointee.trim() || !input.proposedOn) return null;
  const founderNotes = (input.founderNotes || '').trim() || undefined;
  return {
    id: input.id,
    chairId: input.chairId,
    dossierId: input.dossierId,
    appointee: input.appointee.trim(),
    proposedOn: input.proposedOn,
    status: input.status ?? 'proposed',
    founderDecision: input.founderDecision ?? 'pending',
    founderNotes,
    effectiveDate: input.effectiveDate,
    recordedAt: now.toISOString(),
  };
}

/** Whether an appointment is in force — approved and made effective. This is the
    single truth the rest of the House reads to know a Chair is truly seated. */
export function isEffective(a: AppointmentRecord): boolean {
  return a.status === 'effective' && !!a.effectiveDate;
}

/** The effective appointment for a Chair, if any — the appointee who genuinely
    holds it. The latest by effective date wins should more than one ever exist. */
export function seatedAppointment(appointments: AppointmentRecord[], chairId: string): AppointmentRecord | null {
  const effective = appointments
    .filter((a) => a.chairId === chairId && isEffective(a))
    .sort((a, b) => (a.effectiveDate! < b.effectiveDate! ? 1 : -1));
  return effective[0] ?? null;
}

/** The House has seated no one by appointment yet — the Founder holds every
    Chair. Honest empty state; the shelf is ready for the first letter. */
export const APPOINTMENTS: AppointmentRecord[] = [];

/* =============================================================================
   PHASE 5 — STORAGE ARCHITECTURE (institutional memory, kept safely)

   One namespaced, versioned home for each kind of record. The keys are shaped so
   the House can grow — additional Chairs, future Council Sessions, succession,
   and the long institutional history — without any store assuming a fixed count
   or a fixed shape. The logic above is pure; these are the only functions that
   touch the browser, and they fail closed (a read never throws).

   Nothing here deletes institutional memory. `save` replaces the working copy of
   the Founder's own mutable records (notes, in-progress dossiers); the Register
   itself is only ever appended to, above.
   ============================================================================= */

/** The single namespace root — every Executive store hangs beneath it, so the
    House's records are always found together and never collide with other rooms. */
export const STORAGE_ROOT = 'lhc.hq.executive';

/** The versioned keys. Versioning is per-store so any one record shape can evolve
    without disturbing the others. */
export const STORAGE_KEYS = {
  register:     `${STORAGE_ROOT}.register.v1`,
  dossiers:     `${STORAGE_ROOT}.dossiers.v1`,
  appointments: `${STORAGE_ROOT}.appointments.v1`,
  founderNotes: `${STORAGE_ROOT}.founder-notes.v1`,
  council:      `${STORAGE_ROOT}.council.v1`,
  succession:   `${STORAGE_ROOT}.succession.v1`,
} as const;

/** A generic, fail-closed array read from a namespaced store. */
export function loadCollection<T>(key: string, isValid: (x: unknown) => x is T): T[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(isValid) : [];
  } catch { return []; }
}

/** A generic, fail-closed array write to a namespaced store. */
export function saveCollection<T>(key: string, items: T[]): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(items));
  } catch { /* ignore — a failed write must never break the House */ }
}

/* --- the Founder's standing notes on a Chair (Phase 1: Founder Notes) --------
   Kept apart from the immutable charter: a Chair's charter is the institution's;
   these notes are the Founder's, mutable and private. One current note per Chair. */
export interface FounderNote {
  chairId: string;
  note: string;
  updatedAt: string;
}

export function makeFounderNote(chairId: string, note: string, now: Date = new Date()): FounderNote | null {
  if (!chairId) return null;
  return { chairId, note: note.trim(), updatedAt: now.toISOString() };
}

/** Set (or replace) the Founder's note for a Chair — one note per Chair. */
export function setFounderNote(existing: FounderNote[], note: FounderNote): FounderNote[] {
  return [...existing.filter((n) => n.chairId !== note.chairId), note];
}

export function founderNoteFor(notes: FounderNote[], chairId: string): FounderNote | null {
  return notes.find((n) => n.chairId === chairId) ?? null;
}

export function isFounderNote(x: unknown): x is FounderNote {
  const o = x as FounderNote;
  return !!o && typeof o.chairId === 'string' && typeof o.note === 'string' && typeof o.updatedAt === 'string';
}

/* --- Council Sessions (future) — the shelf, prepared -------------------------
   When the Executive Team meets as a body, each sitting will be kept here. The
   shape is minimal and honest: enough to record that a session happened and what
   it settled, ready to deepen later. No sessions are fabricated. */
export interface CouncilSession {
  id: string;
  /** ISO 'YYYY-MM-DD' the Council sat. */
  on: string;
  /** The Chairs present, by id. */
  present: string[];
  /** What the sitting was about. */
  subject: string;
  /** What it settled — kept in the record voice. */
  resolutions: string[];
}

export function isCouncilSession(x: unknown): x is CouncilSession {
  const o = x as CouncilSession;
  return !!o && typeof o.id === 'string' && typeof o.on === 'string'
    && Array.isArray(o.present) && typeof o.subject === 'string' && Array.isArray(o.resolutions);
}

/** No Council has sat yet — the framework stands ready. */
export const COUNCIL_SESSIONS: CouncilSession[] = [];

/* --- Succession (future) — how a charge passes from one holder to the next ----
   A succession links a Chair across a handover, so the line of a seat can be
   read even as the person changes. Prepared now so the record is never broken
   when the first handover comes. */
export interface SuccessionLink {
  id: string;
  chairId: string;
  /** Who held the Chair before. */
  from: string;
  /** Who holds it after. */
  to: string;
  /** ISO 'YYYY-MM-DD' of the handover. */
  on: string;
  /** How the charge was passed — kept in the record voice. */
  note: string;
}

export function isSuccessionLink(x: unknown): x is SuccessionLink {
  const o = x as SuccessionLink;
  return !!o && typeof o.id === 'string' && typeof o.chairId === 'string'
    && typeof o.from === 'string' && typeof o.to === 'string' && typeof o.on === 'string';
}

export const SUCCESSION: SuccessionLink[] = [];

/* =============================================================================
   THE ASSEMBLED VIEW — a Chair with everything the record knows about it, drawn
   together from the separate stores. Pure: given the records, it composes the
   truthful present standing without holding any of its own.
   ============================================================================= */
export interface ChairStanding {
  chair: ExecutiveChair;
  /** The standing derived from the Register (never disagrees with the record). */
  status: ChairStatus;
  /** Who is genuinely seated by an effective appointment, if anyone. */
  seatedBy: AppointmentRecord | null;
  /** The candidacies prepared against this Chair. */
  dossiers: Dossier[];
  /** The Founder's standing note, if written. */
  founderNote: FounderNote | null;
  /** The Chair's full history, oldest first. */
  history: RegisterEntry[];
}

export function chairStanding(
  chair: ExecutiveChair,
  records: {
    register?: RegisterEntry[];
    appointments?: AppointmentRecord[];
    dossiers?: Dossier[];
    founderNotes?: FounderNote[];
  } = {},
): ChairStanding {
  const register = records.register ?? [];
  return {
    chair,
    status: chairStatusFromRegister(register, chair),
    seatedBy: seatedAppointment(records.appointments ?? [], chair.id),
    dossiers: dossiersForChair(records.dossiers ?? [], chair.id),
    founderNote: founderNoteFor(records.founderNotes ?? [], chair.id),
    history: chairHistory(register, chair.id),
  };
}

/** The records the Register composes standings from. Grouped so selectors take a
    single, testable argument (each list defaults to empty — honest by absence). */
export interface ExecutiveRecords {
  register?: RegisterEntry[];
  appointments?: AppointmentRecord[];
  dossiers?: Dossier[];
  founderNotes?: FounderNote[];
}

/** Every Chair with its derived standing, in institutional order (by ordinal).
    The order and the set both come from the data — no count is ever assumed, so
    a third Chair appears the moment it is added, with no change here. */
export function chairStandings(chairs: ExecutiveChair[], records: ExecutiveRecords = {}): ChairStanding[] {
  return [...chairs].sort((a, b) => a.ordinal - b.ordinal).map((c) => chairStanding(c, records));
}

/** A Chair is an "opening" when it is not retired and not held by an effective
    appointment — an active or future seat still to be filled. */
export function isOpening(s: ChairStanding): boolean {
  return s.status !== 'retired' && !s.seatedBy;
}

/** The open Chairs — active or future openings — in institutional order. */
export function openChairStandings(chairs: ExecutiveChair[], records: ExecutiveRecords = {}): ChairStanding[] {
  return chairStandings(chairs, records).filter(isOpening);
}

/** The day a Chair was established, drawn from its own history (or null). */
export function establishedOn(s: ChairStanding): string | null {
  return s.history.find((e) => e.type === 'established')?.on ?? null;
}

/** A truthful one-line institutional standing for a Chair, derived from the
    record — never asserts an appointment that no Appointment record supports. */
export function institutionalStanding(s: ChairStanding): string {
  if (s.status === 'retired') return 'Retired';
  if (s.seatedBy) return `Seated — ${s.seatedBy.appointee}`;
  if (s.status === 'vacant') return 'Vacant';
  if (s.status === 'preparing') return 'Preparing to fill';
  return 'Established — not yet appointed';
}

/** The whole leadership history, every Chair's entries merged and read in order
    (oldest first). Ties on the day fall back to the order recorded. */
export function leadershipHistory(records: ExecutiveRecords = {}): RegisterEntry[] {
  return [...(records.register ?? [])].sort(
    (a, b) => (a.on === b.on ? a.recordedAt.localeCompare(b.recordedAt) : a.on.localeCompare(b.on)),
  );
}
