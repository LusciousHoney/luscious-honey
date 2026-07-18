/* =============================================================================
   PRODUCTION READINESS PACK — the Head of Production's preparation layer
   (Sprint 13E / Council Phase III). Converts an APPROVED Creative Draft into
   practical production instructions that ready content for recording — runtime,
   framing, visual direction, audio, assets, and a checklist.

   This is PREPARATION, not execution: it does not publish, schedule, record, or
   render. A pack is a planning artifact LINKED to a draft (which is linked back
   through assignment → opportunity → intelligence) — never a copy. Routing a pack
   promotes it into the ONE recommendation store with durable, full-chain
   provenance. No second Council/Register/Production-workflow/publishing engine.
   --------------------------------------------------------------------------- */

import {
  STORAGE_ROOT, loadCollection, saveCollection, getChair, CHAIR_HEAD_OF_PRODUCTION,
} from './executive-register.ts';
import { makeSubmission, upsertRecommendation, type Recommendation } from './chief-of-staff-ops.ts';
import { CONTENT_PLATFORMS, contentPlatformLabel, type ContentPlatform } from './creative-assignment.ts';
import { type CreativeDraft } from './creative-draft.ts';

/* --- vocabulary ----------------------------------------------------------- */

export { CONTENT_PLATFORMS, contentPlatformLabel };
export type ProductionComplexity = 'low' | 'medium' | 'high';
export const PRODUCTION_COMPLEXITIES: { id: ProductionComplexity; label: string }[] = [
  { id: 'low', label: 'Low' }, { id: 'medium', label: 'Medium' }, { id: 'high', label: 'High' },
];
const COMPLEXITY_BY_ID = new Map(PRODUCTION_COMPLEXITIES.map((c) => [c.id, c]));
export function productionComplexityLabel(id: ProductionComplexity): string { return COMPLEXITY_BY_ID.get(id)?.label ?? id; }

export type ProductionStatus =
  | 'draft' | 'preparing' | 'ready_for_review' | 'approved'
  | 'revision_requested' | 'held' | 'declined' | 'routed_to_work';
export interface ProductionStatusKind { id: ProductionStatus; label: string; open: boolean; }
export const PRODUCTION_STATUSES: ProductionStatusKind[] = [
  { id: 'draft',              label: 'Draft',              open: true  },
  { id: 'preparing',          label: 'Preparing',          open: true  },
  { id: 'ready_for_review',   label: 'Ready for Review',   open: true  },
  { id: 'approved',           label: 'Approved',           open: true  },
  { id: 'revision_requested', label: 'Revision Requested', open: true  },
  { id: 'held',               label: 'Held',               open: false },
  { id: 'declined',           label: 'Declined',           open: false },
  { id: 'routed_to_work',     label: 'Routed to Work',     open: false },
];
const PROD_STATUS_BY_ID = new Map(PRODUCTION_STATUSES.map((s) => [s.id, s]));
export function productionStatusLabel(id: ProductionStatus): string { return PROD_STATUS_BY_ID.get(id)?.label ?? id; }
export function isOpenProduction(id: ProductionStatus): boolean { return !!PROD_STATUS_BY_ID.get(id)?.open; }

/** A checklist item — used for the production checklist and the asset checklist. */
export interface ChecklistItem { id: string; label: string; done: boolean; }
function sanitizeChecklist(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((i): i is ChecklistItem =>
    !!i && typeof i === 'object' && typeof (i as ChecklistItem).id === 'string' && typeof (i as ChecklistItem).label === 'string')
    .map((i) => ({ id: i.id, label: i.label, done: !!i.done }));
}

/* --- the record ----------------------------------------------------------- */

export interface ProductionReadiness {
  id: string;
  originIntelId: string;
  originOpportunityId: string;
  originAssignmentId: string;
  originDraftId: string;
  linkedRecommendationId: string;   // the draft's promoted recommendation, if any
  title: string;
  objective: string;
  primaryPlatform: ContentPlatform | '';
  contentFormat: string;
  estimatedDuration: string;
  deliveryStyle: string;
  recordingEnvironment: string;
  visualDirection: string;
  cameraRecommendation: string;
  lightingNotes: string;
  audioNotes: string;
  musicRecommendation: string;
  props: string;
  onScreenText: string;
  lowerThirdNotes: string;
  captionNotes: string;
  ctaPlacement: string;
  substackConnection: string;
  pmuConnection: string;
  hrbsConnection: string;
  cautions: string;
  requiredAssets: ChecklistItem[];
  checklist: ChecklistItem[];
  complexity: ProductionComplexity;
  readiness: ProductionComplexity;   // how ready-to-record it is (low..high)
  revisionNote: string;
  status: ProductionStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  promotedRecommendationId?: string;
}

