/* =============================================================================
   OFFICE OF THE CHIEF OF STAFF — the founder's private executive workspace
   (Sprint 9A — the first operational executive workspace inside Headquarters).

   Route: #/chief-of-staff. This is where the Founder comes to understand what
   needs attention, review prepared recommendations, make decisions, coordinate
   executive work, and keep institutional records. It reads like working with an
   exceptional Chief of Staff — calm, editorial, prepared before the Founder
   arrives — never a productivity application.

   This module holds the OFFICE AS DATA + its small amount of pure logic:
   the six sections (Briefing, Decisions, Docket, Open Chairs, Leadership Records,
   Archive), their Version 1 content, and the only interactive foundation —
   recording the Founder's own response to a decision. There is NO AI, NO
   automation, NO fetch, and NO backend: like the residence's Calendar and
   Dictation, the Founder's decisions are the Founder's own and persist client-
   side in localStorage. Everything else is curated, placeholder V1 content —
   the framework, prepared for real records to be laid in later.

   OPEN CHAIRS and LEADERSHIP RECORDS are NOT held here — they are DERIVED from
   the Executive Register (Sprint 11A, `executive-register.ts`), the single
   institutional source of truth for Chairs, standing, appointments, and history.
   This module keeps only the office's own material (sections, briefing, the
   decision system, the docket, the archive) plus the thin selectors below that
   present the Register inside this workspace. No Chair data is duplicated here.
   ============================================================================= */

import {
  CHAIRS as EXECUTIVE_CHAIRS,
  FOUNDING_REGISTER, APPOINTMENTS, DOSSIERS,
  chairStandings, openChairStandings, establishedOn, institutionalStanding, leadershipHistory,
  loadCollection, STORAGE_KEYS, isFounderNote,
  CHAIR_CHIEF_OF_STAFF,
  chairStatusLabel,
  type ExecutiveRecords, type ChairStatus, type AppointmentRecord, type RegisterEntry,
} from './executive-register.ts';

// Re-exported so this office remains the workspace's import surface, while the
// Register stays the source of truth.
export { chairStatusLabel };

/* -----------------------------------------------------------------------------
   THE SECTIONS — the office is organised as data, so its internal navigation is
   never hard-coded. Each section is a calm sub-route (#/chief-of-staff/<id>);
   the Briefing is home.
   --------------------------------------------------------------------------- */
export type CosSectionId =
  | 'briefing'
  | 'initiatives'
  | 'work-queue'
  | 'inbox'
  | 'decisions'
  | 'docket'
  | 'brokerage'
  | 'opportunities'
  | 'chairs'
  | 'leadership'
  | 'archive';

export interface CosSection {
  id: CosSectionId;
  /** Short label for the section nav. */
  label: string;
  /** One quiet line naming what the section is for. */
  note: string;
}

export const COS_SECTIONS: CosSection[] = [
  { id: 'briefing',   label: 'Founder Briefing',  note: 'What has been prepared for you today.' },
  { id: 'initiatives', label: 'Bring an Initiative', note: 'Bring an idea, opportunity, problem, or decision — the House takes it up.' },
  { id: 'work-queue', label: 'Work Queue',        note: 'One view of what requires attention now, across the House.' },
  { id: 'inbox',      label: 'Executive Inbox',   note: 'The front door — record work and the House takes it up.' },
  { id: 'decisions',  label: 'Decisions',         note: 'Prepared recommendations awaiting your word.' },
  { id: 'docket',     label: 'Docket',            note: 'The active questions before the House.' },
  { id: 'brokerage',  label: 'The Brokerage',     note: 'Where the office brokers collaboration between the Chairs.' },
  { id: 'opportunities', label: 'Opportunities',  note: 'Intelligence the Director of Growth has found, awaiting your prioritisation.' },
  { id: 'chairs',     label: 'Open Chairs',       note: 'The seats the House is preparing to fill.' },
  { id: 'leadership', label: 'Leadership Records', note: 'Who holds each charge, and how it was given.' },
  { id: 'archive',    label: 'Archive',           note: 'The institutional record, kept in order.' },
];

/** The section a bare #/chief-of-staff resolves to — the primary landing. */
export const COS_HOME_SECTION: CosSectionId = 'briefing';

const SECTION_IDS = new Set<CosSectionId>(COS_SECTIONS.map((s) => s.id));

