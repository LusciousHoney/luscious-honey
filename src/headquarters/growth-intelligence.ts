/* =============================================================================
   GROWTH INTELLIGENCE — the Director of Growth's research desk (Sprint 13A /
   Council Phase III). The intake for external intelligence: opportunities the
   Growth Chair FINDS before the Founder asks. This is intelligence gathering —
   NOT publishing, NOT execution, NOT analytics automation.

   Doctrine preserved:
     • The Director of Growth captures ("I found this"), never self-assigns work.
     • The Chief of Staff reviews and prioritises (ignore / archive / research /
       recommend / route). Growth presents; the office disposes.
     • The Founder never reviews raw research — only curated opportunities, and
       only once the office has recommended them.

   Architecture: intelligence is its OWN upstream domain with its own store and a
   simple, guarded status — it is not a second copy of the recommendation
   lifecycle. When the office ROUTES an opportunity, it promotes into the existing
   recommendation store (the Executive Inbox) — the one operational store for
   executive WORK. Register-derived identities; no AI, no scraping, no API.
   --------------------------------------------------------------------------- */

import {
  STORAGE_ROOT, loadCollection, saveCollection, getChair, CHAIR_DIRECTOR_OF_GROWTH,
} from './executive-register.ts';
import { makeSubmission, upsertRecommendation, type Recommendation } from './chief-of-staff-ops.ts';

/* --- vocabulary ----------------------------------------------------------- */

export type IntelSource =
  | 'tiktok_search' | 'tiktok_trend' | 'tiktok_analytics' | 'tiktok_comments'
  | 'substack_analytics' | 'substack_notes'
  | 'pmu_analytics' | 'hrbs_analytics'
  | 'youtube' | 'instagram' | 'podcast' | 'article'
  | 'voice_note' | 'founder_idea' | 'other';

export interface IntelSourceKind { id: IntelSource; label: string; }
export const INTEL_SOURCES: IntelSourceKind[] = [
  { id: 'tiktok_search',     label: 'TikTok — Creator Search Insights' },
  { id: 'tiktok_trend',      label: 'TikTok — Trend Discovery' },
  { id: 'tiktok_analytics',  label: 'TikTok — Analytics' },
  { id: 'tiktok_comments',   label: 'TikTok — Comments' },
  { id: 'substack_analytics',label: 'Substack — Analytics' },
  { id: 'substack_notes',    label: 'Substack — Notes' },
  { id: 'pmu_analytics',     label: 'Pull Me Under — Analytics' },
  { id: 'hrbs_analytics',    label: 'HR Baddie Society — Analytics' },
  { id: 'youtube',           label: 'YouTube' },
  { id: 'instagram',         label: 'Instagram' },
  { id: 'podcast',           label: 'Podcast' },
  { id: 'article',           label: 'Article' },
  { id: 'voice_note',        label: 'Voice note' },
  { id: 'founder_idea',      label: 'Founder idea' },
  { id: 'other',             label: 'Other' },
];
const SOURCE_BY_ID = new Map(INTEL_SOURCES.map((s) => [s.id, s]));
export const DEFAULT_SOURCE: IntelSource = 'other';
export function intelSourceLabel(id: IntelSource): string { return SOURCE_BY_ID.get(id)?.label ?? id; }

export type IntelCategory =
  | 'search_opportunity' | 'trend' | 'audience_question' | 'underserved_topic'
  | 'content_gap' | 'creator_inspiration' | 'publication_idea' | 'other';

export interface IntelCategoryKind { id: IntelCategory; label: string; }
export const INTEL_CATEGORIES: IntelCategoryKind[] = [
  { id: 'search_opportunity',  label: 'Search opportunity' },
  { id: 'trend',               label: 'Trend' },
  { id: 'audience_question',   label: 'Recurring audience question' },
  { id: 'underserved_topic',   label: 'Underserved topic' },
  { id: 'content_gap',         label: 'Content gap' },
  { id: 'creator_inspiration', label: 'Creator inspiration' },
  { id: 'publication_idea',    label: 'Publication idea' },
  { id: 'other',               label: 'Other' },
];
const CATEGORY_BY_ID = new Map(INTEL_CATEGORIES.map((c) => [c.id, c]));
export const DEFAULT_CATEGORY: IntelCategory = 'other';
export function intelCategoryLabel(id: IntelCategory): string { return CATEGORY_BY_ID.get(id)?.label ?? id; }