/** A default recording checklist seeded for a new pack — editable and tickable. */
function seedChecklist(now: Date): ChecklistItem[] {
  return [
    'Confirm recording environment', 'Set camera framing', 'Check lighting', 'Check audio',
    'Stage props / on-screen text', 'Review talking-point order', 'Confirm CTA timing',
  ].map((label, i) => ({ id: `ck_${now.getTime()}_${i}`, label, done: false }));
}

/* --- construction --------------------------------------------------------- */

/** A draft is eligible for a production pack once the Founder has approved it. */
export function isDraftEligibleForProduction(d: CreativeDraft): boolean {
  return d.status === 'approved';
}

export function makeProductionReadiness(
  input: {
    id: string; draft: CreativeDraft; title?: string; createdBy?: string;
  } & Partial<Pick<ProductionReadiness, 'objective' | 'primaryPlatform' | 'contentFormat' | 'estimatedDuration'
    | 'deliveryStyle' | 'recordingEnvironment' | 'visualDirection' | 'cameraRecommendation' | 'lightingNotes'
    | 'audioNotes' | 'musicRecommendation' | 'props' | 'onScreenText' | 'lowerThirdNotes' | 'captionNotes'
    | 'ctaPlacement' | 'substackConnection' | 'pmuConnection' | 'hrbsConnection' | 'cautions'
    | 'complexity' | 'readiness'>>,
  now: Date = new Date(),
): ProductionReadiness | null {
  const d = input.draft;
  if (!input.id || !d || !d.originAssignmentId) return null;
  const by = input.createdBy && getChair(input.createdBy) ? input.createdBy : CHAIR_HEAD_OF_PRODUCTION;
  const ts = now.toISOString();
  const c = d.approvedContent ?? d.content;
  const str = (v: string | undefined): string => (v ?? '').trim();
  return {
    id: input.id,
    originIntelId: d.originIntelId,
    originOpportunityId: d.originOpportunityId,
    originAssignmentId: d.originAssignmentId,
    originDraftId: d.id,
    linkedRecommendationId: d.promotedRecommendationId ?? '',
    title: (input.title ?? d.context.centralIdea ?? 'Production pack').trim(),
    objective: str(input.objective) || d.context.centralIdea,
    primaryPlatform: CONTENT_PLATFORMS.some((p) => p.id === input.primaryPlatform) ? (input.primaryPlatform as ContentPlatform) : (d.type.startsWith('tiktok') ? 'tiktok' : 'substack'),
    contentFormat: str(input.contentFormat),
    estimatedDuration: str(input.estimatedDuration),
    deliveryStyle: str(input.deliveryStyle),
    recordingEnvironment: str(input.recordingEnvironment),
    visualDirection: str(input.visualDirection) || (c?.visual ?? ''),
    cameraRecommendation: str(input.cameraRecommendation),
    lightingNotes: str(input.lightingNotes),
    audioNotes: str(input.audioNotes),
    musicRecommendation: str(input.musicRecommendation),
    props: str(input.props),
    onScreenText: str(input.onScreenText),
    lowerThirdNotes: str(input.lowerThirdNotes),
    captionNotes: str(input.captionNotes) || (c?.captionDirection ?? ''),
    ctaPlacement: str(input.ctaPlacement) || (c?.cta ?? ''),
    substackConnection: str(input.substackConnection) || (c?.substackBridge ?? ''),
    pmuConnection: str(input.pmuConnection),
    hrbsConnection: str(input.hrbsConnection),
    cautions: str(input.cautions),
    requiredAssets: [],
    checklist: seedChecklist(now),
    complexity: COMPLEXITY_BY_ID.has(input.complexity as ProductionComplexity) ? (input.complexity as ProductionComplexity) : 'medium',
    readiness: COMPLEXITY_BY_ID.has(input.readiness as ProductionComplexity) ? (input.readiness as ProductionComplexity) : 'low',
    revisionNote: '',
    status: 'draft',
    createdAt: ts, updatedAt: ts, createdBy: by,
  };
}

