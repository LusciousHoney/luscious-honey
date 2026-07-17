/* =============================================================================
   CREATIVE ASSIGNMENT PACK — the Creative Director's planning layer (Sprint 13C /
   Council Phase III). Converts an approved Content Opportunity brief into a
   practical creative assignment: what to make, the hook, the message, the
   platform, and the cross-property strategy — enough for Creative to begin and
   for the Founder to approve.

   This is PLANNING, not execution. An assignment is an annotation layer LINKED to
   an opportunity (which is linked to intelligence) — never a copy. Routing an
   assignment promotes it into the ONE recommendation store with durable,
   bidirectional provenance across the full chain:
     intelligence → opportunity → assignment → recommendation.

   No AI-generated hooks or scripts, no full articles or shot lists, no platform
   integration, no publishing/scheduling, no second Council/Register/execution
   lifecycle. Register-derived Creative identity; scoring is not this layer's job.
   --------------------------------------------------------------------------- */

import {
  STORAGE_ROOT, loadCollection, saveCollection, getChair, CHAIR_CREATIVE_DIRECTOR,
} from './executive-register.ts';
import { makeSubmission, upsertRecommendation, type Recommendation } from './chief-of-staff-ops.ts';
import {
  CONTENT_PROPERTIES, contentPropertyLabel, type ContentProperty, type ContentOpportunity,
} from './content-opportunity.ts';

/* --- vocabulary ----------------------------------------------------------- */

export type ContentPlatform =
  | 'tiktok' | 'tiktok_live' | 'substack' | 'podcast' | 'pull_me_under' | 'hr_baddie_society';
export interface ContentPlatformKind { id: ContentPlatform; label: string; }
export const CONTENT_PLATFORMS: ContentPlatformKind[] = [
  { id: 'tiktok',           label: 'TikTok' },
  { id: 'tiktok_live',      label: 'TikTok LIVE' },
  { id: 'substack',         label: 'Substack' },
  { id: 'podcast',          label: 'Podcast / audio' },
  { id: 'pull_me_under',    label: 'Pull Me Under' },
  { id: 'hr_baddie_society',label: 'HR Baddie Society' },
];
const PLATFORM_BY_ID = new Map(CONTENT_PLATFORMS.map((p) => [p.id, p]));
export function contentPlatformLabel(id: ContentPlatform | ''): string { return id ? (PLATFORM_BY_ID.get(id)?.label ?? id) : 'Not set'; }
function validPlatform(v: unknown): v is ContentPlatform { return typeof v === 'string' && PLATFORM_BY_ID.has(v as ContentPlatform); }

export type TikTokFormat = 'direct_to_camera' | 'voiceover' | 'storytime' | 'commentary' | 'tiktok_live' | 'series';
export const TIKTOK_FORMATS: { id: TikTokFormat; label: string }[] = [
  { id: 'direct_to_camera', label: 'Direct to camera' },
  { id: 'voiceover',        label: 'Voiceover' },
  { id: 'storytime',        label: 'Storytime' },
  { id: 'commentary',       label: 'Commentary' },
  { id: 'tiktok_live',      label: 'TikTok LIVE' },
  { id: 'series',           label: 'Series' },
];
const TIKTOK_FORMAT_BY_ID = new Map(TIKTOK_FORMATS.map((t) => [t.id, t]));
export function tiktokFormatLabel(id: TikTokFormat | ''): string { return id ? (TIKTOK_FORMAT_BY_ID.get(id)?.label ?? id) : 'Not set'; }

export type SubstackKind = 'note' | 'essay' | 'podcast' | 'supporting' | 'none';
export const SUBSTACK_KINDS: { id: SubstackKind; label: string }[] = [
  { id: 'none',       label: 'Not for Substack' },
  { id: 'note',       label: 'Substack Note' },
  { id: 'essay',      label: 'Substack essay' },
  { id: 'podcast',    label: 'Podcast / audio post' },
  { id: 'supporting', label: 'Supporting material only' },
];
const SUBSTACK_KIND_BY_ID = new Map(SUBSTACK_KINDS.map((s) => [s.id, s]));
export function substackKindLabel(id: SubstackKind): string { return SUBSTACK_KIND_BY_ID.get(id)?.label ?? id; }