export type IntelConfidence = 'low' | 'medium' | 'high';
export const INTEL_CONFIDENCES: { id: IntelConfidence; label: string; rank: number }[] = [
  { id: 'high',   label: 'High',   rank: 0 },
  { id: 'medium', label: 'Medium', rank: 1 },
  { id: 'low',    label: 'Low',    rank: 2 },
];
const CONFIDENCE_BY_ID = new Map(INTEL_CONFIDENCES.map((c) => [c.id, c]));
export const DEFAULT_CONFIDENCE: IntelConfidence = 'medium';
export function intelConfidenceLabel(id: IntelConfidence): string { return CONFIDENCE_BY_ID.get(id)?.label ?? id; }
function confidenceRank(id: IntelConfidence): number { return CONFIDENCE_BY_ID.get(id)?.rank ?? 9; }

/* The intelligence status — its own small, guarded lifecycle (NOT the recommendation
   lifecycle). Growth captures; the office reviews and disposes. */
export type IntelStatus =
  | 'captured'     // Growth found it; awaiting the office
  | 'under_review' // the office is looking at it
  | 'researching'  // the office asked Growth to dig deeper
  | 'recommended'  // curated — in the Founder-ready pipeline
  | 'routed'       // promoted into the Executive Inbox as work
  | 'archived'     // kept, but not now
  | 'dismissed';   // ignored

export interface IntelStatusKind { id: IntelStatus; label: string; open: boolean; }
export const INTEL_STATUSES: IntelStatusKind[] = [
  { id: 'captured',     label: 'Captured',      open: true  },
  { id: 'under_review', label: 'Under Review',  open: true  },
  { id: 'researching',  label: 'Researching',   open: true  },
  { id: 'recommended',  label: 'Recommended',   open: true  },
  { id: 'routed',       label: 'Routed to Work',open: false },
  { id: 'archived',     label: 'Archived',      open: false },
  { id: 'dismissed',    label: 'Dismissed',     open: false },
];
const STATUS_BY_ID = new Map(INTEL_STATUSES.map((s) => [s.id, s]));
export function intelStatusLabel(id: IntelStatus): string { return STATUS_BY_ID.get(id)?.label ?? id; }
export function isOpenIntel(id: IntelStatus): boolean { return !!STATUS_BY_ID.get(id)?.open; }

/** The office's prioritisation outcomes for a piece of intelligence. */
export type IntelReviewOutcome = 'ignore' | 'archive' | 'research' | 'recommend' | 'route';
export const INTEL_REVIEW_OUTCOMES: { id: IntelReviewOutcome; label: string; to: IntelStatus }[] = [
  { id: 'research',  label: 'Research further', to: 'researching' },
  { id: 'recommend', label: 'Recommend',        to: 'recommended' },
  { id: 'route',     label: 'Route to Work',    to: 'routed' },
  { id: 'archive',   label: 'Archive',          to: 'archived' },
  { id: 'ignore',    label: 'Ignore',           to: 'dismissed' },
];
const OUTCOME_BY_ID = new Map(INTEL_REVIEW_OUTCOMES.map((o) => [o.id, o]));
export function intelOutcomeLabel(id: IntelReviewOutcome): string { return OUTCOME_BY_ID.get(id)?.label ?? id; }

/* --- the record ----------------------------------------------------------- */

/** An attachment — a screenshot or file kept with the opportunity. Screenshots
    are held as data URLs so they survive locally without an upload service. */
export interface IntelAttachment { id: string; name: string; dataUrl?: string; }

/** The office's recorded review of a piece of intelligence. */
export interface IntelReview { outcome: IntelReviewOutcome; note?: string; decidedAt: string; }

/** A single opportunity captured by the Director of Growth. Deliberately roomy so
    it can grow (new sources, richer attachments) without a schema change. */
