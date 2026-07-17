/* =============================================================================
   CHIEF OF STAFF — OPERATIONAL ENGINE (Sprint 12A: begin operating the Council).

   This is the first operational capability of the Chief of Staff: the machinery
   that lets recommendations be intaken, routed to the owning Chair, progressed
   through a decision lifecycle, and gathered into ONE integrated Founder Briefing
   — so the Founder decides rather than coordinates.

   It implements the already-approved Executive design; it does NOT redesign the
   role, the workflows, or the Executive Register. It reuses the Register as the
   single source of truth for Chairs and for storage, and holds no Chair data of
   its own.

   DISCIPLINE (matching the rest of Headquarters):
     • Pure data + pure logic. NO DOM, NO backend, NO AI, NO automation.
     • Nothing is fabricated: there are no seeded recommendations. The engine
       starts from an honest empty state — the institution is simply quiet until
       real work is recorded.
     • Persistence is client-side, namespaced under the Executive root, versioned,
       and fail-closed (a read never throws).
     • This module is the Chief of Staff ONLY. It contains no Creative, Production,
       or Growth operating logic — it merely routes work to those Chairs by id.
   ============================================================================= */

import {
  STORAGE_ROOT, loadCollection, saveCollection,
  CHAIRS, getChair,
  founderDecisionLabel,
  type ExecutiveChair, type FounderDecision,
} from './executive-register.ts';

/* -----------------------------------------------------------------------------
   PRIORITY — the institution's ordering of what matters now.
   --------------------------------------------------------------------------- */
export type Priority = 'now' | 'next' | 'later';

export interface PriorityKind { id: Priority; label: string; rank: number; }
export const PRIORITIES: PriorityKind[] = [
  { id: 'now',   label: 'Now',   rank: 0 },
  { id: 'next',  label: 'Next',  rank: 1 },
  { id: 'later', label: 'Later', rank: 2 },
];
const PRIORITY_BY_ID = new Map(PRIORITIES.map((p) => [p.id, p]));
export function priorityLabel(id: Priority): string { return PRIORITY_BY_ID.get(id)?.label ?? id; }
function priorityRank(id: Priority): number { return PRIORITY_BY_ID.get(id)?.rank ?? 99; }

/* -----------------------------------------------------------------------------
   THE RECOMMENDATION LIFECYCLE — how a prepared recommendation progresses.

   A recommendation is prepared by the Council (preparing), brought to the Founder
   (awaiting_founder), answered (decided), carried out (executing), and closed
   (complete). It may be parked (held) or retired (withdrawn). Status is the one
   truth of where an item stands; the Founder's answer is recorded alongside it.
   --------------------------------------------------------------------------- */
export type RecStatus =
  | 'preparing'        // being readied by the Council; not yet before the Founder
  | 'awaiting_founder' // prepared and waiting for the Founder's decision
  | 'decided'          // the Founder has decided; not yet in motion
  | 'executing'        // being carried out after the decision
  | 'complete'         // done
  | 'held'             // parked, deliberately, until the time is right
  | 'withdrawn';       // retired from the active record

export interface RecStatusKind {
  id: RecStatus;
  label: string;
  /** True while the item is live work (counts toward workload and priorities). */
  active: boolean;
}
export const REC_STATUSES: RecStatusKind[] = [
  { id: 'preparing',        label: 'Preparing',        active: true  },
  { id: 'awaiting_founder', label: 'Awaiting You',     active: true  },
  { id: 'decided',          label: 'Decided',          active: true  },
  { id: 'executing',        label: 'In Execution',     active: true  },
  { id: 'complete',         label: 'Complete',         active: false },
  { id: 'held',             label: 'Held',             active: false },
  { id: 'withdrawn',        label: 'Withdrawn',        active: false },
];
const REC_STATUS_BY_ID = new Map(REC_STATUSES.map((s) => [s.id, s]));
export function recStatusLabel(id: RecStatus): string { return REC_STATUS_BY_ID.get(id)?.label ?? id; }
export function isActiveStatus(id: RecStatus): boolean { return !!REC_STATUS_BY_ID.get(id)?.active; }