export type Complexity = 'low' | 'medium' | 'high';
export const COMPLEXITIES: { id: Complexity; label: string }[] = [
  { id: 'low', label: 'Low' }, { id: 'medium', label: 'Medium' }, { id: 'high', label: 'High' },
];
const COMPLEXITY_BY_ID = new Map(COMPLEXITIES.map((c) => [c.id, c]));
export function complexityLabel(id: Complexity): string { return COMPLEXITY_BY_ID.get(id)?.label ?? id; }

export type AssignmentStatus =
  | 'draft' | 'in_development' | 'ready_for_review' | 'returned_for_revision'
  | 'approved' | 'held' | 'declined' | 'routed_to_work';
export interface AssignmentStatusKind { id: AssignmentStatus; label: string; open: boolean; }
export const ASSIGNMENT_STATUSES: AssignmentStatusKind[] = [
  { id: 'draft',                 label: 'Draft',                 open: true  },
  { id: 'in_development',        label: 'In Development',        open: true  },
  { id: 'ready_for_review',      label: 'Ready for Review',      open: true  },
  { id: 'returned_for_revision', label: 'Returned for Revision', open: true  },
  { id: 'approved',              label: 'Approved',              open: true  },
  { id: 'held',                  label: 'Held',                  open: false },
  { id: 'declined',              label: 'Declined',              open: false },
  { id: 'routed_to_work',        label: 'Routed to Work',        open: false },
];
const ASN_STATUS_BY_ID = new Map(ASSIGNMENT_STATUSES.map((s) => [s.id, s]));
export function assignmentStatusLabel(id: AssignmentStatus): string { return ASN_STATUS_BY_ID.get(id)?.label ?? id; }
export function isOpenAssignment(id: AssignmentStatus): boolean { return !!ASN_STATUS_BY_ID.get(id)?.open; }

function sanitizeProperties(value: unknown): ContentProperty[] {
  if (!Array.isArray(value)) return [];
  const ok = new Set(CONTENT_PROPERTIES.map((p) => p.id));
  return value.filter((p): p is ContentProperty => typeof p === 'string' && ok.has(p as ContentProperty));
}
function sanitizeStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim());
}

/* --- the assignment record ------------------------------------------------ */

export interface CreativeAssignment {
  id: string;
  originOpportunityId: string;
  originIntelId: string;
  title: string;
  properties: ContentProperty[];
  primaryPlatform: ContentPlatform | '';
  secondaryPlatform: ContentPlatform | '';
  objective: string;
  targetAudience: string;
  audienceNeed: string;
  centralIdea: string;
  creativeAngle: string;
  founderPov: string;
  hook: string;
  firstSentence: string;
  coreMessage: string;
  talkingPoints: string[];
  tone: string;
  voiceGuidance: string;
  callToAction: string;
  // TikTok specifics
  tiktokFormat: TikTokFormat | '';
  tiktokVisual: string;
  tiktokCaption: string;
  // Substack specifics
  substackKind: SubstackKind;
  substackHeadline: string;
  substackPremise: string;
  substackReaderPromise: string;
  substackCta: string;
  // Cross-property connections — a strategic reason per property, not every property.
  substackConnection: string;
  tiktokConnection: string;
  pmuConnection: string;
  hrbsConnection: string;
  evidence: string;
  cautions: string;
  deliverables: string[];
  complexity: Complexity;
  timing: string;
  revisionNote: string;        // the office's concise revision instruction
  status: AssignmentStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  promotedRecommendationId?: string;
}

/* --- construction --------------------------------------------------------- */

