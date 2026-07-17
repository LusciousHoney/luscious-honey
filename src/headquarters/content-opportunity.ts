/* =============================================================================
   CONTENT OPPORTUNITY BRIEF — Growth Intelligence's analysis layer (Sprint 13B /
   Council Phase III). The Director of Growth turns a captured intelligence item
   into a structured, ranked CONTENT OPPORTUNITY: which property it belongs to,
   what audience need it answers, what to make, how timely it is, and what should
   happen next. The office prioritises the brief; the Founder sees a concise,
   executive-level projection.

   This is ANALYSIS, not execution. A brief is an annotation layer LINKED to an
   intelligence record (never a copy). Routing a brief promotes it into the ONE
   recommendation store — the authoritative execution record — with durable,
   bidirectional provenance across intelligence → opportunity → recommendation.

   No AI scoring, no platform integration, no publishing, no second Council/
   Register/execution lifecycle. Scoring is transparent and derived from explicit,
   Growth-set signals — it never predicts exact views, virality, or revenue.
   --------------------------------------------------------------------------- */

import {
  STORAGE_ROOT, loadCollection, saveCollection, getChair, CHAIR_DIRECTOR_OF_GROWTH,
} from './executive-register.ts';
import { makeSubmission, upsertRecommendation, type Recommendation } from './chief-of-staff-ops.ts';
import { intelSourceLabel, isOpenIntel, type IntelligenceItem } from './growth-intelligence.ts';

/* --- content properties (centralised, extensible) ------------------------- */

export type ContentProperty =
  | 'pull_me_under' | 'hr_baddie_society' | 'founder_platform'
  | 'luscious_honey_collective' | 'general_author';

export interface ContentPropertyKind { id: ContentProperty; label: string; }
export const CONTENT_PROPERTIES: ContentPropertyKind[] = [
  { id: 'pull_me_under',            label: 'Pull Me Under' },
  { id: 'hr_baddie_society',        label: 'HR Baddie Society' },
  { id: 'founder_platform',         label: 'Luscious Honey / Founder platform' },
  { id: 'luscious_honey_collective',label: 'Luscious Honey Collective' },
  { id: 'general_author',           label: 'General author platform' },
];
const PROPERTY_BY_ID = new Map(CONTENT_PROPERTIES.map((p) => [p.id, p]));
export function contentPropertyLabel(id: ContentProperty): string { return PROPERTY_BY_ID.get(id)?.label ?? id; }
function sanitizeProperties(value: unknown): ContentProperty[] {
  if (!Array.isArray(value)) return [];
  return value.filter((p): p is ContentProperty => typeof p === 'string' && PROPERTY_BY_ID.has(p as ContentProperty));
}

/* --- opportunity types (strategic outcomes, not publishing) --------------- */

export type OpportunityType =
  | 'tiktok_short' | 'tiktok_live' | 'tiktok_series'
  | 'substack_note' | 'substack_essay' | 'podcast_audio'
  | 'pmu_promo' | 'hr_educational' | 'thought_leadership' | 'cross_platform_campaign';

export interface OpportunityTypeKind { id: OpportunityType; label: string; }
export const OPPORTUNITY_TYPES: OpportunityTypeKind[] = [
  { id: 'tiktok_short',           label: 'TikTok — short-form video' },
  { id: 'tiktok_live',            label: 'TikTok LIVE — topic' },
  { id: 'tiktok_series',          label: 'TikTok — series' },
  { id: 'substack_note',          label: 'Substack — Note' },
  { id: 'substack_essay',         label: 'Substack — essay' },
  { id: 'podcast_audio',          label: 'Podcast / audio post' },
  { id: 'pmu_promo',              label: 'Pull Me Under — promotional' },
  { id: 'hr_educational',         label: 'HR — educational' },
  { id: 'thought_leadership',     label: 'Thought leadership' },
  { id: 'cross_platform_campaign',label: 'Cross-platform campaign' },
];
const TYPE_BY_ID = new Map(OPPORTUNITY_TYPES.map((t) => [t.id, t]));
export function opportunityTypeLabel(id: OpportunityType): string { return TYPE_BY_ID.get(id)?.label ?? id; }
function sanitizeTypes(value: unknown): OpportunityType[] {
  if (!Array.isArray(value)) return [];
  return value.filter((t): t is OpportunityType => typeof t === 'string' && TYPE_BY_ID.has(t as OpportunityType));
}