/** Whether a string names a known section (used to validate the sub-route). */
export function isCosSection(id: string | null | undefined): id is CosSectionId {
  return !!id && SECTION_IDS.has(id as CosSectionId);
}

/* =============================================================================
   1. FOUNDER BRIEFING — the primary landing experience.

   A prepared morning briefing in the House's editorial voice. Content is manual
   Version 1 placeholder (NO AI, NO generated summaries); "Decisions Waiting" is
   the one live line — it is derived from the open decisions below, so the
   Briefing can never disagree with the Decisions section.
   ============================================================================= */
export interface BriefingContent {
  /** The warm opening — the greeting is composed at render with the time of day. */
  goodMorning: string;
  todaysPriorities: string[];
  progressSinceYesterday: string[];
  risks: string[];
  lookingAhead: string[];
  /** The Chief of Staff's own closing note to the Founder. */
  chiefOfStaffNote: string;
}

export const BRIEFING: BriefingContent = {
  goodMorning:
    'Everything is in order. Nothing is on fire. Here is what I have prepared, so your attention goes only where it will matter most.',
  todaysPriorities: [
    'Give your word on the recommendations waiting below — each is prepared, with my thinking laid out.',
    'Look over the Docket once; two questions are ripening and will want you soon, though not today.',
    'Keep the morning unhurried. The House is running; this is a day for judgement, not for haste.',
  ],
  progressSinceYesterday: [
    'The Headquarters residence is complete — all wings are open and settled.',
    'This office — your Chief of Staff — has been prepared and is now standing.',
    'The institutional record has been given its shelves, ready to hold what comes next.',
  ],
  risks: [
    'Nothing requires you urgently. The items below can each wait for a considered decision.',
    'A few chairs remain open; the House functions without them, but filling them well is worth unhurried care.',
  ],
  lookingAhead: [
    'As decisions are recorded here, this office becomes the House’s long memory of how it chose.',
    'When you are ready, real appointment letters, meeting records, and briefings will be filed in the Archive.',
  ],
  chiefOfStaffNote:
    'I have read everything so that you can read only what matters. Take the decisions in whatever order feels right — there is no wrong pace. I will keep the rest in order until you return.',
};

/* =============================================================================
   2. DECISION SYSTEM — the long-term decision record for Headquarters.

   Each decision is prepared FOR the Founder: a recommendation, the reasoning
   behind it, the trade-offs, and the single action requested. The Founder's
   RESPONSE (one of six) is recorded and kept — this is the operational
   foundation of the office and the House's memory of how it chose.
   ============================================================================= */

/** The prepared decision, as authored for the Founder. Status/date describe the
    item as prepared; the Founder's own answer lives separately (a Response). */
export interface Decision {
  id: string;
  title: string;
  /** What this decision is, in a sentence. */
  summary: string;
  /** The Chief of Staff's prepared recommendation. */
  recommendation: string;
  /** Why — the thinking behind the recommendation. */
  reasoning: string;
  /** What is given up or risked either way — named honestly. */
  tradeOffs: string[];
  /** The single, specific action requested of the Founder. */
  requestedAction: string;
  /** The item's prepared status when it was laid before the Founder. */
  status: 'prepared';
  /** ISO 'YYYY-MM-DD' — the day it was prepared. */
  date: string;
}

/** The six responses the Founder may give. `terminal:false` responses keep the
    decision in view (it is still, in some sense, open); `archived` retires it. */
export type ResponseId =
  | 'approved'
  | 'approved_with_changes'
  | 'not_yet'
  | 'rework'
  | 'discuss'
  | 'archive';

export interface ResponseKind {
  id: ResponseId;
  label: string;
  /** One line the office shows back once this response is recorded. */
  echo: string;
  /** Whether this response resolves the decision out of the waiting count. */
  resolves: boolean;
  /** Whether this response retires the decision to the Archive. */
  archives: boolean;
}

export const RESPONSES: ResponseKind[] = [
  { id: 'approved',              label: 'Approved',
    echo: 'Approved. It will be carried out as recommended.',
    resolves: true,  archives: false },
  { id: 'approved_with_changes', label: 'Approved with Changes',
    echo: 'Approved with your changes. Note what you would adjust.',
    resolves: true,  archives: false },
  { id: 'not_yet',               label: 'Not Yet',
    echo: 'Held. Not yet — it will keep until the time is right.',
    resolves: false, archives: false },
  { id: 'rework',                label: 'Rework',
    echo: 'Sent back for rework. It will return to you reconsidered.',
    resolves: false, archives: false },
  { id: 'discuss',               label: 'Discuss',
    echo: 'Set aside to discuss before it is decided.',
    resolves: false, archives: false },
  { id: 'archive',               label: 'Archive',
    echo: 'Archived. Kept in the record, no longer awaiting you.',
    resolves: true,  archives: true },
];