export function makeCreativeAssignment(
  input: {
    id: string; originOpportunityId: string; originIntelId: string; title: string;
    properties?: ContentProperty[]; createdBy?: string;
    primaryPlatform?: ContentPlatform; secondaryPlatform?: ContentPlatform;
    centralIdea?: string; hook?: string; coreMessage?: string; talkingPoints?: string[];
  } & Partial<Pick<CreativeAssignment, 'objective' | 'targetAudience' | 'audienceNeed' | 'creativeAngle'
    | 'founderPov' | 'firstSentence' | 'tone' | 'voiceGuidance' | 'callToAction'
    | 'tiktokFormat' | 'tiktokVisual' | 'tiktokCaption' | 'substackKind' | 'substackHeadline'
    | 'substackPremise' | 'substackReaderPromise' | 'substackCta' | 'substackConnection'
    | 'tiktokConnection' | 'pmuConnection' | 'hrbsConnection' | 'evidence' | 'cautions'
    | 'deliverables' | 'complexity' | 'timing'>>,
  now: Date = new Date(),
): CreativeAssignment | null {
  if (!input.id || !input.originOpportunityId || !input.originIntelId || !input.title.trim()) return null;
  const by = input.createdBy && getChair(input.createdBy) ? input.createdBy : CHAIR_CREATIVE_DIRECTOR;
  const ts = now.toISOString();
  const str = (v: string | undefined): string => (v ?? '').trim();
  return {
    id: input.id,
    originOpportunityId: input.originOpportunityId,
    originIntelId: input.originIntelId,
    title: input.title.trim(),
    properties: sanitizeProperties(input.properties),
    primaryPlatform: validPlatform(input.primaryPlatform) ? input.primaryPlatform : '',
    secondaryPlatform: validPlatform(input.secondaryPlatform) ? input.secondaryPlatform : '',
    objective: str(input.objective),
    targetAudience: str(input.targetAudience),
    audienceNeed: str(input.audienceNeed),
    centralIdea: str(input.centralIdea),
    creativeAngle: str(input.creativeAngle),
    founderPov: str(input.founderPov),
    hook: str(input.hook),
    firstSentence: str(input.firstSentence),
    coreMessage: str(input.coreMessage),
    talkingPoints: sanitizeStrings(input.talkingPoints),
    tone: str(input.tone),
    voiceGuidance: str(input.voiceGuidance),
    callToAction: str(input.callToAction),
    tiktokFormat: input.tiktokFormat && TIKTOK_FORMAT_BY_ID.has(input.tiktokFormat) ? input.tiktokFormat : '',
    tiktokVisual: str(input.tiktokVisual),
    tiktokCaption: str(input.tiktokCaption),
    substackKind: input.substackKind && SUBSTACK_KIND_BY_ID.has(input.substackKind) ? input.substackKind : 'none',
    substackHeadline: str(input.substackHeadline),
    substackPremise: str(input.substackPremise),
    substackReaderPromise: str(input.substackReaderPromise),
    substackCta: str(input.substackCta),
    substackConnection: str(input.substackConnection),
    tiktokConnection: str(input.tiktokConnection),
    pmuConnection: str(input.pmuConnection),
    hrbsConnection: str(input.hrbsConnection),
    evidence: str(input.evidence),
    cautions: str(input.cautions),
    deliverables: sanitizeStrings(input.deliverables),
    complexity: input.complexity && COMPLEXITY_BY_ID.has(input.complexity) ? input.complexity : 'medium',
    timing: str(input.timing),
    revisionNote: '',
    status: 'draft',
    createdAt: ts,
    updatedAt: ts,
    createdBy: by,
  };
}

/** An opportunity brief is eligible to become an assignment once the office has
    recommended it (or already routed it) — a vetted brief, not raw analysis. */
export function isOpportunityEligibleForAssignment(opp: ContentOpportunity): boolean {
  return opp.status === 'recommended' || opp.status === 'routed_to_work';
}

/* --- editing & lifecycle (planning/review only) --------------------------- */

export type AssignmentPatch = Partial<Pick<CreativeAssignment,
  'title' | 'properties' | 'primaryPlatform' | 'secondaryPlatform' | 'objective' | 'targetAudience'
  | 'audienceNeed' | 'centralIdea' | 'creativeAngle' | 'founderPov' | 'hook' | 'firstSentence'
  | 'coreMessage' | 'talkingPoints' | 'tone' | 'voiceGuidance' | 'callToAction'
  | 'tiktokFormat' | 'tiktokVisual' | 'tiktokCaption' | 'substackKind' | 'substackHeadline'
  | 'substackPremise' | 'substackReaderPromise' | 'substackCta' | 'substackConnection'
  | 'tiktokConnection' | 'pmuConnection' | 'hrbsConnection' | 'evidence' | 'cautions'
  | 'deliverables' | 'complexity' | 'timing'>>;