/* --- ratings & transparent scoring ---------------------------------------- */

export type Rating = 'low' | 'medium' | 'high';
export const RATINGS: { id: Rating; label: string; points: number }[] = [
  { id: 'high',   label: 'High',   points: 3 },
  { id: 'medium', label: 'Medium', points: 2 },
  { id: 'low',    label: 'Low',    points: 1 },
];
const RATING_BY_ID = new Map(RATINGS.map((r) => [r.id, r]));
export function ratingLabel(id: Rating): string { return RATING_BY_ID.get(id)?.label ?? id; }
function ratingPoints(id: Rating): number { return RATING_BY_ID.get(id)?.points ?? 0; }

/** The Growth-set signals a brief is scored from — explicit, never inferred. For
    `effort`, LOW is better (less work), so it is inverted in the score. */
export interface OpportunitySignals {
  timeliness: Rating;
  audienceRelevance: Rating;
  propertyFit: Rating;       // brand / property fit
  founderFit: Rating;        // Founder voice fit
  contentPotential: Rating;
  conversionPotential: Rating;
  effort: Rating;            // inverted: low effort scores higher
}
export interface ScoreDimension { id: keyof OpportunitySignals; label: string; weight: number; invert?: boolean; }
export const SCORE_DIMENSIONS: ScoreDimension[] = [
  { id: 'timeliness',          label: 'Timeliness',          weight: 2 },
  { id: 'audienceRelevance',   label: 'Audience relevance',  weight: 2 },
  { id: 'propertyFit',         label: 'Property fit',        weight: 2 },
  { id: 'founderFit',          label: 'Founder voice fit',   weight: 2 },
  { id: 'contentPotential',    label: 'Content potential',   weight: 1 },
  { id: 'conversionPotential', label: 'Conversion potential',weight: 1 },
  { id: 'effort',              label: 'Effort',              weight: 1, invert: true },
];
export const DEFAULT_SIGNALS: OpportunitySignals = {
  timeliness: 'medium', audienceRelevance: 'medium', propertyFit: 'medium',
  founderFit: 'medium', contentPotential: 'medium', conversionPotential: 'medium', effort: 'medium',
};

export interface ScoreFactor { id: keyof OpportunitySignals; label: string; rating: Rating; points: number; weight: number; note: string; }
export interface OpportunityScore {
  /** 0–100, normalised from the weighted signal points. A relative strength — NOT
      a prediction of views, virality, or revenue. */
  score: number;
  band: string;
  factors: ScoreFactor[];
  caution?: string;
}

const EFFORT_NOTE: Record<Rating, string> = { low: 'quick to make', medium: 'moderate effort', high: 'heavy lift' };
function factorNote(dim: ScoreDimension, rating: Rating): string {
  if (dim.invert) return EFFORT_NOTE[rating];
  return rating === 'high' ? 'a strong signal' : rating === 'medium' ? 'a moderate signal' : 'a weak signal';
}

/** Compute a transparent score from the brief's explicit signals and confidence.
    Every point is traceable to a Growth-set rating; the band uses honest, hedged
    language and never claims guaranteed performance. */
export function scoreOpportunity(signals: OpportunitySignals, confidence: Rating): OpportunityScore {
  const factors: ScoreFactor[] = SCORE_DIMENSIONS.map((dim) => {
    const rating = signals[dim.id];
    const raw = ratingPoints(rating);
    const points = dim.invert ? (4 - raw) : raw; // invert effort: low(1)->3, high(3)->1
    return { id: dim.id, label: dim.label, rating, points, weight: dim.weight, note: factorNote(dim, rating) };
  });
  const earned = factors.reduce((s, f) => s + f.points * f.weight, 0);
  const max = SCORE_DIMENSIONS.reduce((s, d) => s + 3 * d.weight, 0);
  const score = Math.round((earned / max) * 100);

  // Honest, hedged band language — a fit, not a forecast.
  let band: string;
  if (confidence === 'low') band = 'Low-confidence signal';
  else if (score >= 78) band = 'Strong fit';
  else if (score >= 60) band = 'Promising';
  else if (score >= 42) band = 'Worth watching';
  else band = 'Needs more research';

  const caution = confidence === 'low'
    ? 'A low-confidence signal — worth more research before committing.'
    : (signals.timeliness === 'high' && score >= 60 ? 'Timely — the moment may pass.' : undefined);

  return { score, band, factors, caution };
}