/* --- editing, checklist & lifecycle --------------------------------------- */

export type ProductionPatch = Partial<Pick<ProductionReadiness, 'title' | 'objective' | 'primaryPlatform'
  | 'contentFormat' | 'estimatedDuration' | 'deliveryStyle' | 'recordingEnvironment' | 'visualDirection'
  | 'cameraRecommendation' | 'lightingNotes' | 'audioNotes' | 'musicRecommendation' | 'props' | 'onScreenText'
  | 'lowerThirdNotes' | 'captionNotes' | 'ctaPlacement' | 'substackConnection' | 'pmuConnection' | 'hrbsConnection'
  | 'cautions' | 'complexity' | 'readiness'>>;

export function updateProductionReadiness(p: ProductionReadiness, patch: ProductionPatch, now: Date = new Date()): ProductionReadiness {
  const next: ProductionReadiness = { ...p, updatedAt: now.toISOString() };
  const bag = next as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (k === 'complexity' || k === 'readiness') { if (COMPLEXITY_BY_ID.has(v as ProductionComplexity)) bag[k] = v; }
    else if (k === 'primaryPlatform') { bag[k] = CONTENT_PLATFORMS.some((pp) => pp.id === v) ? v : ''; }
    else if (typeof v === 'string') bag[k] = v.trim();
  }
  return next;
}

export function addChecklistItem(p: ProductionReadiness, which: 'checklist' | 'requiredAssets', label: string, now: Date = new Date(), id?: string): ProductionReadiness {
  const t = label.trim();
  if (!t) return p;
  const item: ChecklistItem = { id: id ?? `ck_${now.getTime()}`, label: t, done: false };
  return { ...p, [which]: [...p[which], item], updatedAt: now.toISOString() };
}
export function toggleChecklistItem(p: ProductionReadiness, which: 'checklist' | 'requiredAssets', itemId: string, now: Date = new Date()): ProductionReadiness {
  return { ...p, [which]: p[which].map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)), updatedAt: now.toISOString() };
}
/** Checklist completion (0–1) — the honest readiness signal. */
export function checklistProgress(p: ProductionReadiness): number {
  const all = [...p.checklist, ...p.requiredAssets];
  if (all.length === 0) return 0;
  return all.filter((i) => i.done).length / all.length;
}

const PROD_TRANSITIONS: Record<ProductionStatus, ProductionStatus[]> = {
  draft:              ['preparing', 'ready_for_review', 'held', 'declined'],
  preparing:          ['ready_for_review', 'draft', 'held', 'declined'],
  ready_for_review:   ['approved', 'revision_requested', 'held', 'declined', 'routed_to_work'],
  approved:           ['routed_to_work', 'held', 'revision_requested'],
  revision_requested: ['preparing', 'ready_for_review', 'held', 'declined'],
  held:               ['preparing', 'ready_for_review', 'declined'],
  declined:           [],
  routed_to_work:     [],
};
export function canAdvanceProduction(from: ProductionStatus, to: ProductionStatus): boolean {
  return (PROD_TRANSITIONS[from] ?? []).includes(to);
}
export function setProductionStatus(p: ProductionReadiness, to: ProductionStatus, now: Date = new Date()): ProductionReadiness {
  if (!canAdvanceProduction(p.status, to)) return p;
  return { ...p, status: to, updatedAt: now.toISOString() };
}
export const markProductionReady = (p: ProductionReadiness, now?: Date): ProductionReadiness => setProductionStatus(p, 'ready_for_review', now);
export const approveProduction = (p: ProductionReadiness, now?: Date): ProductionReadiness => setProductionStatus(p, 'approved', now);
export const holdProduction = (p: ProductionReadiness, now?: Date): ProductionReadiness => setProductionStatus(p, 'held', now);
export const declineProduction = (p: ProductionReadiness, now?: Date): ProductionReadiness => setProductionStatus(p, 'declined', now);
export function returnProductionForRevision(p: ProductionReadiness, note: string = '', now: Date = new Date()): ProductionReadiness {
  if (!canAdvanceProduction(p.status, 'revision_requested')) return p;
  return { ...p, status: 'revision_requested', revisionNote: note.trim(), updatedAt: now.toISOString() };
}

/* --- the Founder-ready projection ----------------------------------------- */

