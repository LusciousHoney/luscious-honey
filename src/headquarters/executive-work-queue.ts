/* =============================================================================
   THE EXECUTIVE WORK QUEUE — one unified projection of "what requires attention
   now" (Sprint 13F / Council Phase III). The Headquarters pipeline —
   intelligence → opportunity → assignment → draft → production → recommendation —
   is complete; the Founder should no longer walk each stage to find live work.

   This is a PROJECTION, not a workflow. It owns NO records and stores NOTHING: it
   DERIVES queue items from the existing institutional stores, preserving full
   provenance and every downstream workflow. No new lifecycle, no duplicated data,
   no AI scoring, no hidden weighting. A record already promoted into a
   recommendation is represented by that recommendation only — never twice.
   --------------------------------------------------------------------------- */

import { getChair, CHAIR_DIRECTOR_OF_GROWTH, CHAIR_CREATIVE_DIRECTOR, CHAIR_HEAD_OF_PRODUCTION } from './executive-register.ts';
import {
  loadRecommendations, ownerLabel, recStatusLabel, priorityLabel,
  type Recommendation,
} from './chief-of-staff-ops.ts';
import { loadIntelligence, intelStatusLabel, type IntelligenceItem } from './growth-intelligence.ts';
import { loadOpportunities, opportunityStatusLabel, type ContentOpportunity } from './content-opportunity.ts';
import { loadAssignments, assignmentStatusLabel, type CreativeAssignment } from './creative-assignment.ts';
import { loadDrafts, draftStatusLabel, draftTypeLabel, type CreativeDraft } from './creative-draft.ts';
import { loadProduction, productionStatusLabel, type ProductionReadiness } from './production-readiness.ts';

/* --- vocabulary ----------------------------------------------------------- */

export type QueueSourceType = 'intelligence' | 'opportunity' | 'assignment' | 'draft' | 'production' | 'recommendation';
export type QueueOffice = 'founder' | 'chief_of_staff' | 'creative_director' | 'growth' | 'production' | 'business' | 'completed' | 'hidden';
export interface QueueOfficeKind { id: QueueOffice; label: string; }
export const QUEUE_OFFICES: QueueOfficeKind[] = [
  { id: 'founder',          label: 'Founder' },
  { id: 'chief_of_staff',   label: 'Chief of Staff' },
  { id: 'creative_director',label: 'Creative Director' },
  { id: 'growth',           label: 'Growth' },
  { id: 'production',       label: 'Production' },
  { id: 'business',         label: 'Business' },
  { id: 'completed',        label: 'Completed' },
  { id: 'hidden',           label: 'Hidden' },
];
const OFFICE_BY_ID = new Map(QUEUE_OFFICES.map((o) => [o.id, o]));
export function queueOfficeLabel(id: QueueOffice): string { return OFFICE_BY_ID.get(id)?.label ?? id; }

export type QueuePriority = 'critical' | 'high' | 'normal' | 'low' | 'informational';
export const QUEUE_PRIORITIES: { id: QueuePriority; label: string; rank: number }[] = [
  { id: 'critical',      label: 'Critical',      rank: 0 },
  { id: 'high',          label: 'High',          rank: 1 },
  { id: 'normal',        label: 'Normal',        rank: 2 },
  { id: 'low',           label: 'Low',           rank: 3 },
  { id: 'informational', label: 'Informational', rank: 4 },
];
const PRIORITY_BY_ID = new Map(QUEUE_PRIORITIES.map((p) => [p.id, p]));
export function queuePriorityLabel(id: QueuePriority): string { return PRIORITY_BY_ID.get(id)?.label ?? id; }
function priorityRank(id: QueuePriority): number { return PRIORITY_BY_ID.get(id)?.rank ?? 9; }

/** The derived actions — a fixed vocabulary; the queue never invents workflow states. */
export type QueueAction =
  | 'Founder approval needed' | 'Review requested' | 'Ready for production' | 'Production review'
  | 'Research review' | 'Creative revision' | 'Waiting on Growth' | 'Waiting on Production'
  | 'Waiting on Creative' | 'Ready to route' | 'Awaiting Founder' | 'No action required' | 'Completed';