/** The permitted progressions — the lifecycle can never jump arbitrarily. */
const TRANSITIONS: Record<RecStatus, RecStatus[]> = {
  // 'executing' added to preparing/held so the Chief of Staff can route work
  // straight to a Chair (Route for Executive Work) without a Founder decision.
  preparing:        ['awaiting_founder', 'executing', 'held', 'withdrawn'],
  awaiting_founder: ['decided', 'preparing', 'held', 'withdrawn'],
  decided:          ['executing', 'complete', 'withdrawn'],
  executing:        ['complete', 'held', 'withdrawn'],
  complete:         [],
  held:             ['preparing', 'awaiting_founder', 'executing', 'withdrawn'],
  withdrawn:        [],
};
export function canTransition(from: RecStatus, to: RecStatus): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

/* -----------------------------------------------------------------------------
   SUBMISSION TYPE — the kind of work entering through the Executive Inbox. The
   Inbox is the one front door; every submission becomes a tracked record of one
   of these kinds. (This is a description of the work, never a judgement about it.)
   --------------------------------------------------------------------------- */
export type SubmissionType =
  | 'idea'
  | 'decision_request'
  | 'opportunity'
  | 'risk'
  | 'problem'
  | 'creative_concept'
  | 'production_request'
  | 'growth_initiative'
  | 'administrative_task';

export interface SubmissionTypeKind { id: SubmissionType; label: string; }
export const SUBMISSION_TYPES: SubmissionTypeKind[] = [
  { id: 'idea',                label: 'Idea' },
  { id: 'decision_request',    label: 'Decision Request' },
  { id: 'opportunity',         label: 'Opportunity' },
  { id: 'risk',                label: 'Risk' },
  { id: 'problem',             label: 'Problem' },
  { id: 'creative_concept',    label: 'Creative Concept' },
  { id: 'production_request',  label: 'Production Request' },
  { id: 'growth_initiative',   label: 'Growth Initiative' },
  { id: 'administrative_task', label: 'Administrative Task' },
];
const SUBMISSION_TYPE_BY_ID = new Map(SUBMISSION_TYPES.map((s) => [s.id, s]));
export function submissionTypeLabel(id: SubmissionType): string { return SUBMISSION_TYPE_BY_ID.get(id)?.label ?? id; }
const DEFAULT_TYPE: SubmissionType = 'idea';

/* -----------------------------------------------------------------------------
   FOUNDER VISIBILITY — whether an item is on the Founder's radar (surfaced in her
   briefing) or being carried internally by the office. New submissions are
   visible — she recorded it and can see it landed; the Chief of Staff may take it
   internal once the office owns it, taking it off her plate.
   --------------------------------------------------------------------------- */
export type FounderVisibility = 'visible' | 'internal';

export interface FounderVisibilityKind { id: FounderVisibility; label: string; }
export const FOUNDER_VISIBILITIES: FounderVisibilityKind[] = [
  { id: 'visible',  label: 'On Your Radar' },
  { id: 'internal', label: 'Held by the Office' },
];
const VISIBILITY_BY_ID = new Map(FOUNDER_VISIBILITIES.map((v) => [v.id, v]));
export function visibilityLabel(id: FounderVisibility): string { return VISIBILITY_BY_ID.get(id)?.label ?? id; }
const DEFAULT_VISIBILITY: FounderVisibility = 'visible';

/* -----------------------------------------------------------------------------
   THE RECOMMENDATION — the operational record the Chief of Staff tracks. Every
   Executive Inbox submission IS a recommendation record; the Inbox is simply the
   front door through which one is created.
   --------------------------------------------------------------------------- */
export interface Recommendation {
  id: string;
  /** The kind of work this is (from the Inbox). */
  type: SubmissionType;
  /** The matter, in a line. */
  title: string;
  /** What it is — an honest description. */
  summary: string;
  /** The Chair this work is routed to (by Register id), or null if unassigned. */
  ownerChairId: string | null;
  priority: Priority;
  status: RecStatus;
  /** Whether it is on the Founder's radar or held internally by the office. */
  visibility: FounderVisibility;
  /** The Founder's recorded decision (pending until she answers). */
  founderDecision: FounderDecision;
  /** The Chief of Staff's triage outcome for this item, or null until triaged. */
  triage: TriageOutcome | null;
  /** The prepared decision brief, or null until the office prepares it. */
  preparation: Preparation | null;
  /** The Founder's note left with her decision or revision request, if any. */
  founderNote?: string;
  /** ISO datetime the Founder decided (or requested revision), if any. */
  decidedAt?: string;
  /** Whether the item is blocked in execution (a lightweight follow-up flag). */
  blocked: boolean;
  /** ISO datetime created. */
  createdAt: string;
  /** ISO datetime last changed. */
  updatedAt: string;
}