export interface FounderProductionView {
  record: string; duration: string; format: string; environment: string;
  visual: string; cta: string; assets: string[]; cautions: string; decision: string;
}
export function founderProductionView(p: ProductionReadiness): FounderProductionView {
  return {
    record: p.title,
    duration: p.estimatedDuration || 'To be set',
    format: [contentPlatformLabel(p.primaryPlatform), p.contentFormat].filter(Boolean).join(' · ') || 'Not set',
    environment: p.recordingEnvironment || 'Not set',
    visual: p.visualDirection || 'Not set',
    cta: p.ctaPlacement || 'To be defined',
    assets: p.requiredAssets.map((a) => `${a.done ? '✓ ' : ''}${a.label}`),
    cautions: p.cautions || 'None noted',
    decision: 'Approve, request a revision, hold, or decline.',
  };
}

/* --- routing to work (idempotent, full-chain provenance) ------------------ */

export const PROD_PROMOTED_REC_PREFIX = 'rec_from_prod_';
export function productionRecommendationId(p: ProductionReadiness): string { return `${PROD_PROMOTED_REC_PREFIX}${p.id}`; }
export function isProductionRoutable(p: ProductionReadiness): boolean {
  return (p.status === 'approved' || p.status === 'ready_for_review') && !p.promotedRecommendationId;
}
export interface ProductionRouteResult {
  pack: ProductionReadiness; recommendations: Recommendation[]; recommendation: Recommendation | null; created: boolean;
}
/** Promote an approved pack into the one recommendation store, carrying the WHOLE
    chain (intel, opportunity, assignment, draft, production ids). Idempotent; no
    fabricated Founder approval; Register-derived Head-of-Production owner; concise
    execution summary — the full pack stays retrievable via provenance. */
export function routeProductionToWork(p: ProductionReadiness, recommendations: Recommendation[], now: Date = new Date()): ProductionRouteResult {
  const priorId = p.promotedRecommendationId ?? productionRecommendationId(p);
  const existing = recommendations.find((r) => r.id === priorId) ?? null;
  if (existing) {
    const linked = p.status === 'routed_to_work' && p.promotedRecommendationId === existing.id
      ? p
      : { ...p, status: 'routed_to_work' as ProductionStatus, promotedRecommendationId: existing.id, updatedAt: now.toISOString() };
    return { pack: linked, recommendations, recommendation: existing, created: false };
  }
  if (!isProductionRoutable(p)) return { pack: p, recommendations, recommendation: null, created: false };
  const rec = makeSubmission({
    id: productionRecommendationId(p), type: 'idea',
    title: p.title, description: productionExecutionSummary(p),
    ownerChairId: CHAIR_HEAD_OF_PRODUCTION,
    originIntelId: p.originIntelId, originOpportunityId: p.originOpportunityId,
    originAssignmentId: p.originAssignmentId, originDraftId: p.originDraftId, originProductionId: p.id,
  }, now);
  if (!rec) return { pack: p, recommendations, recommendation: null, created: false };
  const linked: ProductionReadiness = { ...p, status: 'routed_to_work', promotedRecommendationId: rec.id, updatedAt: now.toISOString() };
  return { pack: linked, recommendations: upsertRecommendation(recommendations, rec), recommendation: rec, created: true };
}
function productionExecutionSummary(p: ProductionReadiness): string {
  const parts = [`${p.title} — production-ready`];
  if (p.estimatedDuration) parts.push(`Runtime: ${p.estimatedDuration}`);
  if (p.primaryPlatform) parts.push(`Platform: ${contentPlatformLabel(p.primaryPlatform)}${p.contentFormat ? ` (${p.contentFormat})` : ''}`);
  if (p.recordingEnvironment) parts.push(`Setting: ${p.recordingEnvironment}`);
  if (p.requiredAssets.length) parts.push(`Assets: ${p.requiredAssets.map((a) => a.label).join(', ')}`);
  parts.push('Full readiness pack retained via provenance (originProductionId).');
  return parts.join('\n\n');
}

/* --- derived views (pure) ------------------------------------------------- */