export type QueueStatusKind = 'actionable' | 'waiting' | 'completed' | 'hidden';
export type QueueDueState = 'now' | 'soon' | 'waiting' | 'none';

export interface QueueProvenance {
  intelId?: string; opportunityId?: string; assignmentId?: string;
  draftId?: string; productionId?: string; recommendationId?: string;
}

export interface QueueItem {
  id: string;                 // deterministic: `${sourceType}:${sourceId}`
  sourceType: QueueSourceType;
  sourceId: string;
  owner: string;
  office: QueueOffice;
  priority: QueuePriority;
  title: string;
  summary: string;
  requiredAction: QueueAction;
  status: QueueStatusKind;
  dueState: QueueDueState;
  createdAt: string;
  updatedAt: string;
  provenance: QueueProvenance;
  route: string;              // a hash route for quick navigation (read-only)
}

/* --- per-record derivers -------------------------------------------------- */

function chairLabel(id: string): string { return getChair(id)?.title ?? id; }
function base(sourceType: QueueSourceType, sourceId: string, createdAt: string, updatedAt: string): Pick<QueueItem, 'id' | 'sourceType' | 'sourceId' | 'createdAt' | 'updatedAt'> {
  return { id: `${sourceType}:${sourceId}`, sourceType, sourceId, createdAt, updatedAt };
}

function deriveRecommendation(r: Recommendation): QueueItem {
  const provenance: QueueProvenance = {
    intelId: r.originIntelId, opportunityId: r.originOpportunityId, assignmentId: r.originAssignmentId,
    draftId: r.originDraftId, productionId: r.originProductionId, recommendationId: r.id,
  };
  let office: QueueOffice; let priority: QueuePriority; let action: QueueAction; let status: QueueStatusKind; let due: QueueDueState; let route: string;
  const ownerOffice: QueueOffice = r.ownerChairId === CHAIR_CREATIVE_DIRECTOR ? 'creative_director'
    : r.ownerChairId === CHAIR_HEAD_OF_PRODUCTION ? 'production'
    : r.ownerChairId === CHAIR_DIRECTOR_OF_GROWTH ? 'growth' : 'chief_of_staff';
  const ownerRoute = ownerOffice === 'creative_director' ? '#/creative' : ownerOffice === 'production' ? '#/production' : ownerOffice === 'growth' ? '#/growth' : '#/chief-of-staff';
  switch (r.status) {
    case 'awaiting_founder': office = 'founder'; priority = r.blocked ? 'critical' : 'high'; action = 'Awaiting Founder'; status = 'actionable'; due = 'now'; route = '#/chief-of-staff/decisions'; break;
    case 'decided':          office = 'chief_of_staff'; priority = 'normal'; action = 'Ready to route'; status = 'actionable'; due = 'soon'; route = '#/chief-of-staff'; break;
    case 'executing':        office = ownerOffice; priority = r.blocked ? 'high' : 'normal'; action = `Waiting on ${queueOfficeLabel(ownerOffice)}` as QueueAction; status = 'waiting'; due = 'waiting'; route = ownerRoute; break;
    case 'complete':         office = 'completed'; priority = 'informational'; action = 'Completed'; status = 'completed'; due = 'none'; route = ownerRoute; break;
    case 'preparing':        office = 'chief_of_staff'; priority = 'normal'; action = 'Review requested'; status = 'actionable'; due = 'soon'; route = '#/chief-of-staff/inbox'; break;
    default:                 office = 'hidden'; priority = 'informational'; action = 'No action required'; status = 'hidden'; due = 'none'; route = '#/chief-of-staff';
  }
  // executing that maps back to a known owner office keeps a clearer action verb.
  if (r.status === 'executing') action = ownerOffice === 'production' ? 'Production review' : ownerOffice === 'creative_director' ? 'Waiting on Creative' : ownerOffice === 'growth' ? 'Waiting on Growth' : 'Review requested';
  return {
    ...base('recommendation', r.id, r.createdAt, r.updatedAt),
    owner: ownerLabel(r), office, priority, title: r.title,
    summary: `${recStatusLabel(r.status)} · ${priorityLabel(r.priority)}`,
    requiredAction: action, status, dueState: due, provenance, route,
  };
}