/* -----------------------------------------------------------------------------
   TRIAGE — the Chief of Staff's decision about what happens to an incoming item.
   Triage is a routing intent recorded ALONGSIDE the lifecycle status (it is not a
   second status system); each triage action also applies a real, guarded status
   transition where one is warranted.
   --------------------------------------------------------------------------- */
export type TriageOutcome = 'prepare' | 'route' | 'hold' | 'close' | 'request_info';

export interface TriageOutcomeKind { id: TriageOutcome; label: string; }
export const TRIAGE_OUTCOMES: TriageOutcomeKind[] = [
  { id: 'prepare',      label: 'Prepare for Founder Decision' },
  { id: 'route',        label: 'Route for Executive Work' },
  { id: 'hold',         label: 'Hold for Later' },
  { id: 'close',        label: 'Close Without Action' },
  { id: 'request_info', label: 'Request More Information' },
];
const TRIAGE_BY_ID = new Map(TRIAGE_OUTCOMES.map((t) => [t.id, t]));
export function triageLabel(id: TriageOutcome): string { return TRIAGE_BY_ID.get(id)?.label ?? id; }

/** The prepared decision brief — the Chief of Staff's work, so the Founder never
    receives a raw problem. Only the recommended direction and the decision
    requested are required; the rest are optional, to keep preparation concise. */
export interface Preparation {
  /** Concise issue summary (the decision title is the record's own title). */
  issue: string;
  /** Relevant context behind the decision. */
  context: string;
  /** The Chief of Staff's recommended direction (required). */
  recommendation: string;
  /** Meaningful alternatives, when there are any. */
  alternatives: string[];
  /** Risks or trade-offs, named honestly. */
  tradeoffs: string[];
  /** The single, specific decision requested of the Founder (required). */
  decisionRequested: string;
  /** ISO datetime prepared. */
  preparedAt: string;
  /** Who prepared it (the office). */
  preparedBy: string;
}

/** Build a recommendation from a sketch. Requires a title and summary; defaults
    to preparing / next / unassigned / undecided. Nothing is invented. */
export function makeRecommendation(
  input: {
    id: string; title: string; summary: string;
    type?: SubmissionType; ownerChairId?: string | null; priority?: Priority; visibility?: FounderVisibility;
  },
  now: Date = new Date(),
): Recommendation | null {
  if (!input.id || !input.title.trim() || !input.summary.trim()) return null;
  const owner = input.ownerChairId ?? null;
  const ts = now.toISOString();
  return {
    id: input.id,
    type: input.type && SUBMISSION_TYPE_BY_ID.has(input.type) ? input.type : DEFAULT_TYPE,
    title: input.title.trim(),
    summary: input.summary.trim(),
    ownerChairId: owner && getChair(owner) ? owner : null,
    priority: input.priority ?? 'next',
    status: 'preparing',
    visibility: input.visibility && VISIBILITY_BY_ID.has(input.visibility) ? input.visibility : DEFAULT_VISIBILITY,
    founderDecision: 'pending',
    triage: null,
    preparation: null,
    blocked: false,
    createdAt: ts,
    updatedAt: ts,
  };
}

/** Intake a submission through the Executive Inbox — the institution's single
    front door. A submission is just a recommendation created with a type and a
    description; every submission becomes a tracked record the moment it is made.
    Requires a title and a description; nothing is invented. */
export function makeSubmission(
  input: {
    id: string; type: SubmissionType; title: string; description: string;
    priority?: Priority; ownerChairId?: string | null;
  },
  now: Date = new Date(),
): Recommendation | null {
  return makeRecommendation(
    { id: input.id, type: input.type, title: input.title, summary: input.description,
      priority: input.priority, ownerChairId: input.ownerChairId },
    now,
  );
}