/* --- the opportunity record ----------------------------------------------- */

export type OpportunityStatus =
  | 'draft' | 'analyzing' | 'ready_for_review' | 'recommended' | 'held' | 'declined' | 'routed_to_work';

export interface OpportunityStatusKind { id: OpportunityStatus; label: string; open: boolean; }
export const OPPORTUNITY_STATUSES: OpportunityStatusKind[] = [
  { id: 'draft',            label: 'Draft',            open: true  },
  { id: 'analyzing',        label: 'Analyzing',        open: true  },
  { id: 'ready_for_review', label: 'Ready for Review', open: true  },
  { id: 'recommended',      label: 'Recommended',      open: true  },
  { id: 'held',             label: 'Held',             open: false },
  { id: 'declined',         label: 'Declined',         open: false },
  { id: 'routed_to_work',   label: 'Routed to Work',   open: false },
];
const OPP_STATUS_BY_ID = new Map(OPPORTUNITY_STATUSES.map((s) => [s.id, s]));
export function opportunityStatusLabel(id: OpportunityStatus): string { return OPP_STATUS_BY_ID.get(id)?.label ?? id; }
export function isOpenOpportunity(id: OpportunityStatus): boolean { return !!OPP_STATUS_BY_ID.get(id)?.open; }

export interface ContentOpportunity {
  id: string;
  /** The intelligence record this brief analyses — a durable link, never a copy. */
  intelId: string;
  title: string;
  summary: string;
  properties: ContentProperty[];
  audience: string;
  audienceNeed: string;
  angle: string;             // recommended content angle
  pillar: string;            // content pillar (free text)
  types: OpportunityType[];  // suggested formats
  signals: OpportunitySignals;
  confidence: Rating;
  recommendation: string;    // Growth's recommendation
  risks: string;
  evidence: string;          // supporting evidence
  nextAction: string;        // proposed next action
  status: OpportunityStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  /** The recommendation this brief was routed into, when promoted to work. */
  promotedRecommendationId?: string;
}

/* --- construction --------------------------------------------------------- */

export function makeContentOpportunity(
  input: {
    id: string; intelId: string; title: string; summary?: string;
    properties?: ContentProperty[]; audience?: string; audienceNeed?: string;
    angle?: string; pillar?: string; types?: OpportunityType[];
    signals?: Partial<OpportunitySignals>; confidence?: Rating;
    recommendation?: string; risks?: string; evidence?: string; nextAction?: string;
    createdBy?: string;
  },
  now: Date = new Date(),
): ContentOpportunity | null {
  if (!input.id || !input.intelId || !input.title.trim()) return null;
  const by = input.createdBy && getChair(input.createdBy) ? input.createdBy : CHAIR_DIRECTOR_OF_GROWTH;
  const ts = now.toISOString();
  return {
    id: input.id,
    intelId: input.intelId,
    title: input.title.trim(),
    summary: (input.summary ?? '').trim(),
    properties: sanitizeProperties(input.properties),
    audience: (input.audience ?? '').trim(),
    audienceNeed: (input.audienceNeed ?? '').trim(),
    angle: (input.angle ?? '').trim(),
    pillar: (input.pillar ?? '').trim(),
    types: sanitizeTypes(input.types),
    signals: normalizeSignals(input.signals),
    confidence: input.confidence && RATING_BY_ID.has(input.confidence) ? input.confidence : 'medium',
    recommendation: (input.recommendation ?? '').trim(),
    risks: (input.risks ?? '').trim(),
    evidence: (input.evidence ?? '').trim(),
    nextAction: (input.nextAction ?? '').trim(),
    status: 'draft',
    createdAt: ts,
    updatedAt: ts,
    createdBy: by,
  };
}

function normalizeSignals(partial: Partial<OpportunitySignals> | undefined): OpportunitySignals {
  const s = { ...DEFAULT_SIGNALS };
  if (partial) for (const dim of SCORE_DIMENSIONS) {
    const v = partial[dim.id];
    if (v && RATING_BY_ID.has(v)) s[dim.id] = v;
  }
  return s;
}