function deriveIntelligence(i: IntelligenceItem): QueueItem {
  const prov: QueueProvenance = { intelId: i.id, recommendationId: i.promotedRecommendationId };
  let office: QueueOffice = 'chief_of_staff'; let priority: QueuePriority = 'normal'; let action: QueueAction = 'Research review'; let status: QueueStatusKind = 'actionable'; let due: QueueDueState = 'soon'; let route = '#/chief-of-staff/opportunities';
  if (i.promotedRecommendationId || i.status === 'routed') { office = 'hidden'; status = 'hidden'; action = 'No action required'; }
  else if (i.status === 'archived' || i.status === 'dismissed') { office = 'hidden'; status = 'hidden'; action = 'No action required'; }
  else if (i.status === 'researching') { office = 'growth'; priority = 'low'; action = 'Waiting on Growth'; status = 'waiting'; due = 'waiting'; route = '#/growth'; }
  else if (i.status === 'recommended') { action = 'Ready to route'; }
  return {
    ...base('intelligence', i.id, i.capturedAt, i.capturedAt),
    owner: chairLabel(i.capturedBy), office, priority, title: i.title,
    summary: `Intelligence · ${intelStatusLabel(i.status)}`, requiredAction: action, status, dueState: due, provenance: prov, route,
  };
}

function deriveOpportunity(o: ContentOpportunity): QueueItem {
  const prov: QueueProvenance = { intelId: o.intelId, opportunityId: o.id, recommendationId: o.promotedRecommendationId };
  let office: QueueOffice = 'chief_of_staff'; let priority: QueuePriority = 'normal'; let action: QueueAction = 'Review requested'; let status: QueueStatusKind = 'actionable'; let due: QueueDueState = 'soon'; let route = '#/chief-of-staff/opportunities';
  if (o.promotedRecommendationId || o.status === 'routed_to_work') { office = 'hidden'; status = 'hidden'; action = 'No action required'; }
  else if (o.status === 'held' || o.status === 'declined') { office = 'hidden'; status = 'hidden'; action = 'No action required'; }
  else if (o.status === 'draft' || o.status === 'analyzing') { office = 'growth'; priority = 'low'; action = 'Waiting on Growth'; status = 'waiting'; due = 'waiting'; route = '#/growth'; }
  else if (o.status === 'recommended') { action = 'Ready to route'; }
  return {
    ...base('opportunity', o.id, o.createdAt, o.updatedAt),
    owner: chairLabel(o.createdBy), office, priority, title: o.title,
    summary: `Opportunity brief · ${opportunityStatusLabel(o.status)}`, requiredAction: action, status, dueState: due, provenance: prov, route,
  };
}

function deriveAssignment(a: CreativeAssignment): QueueItem {
  const prov: QueueProvenance = { intelId: a.originIntelId, opportunityId: a.originOpportunityId, assignmentId: a.id, recommendationId: a.promotedRecommendationId };
  let office: QueueOffice = 'chief_of_staff'; let priority: QueuePriority = 'normal'; let action: QueueAction = 'Review requested'; let status: QueueStatusKind = 'actionable'; let due: QueueDueState = 'soon'; let route = '#/chief-of-staff/opportunities';
  if (a.promotedRecommendationId || a.status === 'routed_to_work') { office = 'hidden'; status = 'hidden'; action = 'No action required'; }
  else if (a.status === 'held' || a.status === 'declined') { office = 'hidden'; status = 'hidden'; action = 'No action required'; }
  else if (a.status === 'draft' || a.status === 'in_development' || a.status === 'returned_for_revision') { office = 'creative_director'; priority = 'low'; action = 'Waiting on Creative'; status = 'waiting'; due = 'waiting'; route = '#/creative'; }
  else if (a.status === 'approved') { action = 'Ready to route'; }
  return {
    ...base('assignment', a.id, a.createdAt, a.updatedAt),
    owner: chairLabel(a.createdBy), office, priority, title: a.title,
    summary: `Creative assignment · ${assignmentStatusLabel(a.status)}`, requiredAction: action, status, dueState: due, provenance: prov, route,
  };
}