export function updateAssignment(a: CreativeAssignment, patch: AssignmentPatch, now: Date = new Date()): CreativeAssignment {
  const next: CreativeAssignment = { ...a, updatedAt: now.toISOString() };
  const bag = next as unknown as Record<string, unknown>;
  const setStr = (k: keyof CreativeAssignment, v: string | undefined): void => { if (v !== undefined) bag[k as string] = v.trim(); };
  setStr('title', patch.title); setStr('objective', patch.objective); setStr('targetAudience', patch.targetAudience);
  setStr('audienceNeed', patch.audienceNeed); setStr('centralIdea', patch.centralIdea); setStr('creativeAngle', patch.creativeAngle);
  setStr('founderPov', patch.founderPov); setStr('hook', patch.hook); setStr('firstSentence', patch.firstSentence);
  setStr('coreMessage', patch.coreMessage); setStr('tone', patch.tone); setStr('voiceGuidance', patch.voiceGuidance);
  setStr('callToAction', patch.callToAction); setStr('tiktokVisual', patch.tiktokVisual); setStr('tiktokCaption', patch.tiktokCaption);
  setStr('substackHeadline', patch.substackHeadline); setStr('substackPremise', patch.substackPremise);
  setStr('substackReaderPromise', patch.substackReaderPromise); setStr('substackCta', patch.substackCta);
  setStr('substackConnection', patch.substackConnection); setStr('tiktokConnection', patch.tiktokConnection);
  setStr('pmuConnection', patch.pmuConnection); setStr('hrbsConnection', patch.hrbsConnection);
  setStr('evidence', patch.evidence); setStr('cautions', patch.cautions); setStr('timing', patch.timing);
  if (patch.properties !== undefined) next.properties = sanitizeProperties(patch.properties);
  if (patch.talkingPoints !== undefined) next.talkingPoints = sanitizeStrings(patch.talkingPoints);
  if (patch.deliverables !== undefined) next.deliverables = sanitizeStrings(patch.deliverables);
  if (patch.primaryPlatform !== undefined) next.primaryPlatform = validPlatform(patch.primaryPlatform) ? patch.primaryPlatform : '';
  if (patch.secondaryPlatform !== undefined) next.secondaryPlatform = validPlatform(patch.secondaryPlatform) ? patch.secondaryPlatform : '';
  if (patch.tiktokFormat !== undefined) next.tiktokFormat = patch.tiktokFormat && TIKTOK_FORMAT_BY_ID.has(patch.tiktokFormat) ? patch.tiktokFormat : '';
  if (patch.substackKind !== undefined) next.substackKind = SUBSTACK_KIND_BY_ID.has(patch.substackKind) ? patch.substackKind : 'none';
  if (patch.complexity !== undefined) next.complexity = COMPLEXITY_BY_ID.has(patch.complexity) ? patch.complexity : 'medium';
  return next;
}