const RESPONSE_BY_ID = new Map<ResponseId, ResponseKind>(RESPONSES.map((r) => [r.id, r]));

/** A response by id, or null if unknown. */
export function getResponse(id: string | null | undefined): ResponseKind | null {
  if (!id) return null;
  return RESPONSE_BY_ID.get(id as ResponseId) ?? null;
}

/** The Founder's recorded answer to a decision — the durable record. */
export interface DecisionResponse {
  decisionId: string;
  response: ResponseId;
  /** Optional note the Founder attached (e.g. the change they'd make). */
  note?: string;
  /** ISO datetime the response was recorded. */
  respondedAt: string;
}

/**
 * The prepared decisions (Version 1 placeholder content). These read as work an
 * exceptional Chief of Staff would have ready — real in shape, honest in that
 * they describe the House's own opening choices, not fabricated external events.
 */
export const DECISIONS: Decision[] = [
  {
    id: 'dec_cadence',
    title: 'A standing rhythm for this office',
    summary:
      'How often you and I sit down together — the cadence at which briefings are prepared and decisions are brought to you.',
    recommendation:
      'Begin with a single unhurried review each morning, and one longer sitting each week for the Docket.',
    reasoning:
      'A predictable rhythm means nothing piles up unseen and nothing interrupts you out of turn. A daily glance keeps decisions from aging; a weekly sitting is where the larger questions get the room they need.',
    tradeOffs: [
      'A daily rhythm asks for a few quiet minutes each morning.',
      'A lighter cadence would mean fewer touchpoints, but decisions would wait longer for your word.',
    ],
    requestedAction: 'Approve the daily-plus-weekly rhythm, or tell me the cadence you would prefer.',
    status: 'prepared',
    date: '2026-07-15',
  },
  {
    id: 'dec_first_chair',
    title: 'Which chair to prepare first',
    summary:
      'Of the open chairs the House will eventually fill, which one I should begin preparing the ground for.',
    recommendation:
      'Prepare the ground for the chair closest to the work already in motion, before any that are further off.',
    reasoning:
      'The House functions today without any chair filled. Preparing the one nearest the current work means the first appointment, when it comes, lands where it is felt soonest — and teaches us how to make the next one well.',
    tradeOffs: [
      'Focusing on one chair means the others wait a little longer for attention.',
      'Preparing several at once would spread care thin and slow every one of them.',
    ],
    requestedAction: 'Approve preparing one chair first, or name the chair you would rather I begin with.',
    status: 'prepared',
    date: '2026-07-15',
  },
  {
    id: 'dec_record',
    title: 'What this office keeps in the record',
    summary:
      'The standing principle for what is filed in the Archive — every decision, or only the ones that shape the House.',
    recommendation:
      'File every decision recorded here, so the record is complete and can always be trusted.',
    reasoning:
      'A record that keeps everything is a record you never have to second-guess. The small decisions cost almost nothing to keep, and together they become the honest story of how the House was led.',
    tradeOffs: [
      'A complete record grows steadily and will want tending as it does.',
      'Keeping only the large decisions would be lighter, but the record would have gaps you could not later fill.',
    ],
    requestedAction: 'Approve keeping a complete record, or tell me where you would draw the line.',
    status: 'prepared',
    date: '2026-07-15',
  },
];

/* --- pure decision logic (no I/O, no DOM) --------------------------------- */

/** Validate + stamp a Founder response into a durable record (or null if the
    decision or response id is unknown). `now` is injected for testability. */
export function makeResponse(
  input: { decisionId: string; response: string; note?: string },
  now: Date = new Date(),
): DecisionResponse | null {
  if (!DECISIONS.some((d) => d.id === input.decisionId)) return null;
  if (!RESPONSE_BY_ID.has(input.response as ResponseId)) return null;
  const note = (input.note || '').trim() || undefined;
  return {
    decisionId: input.decisionId,
    response: input.response as ResponseId,
    note,
    respondedAt: now.toISOString(),
  };
}

