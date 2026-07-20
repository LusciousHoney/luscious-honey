/* =============================================================================
   Executive Workflow Engine v1 — the orchestration layer of the Headquarters.

   Headquarters is the operating headquarters of the Luscious Honey Collective —
   not a dashboard, not a tracker. The Founder brings an opportunity, idea,
   problem, or decision; the EXECUTIVE TEAM organizes, coordinates, recommends,
   and executes. The Founder never chooses which executive to visit, which office
   owns the work, which platform receives content, or what step comes next.

   The Chief of Staff is the CONDUCTOR: it receives every initiative, determines
   which executives participate, gathers their contributions (each strictly
   within charter), assembles ONE Executive Brief, and returns only what needs a
   Founder decision. On approval the initiative advances into execution, routing
   work into the correct offices. On completion the workflow — not the Founder —
   proposes how it enters institutional history.

   ★ Design boundaries:
     • Pure, deterministic, testable logic. No AI, no network, no external
       publishing. Execution produces INTERNAL routed work items with a seam
       (automationHook) where publishing/automation plugs in LATER.
     • This is the institutional (Headquarters) engine. The Initiative is the
       front-door orchestration object; it does NOT duplicate the Recommendation
       decision record (chief-of-staff-ops.ts) — it is designed to promote into
       that pipeline and the publishing systems through the deferred hooks.
     • Executives contribute only within their charter; the 3 producing Chairs are
       the seated Register Chairs (#002–#004), plus the named Publishing and
       Business Office functions the operating model calls for. New executives
       plug into the same roster.
   ============================================================================= */

import { loadCollection, saveCollection, getChair,
  CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION, CHAIR_DIRECTOR_OF_GROWTH } from './executive-register.ts';

const WORKFLOW_KEY = 'lhc.hq.executive-workflow.v1';

/* --- the executive roster (participants the conductor may enlist) ---------- */

export type ExecutiveId =
  | 'creative_director' | 'head_of_production' | 'director_of_growth'
  | 'publishing' | 'business_office';

export interface WorkflowExecutive {
  id: ExecutiveId;
  label: string;
  /** The Register Chair this function is seated in, when it is a seated Chair. */
  chairId?: string;
  /** The charter areas this executive contributes — never beyond them. */
  charter: string[];
  /** Lowercased trigger terms that call this executive into an initiative. */
  domains: string[];
  /** Whether this executive is always enlisted (core House output). */
  core: boolean;
}

export const EXECUTIVES: WorkflowExecutive[] = [
  {
    id: 'creative_director', label: 'Creative Director', chairId: CHAIR_CREATIVE_DIRECTOR, core: true,
    charter: ['emotional angle', 'narrative', 'creative opportunities'],
    domains: ['content', 'story', 'voice', 'narration', 'creative', 'experience', 'feel', 'emotion', 'angle'],
  },
  {
    id: 'head_of_production', label: 'Head of Production', chairId: CHAIR_HEAD_OF_PRODUCTION, core: false,
    charter: ['format', 'deliverables', 'recording plan', 'assets required'],
    domains: ['record', 'recording', 'video', 'audio', 'voice', 'narration', 'podcast', 'film', 'shoot', 'format', 'produce'],
  },
  {
    id: 'director_of_growth', label: 'Director of Growth', chairId: CHAIR_DIRECTOR_OF_GROWTH, core: true,
    charter: ['platform strategy', 'timing', 'audience', 'distribution'],
    domains: ['content', 'platform', 'audience', 'grow', 'reach', 'distribution', 'tiktok', 'linkedin', 'post', 'launch'],
  },
  {
    id: 'publishing', label: 'Publishing', core: false,
    charter: ['article', 'newsletter', 'journal', 'podcast', 'editorial placement'],
    domains: ['write', 'writing', 'article', 'essay', 'newsletter', 'journal', 'substack', 'editorial', 'podcast', 'publish', 'book'],
  },
  {
    id: 'business_office', label: 'Business Office', core: false,
    charter: ['relationships', 'collaboration opportunities', 'institutional records'],
    domains: ['met', 'meet', 'creator', 'relationship', 'collaborat', 'partner', 'signing', 'introduc', 'network', 'deal'],
  },
];
const EXEC_BY_ID = new Map(EXECUTIVES.map((e) => [e.id, e]));
export function executiveLabel(id: ExecutiveId): string {
  const e = EXEC_BY_ID.get(id);
  return e?.chairId ? (getChair(e.chairId)?.title ?? e.label) : (e?.label ?? id);
}