/** Set a record's Founder-visibility (on the radar vs. held by the office). */
export function setVisibility(rec: Recommendation, visibility: FounderVisibility, now: Date = new Date()): Recommendation {
  if (!VISIBILITY_BY_ID.has(visibility)) return rec;
  return { ...rec, visibility, updatedAt: now.toISOString() };
}

/** Route (or re-route) a recommendation to a Chair — validated against the
    Register. Passing null unassigns; an unknown id leaves the owner unchanged. */
export function routeRecommendation(rec: Recommendation, chairId: string | null, now: Date = new Date()): Recommendation {
  if (chairId !== null && !getChair(chairId)) return rec;
  return { ...rec, ownerChairId: chairId, updatedAt: now.toISOString() };
}

/** Set a recommendation's priority. */
export function setPriority(rec: Recommendation, priority: Priority, now: Date = new Date()): Recommendation {
  if (!PRIORITY_BY_ID.has(priority)) return rec;
  return { ...rec, priority, updatedAt: now.toISOString() };
}

/** Advance a recommendation's status, only along a permitted transition. Returns
    the unchanged record if the transition is not allowed (the lifecycle holds). */
export function advance(rec: Recommendation, to: RecStatus, now: Date = new Date()): Recommendation {
  if (!canTransition(rec.status, to)) return rec;
  return { ...rec, status: to, updatedAt: now.toISOString() };
}

/** Record the Founder's decision on a recommendation, moving its status to match
    her answer: approved/approved-with-changes → decided; declined → withdrawn;
    deferred → held; pending leaves it awaiting. The record is never fabricated —
    only the Founder's real answer is stored. */
export function recordFounderDecision(
  rec: Recommendation, decision: FounderDecision, note: string = '', now: Date = new Date(),
): Recommendation {
  const ts = now.toISOString();
  let status: RecStatus = rec.status;
  if (decision === 'approved' || decision === 'approved_with_changes') status = 'decided';
  else if (decision === 'declined') status = 'withdrawn';
  else if (decision === 'deferred') status = 'held';
  else status = 'awaiting_founder';
  const trimmed = note.trim();
  return {
    ...rec,
    founderDecision: decision,
    status,
    founderNote: trimmed || undefined,
    decidedAt: ts,
    updatedAt: ts,
  };
}

/* -----------------------------------------------------------------------------
   TRIAGE + PREPARATION + FOUNDER LOOP (Sprint 12C) — the Chief of Staff turns raw
   incoming work into a decision-ready recommendation, the Founder answers once,
   and the office carries the result forward. All status changes go through the
   guarded lifecycle; no invalid jump is ever made.
   --------------------------------------------------------------------------- */

/** Apply a triage outcome. Records the routing intent AND the matching guarded
    status change: prepare keeps it in preparation; route (needs an owner) sends
    it to a Chair to execute; hold/request_info park it; close withdraws it. An
    illegal status move is refused, but the triage intent is still recorded. */
export function triage(
  rec: Recommendation, outcome: TriageOutcome,
  opts: { ownerChairId?: string | null; note?: string } = {}, now: Date = new Date(),
): Recommendation {
  if (!TRIAGE_BY_ID.has(outcome)) return rec;
  const ts = now.toISOString();
  let next: Recommendation = { ...rec, triage: outcome, updatedAt: ts };
  if (outcome === 'route') {
    // Route only moves work into execution once it has a real owner — nothing
    // enters execution unowned.
    const owner = opts.ownerChairId ?? rec.ownerChairId;
    if (owner && getChair(owner)) {
      next = { ...next, ownerChairId: owner };
      if (canTransition(next.status, 'executing')) next = { ...next, status: 'executing' };
    }
  } else if (outcome === 'prepare') {
    // Stays in preparation (or returns there from held), ready for the brief.
    if (rec.status === 'held' && canTransition('held', 'preparing')) next = { ...next, status: 'preparing' };
  } else if (outcome === 'hold' || outcome === 'request_info') {
    if (canTransition(next.status, 'held')) next = { ...next, status: 'held' };
  } else if (outcome === 'close') {
    if (canTransition(next.status, 'withdrawn')) next = { ...next, status: 'withdrawn' };
  }
  return next;
}