function deriveDraft(d: CreativeDraft): QueueItem {
  const prov: QueueProvenance = { intelId: d.originIntelId, opportunityId: d.originOpportunityId, assignmentId: d.originAssignmentId, draftId: d.id, recommendationId: d.promotedRecommendationId };
  let office: QueueOffice = 'creative_director'; let priority: QueuePriority = 'normal'; let action: QueueAction = 'Waiting on Creative'; let status: QueueStatusKind = 'waiting'; let due: QueueDueState = 'waiting'; let route = '#/creative';
  if (d.promotedRecommendationId) { office = 'hidden'; status = 'hidden'; action = 'No action required'; }
  else if (d.status === 'declined' || d.status === 'held') { office = 'hidden'; status = 'hidden'; action = 'No action required'; }
  else if (d.status === 'draft_ready' || d.status === 'revised') { office = 'founder'; priority = 'normal'; action = 'Review requested'; status = 'actionable'; due = 'now'; route = '#/chief-of-staff/opportunities'; }
  else if (d.status === 'generation_failed') { office = 'creative_director'; priority = 'high'; action = 'Creative revision'; status = 'actionable'; due = 'now'; }
  else if (d.status === 'approved') { office = 'chief_of_staff'; priority = 'normal'; action = 'Ready to route'; status = 'actionable'; due = 'soon'; route = '#/chief-of-staff/opportunities'; }
  else if (d.status === 'revision_requested') { office = 'creative_director'; priority = 'low'; action = 'Creative revision'; status = 'waiting'; }
  return {
    ...base('draft', d.id, d.createdAt, d.updatedAt),
    owner: chairLabel(d.createdBy), office, priority, title: `${draftTypeLabel(d.type)} — ${d.context.centralIdea || 'draft'}`,
    summary: `Creative draft · ${draftStatusLabel(d.status)}`, requiredAction: action, status, dueState: due, provenance: prov, route,
  };
}

function deriveProduction(p: ProductionReadiness): QueueItem {
  const prov: QueueProvenance = {
    intelId: p.originIntelId, opportunityId: p.originOpportunityId, assignmentId: p.originAssignmentId,
    draftId: p.originDraftId, productionId: p.id, recommendationId: p.promotedRecommendationId,
  };
  let office: QueueOffice = 'production'; let priority: QueuePriority = 'low'; let action: QueueAction = 'Waiting on Production'; let status: QueueStatusKind = 'waiting'; let due: QueueDueState = 'waiting'; let route = '#/production';
  if (p.promotedRecommendationId) { office = 'hidden'; status = 'hidden'; action = 'No action required'; }
  else if (p.status === 'declined' || p.status === 'held') { office = 'hidden'; status = 'hidden'; action = 'No action required'; }
  else if (p.status === 'ready_for_review') { office = 'founder'; priority = 'normal'; action = 'Review requested'; status = 'actionable'; due = 'now'; route = '#/chief-of-staff/opportunities'; }
  else if (p.status === 'approved') { office = 'chief_of_staff'; priority = 'normal'; action = 'Ready to route'; status = 'actionable'; due = 'soon'; route = '#/chief-of-staff/opportunities'; }
  return {
    ...base('production', p.id, p.createdAt, p.updatedAt),
    owner: chairLabel(p.createdBy), office, priority, title: p.title,
    summary: `Production readiness · ${productionStatusLabel(p.status)}`, requiredAction: action, status, dueState: due, provenance: prov, route,
  };
}

/* --- the projection ------------------------------------------------------- */