/** Whether an intelligence item may become a brief — an open (unsettled) item. */
export function isIntelEligibleForBrief(item: IntelligenceItem): boolean {
  return isOpenIntel(item.status);
}

/* --- editing & lifecycle (analysis/prioritisation only) ------------------- */

/** Apply a partial edit to a draft/analysis brief, bumping updatedAt. */
export function updateOpportunity(opp: ContentOpportunity, patch: Partial<Pick<ContentOpportunity,
  'title' | 'summary' | 'properties' | 'audience' | 'audienceNeed' | 'angle' | 'pillar' | 'types'
  | 'signals' | 'confidence' | 'recommendation' | 'risks' | 'evidence' | 'nextAction'>>, now: Date = new Date()): ContentOpportunity {
  return {
    ...opp,
    ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
    ...(patch.summary !== undefined ? { summary: patch.summary.trim() } : {}),
    ...(patch.properties !== undefined ? { properties: sanitizeProperties(patch.properties) } : {}),
    ...(patch.audience !== undefined ? { audience: patch.audience.trim() } : {}),
    ...(patch.audienceNeed !== undefined ? { audienceNeed: patch.audienceNeed.trim() } : {}),
    ...(patch.angle !== undefined ? { angle: patch.angle.trim() } : {}),
    ...(patch.pillar !== undefined ? { pillar: patch.pillar.trim() } : {}),
    ...(patch.types !== undefined ? { types: sanitizeTypes(patch.types) } : {}),
    ...(patch.signals !== undefined ? { signals: normalizeSignals(patch.signals) } : {}),
    ...(patch.confidence !== undefined && RATING_BY_ID.has(patch.confidence) ? { confidence: patch.confidence } : {}),
    ...(patch.recommendation !== undefined ? { recommendation: patch.recommendation.trim() } : {}),
    ...(patch.risks !== undefined ? { risks: patch.risks.trim() } : {}),
    ...(patch.evidence !== undefined ? { evidence: patch.evidence.trim() } : {}),
    ...(patch.nextAction !== undefined ? { nextAction: patch.nextAction.trim() } : {}),
    updatedAt: now.toISOString(),
  };
}

const OPP_STATUS_TRANSITIONS: Record<OpportunityStatus, OpportunityStatus[]> = {
  draft:            ['analyzing', 'ready_for_review', 'held', 'declined'],
  analyzing:        ['ready_for_review', 'draft', 'held', 'declined'],
  ready_for_review: ['recommended', 'held', 'declined', 'analyzing', 'routed_to_work'],
  recommended:      ['routed_to_work', 'held', 'declined', 'ready_for_review'],
  held:             ['ready_for_review', 'analyzing', 'declined'],
  declined:         [],
  routed_to_work:   [],
};
export function canAdvanceOpportunity(from: OpportunityStatus, to: OpportunityStatus): boolean {
  return (OPP_STATUS_TRANSITIONS[from] ?? []).includes(to);
}
export function setOpportunityStatus(opp: ContentOpportunity, to: OpportunityStatus, now: Date = new Date()): ContentOpportunity {
  if (!canAdvanceOpportunity(opp.status, to)) return opp;
  return { ...opp, status: to, updatedAt: now.toISOString() };
}
export const markReadyForReview = (opp: ContentOpportunity, now?: Date): ContentOpportunity => setOpportunityStatus(opp, 'ready_for_review', now);
export const recommendOpportunity = (opp: ContentOpportunity, now?: Date): ContentOpportunity => setOpportunityStatus(opp, 'recommended', now);
export const returnOpportunityForResearch = (opp: ContentOpportunity, now?: Date): ContentOpportunity => setOpportunityStatus(opp, 'analyzing', now);
export const holdOpportunity = (opp: ContentOpportunity, now?: Date): ContentOpportunity => setOpportunityStatus(opp, 'held', now);
export const declineOpportunity = (opp: ContentOpportunity, now?: Date): ContentOpportunity => setOpportunityStatus(opp, 'declined', now);

/* --- the Founder-ready projection ----------------------------------------- */

export interface FounderBrief {
  found: string; whyNow: string; where: string; who: string;
  recommended: string; formats: string[]; reason: string; decision: string;
}
/** A concise, executive-level projection — what the Founder sees. No raw research,
    no scoring forms; a clear decision request. */