/** Attach a prepared decision brief. Requires a recommended direction and a
    decision requested; the rest is optional to keep preparation concise. Returns
    null if the required fields are empty (a clear failure the caller surfaces). */
export function prepareRecommendation(
  rec: Recommendation,
  input: {
    issue?: string; context?: string; recommendation: string;
    alternatives?: string[]; tradeoffs?: string[]; decisionRequested: string; preparedBy?: string;
  },
  now: Date = new Date(),
): Recommendation | null {
  if (!input.recommendation.trim() || !input.decisionRequested.trim()) return null;
  const ts = now.toISOString();
  const clean = (xs?: string[]): string[] => (xs ?? []).map((s) => s.trim()).filter(Boolean);
  const preparation: Preparation = {
    issue: (input.issue ?? '').trim(),
    context: (input.context ?? '').trim(),
    recommendation: input.recommendation.trim(),
    alternatives: clean(input.alternatives),
    tradeoffs: clean(input.tradeoffs),
    decisionRequested: input.decisionRequested.trim(),
    preparedAt: ts,
    preparedBy: (input.preparedBy || 'Chief of Staff').trim(),
  };
  return { ...rec, preparation, triage: 'prepare', updatedAt: ts };
}

/** Present a prepared item to the Founder — moves it to awaiting_founder. Only
    succeeds when a brief exists and the transition is legal; otherwise unchanged. */
export function presentToFounder(rec: Recommendation, now: Date = new Date()): Recommendation {
  if (!rec.preparation) return rec;
  if (!canTransition(rec.status, 'awaiting_founder')) return rec;
  return { ...rec, status: 'awaiting_founder', updatedAt: now.toISOString() };
}

/** The Founder asks for a revision — returns the item to preparation with her
    note preserved, so the office can revise. A guarded transition. */
export function requestRevision(rec: Recommendation, note: string = '', now: Date = new Date()): Recommendation {
  if (!canTransition(rec.status, 'preparing')) return rec;
  const ts = now.toISOString();
  const trimmed = note.trim();
  return {
    ...rec,
    status: 'preparing',
    founderNote: trimmed || rec.founderNote,
    decidedAt: ts,
    updatedAt: ts,
  };
}

/** Set (or clear) the execution "blocked" follow-up flag. */
export function setBlocked(rec: Recommendation, blocked: boolean, now: Date = new Date()): Recommendation {
  return { ...rec, blocked, updatedAt: now.toISOString() };
}

/* -----------------------------------------------------------------------------
   DERIVED VIEWS — the honest, computed picture of the operational record.
   --------------------------------------------------------------------------- */

/** Active recommendations, ordered by priority then most-recently-updated. */
export function activeRecommendations(recs: Recommendation[]): Recommendation[] {
  return recs
    .filter((r) => isActiveStatus(r.status))
    .sort((a, b) => (priorityRank(a.priority) - priorityRank(b.priority)) || b.updatedAt.localeCompare(a.updatedAt));
}

/** Recommendations prepared and waiting for the Founder's decision. */
export function awaitingFounder(recs: Recommendation[]): Recommendation[] {
  return activeRecommendations(recs).filter((r) => r.status === 'awaiting_founder');
}

/** Work in execution — the Chief of Staff's follow-up list (the Founder need not
    track it; this is what the office is carrying to completion). */
export function inExecution(recs: Recommendation[]): Recommendation[] {
  return activeRecommendations(recs).filter((r) => r.status === 'executing');
}

/** Per-Chair workload — how much live work each Chair is carrying. Derived over
    the Register's Chairs, so it is honest and needs no fixed count. */
export interface ChairWorkload {
  chairId: string;
  title: string;
  ordinal: number;
  activeCount: number;
}
export function chairWorkload(
  recs: Recommendation[], chairs: ExecutiveChair[] = CHAIRS,
): ChairWorkload[] {
  const active = activeRecommendations(recs);
  return [...chairs]
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((c) => ({
      chairId: c.id,
      title: c.title,
      ordinal: c.ordinal,
      activeCount: active.filter((r) => r.ownerChairId === c.id).length,
    }));
}