export interface IntelligenceItem {
  id: string;
  source: IntelSource;
  category: IntelCategory;
  title: string;
  summary: string;
  /** Why it matters — the Growth Chair's case for the Founder's attention. */
  whyItMatters: string;
  /** Who it is for. */
  audience: string;
  confidence: IntelConfidence;
  capturedAt: string;
  /** The Chair that found it (by Register id) — the Director of Growth by default. */
  capturedBy: string;
  links: string[];
  attachments: IntelAttachment[];
  notes: string;
  status: IntelStatus;
  /** The office's review, once it has prioritised this item. */
  review: IntelReview | null;
  /** The Executive Inbox record this was promoted into, when routed to work. */
  promotedRecommendationId?: string;
}

/* --- construction --------------------------------------------------------- */

export function makeIntelligenceItem(
  input: {
    id: string; title: string; summary: string;
    source?: IntelSource; category?: IntelCategory; confidence?: IntelConfidence;
    whyItMatters?: string; audience?: string; capturedBy?: string;
    links?: string[]; attachments?: IntelAttachment[]; notes?: string;
  },
  now: Date = new Date(),
): IntelligenceItem | null {
  if (!input.id || !input.title.trim() || !input.summary.trim()) return null;
  const by = input.capturedBy && getChair(input.capturedBy) ? input.capturedBy : CHAIR_DIRECTOR_OF_GROWTH;
  return {
    id: input.id,
    source: input.source && SOURCE_BY_ID.has(input.source) ? input.source : DEFAULT_SOURCE,
    category: input.category && CATEGORY_BY_ID.has(input.category) ? input.category : DEFAULT_CATEGORY,
    title: input.title.trim(),
    summary: input.summary.trim(),
    whyItMatters: (input.whyItMatters ?? '').trim(),
    audience: (input.audience ?? '').trim(),
    confidence: input.confidence && CONFIDENCE_BY_ID.has(input.confidence) ? input.confidence : DEFAULT_CONFIDENCE,
    capturedAt: now.toISOString(),
    capturedBy: by,
    links: sanitizeLinks(input.links),
    attachments: sanitizeAttachments(input.attachments),
    notes: (input.notes ?? '').trim(),
    status: 'captured',
    review: null,
  };
}

function sanitizeLinks(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((l): l is string => typeof l === 'string' && l.trim().length > 0).map((l) => l.trim());
}
function sanitizeAttachments(value: unknown): IntelAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.filter((a): a is IntelAttachment =>
    !!a && typeof a === 'object'
    && typeof (a as IntelAttachment).id === 'string'
    && typeof (a as IntelAttachment).name === 'string');
}

/* --- the office's review (prioritisation) --------------------------------- */

/** Only OPEN intelligence can be reviewed — a routed / archived / dismissed item
    is settled. Returns the item unchanged if it cannot be reviewed. */
export function canReviewIntel(item: IntelligenceItem): boolean {
  return isOpenIntel(item.status);
}

/** The office records a prioritisation decision. The Founder is never involved
    here — this is the Chief of Staff curating raw research. */
export function reviewIntelligence(
  item: IntelligenceItem, outcome: IntelReviewOutcome, note: string = '', now: Date = new Date(),
): IntelligenceItem {
  const o = OUTCOME_BY_ID.get(outcome);
  if (!o || !canReviewIntel(item)) return item;
  return {
    ...item,
    status: o.to,
    review: { outcome, note: note.trim() || undefined, decidedAt: now.toISOString() },
  };
}

/** Move a captured item into the office's active review (captured → under_review).
    A convenience the office uses when it picks an item up. */
export function beginIntelReview(item: IntelligenceItem): IntelligenceItem {
  if (item.status !== 'captured') return item;
  return { ...item, status: 'under_review' };
}

/** Record the Executive Inbox record an opportunity was promoted into, so the
    intelligence keeps a link to the work it became. */
export function linkPromotedRecommendation(item: IntelligenceItem, recommendationId: string): IntelligenceItem {
  return { ...item, promotedRecommendationId: recommendationId };
}

/** The stable, deterministic id of the recommendation an intelligence item promotes
    into — the same id every time, so promotion can never fork a record. */