const ASN_TRANSITIONS: Record<AssignmentStatus, AssignmentStatus[]> = {
  draft:                 ['in_development', 'ready_for_review', 'held', 'declined'],
  in_development:        ['ready_for_review', 'draft', 'held', 'declined'],
  ready_for_review:      ['approved', 'returned_for_revision', 'held', 'declined', 'routed_to_work'],
  returned_for_revision: ['in_development', 'ready_for_review', 'held', 'declined'],
  approved:              ['routed_to_work', 'held', 'returned_for_revision'],
  held:                  ['in_development', 'ready_for_review', 'declined'],
  declined:              [],
  routed_to_work:        [],
};
export function canAdvanceAssignment(from: AssignmentStatus, to: AssignmentStatus): boolean {
  return (ASN_TRANSITIONS[from] ?? []).includes(to);
}
export function setAssignmentStatus(a: CreativeAssignment, to: AssignmentStatus, now: Date = new Date()): CreativeAssignment {
  if (!canAdvanceAssignment(a.status, to)) return a;
  return { ...a, status: to, updatedAt: now.toISOString() };
}
export const markAssignmentReady = (a: CreativeAssignment, now?: Date): CreativeAssignment => setAssignmentStatus(a, 'ready_for_review', now);
export const approveAssignment = (a: CreativeAssignment, now?: Date): CreativeAssignment => setAssignmentStatus(a, 'approved', now);
export const holdAssignment = (a: CreativeAssignment, now?: Date): CreativeAssignment => setAssignmentStatus(a, 'held', now);
export const declineAssignment = (a: CreativeAssignment, now?: Date): CreativeAssignment => setAssignmentStatus(a, 'declined', now);

/** Return an assignment for revision with a concise instruction (a narrow field,
    NOT a thread). Recorded on the assignment for Creative to act on. */
export function returnAssignmentForRevision(a: CreativeAssignment, note: string = '', now: Date = new Date()): CreativeAssignment {
  if (!canAdvanceAssignment(a.status, 'returned_for_revision')) return a;
  return { ...a, status: 'returned_for_revision', revisionNote: note.trim(), updatedAt: now.toISOString() };
}

/* --- the Founder-ready projection ----------------------------------------- */

export interface FounderAssignment {
  make: string; whyNow: string; who: string; hook: string; mainPoint: string;
  format: string; substackConnection: string; cta: string; decision: string;
}
/** Concise, executive-level — what to make and the one decision. No internal form. */
export function founderAssignment(a: CreativeAssignment): FounderAssignment {
  return {
    make: a.title,
    whyNow: a.timing || a.objective || 'A timely fit for the House.',
    who: a.targetAudience || 'Not yet specified',
    hook: a.hook || 'To be drafted',
    mainPoint: a.centralIdea || a.coreMessage || a.title,
    format: [contentPlatformLabel(a.primaryPlatform), a.tiktokFormat ? tiktokFormatLabel(a.tiktokFormat) : ''].filter(Boolean).join(' · ') || 'Not set',
    substackConnection: a.substackKind !== 'none' ? `${substackKindLabel(a.substackKind)}${a.substackConnection ? ` — ${a.substackConnection}` : ''}` : (a.substackConnection || 'None'),
    cta: a.callToAction || 'To be defined',
    decision: 'Approve, adjust, or decline this assignment.',
  };
}

/* --- routing to work (idempotent, full-chain provenance) ------------------ */

export const ASN_PROMOTED_REC_PREFIX = 'rec_from_asn_';
export function assignmentRecommendationId(a: CreativeAssignment): string {
  return `${ASN_PROMOTED_REC_PREFIX}${a.id}`;
}
export function isAssignmentRoutable(a: CreativeAssignment): boolean {
  return (a.status === 'approved' || a.status === 'ready_for_review') && !a.promotedRecommendationId;
}

export interface AssignmentRouteResult {
  assignment: CreativeAssignment;
  recommendations: Recommendation[];
  recommendation: Recommendation | null;
  created: boolean;
}

/** Promote an approved assignment into the Executive Inbox — the one store for
    executive WORK — carrying the WHOLE chain (originIntelId, originOpportunityId,
    originAssignmentId). Idempotent: an already-routed assignment (or an existing
    record at its stable id) is reused, never duplicated, and downstream work is
    never overwritten. The description is a concise execution-ready summary — the
    full pack stays retrievable through provenance. No fabricated Founder approval. */