export interface QueueCollections {
  intelligence: IntelligenceItem[]; opportunities: ContentOpportunity[];
  assignments: CreativeAssignment[]; drafts: CreativeDraft[];
  production: ProductionReadiness[]; recommendations: Recommendation[];
}

/** Derive the whole queue from the institutional stores — pure, ownerless, and
    idempotent (deriving twice from the same state yields identical items). Items
    are ordered by priority then most-recently-updated. */
export function deriveWorkQueue(c: QueueCollections): QueueItem[] {
  const items: QueueItem[] = [
    ...c.recommendations.map(deriveRecommendation),
    ...c.intelligence.map(deriveIntelligence),
    ...c.opportunities.map(deriveOpportunity),
    ...c.assignments.map(deriveAssignment),
    ...c.drafts.map(deriveDraft),
    ...c.production.map(deriveProduction),
  ];
  return items.sort((a, b) => (priorityRank(a.priority) - priorityRank(b.priority)) || b.updatedAt.localeCompare(a.updatedAt));
}

/** Convenience: derive from the live client stores. */
export function loadWorkQueue(): QueueItem[] {
  return deriveWorkQueue({
    intelligence: loadIntelligence(), opportunities: loadOpportunities(),
    assignments: loadAssignments(), drafts: loadDrafts(), production: loadProduction(),
    recommendations: loadRecommendations(),
  });
}

/* --- derived views & filtering -------------------------------------------- */

/** The live, actionable + waiting items (hidden records are excluded). */
export function activeQueue(items: QueueItem[]): QueueItem[] {
  return items.filter((i) => i.status === 'actionable' || i.status === 'waiting');
}
export function needsFounder(items: QueueItem[]): QueueItem[] {
  return items.filter((i) => i.office === 'founder' && i.status === 'actionable');
}
export function waitingItems(items: QueueItem[]): QueueItem[] {
  return items.filter((i) => i.status === 'waiting');
}
export function completedItems(items: QueueItem[]): QueueItem[] {
  return items.filter((i) => i.status === 'completed');
}
export function queueByOffice(items: QueueItem[], office: QueueOffice): QueueItem[] {
  return items.filter((i) => i.office === office);
}

export interface QueueFilter { owner?: string; office?: QueueOffice; priority?: QueuePriority; needsFounder?: boolean; completed?: boolean; waiting?: boolean; }
export function filterQueue(items: QueueItem[], f: QueueFilter): QueueItem[] {
  return items.filter((i) => {
    if (i.status === 'hidden') return false;
    if (f.owner && i.owner !== f.owner) return false;
    if (f.office && i.office !== f.office) return false;
    if (f.priority && i.priority !== f.priority) return false;
    if (f.needsFounder && !(i.office === 'founder' && i.status === 'actionable')) return false;
    if (f.completed && i.status !== 'completed') return false;
    if (f.waiting && i.status !== 'waiting') return false;
    return true;
  });
}

/** The Executive Office summary — a few honest counts, no dashboard. */
export interface QueueSummary {
  founderAttention: number; waitingProduction: number; waitingCreative: number;
  waitingGrowth: number; completedToday: number; recentlyFinished: QueueItem[];
}
export function queueSummary(items: QueueItem[], now: Date = new Date()): QueueSummary {
  const day = now.toISOString().slice(0, 10);
  const completed = completedItems(items);
  const waiting = waitingItems(items);
  return {
    founderAttention: needsFounder(items).length,
    waitingProduction: waiting.filter((i) => i.office === 'production').length,
    waitingCreative: waiting.filter((i) => i.office === 'creative_director').length,
    waitingGrowth: waiting.filter((i) => i.office === 'growth').length,
    completedToday: completed.filter((i) => i.updatedAt.slice(0, 10) === day).length,
    recentlyFinished: [...completed].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3),
  };
}

/** Distinct owners present in the live queue — for the owner filter. */
export function queueOwners(items: QueueItem[]): string[] {
  return [...new Set(activeQueue(items).map((i) => i.owner))].sort();
}