/** Index responses by decision id — the latest response wins for each decision. */
export function responsesById(responses: DecisionResponse[]): Map<string, DecisionResponse> {
  const map = new Map<string, DecisionResponse>();
  for (const r of responses) {
    const prev = map.get(r.decisionId);
    if (!prev || r.respondedAt >= prev.respondedAt) map.set(r.decisionId, r);
  }
  return map;
}

/** A decision paired with the Founder's response (if any) and its live state. */
export interface DecisionView {
  decision: Decision;
  response: DecisionResponse | null;
  /** True while the decision still awaits the Founder (no resolving response). */
  awaiting: boolean;
  /** True once a response archives it (kept in the record, out of the active set). */
  archived: boolean;
}

/** Build the active view of a decision from its recorded response. */
export function decisionView(decision: Decision, response: DecisionResponse | null): DecisionView {
  const kind = response ? RESPONSE_BY_ID.get(response.response) ?? null : null;
  return {
    decision,
    response,
    awaiting: !kind || !kind.resolves,
    archived: !!kind && kind.archives,
  };
}

/** All decisions as views, active (non-archived) first, in prepared order. */
export function decisionViews(
  decisions: Decision[],
  responses: DecisionResponse[],
): DecisionView[] {
  const byId = responsesById(responses);
  const views = decisions.map((d) => decisionView(d, byId.get(d.id) ?? null));
  // Active decisions keep their prepared order; archived ones settle to the end.
  return [...views.filter((v) => !v.archived), ...views.filter((v) => v.archived)];
}

/** The decisions still awaiting the Founder — the Briefing's live "Decisions
    Waiting" line and the office's only count (honest, derived, never fabricated). */
export function openDecisions(
  decisions: Decision[],
  responses: DecisionResponse[],
): DecisionView[] {
  return decisionViews(decisions, responses).filter((v) => v.awaiting && !v.archived);
}

/* --- client persistence (localStorage; no backend) ------------------------ */
const DECISIONS_STORE = 'lhc.hq.cos.decisions.v1';

export function loadResponses(): DecisionResponse[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(DECISIONS_STORE) : null;
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(isResponse) : [];
  } catch { return []; }
}
export function saveResponses(responses: DecisionResponse[]): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(DECISIONS_STORE, JSON.stringify(responses));
  } catch { /* ignore */ }
}
/** Record a Founder response, replacing any earlier answer to the same decision. */
export function recordResponse(
  existing: DecisionResponse[],
  response: DecisionResponse,
): DecisionResponse[] {
  return [...existing.filter((r) => r.decisionId !== response.decisionId), response];
}
/** Withdraw the Founder's answer to a decision, returning it to waiting. */
export function clearResponse(existing: DecisionResponse[], decisionId: string): DecisionResponse[] {
  return existing.filter((r) => r.decisionId !== decisionId);
}
function isResponse(r: unknown): r is DecisionResponse {
  const o = r as DecisionResponse;
  return !!o && typeof o.decisionId === 'string' && typeof o.response === 'string'
    && typeof o.respondedAt === 'string' && RESPONSE_BY_ID.has(o.response as ResponseId);
}

/* =============================================================================
   3. DOCKET — the active strategic questions before the House.

   Not tasks. Each item is a question that wants leadership consideration, with
   the background and the Chief of Staff's recommendation prepared. Version 1
   content; presentation only (no workflow, no due dates, no assignment).
   ============================================================================= */
export type DocketStatus = 'forming' | 'in_consideration' | 'ready_for_you';

export interface DocketStatusKind { id: DocketStatus; label: string; }
export const DOCKET_STATUSES: DocketStatusKind[] = [
  { id: 'forming',          label: 'Forming' },
  { id: 'in_consideration', label: 'In Consideration' },
  { id: 'ready_for_you',    label: 'Ready for You' },
];
const DOCKET_STATUS_BY_ID = new Map(DOCKET_STATUSES.map((s) => [s.id, s]));

/** The label for a docket status (or the raw id if somehow unknown). */
export function docketStatusLabel(id: DocketStatus): string {
  return DOCKET_STATUS_BY_ID.get(id)?.label ?? id;
}

export interface DocketItem {
  id: string;
  /** The question, phrased as a question. */
  question: string;
  /** What sits behind it — context, not a brief. */
  background: string;
  /** The Chief of Staff's early recommendation (may still be forming). */
  recommendation: string;
  /** Who is carrying it toward a decision. */
  owner: string;
  status: DocketStatus;
}