export function routeAssignmentToWork(
  a: CreativeAssignment, recommendations: Recommendation[], now: Date = new Date(),
): AssignmentRouteResult {
  const priorId = a.promotedRecommendationId ?? assignmentRecommendationId(a);
  const existing = recommendations.find((r) => r.id === priorId) ?? null;
  if (existing) {
    const linked = a.status === 'routed_to_work' && a.promotedRecommendationId === existing.id
      ? a
      : { ...a, status: 'routed_to_work' as AssignmentStatus, promotedRecommendationId: existing.id, updatedAt: now.toISOString() };
    return { assignment: linked, recommendations, recommendation: existing, created: false };
  }
  if (!isAssignmentRoutable(a)) return { assignment: a, recommendations, recommendation: null, created: false };

  const rec = makeSubmission({
    id: assignmentRecommendationId(a),
    type: 'idea',
    title: a.title,
    description: assignmentExecutionSummary(a),
    ownerChairId: CHAIR_CREATIVE_DIRECTOR,
    originIntelId: a.originIntelId,
    originOpportunityId: a.originOpportunityId,
    originAssignmentId: a.id,
  }, now);
  if (!rec) return { assignment: a, recommendations, recommendation: null, created: false };
  const linked: CreativeAssignment = { ...a, status: 'routed_to_work', promotedRecommendationId: rec.id, updatedAt: now.toISOString() };
  return { assignment: linked, recommendations: upsertRecommendation(recommendations, rec), recommendation: rec, created: true };
}

/** A concise, execution-ready summary — NOT the full assignment payload. */
function assignmentExecutionSummary(a: CreativeAssignment): string {
  const parts = [a.centralIdea || a.title];
  if (a.hook) parts.push(`Hook: ${a.hook}`);
  if (a.primaryPlatform) parts.push(`Primary: ${contentPlatformLabel(a.primaryPlatform)}${a.tiktokFormat ? ` (${tiktokFormatLabel(a.tiktokFormat)})` : ''}`);
  if (a.callToAction) parts.push(`CTA: ${a.callToAction}`);
  if (a.substackKind !== 'none') parts.push(`Substack: ${substackKindLabel(a.substackKind)}`);
  return parts.filter(Boolean).join('\n\n');
}

/* --- derived views (pure) ------------------------------------------------- */

export function assignmentsForOpportunity(oppId: string, list: CreativeAssignment[]): CreativeAssignment[] {
  return list.filter((a) => a.originOpportunityId === oppId).sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
}
export function draftAssignments(list: CreativeAssignment[]): CreativeAssignment[] {
  return list.filter((a) => a.status === 'draft' || a.status === 'in_development' || a.status === 'returned_for_revision')
    .sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
}
export function assignmentsForReview(list: CreativeAssignment[]): CreativeAssignment[] {
  return list.filter((a) => a.status === 'ready_for_review').sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
}
export function approvedAssignments(list: CreativeAssignment[]): CreativeAssignment[] {
  return list.filter((a) => a.status === 'approved').sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
}
export interface AssignmentStanding {
  draft: number; inDevelopment: number; readyForReview: number; returned: number;
  approved: number; held: number; declined: number; routed: number; total: number;
}
export function assignmentStanding(list: CreativeAssignment[]): AssignmentStanding {
  const n = (s: AssignmentStatus): number => list.filter((a) => a.status === s).length;
  return {
    draft: n('draft'), inDevelopment: n('in_development'), readyForReview: n('ready_for_review'),
    returned: n('returned_for_revision'), approved: n('approved'), held: n('held'),
    declined: n('declined'), routed: n('routed_to_work'), total: list.length,
  };
}
export function assignmentAuthorLabel(a: CreativeAssignment): string {
  return getChair(a.createdBy)?.title ?? a.createdBy;
}
/** The selected properties with their strategic connection reasons, for display. */
export function crossPropertyReasons(a: CreativeAssignment): { property: ContentProperty; reason: string }[] {
  const reasonFor: Partial<Record<ContentProperty, string>> = {
    founder_platform: a.tiktokConnection, luscious_honey_collective: a.substackConnection,
    pull_me_under: a.pmuConnection, hr_baddie_society: a.hrbsConnection,
  };
  return a.properties.map((p) => ({ property: p, reason: reasonFor[p] ?? '' }));
}

/* --- storage -------------------------------------------------------------- */

export const ASSIGNMENT_KEY = `${STORAGE_ROOT}.creative-assignments.v1`;