export const PROMOTED_REC_PREFIX = 'rec_from_';
export function promotedRecommendationId(item: IntelligenceItem): string {
  return `${PROMOTED_REC_PREFIX}${item.id}`;
}

/** The pipeline seam: shape a routed opportunity as an Executive Inbox submission
    input. Carries the originating intelligence id so the created recommendation
    keeps a durable link back to its research provenance. */
export function intelligenceToSubmission(item: IntelligenceItem): {
  id: string; type: 'idea'; title: string; description: string; ownerChairId: string; originIntelId: string;
} {
  const why = item.whyItMatters ? `\n\nWhy it matters: ${item.whyItMatters}` : '';
  const src = `\n\nSource: ${intelSourceLabel(item.source)}`;
  return {
    id: promotedRecommendationId(item),
    type: 'idea',
    title: item.title,
    description: `${item.summary}${why}${src}`,
    ownerChairId: CHAIR_DIRECTOR_OF_GROWTH,
    originIntelId: item.id,
  };
}

/** Whether an opportunity may be routed to work — an open item that has not yet
    been promoted. An already-routed item is handled idempotently by the router. */
export function isRoutable(item: IntelligenceItem): boolean {
  return canReviewIntel(item) && item.status !== 'routed';
}

/** The result of routing an opportunity to work: the updated intelligence record,
    the recommendation store to persist, the resulting recommendation, and whether
    a NEW recommendation was created (false when the existing one was reused). */
export interface RouteToWorkResult {
  item: IntelligenceItem;
  recommendations: Recommendation[];
  recommendation: Recommendation | null;
  created: boolean;
}

/** Promote an opportunity into the Executive Inbox — the one store for executive
    WORK — with a durable, bidirectional provenance link. IDEMPOTENT: if this
    opportunity already promoted a recommendation (or one already exists at its
    stable id), the existing recommendation is reused, never duplicated. Routing
    fabricates no Founder approval — the created record enters the normal lifecycle
    at `preparing`, exactly like any other submission. */
export function routeIntelligenceToWork(
  item: IntelligenceItem, recommendations: Recommendation[], now: Date = new Date(),
): RouteToWorkResult {
  // Already promoted → return the existing recommendation, unchanged.
  const priorId = item.promotedRecommendationId ?? promotedRecommendationId(item);
  const existing = recommendations.find((r) => r.id === priorId) ?? null;
  if (existing) {
    const linked = item.status === 'routed' && item.promotedRecommendationId === existing.id
      ? item
      : linkPromotedRecommendation(reviewIntelligence(item, 'route', '', now), existing.id);
    return { item: linked, recommendations, recommendation: existing, created: false };
  }
  // Not yet eligible (settled and never promoted) → nothing to do.
  if (!canReviewIntel(item)) return { item, recommendations, recommendation: null, created: false };

  const routed = reviewIntelligence(item, 'route', '', now);
  const rec = makeSubmission(intelligenceToSubmission(routed), now);
  if (!rec) return { item: routed, recommendations, recommendation: null, created: false };
  const linked = linkPromotedRecommendation(routed, rec.id);
  return { item: linked, recommendations: upsertRecommendation(recommendations, rec), recommendation: rec, created: true };
}

/* --- derived views (pure) ------------------------------------------------- */

const CAPTURED_ORDER: IntelStatus[] = ['captured', 'under_review', 'researching'];

/** The office's intake queue — everything awaiting or in prioritisation, most
    confident and most recent first. Settled and recommended items are elsewhere. */
export function intelIntakeQueue(items: IntelligenceItem[]): IntelligenceItem[] {
  return items
    .filter((i) => CAPTURED_ORDER.includes(i.status))
    .sort((a, b) =>
      (CAPTURED_ORDER.indexOf(a.status) - CAPTURED_ORDER.indexOf(b.status))
      || (confidenceRank(a.confidence) - confidenceRank(b.confidence))
      || b.capturedAt.localeCompare(a.capturedAt));
}

/** Everything the Director of Growth has captured — the Chair's own research log,
    newest first. "I found this." */
export function growthCaptures(items: IntelligenceItem[]): IntelligenceItem[] {
  return [...items].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}