export const DOCKET: DocketItem[] = [
  {
    id: 'dk_voice',
    question: 'What does the House sound like when it speaks to the world?',
    background:
      'As the wings open outward, the House will have more occasions to speak. Settling its voice now — warm, editorial, unhurried — keeps every later word consistent.',
    recommendation:
      'Draw the voice from what already exists in the residence, and write it down before it is needed, not after.',
    owner: 'Chief of Staff',
    status: 'in_consideration',
  },
  {
    id: 'dk_first_appointment',
    question: 'When is the right moment to make the first appointment?',
    background:
      'The House runs well as it is. The first person invited to a chair sets the tone for everyone who follows, so the timing matters as much as the choice.',
    recommendation:
      'Wait until the work plainly outgrows one pair of hands, then move deliberately — the moment will announce itself.',
    owner: 'Chief of Staff',
    status: 'forming',
  },
  {
    id: 'dk_rhythm',
    question: 'How does the House keep its calm as it grows?',
    background:
      'Everything built so far has been unhurried and intentional. Preserving that as more people and more work arrive is a question of habits, not rules.',
    recommendation:
      'Protect the morning review and the weekly sitting as the House grows — rhythm is what keeps calm from being accidental.',
    owner: 'Chief of Staff',
    status: 'forming',
  },
];

/* =============================================================================
   4. OPEN CHAIRS — DERIVED from the Executive Register.

   The seats the House is preparing to fill, drawn straight from the approved
   foundation. A Chair is shown here when its derived standing is an active or
   future opening (not retired, not seated). Nothing is duplicated: the Chairs,
   their standing, and their history all come from `executive-register.ts`.

   One presentation rule lives here: where this section exposes the Creative
   Director's charter, the word "canon" and its variations are replaced with
   plain creative-standards language — a wording choice for this surface, not a
   change to the approved foundation.
   ============================================================================= */

/** Replace "canon" language with plain creative-standards wording, in order from
    the most specific phrase to the bare word, so no "canon" remains. */
const CANON_REPLACEMENTS: [RegExp, string][] = [
  [/accumulating creative canon/gi, 'accumulating body of creative standards'],
  [/creative canon/gi, 'creative standards'],
  [/\bcanons\b/gi, 'creative standards'],
  [/\bcanon\b/gi, 'creative standards'],
];
export function neutralizeCanon(text: string): string {
  return CANON_REPLACEMENTS.reduce((s, [re, rep]) => s.replace(re, rep), text);
}

/** The live records this workspace reads: the Register foundation, plus any
    Founder notes genuinely written client-side. Selectors take records as an
    argument (testable); this gathers the live ones for rendering. */
export function executiveRecords(): ExecutiveRecords {
  return {
    register: FOUNDING_REGISTER,
    appointments: APPOINTMENTS,
    dossiers: DOSSIERS,
    founderNotes: loadCollection(STORAGE_KEYS.founderNotes, isFounderNote),
  };
}

/** One open Chair, shaped for this section — derived, with canon language
    neutralised on every exposed field. */
export interface OpenChairView {
  ordinal: number;
  title: string;
  purpose: string;
  charge: string;
  responsibilities: string[];
  status: ChairStatus;
  statusLabel: string;
  establishedOn: string | null;
}

export function openChairViews(records: ExecutiveRecords = executiveRecords()): OpenChairView[] {
  return openChairStandings(EXECUTIVE_CHAIRS, records).map((s) => ({
    ordinal: s.chair.ordinal,
    title: s.chair.title,
    purpose: neutralizeCanon(s.chair.purpose),
    charge: neutralizeCanon(s.chair.charge),
    responsibilities: s.chair.standingResponsibilities.map(neutralizeCanon),
    status: s.status,
    statusLabel: chairStatusLabel(s.status),
    establishedOn: establishedOn(s),
  }));
}

/* =============================================================================
   5. LEADERSHIP RECORDS — DERIVED from Chair definitions + Register history.

   Every Chair's truthful current standing, its appointment (only if a real
   Appointment record exists), any genuine Founder note, and the preserved
   leadership history. No standing is stored here; all of it is derived, so the
   record can never disagree with the Register.
   ============================================================================= */