export function productionForDraft(draftId: string, list: ProductionReadiness[]): ProductionReadiness[] {
  return list.filter((p) => p.originDraftId === draftId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function productionDrafts(list: ProductionReadiness[]): ProductionReadiness[] {
  return list.filter((p) => p.status === 'draft' || p.status === 'preparing' || p.status === 'revision_requested')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function productionForReview(list: ProductionReadiness[]): ProductionReadiness[] {
  return list.filter((p) => p.status === 'ready_for_review').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function approvedProduction(list: ProductionReadiness[]): ProductionReadiness[] {
  return list.filter((p) => p.status === 'approved').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export interface ProductionStanding {
  draft: number; preparing: number; readyForReview: number; approved: number;
  revision: number; held: number; declined: number; routed: number; total: number;
}
export function productionStanding(list: ProductionReadiness[]): ProductionStanding {
  const n = (s: ProductionStatus): number => list.filter((p) => p.status === s).length;
  return {
    draft: n('draft'), preparing: n('preparing'), readyForReview: n('ready_for_review'), approved: n('approved'),
    revision: n('revision_requested'), held: n('held'), declined: n('declined'), routed: n('routed_to_work'), total: list.length,
  };
}
export function productionAuthorLabel(p: ProductionReadiness): string { return getChair(p.createdBy)?.title ?? p.createdBy; }

/* --- storage -------------------------------------------------------------- */

export const PRODUCTION_KEY = `${STORAGE_ROOT}.production-readiness.v1`;

export function isProductionReadiness(x: unknown): x is ProductionReadiness {
  const o = x as ProductionReadiness;
  return !!o && typeof o === 'object'
    && typeof o.id === 'string' && typeof o.originDraftId === 'string'
    && typeof o.title === 'string' && typeof o.status === 'string' && typeof o.createdAt === 'string';
}
export function normalizeProductionReadiness(p: ProductionReadiness): ProductionReadiness {
  const status = PROD_STATUS_BY_ID.has(p.status) ? p.status : 'draft';
  const complexity = COMPLEXITY_BY_ID.has(p.complexity) ? p.complexity : 'medium';
  const readiness = COMPLEXITY_BY_ID.has(p.readiness) ? p.readiness : 'low';
  const primaryPlatform = CONTENT_PLATFORMS.some((pp) => pp.id === p.primaryPlatform) ? p.primaryPlatform : '';
  const checklist = sanitizeChecklist(p.checklist);
  const requiredAssets = sanitizeChecklist(p.requiredAssets);
  const clOk = Array.isArray(p.checklist) && checklist.length === p.checklist.length;
  const raOk = Array.isArray(p.requiredAssets) && requiredAssets.length === p.requiredAssets.length;
  const unchanged = p.status === status && p.complexity === complexity && p.readiness === readiness
    && p.primaryPlatform === primaryPlatform && clOk && raOk;
  const s = (v: string | undefined): string => v ?? '';
  return unchanged ? p : {
    ...p, status, complexity, readiness, primaryPlatform,
    checklist: clOk ? p.checklist : checklist,
    requiredAssets: raOk ? p.requiredAssets : requiredAssets,
    linkedRecommendationId: s(p.linkedRecommendationId),
    objective: s(p.objective), contentFormat: s(p.contentFormat), estimatedDuration: s(p.estimatedDuration),
    deliveryStyle: s(p.deliveryStyle), recordingEnvironment: s(p.recordingEnvironment), visualDirection: s(p.visualDirection),
    cameraRecommendation: s(p.cameraRecommendation), lightingNotes: s(p.lightingNotes), audioNotes: s(p.audioNotes),
    musicRecommendation: s(p.musicRecommendation), props: s(p.props), onScreenText: s(p.onScreenText),
    lowerThirdNotes: s(p.lowerThirdNotes), captionNotes: s(p.captionNotes), ctaPlacement: s(p.ctaPlacement),
    substackConnection: s(p.substackConnection), pmuConnection: s(p.pmuConnection), hrbsConnection: s(p.hrbsConnection),
    cautions: s(p.cautions), revisionNote: s(p.revisionNote),
    createdBy: p.createdBy && getChair(p.createdBy) ? p.createdBy : CHAIR_HEAD_OF_PRODUCTION,
  };
}
export function loadProduction(): ProductionReadiness[] {
  return loadCollection(PRODUCTION_KEY, isProductionReadiness).map(normalizeProductionReadiness);
}
export function saveProduction(list: ProductionReadiness[]): void { saveCollection(PRODUCTION_KEY, list); }
export function upsertProduction(existing: ProductionReadiness[], p: ProductionReadiness): ProductionReadiness[] {
  return [...existing.filter((x) => x.id !== p.id), p];
}