export function founderBrief(opp: ContentOpportunity): FounderBrief {
  return {
    found: opp.summary || opp.title,
    whyNow: opp.signals.timeliness === 'high' ? 'Timely — a rising moment.' : (opp.audienceNeed || 'A steady audience need.'),
    where: opp.properties.map(contentPropertyLabel).join(', ') || 'Not yet assigned',
    who: opp.audience || 'Not yet specified',
    recommended: opp.angle || opp.recommendation || opp.title,
    formats: opp.types.map(opportunityTypeLabel),
    reason: opp.recommendation || 'A strong strategic fit for the House.',
    decision: opp.nextAction || 'Approve to route this into work.',
  };
}

/* --- routing to work (idempotent, bidirectional provenance) --------------- */

export const OPP_PROMOTED_REC_PREFIX = 'rec_from_opp_';
export function opportunityRecommendationId(opp: ContentOpportunity): string {
  return `${OPP_PROMOTED_REC_PREFIX}${opp.id}`;
}

/** Whether a brief may be routed to work — reviewed and not yet promoted. */
export function isOpportunityRoutable(opp: ContentOpportunity): boolean {
  return (opp.status === 'ready_for_review' || opp.status === 'recommended') && !opp.promotedRecommendationId;
}

export interface OpportunityRouteResult {
  opportunity: ContentOpportunity;
  recommendations: Recommendation[];
  recommendation: Recommendation | null;
  created: boolean;
}

/** Promote a brief into the Executive Inbox — the one store for executive WORK —
    carrying BOTH the originating intelligence id and the opportunity id so the full
    chain intelligence → opportunity → recommendation stays traceable. Idempotent:
    an already-routed brief (or an existing record at its stable id) is reused, never
    duplicated, and downstream work is never overwritten. Fabricates no Founder
    approval — the record enters the normal lifecycle at `preparing`. */
export function routeOpportunityToWork(
  opp: ContentOpportunity, recommendations: Recommendation[], now: Date = new Date(),
): OpportunityRouteResult {
  const priorId = opp.promotedRecommendationId ?? opportunityRecommendationId(opp);
  const existing = recommendations.find((r) => r.id === priorId) ?? null;
  if (existing) {
    const linked = opp.status === 'routed_to_work' && opp.promotedRecommendationId === existing.id
      ? opp
      : { ...opp, status: 'routed_to_work' as OpportunityStatus, promotedRecommendationId: existing.id, updatedAt: now.toISOString() };
    return { opportunity: linked, recommendations, recommendation: existing, created: false };
  }
  if (!isOpportunityRoutable(opp)) return { opportunity: opp, recommendations, recommendation: null, created: false };

  const rec = makeSubmission({
    id: opportunityRecommendationId(opp),
    type: 'idea',
    title: opp.title,
    description: opportunityDescription(opp),
    ownerChairId: CHAIR_DIRECTOR_OF_GROWTH,
    originIntelId: opp.intelId,
    originOpportunityId: opp.id,
  }, now);
  if (!rec) return { opportunity: opp, recommendations, recommendation: null, created: false };
  const linked: ContentOpportunity = { ...opp, status: 'routed_to_work', promotedRecommendationId: rec.id, updatedAt: now.toISOString() };
  return { opportunity: linked, recommendations: upsertRecommendation(recommendations, rec), recommendation: rec, created: true };
}

function opportunityDescription(opp: ContentOpportunity): string {
  const parts = [opp.summary || opp.title];
  if (opp.angle) parts.push(`Angle: ${opp.angle}`);
  if (opp.properties.length) parts.push(`Property: ${opp.properties.map(contentPropertyLabel).join(', ')}`);
  if (opp.types.length) parts.push(`Formats: ${opp.types.map(opportunityTypeLabel).join(', ')}`);
  if (opp.recommendation) parts.push(`Why: ${opp.recommendation}`);
  return parts.filter(Boolean).join('\n\n');
}

/* --- derived views (pure) ------------------------------------------------- */