/** The Founder-ready pipeline — opportunities the office has RECOMMENDED. The
    foundation of what the Founder eventually sees (curated, never raw). */
export function founderReadyPipeline(items: IntelligenceItem[]): IntelligenceItem[] {
  return items
    .filter((i) => i.status === 'recommended')
    .sort((a, b) => (confidenceRank(a.confidence) - confidenceRank(b.confidence)) || b.capturedAt.localeCompare(a.capturedAt));
}

export interface IntelStanding {
  captured: number; underReview: number; researching: number;
  recommended: number; routed: number; archived: number; dismissed: number; total: number;
}
export function intelStanding(items: IntelligenceItem[]): IntelStanding {
  const n = (s: IntelStatus): number => items.filter((i) => i.status === s).length;
  return {
    captured: n('captured'), underReview: n('under_review'), researching: n('researching'),
    recommended: n('recommended'), routed: n('routed'), archived: n('archived'), dismissed: n('dismissed'),
    total: items.length,
  };
}

/* --- storage -------------------------------------------------------------- */

export const INTELLIGENCE_KEY = `${STORAGE_ROOT}.growth-intel.v1`;

export function isIntelligenceItem(x: unknown): x is IntelligenceItem {
  const o = x as IntelligenceItem;
  return !!o && typeof o === 'object'
    && typeof o.id === 'string' && typeof o.title === 'string' && typeof o.summary === 'string'
    && typeof o.capturedAt === 'string' && typeof o.status === 'string';
}

/** Fill and sanitise a stored record — honest defaults, dropped bad enums, so an
    early or hand-edited record stays valid without a migration. */
export function normalizeIntelligenceItem(item: IntelligenceItem): IntelligenceItem {
  const source = SOURCE_BY_ID.has(item.source) ? item.source : DEFAULT_SOURCE;
  const category = CATEGORY_BY_ID.has(item.category) ? item.category : DEFAULT_CATEGORY;
  const confidence = CONFIDENCE_BY_ID.has(item.confidence) ? item.confidence : DEFAULT_CONFIDENCE;
  const status = STATUS_BY_ID.has(item.status) ? item.status : 'captured';
  const capturedBy = item.capturedBy && getChair(item.capturedBy) ? item.capturedBy : CHAIR_DIRECTOR_OF_GROWTH;
  // Preserve the array reference when it is already clean, so a well-formed record
  // passes through unchanged (the fast-path below).
  const linksOk = Array.isArray(item.links) && sanitizeLinks(item.links).length === item.links.length;
  const links = linksOk ? item.links : sanitizeLinks(item.links);
  const attOk = Array.isArray(item.attachments) && sanitizeAttachments(item.attachments).length === item.attachments.length;
  const attachments = attOk ? item.attachments : sanitizeAttachments(item.attachments);
  const whyItMatters = item.whyItMatters ?? '';
  const audience = item.audience ?? '';
  const notes = item.notes ?? '';
  const review = item.review ?? null;
  const unchanged = item.source === source && item.category === category && item.confidence === confidence
    && item.status === status && item.capturedBy === capturedBy
    && item.links === links && item.attachments === attachments
    && item.whyItMatters === whyItMatters && item.audience === audience && item.notes === notes
    && item.review === review;
  return unchanged ? item : {
    ...item, source, category, confidence, status, capturedBy, links, attachments,
    whyItMatters, audience, notes, review,
  };
}

export function loadIntelligence(): IntelligenceItem[] {
  return loadCollection(INTELLIGENCE_KEY, isIntelligenceItem).map(normalizeIntelligenceItem);
}
export function saveIntelligence(items: IntelligenceItem[]): void {
  saveCollection(INTELLIGENCE_KEY, items);
}
export function upsertIntelligence(existing: IntelligenceItem[], item: IntelligenceItem): IntelligenceItem[] {
  return [...existing.filter((i) => i.id !== item.id), item];
}

/** A Register-derived label for the capturing Chair. */
export function capturedByLabel(item: IntelligenceItem): string {
  return getChair(item.capturedBy)?.title ?? item.capturedBy;
}
