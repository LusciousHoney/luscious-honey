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
  preparing:        ['awaiting_founder', 'held', 'withdrawn'],
  awaiting_founder: ['decided', 'preparing', 'held', 'withdrawn'],
  decided:          ['executing', 'complete', 'withdrawn'],
  executing:        ['complete', 'held'],
  complete:         [],
  held:             ['preparing', 'awaiting_founder', 'withdrawn'],
  withdrawn:        [],
};
export function canTransition(from: RecStatus, to: RecStatus): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

/* -----------------------------------------------------------------------------
   THE RECOMMENDATION — the operational record the Chief of Staff tracks.
   --------------------------------------------------------------------------- */
export interface Recommendation {
  id: string;
  /** The matter, in a line. */
  title: string;
  /** What it is — one honest sentence. */
  summary: string;
  /** The Chair this work is routed to (by Register id), or null if unassigned. */
  ownerChairId: string | null;
  priority: Priority;
  status: RecStatus;
  /** The Founder's recorded decision (pending until she answers). */
  founderDecision: FounderDecision;
  /** ISO datetime created. */
  createdAt: string;
  /** ISO datetime last changed. */
  updatedAt: string;
}

/** Build a recommendation from a sketch. Requires a title and summary; defaults
    to preparing / next / unassigned / undecided. Nothing is invented. */
export function makeRecommendation(
  input: { id: string; title: string; summary: string; ownerChairId?: string | null; priority?: Priority },
  now: Date = new Date(),
): Recommendation | null {
  if (!input.id || !input.title.trim() || !input.summary.trim()) return null;
  const owner = input.ownerChairId ?? null;
  const ts = now.toISOString();
  return {
    id: input.id,
    title: input.title.trim(),
    summary: input.summary.trim(),
    ownerChairId: owner && getChair(owner) ? owner : null,
    priority: input.priority ?? 'next',
    status: 'preparing',
    founderDecision: 'pending',
    createdAt: ts,
    updatedAt: ts,
  };
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
  rec: Recommendation, decision: FounderDecision, now: Date = new Date(),
): Recommendation {
  const ts = now.toISOString();
  let status: RecStatus = rec.status;
  if (decision === 'approved' || decision === 'approved_with_changes') status = 'decided';
  else if (decision === 'declined') status = 'withdrawn';
  else if (decision === 'deferred') status = 'held';
  else status = 'awaiting_founder';
  return { ...rec, founderDecision: decision, status, updatedAt: ts };
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
}

export function operationalBriefing(
  recs: Recommendation[], chairs: ExecutiveChair[] = CHAIRS,
): OperationalBriefing {
  const active = activeRecommendations(recs);
  return {
    quiet: active.length === 0,
    waiting: awaitingFounder(recs),
    waitingCount: awaitingFounder(recs).length,
    priorities: active,
    inExecution: inExecution(recs),
    unassigned: unassigned(recs),
    workload: chairWorkload(recs, chairs),
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

export function loadRecommendations(): Recommendation[] {
  return loadCollection(RECOMMENDATIONS_KEY, isRecommendation);
}
export function saveRecommendations(recs: Recommendation[]): void {
  saveCollection(RECOMMENDATIONS_KEY, recs);
}

/** Insert or replace a recommendation by id (one record per id) — the durable
    write the office uses as work is intaken and progressed. */
export function upsertRecommendation(existing: Recommendation[], rec: Recommendation): Recommendation[] {
  return [...existing.filter((r) => r.id !== rec.id), rec];
}
