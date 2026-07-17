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
  CHAIRS, getChair, CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION, CHAIR_DIRECTOR_OF_GROWTH,
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
  // 'preparing' added so a receiving Chair can Return work to the Chief of Staff.
  executing:        ['preparing', 'complete', 'held', 'withdrawn'],
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
  /** The receiving Chair's own progress on this item, or null until they act.
      An annotation beside the lifecycle (like triage), never a second engine. */
  creativeStage: CreativeStage | null;
  /** A note the receiving Chair sends back through the Chief of Staff. */
  creativeNote?: string;
  /** The Head of Production's progression on this item, or null until accepted. */
  productionStage: ProductionStage | null;
  /** A note Production sends back through the Chief of Staff. */
  productionNote?: string;
  /** The Director of Growth's progression on this item, or null until accepted. */
  growthStage: GrowthStage | null;
  /** A note Growth sends back through the Chief of Staff. */
  growthNote?: string;
  /** Append-only institutional trail of office-brokered handoffs on this record
      (Sprint 12G). Provenance — never a second store, never removed. */
  collaborationTrail: Handoff[];
  /** Bounded question→answer consultations on this record (Sprint 12G). Ownership
      never changes; not a messaging thread. */
  consultations: Consultation[];
  /** When this record was promoted from a Growth Intelligence opportunity, the id
      of that originating intelligence record (Sprint 13A) — the durable link back
      to its research provenance. Absent for work that did not begin as research. */
  originIntelId?: string;
  /** When promoted from a Content Opportunity brief (Sprint 13B), the id of that
      brief — the middle link in intelligence → opportunity → recommendation. */
  originOpportunityId?: string;
  /** When promoted from a Creative Assignment Pack (Sprint 13C), the id of that
      assignment — completing intelligence → opportunity → assignment → recommendation. */
  originAssignmentId?: string;
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
    originIntelId?: string; originOpportunityId?: string; originAssignmentId?: string;
  },
  now: Date = new Date(),
): Recommendation | null {
  if (!input.id || !input.title.trim() || !input.summary.trim()) return null;
  const owner = input.ownerChairId ?? null;
  const ts = now.toISOString();
  return {
    id: input.id,
    ...(input.originIntelId ? { originIntelId: input.originIntelId } : {}),
    ...(input.originOpportunityId ? { originOpportunityId: input.originOpportunityId } : {}),
    ...(input.originAssignmentId ? { originAssignmentId: input.originAssignmentId } : {}),
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
    creativeStage: null,
    productionStage: null,
    growthStage: null,
    collaborationTrail: [],
    consultations: [],
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
    originIntelId?: string; originOpportunityId?: string; originAssignmentId?: string;
  },
  now: Date = new Date(),
): Recommendation | null {
  return makeRecommendation(
    { id: input.id, type: input.type, title: input.title, summary: input.description,
      priority: input.priority, ownerChairId: input.ownerChairId,
      originIntelId: input.originIntelId, originOpportunityId: input.originOpportunityId,
      originAssignmentId: input.originAssignmentId },
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
   RECEIVING CHAIR — CREATIVE DIRECTOR (Sprint 12D). The Creative Director works
   only on items the Chief of Staff has routed to Chair #002. `creativeStage` is
   the Chair's own progress annotation beside the shared lifecycle — NOT a second
   engine; every action updates the same recommendation record. The Chair never
   speaks to the Founder directly: a clarification returns to the Chief of Staff.
   --------------------------------------------------------------------------- */
export type CreativeStage = 'accepted' | 'in_progress' | 'clarification' | 'complete';

export interface CreativeStageKind { id: CreativeStage; label: string; }
export const CREATIVE_STAGES: CreativeStageKind[] = [
  { id: 'accepted',      label: 'Accepted' },
  { id: 'in_progress',   label: 'In Progress' },
  { id: 'clarification', label: 'Clarification Requested' },
  { id: 'complete',      label: 'Creative Review Complete' },
];
const CREATIVE_STAGE_BY_ID = new Map(CREATIVE_STAGES.map((s) => [s.id, s]));

/** The label for a creative stage; null (routed, not yet accepted) reads as
    "Awaiting Creative". */
export function creativeStageLabel(stage: CreativeStage | null): string {
  return stage ? (CREATIVE_STAGE_BY_ID.get(stage)?.label ?? stage) : 'Awaiting Creative';
}

/** Accept a routed item — the Creative Director takes it up. Keeps it in
    execution (advancing there if it arrived approved-but-not-yet-in-motion). */
export function creativeAccept(rec: Recommendation, now: Date = new Date()): Recommendation {
  const status = canTransition(rec.status, 'executing') ? 'executing' : rec.status;
  return { ...rec, creativeStage: 'accepted', status, updatedAt: now.toISOString() };
}

/** Mark accepted work as actively in progress. */
export function creativeStart(rec: Recommendation, now: Date = new Date()): Recommendation {
  const status = canTransition(rec.status, 'executing') ? 'executing' : rec.status;
  return { ...rec, creativeStage: 'in_progress', status, updatedAt: now.toISOString() };
}

/** Mark the creative review complete — the Chair's part is done. */
export function creativeComplete(rec: Recommendation, now: Date = new Date()): Recommendation {
  const status = canTransition(rec.status, 'complete') ? 'complete' : rec.status;
  return { ...rec, creativeStage: 'complete', status, updatedAt: now.toISOString() };
}

/** Return the work to the Chief of Staff — the Chair sets it down; ownership and
    the creative annotation are cleared, and it re-enters the office untriaged. */
export function creativeReturn(rec: Recommendation, now: Date = new Date()): Recommendation {
  const status = canTransition(rec.status, 'preparing') ? 'preparing' : rec.status;
  return {
    ...rec, ownerChairId: null, creativeStage: null, creativeNote: undefined,
    triage: null, status, updatedAt: now.toISOString(),
  };
}

/** Request Founder clarification — routed BACK through the Chief of Staff, never
    to the Founder directly. The item is paused (held) with the Chair's note for
    the office to carry. */
export function creativeRequestClarification(
  rec: Recommendation, note: string = '', now: Date = new Date(),
): Recommendation {
  const status = canTransition(rec.status, 'held') ? 'held' : rec.status;
  const trimmed = note.trim();
  return { ...rec, creativeStage: 'clarification', creativeNote: trimmed || undefined, status, updatedAt: now.toISOString() };
}

/** The Creative Director's queue — ONLY active work routed to Chair #002, in
    priority order. Work owned by other Chairs is never exposed here. */
export function creativeQueue(recs: Recommendation[]): Recommendation[] {
  return activeRecommendations(recs).filter((r) => r.ownerChairId === CHAIR_CREATIVE_DIRECTOR);
}

/** What the Chief of Staff needs to know about Creative at a glance — derived,
    honest counts. `completed` includes finished (inactive) creative work. */
export interface CreativeStanding {
  awaiting: number;      // routed, not yet accepted
  accepted: number;
  inProgress: number;
  clarification: number; // paused, needs the office to carry a clarification
  completed: number;
}
export function creativeStanding(recs: Recommendation[]): CreativeStanding {
  const owned = recs.filter((r) => r.ownerChairId === CHAIR_CREATIVE_DIRECTOR);
  const active = owned.filter((r) => isActiveStatus(r.status));
  return {
    awaiting: active.filter((r) => r.creativeStage === null).length,
    accepted: active.filter((r) => r.creativeStage === 'accepted').length,
    inProgress: active.filter((r) => r.creativeStage === 'in_progress').length,
    clarification: owned.filter((r) => r.creativeStage === 'clarification').length,
    completed: owned.filter((r) => r.creativeStage === 'complete').length,
  };
}

/* -----------------------------------------------------------------------------
   RECEIVING CHAIR — HEAD OF PRODUCTION (Sprint 12E). The Head of Production works
   only on items the Chief of Staff has routed to Chair #003. `productionStage` is
   the Chair's own progression annotation beside the shared lifecycle — NOT a
   second engine; every action updates the same recommendation record. The Chair
   never speaks to the Founder directly: a clarification returns to the office.

   Eligibility: Production may only take up work that is genuinely ready — approved
   (decided) or validly routed for execution (executing). Held, withdrawn,
   awaiting-Founder, or still-in-preparation work must never silently enter
   Production. Blocked reuses the shared `blocked` flag; clarification pauses the
   item (held) while PRESERVING its stage, which is cleaner than the creative
   pattern and safe because only Production items carry a productionStage/Note.
   --------------------------------------------------------------------------- */
export type ProductionStage =
  | 'accepted' | 'planning' | 'ready' | 'in_production' | 'delivery_ready' | 'complete';

export interface ProductionStageKind { id: ProductionStage; label: string; }
export const PRODUCTION_STAGES: ProductionStageKind[] = [
  { id: 'accepted',       label: 'Accepted' },
  { id: 'planning',       label: 'Planning' },
  { id: 'ready',          label: 'Ready for Production' },
  { id: 'in_production',  label: 'In Production' },
  { id: 'delivery_ready', label: 'Delivery Ready' },
  { id: 'complete',       label: 'Production Complete' },
];
const PRODUCTION_STAGE_BY_ID = new Map(PRODUCTION_STAGES.map((s) => [s.id, s]));
const PRODUCTION_STAGE_ORDER: ProductionStage[] = PRODUCTION_STAGES.map((s) => s.id);
function productionStageIndex(s: ProductionStage | null): number {
  return s ? PRODUCTION_STAGE_ORDER.indexOf(s) : -1;
}

/** The label for a production stage; null (routed, not accepted) → "Awaiting Production". */
export function productionStageLabel(stage: ProductionStage | null): string {
  return stage ? (PRODUCTION_STAGE_BY_ID.get(stage)?.label ?? stage) : 'Awaiting Production';
}

/** Whether Production may take up this item: approved (decided) or validly routed
    for execution (executing). Never held / withdrawn / awaiting-Founder / preparing. */
export function isProductionEligible(rec: Recommendation): boolean {
  return rec.status === 'decided' || rec.status === 'executing';
}

/** A production stage move is valid only forward along the sequence (no regress,
    from null only to accepted). */
export function canAdvanceProductionStage(from: ProductionStage | null, to: ProductionStage): boolean {
  if (!PRODUCTION_STAGE_BY_ID.has(to)) return false;
  return productionStageIndex(to) > productionStageIndex(from);
}

/** Advance the production stage, forward-only. Keeps the item in execution
    (advancing there when eligible) until it reaches complete. Returns unchanged
    on an invalid (backward/unknown) move — the progression holds. */
export function advanceProduction(rec: Recommendation, to: ProductionStage, now: Date = new Date()): Recommendation {
  if (!canAdvanceProductionStage(rec.productionStage, to)) return rec;
  const status = to === 'complete'
    ? (canTransition(rec.status, 'complete') ? 'complete' : rec.status)
    : (canTransition(rec.status, 'executing') ? 'executing' : rec.status);
  return { ...rec, productionStage: to, status, updatedAt: now.toISOString() };
}

/** Accept a routed item for Production — only when it is genuinely eligible. */
export function productionAccept(rec: Recommendation, now: Date = new Date()): Recommendation {
  if (!isProductionEligible(rec)) return rec;
  return advanceProduction(rec, 'accepted', now);
}
export const productionPlanning = (rec: Recommendation, now?: Date): Recommendation => advanceProduction(rec, 'planning', now);
export const productionReady = (rec: Recommendation, now?: Date): Recommendation => advanceProduction(rec, 'ready', now);
export const productionInProduction = (rec: Recommendation, now?: Date): Recommendation => advanceProduction(rec, 'in_production', now);
export const productionDeliveryReady = (rec: Recommendation, now?: Date): Recommendation => advanceProduction(rec, 'delivery_ready', now);
export const productionComplete = (rec: Recommendation, now?: Date): Recommendation => advanceProduction(rec, 'complete', now);

/** Return the work to the Chief of Staff — ownership and production annotations
    cleared; it re-enters the office untriaged. */
export function productionReturn(rec: Recommendation, now: Date = new Date()): Recommendation {
  const status = canTransition(rec.status, 'preparing') ? 'preparing' : rec.status;
  return {
    ...rec, ownerChairId: null, productionStage: null, productionNote: undefined,
    triage: null, status, updatedAt: now.toISOString(),
  };
}

/** Request clarification — routed BACK through the Chief of Staff, never to the
    Founder. The item pauses (held) with its stage preserved and the note kept. */
export function productionRequestClarification(rec: Recommendation, note: string = '', now: Date = new Date()): Recommendation {
  const status = canTransition(rec.status, 'held') ? 'held' : rec.status;
  const trimmed = note.trim();
  return { ...rec, productionNote: trimmed || undefined, status, updatedAt: now.toISOString() };
}

/** The Head of Production's queue — work routed to Chair #003 that is active, or
    paused for clarification. Work owned by other Chairs is never exposed here. */
export function productionQueue(recs: Recommendation[]): Recommendation[] {
  return recs
    .filter((r) => r.ownerChairId === CHAIR_HEAD_OF_PRODUCTION
      && (isActiveStatus(r.status) || (r.status === 'held' && !!r.productionNote)))
    .sort((a, b) => (priorityRank(a.priority) - priorityRank(b.priority)) || b.updatedAt.localeCompare(a.updatedAt));
}

/** What the Chief of Staff needs to know about Production at a glance. */
export interface ProductionStanding {
  awaiting: number;      // routed, not yet accepted
  accepted: number;
  planning: number;
  ready: number;
  inProduction: number;
  blocked: number;
  clarification: number; // paused, needs the office to carry a clarification
  deliveryReady: number;
  complete: number;
}
export function productionStanding(recs: Recommendation[]): ProductionStanding {
  const owned = recs.filter((r) => r.ownerChairId === CHAIR_HEAD_OF_PRODUCTION);
  const active = owned.filter((r) => isActiveStatus(r.status));
  return {
    awaiting: active.filter((r) => r.productionStage === null).length,
    accepted: active.filter((r) => r.productionStage === 'accepted').length,
    planning: active.filter((r) => r.productionStage === 'planning').length,
    ready: active.filter((r) => r.productionStage === 'ready').length,
    inProduction: active.filter((r) => r.productionStage === 'in_production').length,
    blocked: active.filter((r) => r.blocked).length,
    clarification: owned.filter((r) => r.status === 'held' && !!r.productionNote).length,
    deliveryReady: active.filter((r) => r.productionStage === 'delivery_ready').length,
    complete: owned.filter((r) => r.productionStage === 'complete').length,
  };
}

/* -----------------------------------------------------------------------------
   RECEIVING CHAIR — DIRECTOR OF GROWTH (Sprint 12F). The Director of Growth works
   only on items the Chief of Staff has routed to Chair #004. `growthStage` is the
   Chair's own progression annotation beside the shared lifecycle — NOT a second
   engine; every action updates the same recommendation record. The Chair never
   speaks to the Founder directly: a clarification returns to the office.

   Eligibility mirrors Production: Growth may only take up genuinely ready work —
   approved (decided) or validly routed for execution (executing). Held, withdrawn,
   awaiting-Founder, or still-in-preparation work must never silently enter Growth.
   Blocked reuses the shared `blocked` flag; clarification pauses the item (held)
   while PRESERVING its stage, safe because only Growth items carry a growthStage.
   --------------------------------------------------------------------------- */
export type GrowthStage =
  | 'accepted' | 'strategy' | 'research' | 'campaign_planning'
  | 'ready_to_launch' | 'active' | 'measuring' | 'complete';

export interface GrowthStageKind { id: GrowthStage; label: string; }
export const GROWTH_STAGES: GrowthStageKind[] = [
  { id: 'accepted',          label: 'Accepted' },
  { id: 'strategy',          label: 'Strategy' },
  { id: 'research',          label: 'Research' },
  { id: 'campaign_planning', label: 'Campaign Planning' },
  { id: 'ready_to_launch',   label: 'Ready to Launch' },
  { id: 'active',            label: 'Active' },
  { id: 'measuring',         label: 'Measuring Results' },
  { id: 'complete',          label: 'Growth Complete' },
];
const GROWTH_STAGE_BY_ID = new Map(GROWTH_STAGES.map((s) => [s.id, s]));
const GROWTH_STAGE_ORDER: GrowthStage[] = GROWTH_STAGES.map((s) => s.id);
function growthStageIndex(s: GrowthStage | null): number {
  return s ? GROWTH_STAGE_ORDER.indexOf(s) : -1;
}

/** The label for a growth stage; null (routed, not accepted) → "Awaiting Growth". */
export function growthStageLabel(stage: GrowthStage | null): string {
  return stage ? (GROWTH_STAGE_BY_ID.get(stage)?.label ?? stage) : 'Awaiting Growth';
}

/** Whether Growth may take up this item: approved (decided) or validly routed for
    execution (executing). Never held / withdrawn / awaiting-Founder / preparing. */
export function isGrowthEligible(rec: Recommendation): boolean {
  return rec.status === 'decided' || rec.status === 'executing';
}

/** A growth stage move is valid only forward along the sequence (no regress,
    from null only to accepted). */
export function canAdvanceGrowthStage(from: GrowthStage | null, to: GrowthStage): boolean {
  if (!GROWTH_STAGE_BY_ID.has(to)) return false;
  return growthStageIndex(to) > growthStageIndex(from);
}

/** Advance the growth stage, forward-only. Keeps the item in execution (advancing
    there when eligible) until it reaches complete. Returns unchanged on an invalid
    (backward/unknown) move — the progression holds. */
export function advanceGrowth(rec: Recommendation, to: GrowthStage, now: Date = new Date()): Recommendation {
  if (!canAdvanceGrowthStage(rec.growthStage, to)) return rec;
  const status = to === 'complete'
    ? (canTransition(rec.status, 'complete') ? 'complete' : rec.status)
    : (canTransition(rec.status, 'executing') ? 'executing' : rec.status);
  return { ...rec, growthStage: to, status, updatedAt: now.toISOString() };
}

/** Accept a routed item for Growth — only when it is genuinely eligible. */
export function growthAccept(rec: Recommendation, now: Date = new Date()): Recommendation {
  if (!isGrowthEligible(rec)) return rec;
  return advanceGrowth(rec, 'accepted', now);
}
export const growthStrategy = (rec: Recommendation, now?: Date): Recommendation => advanceGrowth(rec, 'strategy', now);
export const growthResearch = (rec: Recommendation, now?: Date): Recommendation => advanceGrowth(rec, 'research', now);
export const growthCampaignPlanning = (rec: Recommendation, now?: Date): Recommendation => advanceGrowth(rec, 'campaign_planning', now);
export const growthReadyToLaunch = (rec: Recommendation, now?: Date): Recommendation => advanceGrowth(rec, 'ready_to_launch', now);
export const growthActive = (rec: Recommendation, now?: Date): Recommendation => advanceGrowth(rec, 'active', now);
export const growthMeasuring = (rec: Recommendation, now?: Date): Recommendation => advanceGrowth(rec, 'measuring', now);
export const growthComplete = (rec: Recommendation, now?: Date): Recommendation => advanceGrowth(rec, 'complete', now);

/** Return the work to the Chief of Staff — ownership and growth annotations
    cleared; it re-enters the office untriaged. */
export function growthReturn(rec: Recommendation, now: Date = new Date()): Recommendation {
  const status = canTransition(rec.status, 'preparing') ? 'preparing' : rec.status;
  return {
    ...rec, ownerChairId: null, growthStage: null, growthNote: undefined,
    triage: null, status, updatedAt: now.toISOString(),
  };
}

/** Request clarification — routed BACK through the Chief of Staff, never to the
    Founder. The item pauses (held) with its stage preserved and the note kept. */
export function growthRequestClarification(rec: Recommendation, note: string = '', now: Date = new Date()): Recommendation {
  const status = canTransition(rec.status, 'held') ? 'held' : rec.status;
  const trimmed = note.trim();
  return { ...rec, growthNote: trimmed || undefined, status, updatedAt: now.toISOString() };
}

/** The Director of Growth's queue — work routed to Chair #004 that is active, or
    paused for clarification. Work owned by other Chairs is never exposed here. */
export function growthQueue(recs: Recommendation[]): Recommendation[] {
  return recs
    .filter((r) => r.ownerChairId === CHAIR_DIRECTOR_OF_GROWTH
      && (isActiveStatus(r.status) || (r.status === 'held' && !!r.growthNote)))
    .sort((a, b) => (priorityRank(a.priority) - priorityRank(b.priority)) || b.updatedAt.localeCompare(a.updatedAt));
}

/** What the Chief of Staff needs to know about Growth at a glance. */
export interface GrowthStanding {
  awaiting: number;      // routed, not yet accepted
  accepted: number;
  strategy: number;
  research: number;
  campaignPlanning: number;
  readyToLaunch: number;
  active: number;
  measuring: number;
  blocked: number;
  clarification: number; // paused, needs the office to carry a clarification
  complete: number;
}
export function growthStanding(recs: Recommendation[]): GrowthStanding {
  const owned = recs.filter((r) => r.ownerChairId === CHAIR_DIRECTOR_OF_GROWTH);
  const active = owned.filter((r) => isActiveStatus(r.status));
  return {
    awaiting: active.filter((r) => r.growthStage === null).length,
    accepted: active.filter((r) => r.growthStage === 'accepted').length,
    strategy: active.filter((r) => r.growthStage === 'strategy').length,
    research: active.filter((r) => r.growthStage === 'research').length,
    campaignPlanning: active.filter((r) => r.growthStage === 'campaign_planning').length,
    readyToLaunch: active.filter((r) => r.growthStage === 'ready_to_launch').length,
    active: active.filter((r) => r.growthStage === 'active').length,
    measuring: active.filter((r) => r.growthStage === 'measuring').length,
    blocked: active.filter((r) => r.blocked).length,
    clarification: owned.filter((r) => r.status === 'held' && !!r.growthNote).length,
    complete: owned.filter((r) => r.growthStage === 'complete').length,
  };
}

/* =============================================================================
   EXECUTIVE COLLABORATION — FOUNDATIONS (Sprint 12G / Council Phase II)

   Doctrine: THE CHAIR PROPOSES; THE OFFICE DISPOSES. A Chair never hands work to
   another Chair directly. It proposes, and the Chief of Staff brokers. These are
   annotations on the ONE shared record — not a second store, not a second
   lifecycle, not a messaging system. Two primitives only:

     • HANDOFF     — office-brokered transfer of OWNERSHIP between Chairs.
                     proposed → authorized (office) → accepted (owner moves) ;
                     off-ramps: declined (returns to the office) / withdrawn.
     • CONSULTATION — one focused question, one recorded answer. Ownership STAYS.

   The five approved Founder decisions are encoded here:
     1. The office may broker without separate Founder approval — BUT collaboration
        never bypasses an existing lifecycle approval requirement (we only permit
        collaboration on `executing`, owned work; awaiting_founder is never touched).
     2. Direct ownership transfer to the receiving Chair, office-authorized and
        recorded — no unowned queue between Chairs.
     3. One question, one answer — no threads.
     4. A declined handoff returns to the office, never straight to the sender.
     5. The final Chair's completion closes the record; all history is preserved.
   --------------------------------------------------------------------------- */

export type HandoffStatus = 'proposed' | 'authorized' | 'accepted' | 'declined' | 'withdrawn';
export type ConsultationStatus = 'open' | 'answered' | 'withdrawn';

/** An office-brokered transfer of ownership from one Chair to another. Immutable
    core (id / from / to / proposedBy / reason / prior context); timestamps and
    status accrete as the office and receiving Chair act. Never removed from the
    trail — it is the record's provenance. */
export interface Handoff {
  id: string;
  fromChairId: string;          // the sending Chair (owner at proposal)
  toChairId: string;            // the receiving Chair
  proposedByChairId: string;    // who proposed (the owning Chair)
  reason: string;               // purpose of the handoff
  status: HandoffStatus;
  /** Provenance: the sending Chair's stage snapshot at proposal (role-specific). */
  fromStageAtProposal: string | null;
  /** Prior lifecycle + ownership context, for auditability. */
  priorOwnerChairId: string | null;
  priorStatus: RecStatus;
  createdAt: string;            // proposed at
  authorizedAt?: string;        // the office authorized
  authorizedBy?: string;        // the office marker (Chief of Staff)
  acceptedAt?: string;          // the receiving Chair accepted (ownership moved)
  declinedAt?: string;          // the receiving Chair declined (returned to office)
  declineReason?: string;
  resolvedAt?: string;          // accepted / declined / withdrawn — terminal moment
}

/** A bounded question→answer between the owning Chair and a consulted Chair.
    Ownership never changes. Not a thread — exactly one question and one answer. */
export interface Consultation {
  id: string;
  owningChairId: string;        // stays the owner throughout
  consultedChairId: string;
  question: string;
  answer?: string;
  status: ConsultationStatus;
  brokeredBy: string;           // the office marker (Chief of Staff)
  requestedAt: string;
  answeredAt?: string;
}

/** The office is always the actor of record for a brokered transfer. */
export const OFFICE_BROKER = 'chief_of_staff';

/** Why a collaboration action was refused — explicit, so callers and tests can
    distinguish each guard rather than reading an unchanged record. */
export type CollaborationDenial =
  | 'unknown_chair'          // sending or receiving Chair not in the Register
  | 'self_handoff'           // a Chair cannot hand off to itself
  | 'self_consultation'      // a Chair cannot consult itself
  | 'not_owner'              // only the current owning Chair may propose
  | 'record_not_collaborable'// record isn't owned, executing work (held/withdrawn/complete/awaiting_founder)
  | 'existing_open_handoff'  // an open handoff already exists on this record
  | 'handoff_not_found'
  | 'handoff_wrong_state'    // the handoff is not in the required state for this action
  | 'not_authorized'         // ownership cannot move before the office authorizes
  | 'not_receiving_chair'    // only the receiving Chair may accept / decline
  | 'not_proposer_or_office' // only the proposer or the office may withdraw
  | 'consultation_not_found'
  | 'consultation_wrong_state'
  | 'not_consulted_chair'    // only the consulted Chair may answer
  | 'empty_question'
  | 'empty_answer';

/** An explicit success/failure result — the collaboration surface never signals a
    refusal by silently returning the record unchanged. On success it carries the
    next record (and the handoff/consultation id it acted on). */
export type CollaborationResult =
  | { ok: true; rec: Recommendation; handoffId?: string; consultationId?: string }
  | { ok: false; reason: CollaborationDenial };

const fail = (reason: CollaborationDenial): CollaborationResult => ({ ok: false, reason });

/** A record may begin new collaboration only when it is genuinely owned, in-motion
    work: status `executing` with an owner. This single gate upholds decision #1 —
    awaiting_founder / preparing / held / complete / withdrawn records can never be
    handed off or consulted, so collaboration can never bypass a Founder approval
    the lifecycle still requires. */
export function isCollaborable(rec: Recommendation): boolean {
  return rec.status === 'executing' && !!rec.ownerChairId;
}

/** The sending Chair's role-specific stage at the moment of a handoff — captured
    as provenance so ownership can move without erasing where the work has been. */
function ownerStageSnapshot(rec: Recommendation): string | null {
  if (rec.ownerChairId === CHAIR_CREATIVE_DIRECTOR) return rec.creativeStage;
  if (rec.ownerChairId === CHAIR_HEAD_OF_PRODUCTION) return rec.productionStage;
  if (rec.ownerChairId === CHAIR_DIRECTOR_OF_GROWTH) return rec.growthStage;
  return null;
}

/** The single open (proposed or authorized) handoff on a record, if any. */
export function openHandoff(rec: Recommendation): Handoff | null {
  return rec.collaborationTrail.find((h) => h.status === 'proposed' || h.status === 'authorized') ?? null;
}
function findHandoff(rec: Recommendation, id: string): Handoff | null {
  return rec.collaborationTrail.find((h) => h.id === id) ?? null;
}
function replaceHandoff(rec: Recommendation, next: Handoff, now: Date): Recommendation {
  return {
    ...rec,
    collaborationTrail: rec.collaborationTrail.map((h) => (h.id === next.id ? next : h)),
    updatedAt: now.toISOString(),
  };
}

/* --- Handoff (ownership moves, office-brokered) --------------------------- */

/** A Chair PROPOSES a handoff to another Chair. Nothing moves yet — this only
    records the proposal for the office to broker. Guards: only the current owner
    may propose; the target must be a real, different Chair; the record must be
    collaborable; and only one open handoff at a time. */
export function proposeHandoff(
  rec: Recommendation, fromChairId: string, toChairId: string, reason: string,
  now: Date = new Date(), id: string = `handoff_${now.getTime()}`,
): CollaborationResult {
  if (!getChair(fromChairId) || !getChair(toChairId)) return fail('unknown_chair');
  if (fromChairId === toChairId) return fail('self_handoff');
  if (!isCollaborable(rec)) return fail('record_not_collaborable');
  if (rec.ownerChairId !== fromChairId) return fail('not_owner');
  if (openHandoff(rec)) return fail('existing_open_handoff');
  const handoff: Handoff = {
    id, fromChairId, toChairId, proposedByChairId: fromChairId,
    reason: reason.trim(), status: 'proposed',
    fromStageAtProposal: ownerStageSnapshot(rec),
    priorOwnerChairId: rec.ownerChairId, priorStatus: rec.status,
    createdAt: now.toISOString(),
  };
  return {
    ok: true,
    rec: { ...rec, collaborationTrail: [...rec.collaborationTrail, handoff], updatedAt: now.toISOString() },
    handoffId: id,
  };
}

/** The OFFICE authorizes a proposed handoff. Ownership still does not move — this
    is the brokerage step that makes a later transfer legitimate. */
export function authorizeHandoff(rec: Recommendation, handoffId: string, now: Date = new Date()): CollaborationResult {
  const h = findHandoff(rec, handoffId);
  if (!h) return fail('handoff_not_found');
  if (h.status !== 'proposed') return fail('handoff_wrong_state');
  const next: Handoff = { ...h, status: 'authorized', authorizedAt: now.toISOString(), authorizedBy: OFFICE_BROKER };
  return { ok: true, rec: replaceHandoff(rec, next, now), handoffId };
}

/** The RECEIVING Chair accepts an AUTHORIZED handoff — and only now does ownership
    move, directly to the receiving Chair. A Chair can never take ownership silently:
    acceptance requires a prior office authorization, and only the named receiving
    Chair may accept. The sending Chair's stage history is preserved on the record. */
export function acceptHandoff(
  rec: Recommendation, handoffId: string, byChairId: string, now: Date = new Date(),
): CollaborationResult {
  const h = findHandoff(rec, handoffId);
  if (!h) return fail('handoff_not_found');
  if (h.status !== 'authorized') return fail('not_authorized');
  if (byChairId !== h.toChairId) return fail('not_receiving_chair');
  const ts = now.toISOString();
  const next: Handoff = { ...h, status: 'accepted', acceptedAt: ts, resolvedAt: ts };
  const moved = replaceHandoff(rec, next, now);
  return { ok: true, rec: { ...moved, ownerChairId: h.toChairId, updatedAt: ts }, handoffId };
}

/** The RECEIVING Chair declines an AUTHORIZED handoff. Per decision #4 the work
    returns to the OFFICE (unowned, re-opened for triage) — never straight back to
    the sending Chair. Ownership does not pass to the decliner. */
export function declineHandoff(
  rec: Recommendation, handoffId: string, byChairId: string, reason: string = '', now: Date = new Date(),
): CollaborationResult {
  const h = findHandoff(rec, handoffId);
  if (!h) return fail('handoff_not_found');
  if (h.status !== 'authorized') return fail('handoff_wrong_state');
  if (byChairId !== h.toChairId) return fail('not_receiving_chair');
  const ts = now.toISOString();
  const next: Handoff = { ...h, status: 'declined', declinedAt: ts, resolvedAt: ts, declineReason: reason.trim() || undefined };
  const withTrail = replaceHandoff(rec, next, now);
  const status = canTransition(withTrail.status, 'preparing') ? 'preparing' : withTrail.status;
  return { ok: true, rec: { ...withTrail, ownerChairId: null, triage: null, status, updatedAt: ts }, handoffId };
}

/** Withdraw an as-yet-unaccepted handoff (proposed or authorized). Only the Chair
    that proposed it or the office may withdraw. Ownership is untouched — the work
    simply stays where it was. */
export function withdrawHandoff(
  rec: Recommendation, handoffId: string, byChairId: string, now: Date = new Date(),
): CollaborationResult {
  const h = findHandoff(rec, handoffId);
  if (!h) return fail('handoff_not_found');
  if (h.status !== 'proposed' && h.status !== 'authorized') return fail('handoff_wrong_state');
  if (byChairId !== h.proposedByChairId && byChairId !== OFFICE_BROKER) return fail('not_proposer_or_office');
  const ts = now.toISOString();
  const next: Handoff = { ...h, status: 'withdrawn', resolvedAt: ts };
  return { ok: true, rec: replaceHandoff(rec, next, now), handoffId };
}

/* --- Consultation (ownership stays) --------------------------------------- */

/** The owning Chair requests a focused consultation from another Chair. Ownership
    never changes. One question; the answer comes later. Guards mirror handoff:
    real, different Chair; the requester must own collaborable work; a question. */
export function requestConsultation(
  rec: Recommendation, fromChairId: string, toChairId: string, question: string,
  now: Date = new Date(), id: string = `consult_${now.getTime()}`,
): CollaborationResult {
  if (!getChair(fromChairId) || !getChair(toChairId)) return fail('unknown_chair');
  if (fromChairId === toChairId) return fail('self_consultation');
  if (!isCollaborable(rec)) return fail('record_not_collaborable');
  if (rec.ownerChairId !== fromChairId) return fail('not_owner');
  const q = question.trim();
  if (!q) return fail('empty_question');
  const consultation: Consultation = {
    id, owningChairId: fromChairId, consultedChairId: toChairId,
    question: q, status: 'open', brokeredBy: OFFICE_BROKER, requestedAt: now.toISOString(),
  };
  return {
    ok: true,
    rec: { ...rec, consultations: [...rec.consultations, consultation], updatedAt: now.toISOString() },
    consultationId: id,
  };
}

/** The consulted Chair answers an open consultation — one recorded answer. Only the
    consulted Chair may answer; ownership is never affected. */
export function answerConsultation(
  rec: Recommendation, consultationId: string, byChairId: string, answer: string, now: Date = new Date(),
): CollaborationResult {
  const c = rec.consultations.find((x) => x.id === consultationId) ?? null;
  if (!c) return fail('consultation_not_found');
  if (c.status !== 'open') return fail('consultation_wrong_state');
  if (byChairId !== c.consultedChairId) return fail('not_consulted_chair');
  const a = answer.trim();
  if (!a) return fail('empty_answer');
  const ts = now.toISOString();
  const next: Consultation = { ...c, answer: a, status: 'answered', answeredAt: ts };
  return {
    ok: true,
    rec: { ...rec, consultations: rec.consultations.map((x) => (x.id === next.id ? next : x)), updatedAt: ts },
    consultationId,
  };
}

/** Withdraw an open consultation — by the owning Chair or the office. */
export function withdrawConsultation(
  rec: Recommendation, consultationId: string, byChairId: string, now: Date = new Date(),
): CollaborationResult {
  const c = rec.consultations.find((x) => x.id === consultationId) ?? null;
  if (!c) return fail('consultation_not_found');
  if (c.status !== 'open') return fail('consultation_wrong_state');
  if (byChairId !== c.owningChairId && byChairId !== OFFICE_BROKER) return fail('not_owner');
  const next: Consultation = { ...c, status: 'withdrawn' };
  return {
    ok: true,
    rec: { ...rec, consultations: rec.consultations.map((x) => (x.id === next.id ? next : x)), updatedAt: now.toISOString() },
    consultationId,
  };
}

/* --- Derived collaboration views (pure; support later UI, build none now) --- */

/** A handoff paired with the record it belongs to — what the office needs to act. */
export interface HandoffView { rec: Recommendation; handoff: Handoff; }
export interface ConsultationView { rec: Recommendation; consultation: Consultation; }

function collectHandoffs(recs: Recommendation[], keep: (h: Handoff) => boolean): HandoffView[] {
  const out: HandoffView[] = [];
  for (const rec of recs) for (const handoff of rec.collaborationTrail) if (keep(handoff)) out.push({ rec, handoff });
  return out.sort((a, b) => a.handoff.createdAt.localeCompare(b.handoff.createdAt));
}

/** Proposals awaiting the office to authorize (or withdraw). */
export function pendingHandoffProposals(recs: Recommendation[]): HandoffView[] {
  return collectHandoffs(recs, (h) => h.status === 'proposed');
}
/** Authorized handoffs awaiting the receiving Chair's acceptance or decline. */
export function handoffsAwaitingAcceptance(recs: Recommendation[]): HandoffView[] {
  return collectHandoffs(recs, (h) => h.status === 'authorized');
}
/** Declined handoffs — the work is back with the office to re-broker. */
export function declinedHandoffsForOffice(recs: Recommendation[]): HandoffView[] {
  return collectHandoffs(recs, (h) => h.status === 'declined')
    .sort((a, b) => (a.handoff.resolvedAt ?? '').localeCompare(b.handoff.resolvedAt ?? ''));
}

/** The most recently created handoff on a record, or null. */
export function latestHandoff(rec: Recommendation): Handoff | null {
  return rec.collaborationTrail.length ? rec.collaborationTrail[rec.collaborationTrail.length - 1] : null;
}

/** Records genuinely awaiting the office's hand after a decline: unowned, re-opened
    (`preparing`), and whose latest handoff was declined. Once the office re-routes,
    holds, or withdraws the work, it leaves this queue — so "Returned to the Office"
    only ever shows what still needs the office to act. The declined handoff itself
    is never removed from the trail; it remains as provenance. */
export function handoffsReturnedToOffice(recs: Recommendation[]): HandoffView[] {
  const out: HandoffView[] = [];
  for (const rec of recs) {
    const last = latestHandoff(rec);
    if (rec.ownerChairId === null && rec.status === 'preparing' && last && last.status === 'declined') {
      out.push({ rec, handoff: last });
    }
  }
  return out.sort((a, b) => (a.handoff.resolvedAt ?? '').localeCompare(b.handoff.resolvedAt ?? ''));
}
/** Open consultations awaiting the consulted Chair's answer. */
export function unansweredConsultations(recs: Recommendation[]): ConsultationView[] {
  const out: ConsultationView[] = [];
  for (const rec of recs) for (const consultation of rec.consultations)
    if (consultation.status === 'open') out.push({ rec, consultation });
  return out.sort((a, b) => a.consultation.requestedAt.localeCompare(b.consultation.requestedAt));
}

/** The full, ordered collaboration provenance of a single record — every handoff
    and consultation on it, oldest first. Honest history, never destroyed. */
export interface CollaborationEvent {
  at: string; kind: 'handoff' | 'consultation'; status: string;
  handoff?: Handoff; consultation?: Consultation;
}
export function collaborationHistory(rec: Recommendation): CollaborationEvent[] {
  const events: CollaborationEvent[] = [
    ...rec.collaborationTrail.map((h) => ({ at: h.createdAt, kind: 'handoff' as const, status: h.status, handoff: h })),
    ...rec.consultations.map((c) => ({ at: c.requestedAt, kind: 'consultation' as const, status: c.status, consultation: c })),
  ];
  return events.sort((a, b) => a.at.localeCompare(b.at));
}

/** Records currently WAITING on a collaboration to resolve — an open handoff still
    to be brokered/accepted, or an unanswered consultation. Derived honestly from
    the record itself; no invented dependency graph. */
export function collaborationWaiting(recs: Recommendation[]): Recommendation[] {
  return recs.filter((rec) =>
    !!openHandoff(rec) || rec.consultations.some((c) => c.status === 'open'));
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

/** A Chair's institutional title from its Register id (falls back to the raw id). */
export function chairLabel(chairId: string | null | undefined): string {
  return chairId ? (getChair(chairId)?.title ?? chairId) : 'Unassigned';
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
    triage/preparation/blocked from 12C; creativeStage from 12D) with honest
    defaults, and drop unknown enum values — so Sprint 12A–12C records stay valid
    without a migration and without silent data loss. Well-formed records pass
    through unchanged. */
const HANDOFF_STATUSES = new Set<HandoffStatus>(['proposed', 'authorized', 'accepted', 'declined', 'withdrawn']);
const CONSULTATION_STATUSES = new Set<ConsultationStatus>(['open', 'answered', 'withdrawn']);

/** Keep only well-formed handoff entries — a stored trail can never inject a
    malformed or half-typed handoff into the running office. */
function sanitizeTrail(value: unknown): Handoff[] {
  if (!Array.isArray(value)) return [];
  return value.filter((h): h is Handoff =>
    !!h && typeof h === 'object'
    && typeof (h as Handoff).id === 'string'
    && typeof (h as Handoff).fromChairId === 'string'
    && typeof (h as Handoff).toChairId === 'string'
    && typeof (h as Handoff).createdAt === 'string'
    && HANDOFF_STATUSES.has((h as Handoff).status));
}
function sanitizeConsultations(value: unknown): Consultation[] {
  if (!Array.isArray(value)) return [];
  return value.filter((c): c is Consultation =>
    !!c && typeof c === 'object'
    && typeof (c as Consultation).id === 'string'
    && typeof (c as Consultation).owningChairId === 'string'
    && typeof (c as Consultation).consultedChairId === 'string'
    && typeof (c as Consultation).question === 'string'
    && typeof (c as Consultation).requestedAt === 'string'
    && CONSULTATION_STATUSES.has((c as Consultation).status));
}

export function normalizeRecommendation(rec: Recommendation): Recommendation {
  const type = SUBMISSION_TYPE_BY_ID.has(rec.type) ? rec.type : DEFAULT_TYPE;
  const visibility = VISIBILITY_BY_ID.has(rec.visibility) ? rec.visibility : DEFAULT_VISIBILITY;
  const triage = rec.triage && TRIAGE_BY_ID.has(rec.triage) ? rec.triage : null;
  const preparation = rec.preparation ?? null;
  const blocked = rec.blocked === true;
  const creativeStage = rec.creativeStage && CREATIVE_STAGE_BY_ID.has(rec.creativeStage) ? rec.creativeStage : null;
  const productionStage = rec.productionStage && PRODUCTION_STAGE_BY_ID.has(rec.productionStage) ? rec.productionStage : null;
  const growthStage = rec.growthStage && GROWTH_STAGE_BY_ID.has(rec.growthStage) ? rec.growthStage : null;
  // Collaboration collections (12G) — always arrays, only well-formed entries. Kept
  // by reference when already clean so the unchanged fast-path still holds.
  const trailOk = Array.isArray(rec.collaborationTrail) && sanitizeTrail(rec.collaborationTrail).length === rec.collaborationTrail.length;
  const collaborationTrail = trailOk ? rec.collaborationTrail : sanitizeTrail(rec.collaborationTrail);
  const consultOk = Array.isArray(rec.consultations) && sanitizeConsultations(rec.consultations).length === rec.consultations.length;
  const consultations = consultOk ? rec.consultations : sanitizeConsultations(rec.consultations);
  const unchanged = rec.type === type && rec.visibility === visibility
    && rec.triage === triage && rec.preparation === preparation && rec.blocked === blocked
    && rec.creativeStage === creativeStage && rec.productionStage === productionStage
    && rec.growthStage === growthStage
    && rec.collaborationTrail === collaborationTrail && rec.consultations === consultations;
  return unchanged ? rec : { ...rec, type, visibility, triage, preparation, blocked, creativeStage, productionStage, growthStage, collaborationTrail, consultations };
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