/** One Chair's line in the leadership record — its truthful present standing. */
export interface LeadershipStandingView {
  ordinal: number;
  title: string;
  /** The truthful institutional standing (e.g. "Established — not yet appointed"). */
  standing: string;
  status: ChairStatus;
  /** True only when a real, effective Appointment record seats the Chair. */
  seated: boolean;
  establishedOn: string | null;
  /** The Founder's own note, only if genuinely written. */
  founderNote: string | null;
  /** An honest distinction for Chair #001: established and operating as the live
      workspace, though never formally appointed. Null for every other Chair. */
  operatingNote: string | null;
}

export function leadershipViews(records: ExecutiveRecords = executiveRecords()): LeadershipStandingView[] {
  return chairStandings(EXECUTIVE_CHAIRS, records).map((s) => ({
    ordinal: s.chair.ordinal,
    title: s.chair.title,
    standing: institutionalStanding(s),
    status: s.status,
    seated: !!s.seatedBy,
    establishedOn: establishedOn(s),
    founderNote: s.founderNote?.note ?? null,
    operatingNote: s.chair.id === CHAIR_CHIEF_OF_STAFF
      ? 'Established and operating as the live workspace — this office — though no formal appointment has been made.'
      : null,
  }));
}

/** The appointments genuinely on record — honestly empty until the first letter. */
export function appointmentsOnRecord(records: ExecutiveRecords = executiveRecords()): AppointmentRecord[] {
  return records.appointments ?? [];
}

/** The preserved leadership history, oldest first — the Register's own entries,
    never rewritten or deleted. */
export function leadershipHistoryView(records: ExecutiveRecords = executiveRecords()): RegisterEntry[] {
  return leadershipHistory(records);
}

/* =============================================================================
   6. ARCHIVE — the institutional record, given its shelves.

   The categories are prepared now so documents have a home the moment they
   exist. Version 1 is structure: each category is honest about being empty
   rather than fabricating records. Decisions the Founder records ARE real, so
   that shelf reflects the true count; the rest await their first document.
   ============================================================================= */
export type ArchiveCategoryId =
  | 'briefings'
  | 'decisions'
  | 'appointment_letters'
  | 'meeting_records'
  | 'leadership_documents';

export interface ArchiveCategory {
  id: ArchiveCategoryId;
  label: string;
  /** One line on what this shelf holds. */
  note: string;
  /** The honest line shown while the shelf is empty. */
  emptyLine: string;
}

export const ARCHIVE_CATEGORIES: ArchiveCategory[] = [
  { id: 'briefings',            label: 'Briefings',
    note: 'The prepared briefings, kept as they are given.',
    emptyLine: 'No briefings filed yet — the shelf is ready.' },
  { id: 'decisions',            label: 'Decisions',
    note: 'The record of every decision, and how it was answered.',
    emptyLine: 'No decisions recorded yet — your answers will be kept here.' },
  { id: 'appointment_letters',  label: 'Appointment Letters',
    note: 'The letters that seat each chair.',
    emptyLine: 'No appointments made yet — the shelf is ready for the first letter.' },
  { id: 'meeting_records',      label: 'Meeting Records',
    note: 'What was said and settled when the House met.',
    emptyLine: 'No meeting records filed yet — the shelf is ready.' },
  { id: 'leadership_documents', label: 'Leadership Documents',
    note: 'The charters, charges, and standing papers of leadership.',
    emptyLine: 'No leadership documents filed yet — the shelf is ready.' },
];

/** A prepared category with a truthful count of what it currently holds. In V1
    only the Decisions shelf can hold anything (the Founder's own recorded
    answers); every other shelf is honestly empty until real documents arrive. */
export interface ArchiveShelf extends ArchiveCategory { count: number; }

export function archiveShelves(recordedDecisionCount: number): ArchiveShelf[] {
  return ARCHIVE_CATEGORIES.map((c) => ({
    ...c,
    count: c.id === 'decisions' ? Math.max(0, recordedDecisionCount) : 0,
  }));
}

/* =============================================================================
   ROOM COPY — the office's own framing lines.
   ============================================================================= */
export const COS_EYEBROW = 'The Founder’s Office';
export const COS_TITLE = 'Office of the Chief of Staff';
export const COS_LEDE =
  'Your private executive workspace — where the day is understood, recommendations are reviewed, decisions are made, and the House keeps its record. Everything here has been prepared before you arrived.';