/** Work that has entered but not yet been routed to a Chair — nothing should sit
    unowned; this surfaces anything that has. */
export function unassigned(recs: Recommendation[]): Recommendation[] {
  return activeRecommendations(recs).filter((r) => r.ownerChairId === null);
}

/** The label for a recommendation's owning Chair (or an honest "Unassigned"). */
export function ownerLabel(rec: Recommendation): string {
  return rec.ownerChairId ? (getChair(rec.ownerChairId)?.title ?? rec.ownerChairId) : 'Unassigned';
}

/** The label for a recommendation's Founder decision. */
export function decisionLabel(rec: Recommendation): string {
  return founderDecisionLabel(rec.founderDecision);
}

/** The label for a recommendation's submission type. */
export function typeLabel(rec: Recommendation): string {
  return submissionTypeLabel(rec.type);
}

/* -----------------------------------------------------------------------------
   THE EXECUTIVE INBOX — the Chief of Staff's working queue.

   The full ledger is the institution's long-term memory (newest first); the
   working queue is the active portion the office is coordinating. These reuse the
   same records — the Inbox does not hold a second store.
   --------------------------------------------------------------------------- */

/** Every submission ever made, newest first — the institution's memory. */
export function inboxLedger(recs: Recommendation[]): Recommendation[] {
  return [...recs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The Chief of Staff's active working queue, in priority order. */
export function chiefOfStaffQueue(recs: Recommendation[]): Recommendation[] {
  return activeRecommendations(recs);
}

/** Active work still being readied by the office — what requires preparation. */
export function needsPreparation(recs: Recommendation[]): Recommendation[] {
  return activeRecommendations(recs).filter((r) => r.status === 'preparing');
}

/* --- Sprint 12C: the full loop's derived views ---------------------------- */

/** Untriaged incoming work — the Chief of Staff has not yet decided its path. */
export function needsTriage(recs: Recommendation[]): Recommendation[] {
  return activeRecommendations(recs).filter((r) => r.status === 'preparing' && r.triage === null);
}

/** Triaged to a Founder decision and being prepared, not yet presented. */
export function inPreparation(recs: Recommendation[]): Recommendation[] {
  return activeRecommendations(recs).filter((r) => r.status === 'preparing' && r.triage === 'prepare');
}

/** Prepared decisions ready for the Founder — the ONLY items she should see. */
export function decisionsForFounder(recs: Recommendation[]): Recommendation[] {
  return awaitingFounder(recs).filter((r) => r.preparation !== null);
}

/** Approved work being carried out — the execution-follow-up view (decided or in
    execution). The Founder never chases these; the Chief of Staff tracks them. */
export function executionFollowUp(recs: Recommendation[]): Recommendation[] {
  return activeRecommendations(recs).filter((r) => r.status === 'decided' || r.status === 'executing');
}

/** Active work flagged blocked in execution. */
export function blockedItems(recs: Recommendation[]): Recommendation[] {
  return activeRecommendations(recs).filter((r) => r.blocked);
}

/** Items deliberately held (parked or awaiting more information). */
export function heldItems(recs: Recommendation[]): Recommendation[] {
  return recs.filter((r) => r.status === 'held');
}

/** Completed work — kept for the record. */
export function completedItems(recs: Recommendation[]): Recommendation[] {
  return recs.filter((r) => r.status === 'complete');
}

/** The label for a recommendation's triage outcome (or "Untriaged"). */
export function triageStateLabel(rec: Recommendation): string {
  return rec.triage ? triageLabel(rec.triage) : 'Untriaged';
}

/* -----------------------------------------------------------------------------
   THE INTEGRATED OPERATIONAL BRIEFING — one honest picture for the Founder.

   This is the workload-reducer: rather than many disconnected updates, the Chief
   of Staff presents a single derived summary — what awaits her, the institution's
   priorities, what is in motion, and how the Chairs are loaded. When nothing is
   recorded, it says so plainly (quiet), never inventing activity.
   --------------------------------------------------------------------------- */
export interface OperationalBriefing {
  /** True when there is no live work at all — the honest quiet state. */
  quiet: boolean;
  /** Prepared and waiting for the Founder's decision. */
  waiting: Recommendation[];
  waitingCount: number;
  /** Active work in priority order. */
  priorities: Recommendation[];
  /** Work in execution (the office's follow-up, not the Founder's). */
  inExecution: Recommendation[];
  /** Work not yet routed to a Chair (should be empty). */
  unassigned: Recommendation[];
  /** Per-Chair live workload. */
  workload: ChairWorkload[];
  /* --- Sprint 12C: loop counts (summary only; the surfaces hold the detail). */
  /** Untriaged incoming work the Chief of Staff must review. */
  needsTriageCount: number;
  /** Items being prepared into a decision brief. */
  inPreparationCount: number;
  /** Prepared decisions genuinely ready for the Founder. */
  readyForFounderCount: number;
  /** Approved work in follow-up (decided or executing). */
  inFollowUpCount: number;
  /** Work flagged blocked. */
  blockedCount: number;
  /** Work held for later or pending information. */
  heldCount: number;
}

export function operationalBriefing(
  recs: Recommendation[], chairs: ExecutiveChair[] = CHAIRS,
): OperationalBriefing {
  const active = activeRecommendations(recs);
  return {
    quiet: active.length === 0 && heldItems(recs).length === 0,
    waiting: decisionsForFounder(recs),
    waitingCount: decisionsForFounder(recs).length,
    priorities: active,
    inExecution: inExecution(recs),
    unassigned: unassigned(recs),
    workload: chairWorkload(recs, chairs),
    needsTriageCount: needsTriage(recs).length,
    inPreparationCount: inPreparation(recs).length,
    readyForFounderCount: decisionsForFounder(recs).length,
    inFollowUpCount: executionFollowUp(recs).length,
    blockedCount: blockedItems(recs).length,
    heldCount: heldItems(recs).length,
  };
}

/* -----------------------------------------------------------------------------
   PERSISTENCE — client-side, namespaced under the Executive root, fail-closed.
   Reuses the Register's generic storage helpers; adds no Register machinery.
   --------------------------------------------------------------------------- */
export const RECOMMENDATIONS_KEY = `${STORAGE_ROOT}.cos-ops.recommendations.v1`;

export function isRecommendation(x: unknown): x is Recommendation {
  const o = x as Recommendation;
  return !!o
    && typeof o.id === 'string' && typeof o.title === 'string' && typeof o.summary === 'string'
    && (o.ownerChairId === null || typeof o.ownerChairId === 'string')
    && typeof o.priority === 'string' && REC_STATUS_BY_ID.has(o.status)
    && typeof o.founderDecision === 'string'
    && typeof o.createdAt === 'string' && typeof o.updatedAt === 'string';
}

/** Fill fields that a stored record may predate (Inbox type/visibility from 12B;
    triage/preparation/blocked from 12C) with honest defaults, and drop unknown
    enum values — so Sprint 12A and 12B records stay valid without a migration and
    without silent data loss. Well-formed records pass through unchanged. */
export function normalizeRecommendation(rec: Recommendation): Recommendation {
  const type = SUBMISSION_TYPE_BY_ID.has(rec.type) ? rec.type : DEFAULT_TYPE;
  const visibility = VISIBILITY_BY_ID.has(rec.visibility) ? rec.visibility : DEFAULT_VISIBILITY;
  const triage = rec.triage && TRIAGE_BY_ID.has(rec.triage) ? rec.triage : null;
  const preparation = rec.preparation ?? null;
  const blocked = rec.blocked === true;
  const unchanged = rec.type === type && rec.visibility === visibility
    && rec.triage === triage && rec.preparation === preparation && rec.blocked === blocked;
  return unchanged ? rec : { ...rec, type, visibility, triage, preparation, blocked };
}

export function loadRecommendations(): Recommendation[] {
  return loadCollection(RECOMMENDATIONS_KEY, isRecommendation).map(normalizeRecommendation);
}
export function saveRecommendations(recs: Recommendation[]): void {
  saveCollection(RECOMMENDATIONS_KEY, recs);
}

/** Insert or replace a recommendation by id (one record per id) — the durable
    write the office uses as work is intaken and progressed. */
export function upsertRecommendation(existing: Recommendation[], rec: Recommendation): Recommendation[] {
  return [...existing.filter((r) => r.id !== rec.id), rec];
}