/* --- the initiative and its parts ----------------------------------------- */

export type InitiativeStatus =
  | 'brief_ready'   // the Executive Team has coordinated; one Brief awaits the Founder
  | 'approved' | 'revising' | 'paused' | 'declined'
  | 'executing' | 'completed' | 'archived';

export type FounderDecision = 'approve' | 'revise' | 'pause' | 'decline';

export type Priority = 'normal' | 'high';

/** One executive's contribution — strictly its charter areas, filled for this initiative. */
export interface ExecutiveContribution {
  executive: ExecutiveId;
  /** charter-area → the executive's note for it. */
  notes: { area: string; note: string }[];
  /** Concrete deliverables this executive can produce for the initiative. */
  deliverables: string[];
  /** Platforms/placements this executive recommends (growth + publishing). */
  platforms: string[];
}

/** The ONE Executive Brief the Founder receives — never six conversations. */
export interface ExecutiveBrief {
  purpose: string;
  recommendedDeliverables: string[];
  priority: Priority;
  suggestedTimeline: string;
  recommendedPlatforms: string[];
  requiredFounderDecisions: string[];
  dependencies: string[];
  nextActions: string[];
}

export type HistoryDisposition =
  | 'historical_record' | 'museum_artifact' | 'editorial_publication'
  | 'journal_entry' | 'institutional_milestone' | 'internal';

export const HISTORY_DISPOSITIONS: { id: HistoryDisposition; label: string }[] = [
  { id: 'historical_record',     label: 'Historical record' },
  { id: 'museum_artifact',       label: 'Museum artifact' },
  { id: 'editorial_publication', label: 'Editorial publication' },
  { id: 'journal_entry',         label: 'Journal entry' },
  { id: 'institutional_milestone', label: 'Institutional milestone' },
  { id: 'internal',              label: 'Remain internal' },
];

/** A routed unit of execution — INTERNAL only. The automationHook is the seam a
    future publishing/automation system plugs into; v1 never publishes. */
export interface WorkItem {
  id: string;
  office: ExecutiveId;      // the office that owns this work
  title: string;           // the deliverable (e.g. 'TikTok script')
  platform: string;        // intended destination (e.g. 'TikTok', 'House Journal')
  status: 'routed' | 'done';
  automationHook: 'none';  // reserved seam — no external publishing in v1
}

export interface Initiative {
  id: string;
  founderInput: string;
  title: string;
  status: InitiativeStatus;
  participants: ExecutiveId[];
  contributions: ExecutiveContribution[];
  brief: ExecutiveBrief;
  decision?: { decision: FounderDecision; note?: string; at: string };
  execution: WorkItem[];
  history?: { recommended: HistoryDisposition; chosen?: HistoryDisposition };
  createdAt: string;
  updatedAt: string;
}

/* --- the conductor: who participates -------------------------------------- */

const norm = (s: string) => s.toLowerCase();

/** Deterministically select the executives an initiative calls for. Core
    executives are always enlisted; the rest join when the input touches their
    domain. The Founder chooses none of this. */
export function selectParticipants(input: string): ExecutiveId[] {
  const text = norm(input);
  return EXECUTIVES
    .filter((e) => e.core || e.domains.some((d) => text.includes(d)))
    .map((e) => e.id);
}

/* --- executive contributions (each within charter) ------------------------ */