export function isCreativeAssignment(x: unknown): x is CreativeAssignment {
  const o = x as CreativeAssignment;
  return !!o && typeof o === 'object'
    && typeof o.id === 'string' && typeof o.originOpportunityId === 'string'
    && typeof o.originIntelId === 'string' && typeof o.title === 'string'
    && typeof o.status === 'string' && typeof o.createdAt === 'string';
}

export function normalizeCreativeAssignment(a: CreativeAssignment): CreativeAssignment {
  const status = ASN_STATUS_BY_ID.has(a.status) ? a.status : 'draft';
  const complexity = COMPLEXITY_BY_ID.has(a.complexity) ? a.complexity : 'medium';
  const substackKind = SUBSTACK_KIND_BY_ID.has(a.substackKind) ? a.substackKind : 'none';
  const primaryPlatform = validPlatform(a.primaryPlatform) ? a.primaryPlatform : '';
  const secondaryPlatform = validPlatform(a.secondaryPlatform) ? a.secondaryPlatform : '';
  const tiktokFormat = a.tiktokFormat && TIKTOK_FORMAT_BY_ID.has(a.tiktokFormat) ? a.tiktokFormat : '';
  const properties = sanitizeProperties(a.properties);
  const talkingPoints = sanitizeStrings(a.talkingPoints);
  const deliverables = sanitizeStrings(a.deliverables);
  const propsOk = Array.isArray(a.properties) && properties.length === a.properties.length;
  const tpOk = Array.isArray(a.talkingPoints) && talkingPoints.length === a.talkingPoints.length;
  const delOk = Array.isArray(a.deliverables) && deliverables.length === a.deliverables.length;
  const unchanged = a.status === status && a.complexity === complexity && a.substackKind === substackKind
    && a.primaryPlatform === primaryPlatform && a.secondaryPlatform === secondaryPlatform
    && a.tiktokFormat === tiktokFormat && propsOk && tpOk && delOk;
  const s = (v: string | undefined): string => v ?? '';
  return unchanged ? a : {
    ...a, status, complexity, substackKind, primaryPlatform, secondaryPlatform, tiktokFormat,
    properties: propsOk ? a.properties : properties,
    talkingPoints: tpOk ? a.talkingPoints : talkingPoints,
    deliverables: delOk ? a.deliverables : deliverables,
    objective: s(a.objective), targetAudience: s(a.targetAudience), audienceNeed: s(a.audienceNeed),
    centralIdea: s(a.centralIdea), creativeAngle: s(a.creativeAngle), founderPov: s(a.founderPov),
    hook: s(a.hook), firstSentence: s(a.firstSentence), coreMessage: s(a.coreMessage),
    tone: s(a.tone), voiceGuidance: s(a.voiceGuidance), callToAction: s(a.callToAction),
    tiktokVisual: s(a.tiktokVisual), tiktokCaption: s(a.tiktokCaption),
    substackHeadline: s(a.substackHeadline), substackPremise: s(a.substackPremise),
    substackReaderPromise: s(a.substackReaderPromise), substackCta: s(a.substackCta),
    substackConnection: s(a.substackConnection), tiktokConnection: s(a.tiktokConnection),
    pmuConnection: s(a.pmuConnection), hrbsConnection: s(a.hrbsConnection),
    evidence: s(a.evidence), cautions: s(a.cautions), timing: s(a.timing), revisionNote: s(a.revisionNote),
    createdBy: a.createdBy && getChair(a.createdBy) ? a.createdBy : CHAIR_CREATIVE_DIRECTOR,
  };
}

export function loadAssignments(): CreativeAssignment[] {
  return loadCollection(ASSIGNMENT_KEY, isCreativeAssignment).map(normalizeCreativeAssignment);
}
export function saveAssignments(list: CreativeAssignment[]): void {
  saveCollection(ASSIGNMENT_KEY, list);
}
export function upsertAssignment(existing: CreativeAssignment[], a: CreativeAssignment): CreativeAssignment[] {
  return [...existing.filter((x) => x.id !== a.id), a];
}

/** A short property summary for cards. */
export function assignmentPropertyLabel(a: CreativeAssignment): string {
  return a.properties.map(contentPropertyLabel).join(', ') || 'No property';
}