export function opportunitiesForIntel(intelId: string, opps: ContentOpportunity[]): ContentOpportunity[] {
  return opps.filter((o) => o.intelId === intelId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function draftOpportunities(opps: ContentOpportunity[]): ContentOpportunity[] {
  return opps.filter((o) => o.status === 'draft' || o.status === 'analyzing').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
/** Briefs the office should review, best-scoring first. */
export function opportunitiesForReview(opps: ContentOpportunity[]): ContentOpportunity[] {
  return opps
    .filter((o) => o.status === 'ready_for_review')
    .sort((a, b) => scoreOpportunity(b.signals, b.confidence).score - scoreOpportunity(a.signals, a.confidence).score
      || b.updatedAt.localeCompare(a.updatedAt));
}
/** Recommended briefs — the Founder-ready set. */
export function founderReadyOpportunities(opps: ContentOpportunity[]): ContentOpportunity[] {
  return opps
    .filter((o) => o.status === 'recommended')
    .sort((a, b) => scoreOpportunity(b.signals, b.confidence).score - scoreOpportunity(a.signals, a.confidence).score);
}

export interface OpportunityStanding {
  draft: number; analyzing: number; readyForReview: number; recommended: number;
  held: number; declined: number; routed: number; total: number;
}
export function opportunityStanding(opps: ContentOpportunity[]): OpportunityStanding {
  const n = (s: OpportunityStatus): number => opps.filter((o) => o.status === s).length;
  return {
    draft: n('draft'), analyzing: n('analyzing'), readyForReview: n('ready_for_review'),
    recommended: n('recommended'), held: n('held'), declined: n('declined'), routed: n('routed_to_work'),
    total: opps.length,
  };
}

/** A Register-derived label for the brief's author. */
export function opportunityAuthorLabel(opp: ContentOpportunity): string {
  return getChair(opp.createdBy)?.title ?? opp.createdBy;
}
/** The originating source, when the intelligence record is on hand. */
export function opportunitySourceLabel(intel: IntelligenceItem | null): string {
  return intel ? intelSourceLabel(intel.source) : 'Unknown source';
}

/* --- storage -------------------------------------------------------------- */

export const OPPORTUNITY_KEY = `${STORAGE_ROOT}.content-opportunities.v1`;

export function isContentOpportunity(x: unknown): x is ContentOpportunity {
  const o = x as ContentOpportunity;
  return !!o && typeof o === 'object'
    && typeof o.id === 'string' && typeof o.intelId === 'string' && typeof o.title === 'string'
    && typeof o.status === 'string' && typeof o.createdAt === 'string';
}

export function normalizeContentOpportunity(opp: ContentOpportunity): ContentOpportunity {
  const status = OPP_STATUS_BY_ID.has(opp.status) ? opp.status : 'draft';
  const confidence = RATING_BY_ID.has(opp.confidence) ? opp.confidence : 'medium';
  const properties = sanitizeProperties(opp.properties);
  const types = sanitizeTypes(opp.types);
  const signals = normalizeSignals(opp.signals);
  const propsOk = Array.isArray(opp.properties) && properties.length === opp.properties.length;
  const typesOk = Array.isArray(opp.types) && types.length === opp.types.length;
  const signalsClean = SCORE_DIMENSIONS.every((d) => opp.signals && RATING_BY_ID.has(opp.signals[d.id]));
  const unchanged = opp.status === status && opp.confidence === confidence
    && propsOk && typesOk && signalsClean;
  return unchanged ? opp : {
    ...opp, status, confidence,
    properties: propsOk ? opp.properties : properties,
    types: typesOk ? opp.types : types,
    signals: signalsClean ? opp.signals : signals,
    summary: opp.summary ?? '', audience: opp.audience ?? '', audienceNeed: opp.audienceNeed ?? '',
    angle: opp.angle ?? '', pillar: opp.pillar ?? '', recommendation: opp.recommendation ?? '',
    risks: opp.risks ?? '', evidence: opp.evidence ?? '', nextAction: opp.nextAction ?? '',
    createdBy: opp.createdBy && getChair(opp.createdBy) ? opp.createdBy : CHAIR_DIRECTOR_OF_GROWTH,
  };
}

export function loadOpportunities(): ContentOpportunity[] {
  return loadCollection(OPPORTUNITY_KEY, isContentOpportunity).map(normalizeContentOpportunity);
}
export function saveOpportunities(opps: ContentOpportunity[]): void {
  saveCollection(OPPORTUNITY_KEY, opps);
}
export function upsertOpportunity(existing: ContentOpportunity[], opp: ContentOpportunity): ContentOpportunity[] {
  return [...existing.filter((o) => o.id !== opp.id), opp];
}