/** The concrete deliverables and platforms each executive brings, by charter. */
function contributionFor(id: ExecutiveId, initiative: { title: string }): ExecutiveContribution {
  const subject = initiative.title;
  switch (id) {
    case 'creative_director':
      return { executive: id,
        notes: [
          { area: 'emotional angle', note: `The through-line of "${subject}" — why it matters to the audience.` },
          { area: 'narrative', note: 'Shape the moment into a story the House can tell in its own voice.' },
          { area: 'creative opportunities', note: 'Openings this creates for related pieces.' },
        ],
        deliverables: ['Creative direction'], platforms: [] };
    case 'head_of_production':
      return { executive: id,
        notes: [
          { area: 'format', note: 'Short-form video and spoken audio suit this best.' },
          { area: 'recording plan', note: 'A single recording session covers the spoken pieces.' },
          { area: 'assets required', note: 'Narration take; any reference material from the event.' },
        ],
        deliverables: ['TikTok script', 'Podcast outline'], platforms: [] };
    case 'director_of_growth':
      return { executive: id,
        notes: [
          { area: 'platform strategy', note: 'Lead on short-form, carry the long form on owned channels.' },
          { area: 'timing', note: 'Publish while the moment is fresh — within the week.' },
          { area: 'audience', note: 'Creators and readers already close to the House.' },
          { area: 'distribution', note: 'Sequence across platforms rather than all at once.' },
        ],
        deliverables: [], platforms: ['TikTok', 'LinkedIn'] };
    case 'publishing':
      return { executive: id,
        notes: [
          { area: 'editorial placement', note: 'A reflective piece belongs in the House Journal, with a Substack edition.' },
        ],
        deliverables: ['Substack article', 'House Journal entry'], platforms: ['Substack', 'House Journal'] };
    case 'business_office':
      return { executive: id,
        notes: [
          { area: 'relationships', note: 'Note the new connection and any people to thank or follow up with.' },
          { area: 'collaboration opportunities', note: 'A possible collaboration to explore, on the House\'s terms.' },
          { area: 'institutional records', note: 'Log the relationship in the institutional record.' },
        ],
        deliverables: [], platforms: [] };
  }
}

/* --- brief assembly: the ONE recommendation ------------------------------- */

const HIGH_PRIORITY_SIGNALS = ['urgent', 'deadline', 'today', 'time-sensitive', 'launch', 'opportunity'];

function assembleBrief(input: string, contributions: ExecutiveContribution[]): ExecutiveBrief {
  const uniq = (xs: string[]) => [...new Set(xs)];
  const has = (id: ExecutiveId) => contributions.some((c) => c.executive === id);
  const deliverables = uniq(contributions.flatMap((c) => c.deliverables));
  const platforms = uniq(contributions.flatMap((c) => c.platforms));
  const priority: Priority = HIGH_PRIORITY_SIGNALS.some((s) => norm(input).includes(s)) ? 'high' : 'normal';

  const requiredFounderDecisions = ['Approve the overall direction'];
  if (platforms.length > 1) requiredFounderDecisions.push('Confirm the primary platform');
  if (has('head_of_production')) requiredFounderDecisions.push('Consent to record');
  if (has('business_office')) requiredFounderDecisions.push('Decide whether to pursue the collaboration');

  const dependencies: string[] = [];
  if (has('head_of_production')) dependencies.push('Recording assets and a narration take');
  if (has('business_office')) dependencies.push('Follow-up with the new connection');

  const nextActions = deliverables.map((d) => `Route "${d}" to its office`);

  return {
    purpose: 'Turn this into coordinated work across the House, with the Founder deciding once.',
    recommendedDeliverables: deliverables,
    priority,
    suggestedTimeline: priority === 'high' ? 'This week — the moment is fresh.' : 'Within two weeks.',
    recommendedPlatforms: platforms,
    requiredFounderDecisions,
    dependencies,
    nextActions,
  };
}

/* --- opening an initiative: the Founder's single act ---------------------- */

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/** Derive a short institutional title from the Founder's own words. */
export function deriveTitle(input: string): string {
  // Split only at a sentence-ender preceded by a lowercase letter/digit, so
  // initials and abbreviations ("J.K.") never split the title mid-name.
  const first = input.trim().split(/(?<=[a-z0-9][.!?])\s/)[0] ?? input.trim();
  const t = first.replace(/\s+/g, ' ').trim();
  return t.length > 72 ? `${t.slice(0, 69)}…` : t;
}

/**
 * The Founder brings an initiative; the Executive Team does the rest. This one
 * call enlists the executives, gathers their contributions, and assembles the
 * single Brief — returning an initiative ready for the Founder's one decision.
 * Pure and deterministic.
 */
export function openInitiative(founderInput: string, now: Date = new Date()): Initiative {
  const at = now.toISOString();
  const title = deriveTitle(founderInput);
  const participants = selectParticipants(founderInput);
  const contributions = participants.map((id) => contributionFor(id, { title }));
  const brief = assembleBrief(founderInput, contributions);
  return {
    id: `init:${at}:${slug(title) || 'initiative'}`,
    founderInput, title, status: 'brief_ready',
    participants, contributions, brief,
    execution: [],
    createdAt: at, updatedAt: at,
  };
}

/* --- the Founder decision ------------------------------------------------- */

const STATUS_FOR: Record<FounderDecision, InitiativeStatus> = {
  approve: 'approved', revise: 'revising', pause: 'paused', decline: 'declined',
};

/**
 * Record the Founder's one decision. Approve automatically advances the
 * initiative into execution, routing work into the correct offices. Revise /
 * Pause / Decline hold it without routing. Pure; returns a new initiative.
 */
export function decide(initiative: Initiative, decision: FounderDecision, note: string | undefined, now: Date = new Date()): Initiative {
  const at = now.toISOString();
  const decided: Initiative = { ...initiative, decision: { decision, note, at }, status: STATUS_FOR[decision], updatedAt: at };
  return decision === 'approve' ? advanceToExecution(decided, now) : decided;
}

/* --- execution: routing work into the offices ----------------------------- */

/** Which office owns each recommended deliverable (deterministic routing). */
function officeForDeliverable(title: string, contributions: ExecutiveContribution[]): ExecutiveId {
  const owner = contributions.find((c) => c.deliverables.includes(title));
  return owner?.executive ?? 'creative_director';
}
function platformForDeliverable(title: string, platforms: string[]): string {
  const t = norm(title);
  if (t.includes('tiktok')) return 'TikTok';
  if (t.includes('linkedin')) return 'LinkedIn';
  if (t.includes('substack')) return 'Substack';
  if (t.includes('journal')) return 'House Journal';
  if (t.includes('podcast')) return 'Podcast';
  return platforms[0] ?? 'Internal';
}

/** Route the approved brief's deliverables into internal work items. No external
    publishing — the automationHook seam stays inert until a later sprint. */
export function advanceToExecution(initiative: Initiative, now: Date = new Date()): Initiative {
  const at = now.toISOString();
  const execution: WorkItem[] = initiative.brief.recommendedDeliverables.map((title, i) => ({
    id: `${initiative.id}:work:${i}`,
    office: officeForDeliverable(title, initiative.contributions),
    title,
    platform: platformForDeliverable(title, initiative.brief.recommendedPlatforms),
    status: 'routed',
    automationHook: 'none',
  }));
  return { ...initiative, status: 'executing', execution, updatedAt: at };
}

/* --- institutional history: the workflow decides, not the Founder's memory - */

/** Recommend how a completed initiative should enter institutional history.
    Deterministic from what the initiative produced; the Founder confirms. */
export function recommendHistory(initiative: Initiative): HistoryDisposition {
  const platforms = initiative.brief.recommendedPlatforms.map(norm);
  if (platforms.some((p) => p.includes('journal'))) return 'journal_entry';
  if (initiative.participants.includes('publishing')) return 'editorial_publication';
  if (initiative.participants.includes('business_office')) return 'historical_record';
  return 'internal';
}

/** Mark execution complete and attach the workflow's history recommendation. */
export function completeInitiative(initiative: Initiative, now: Date = new Date()): Initiative {
  return {
    ...initiative,
    status: 'completed',
    execution: initiative.execution.map((w) => ({ ...w, status: 'done' })),
    history: { recommended: recommendHistory(initiative), chosen: initiative.history?.chosen },
    updatedAt: now.toISOString(),
  };
}

/** The Founder (or the workflow) confirms how the initiative enters history, and
    it passes into the institutional record. */
export function archiveInitiative(initiative: Initiative, chosen: HistoryDisposition, now: Date = new Date()): Initiative {
  const recommended = initiative.history?.recommended ?? recommendHistory(initiative);
  return { ...initiative, status: 'archived', history: { recommended, chosen }, updatedAt: now.toISOString() };
}

/* --- persistence (own store; never a decision or institutional record store) */

function isInitiative(x: unknown): x is Initiative {
  const i = x as Initiative;
  return !!i && typeof i.id === 'string' && typeof i.founderInput === 'string'
    && Array.isArray(i.participants) && !!i.brief && typeof i.status === 'string';
}
export function loadInitiatives(): Initiative[] { return loadCollection(WORKFLOW_KEY, isInitiative); }
export function saveInitiatives(items: Initiative[]): void { saveCollection(WORKFLOW_KEY, items); }

/** Add or replace an initiative by id — idempotent. */
export function upsertInitiative(items: Initiative[], initiative: Initiative): Initiative[] {
  return [...items.filter((i) => i.id !== initiative.id), initiative];
}
