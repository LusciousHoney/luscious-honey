/* =============================================================================
   CREATIVE DRAFTING ASSISTANT — the first controlled, AI-assisted staff layer
   (Sprint 13D / Council Phase III). Converts an APPROVED Creative Assignment Pack
   into reviewable DRAFT content for TikTok and Substack. Draft preparation ONLY —
   it never publishes, schedules, approves itself, or bypasses the Founder, who
   remains the final editorial authority.

   Institutional truth is layered and never conflated:
     source intelligence → Growth analysis → approved assignment → AI-assisted
     DRAFT material → Founder-approved final content.
   AI output is NOT fact merely because it was generated; every draft is marked
   unverified until the Founder reviews and approves it.

   The provider is behind a narrow, provider-agnostic interface (no vendor is
   hardcoded, no secret is in client code). Tests and offline preview use a
   deterministic provider — never a live service. Generation happens only after an
   explicit, authorized request; there is no autonomous or background generation.
   This is a connected annotation layer, not a second execution engine.
   --------------------------------------------------------------------------- */

import {
  STORAGE_ROOT, loadCollection, saveCollection, getChair, CHAIR_CREATIVE_DIRECTOR,
} from './executive-register.ts';
import { makeSubmission, upsertRecommendation, type Recommendation } from './chief-of-staff-ops.ts';
import { type CreativeAssignment } from './creative-assignment.ts';
import { type ContentOpportunity } from './content-opportunity.ts';
import { type IntelligenceItem } from './growth-intelligence.ts';

/* --- vocabulary ----------------------------------------------------------- */

export type DraftType = 'tiktok_short' | 'tiktok_live' | 'substack_note' | 'substack_essay';
export interface DraftTypeKind { id: DraftType; label: string; }
export const DRAFT_TYPES: DraftTypeKind[] = [
  { id: 'tiktok_short',  label: 'TikTok — short-form draft' },
  { id: 'tiktok_live',   label: 'TikTok LIVE — brief' },
  { id: 'substack_note', label: 'Substack — Note draft' },
  { id: 'substack_essay',label: 'Substack — essay outline' },
];
const DRAFT_TYPE_BY_ID = new Map(DRAFT_TYPES.map((t) => [t.id, t]));
export function draftTypeLabel(id: DraftType): string { return DRAFT_TYPE_BY_ID.get(id)?.label ?? id; }

export type DraftStatus =
  | 'requested' | 'generating' | 'draft_ready' | 'generation_failed'
  | 'revision_requested' | 'revised' | 'approved' | 'declined' | 'held';
export interface DraftStatusKind { id: DraftStatus; label: string; }
export const DRAFT_STATUSES: DraftStatusKind[] = [
  { id: 'requested',          label: 'Requested' },
  { id: 'generating',         label: 'Generating' },
  { id: 'draft_ready',        label: 'Draft Ready' },
  { id: 'generation_failed',  label: 'Generation Failed' },
  { id: 'revision_requested', label: 'Revision Requested' },
  { id: 'revised',            label: 'Revised' },
  { id: 'approved',           label: 'Approved' },
  { id: 'declined',           label: 'Declined' },
  { id: 'held',               label: 'Held' },
];
const DRAFT_STATUS_BY_ID = new Map(DRAFT_STATUSES.map((s) => [s.id, s]));
export function draftStatusLabel(id: DraftStatus): string { return DRAFT_STATUS_BY_ID.get(id)?.label ?? id; }

/** Concise voice directions the Founder can select. No living third-party
    creator's voice is ever imitated. */
export const VOICE_DIRECTIONS: string[] = [
  'Closer to Luscious Honey’s established voice',
  'Sharper', 'Warmer', 'More conversational', 'More authoritative',
  'More playful', 'More sensual (where appropriate)', 'More concise', 'More educational',
];

/* --- prompt context (assembled from approved records only) ---------------- */

/** The relevant, non-secret context a draft is built from — nothing unrelated,
    no hidden Founder information beyond what the content needs. */
export interface DraftContext {
  intelId: string;
  opportunityId: string;
  assignmentId: string;
  properties: string[];
  audience: string;
  centralIdea: string;
  hook: string;
  talkingPoints: string[];
  tone: string;
  voiceGuidance: string;
  callToAction: string;
  substackConnection: string;
  tiktokConnection: string;
  cautions: string;
  /** Observed source evidence — kept distinct from creative interpretation. */
  sourceEvidence: string;
  /** Whether the intelligence record actually supports a "trending" framing. */
  trendingSupported: boolean;
}

/** Assemble a draft context from the approved institutional records — using only
    the fields the content needs. Unrelated records are never included. */
export function buildDraftContext(
  assignment: CreativeAssignment,
  opportunity: ContentOpportunity | null,
  intel: IntelligenceItem | null,
): DraftContext {
  const evidenceParts = [intel?.whyItMatters, opportunity?.audienceNeed, assignment.evidence]
    .map((s) => (s ?? '').trim()).filter(Boolean);
  return {
    intelId: assignment.originIntelId,
    opportunityId: assignment.originOpportunityId,
    assignmentId: assignment.id,
    properties: assignment.properties.slice(),
    audience: assignment.targetAudience || opportunity?.audience || '',
    centralIdea: assignment.centralIdea,
    hook: assignment.hook,
    talkingPoints: assignment.talkingPoints.slice(),
    tone: assignment.tone,
    voiceGuidance: assignment.voiceGuidance,
    callToAction: assignment.callToAction,
    substackConnection: assignment.substackConnection,
    tiktokConnection: assignment.tiktokConnection,
    cautions: assignment.cautions,
    sourceEvidence: evidenceParts.join(' · '),
    // Only claim "trending" if the intelligence source is a trend/analytics signal.
    trendingSupported: !!intel && ['tiktok_trend', 'tiktok_analytics', 'substack_analytics', 'pmu_analytics', 'hrbs_analytics'].includes(intel.source),
  };
}

/* --- generated content ---------------------------------------------------- */

/** Structured draft output. A provider fills the fields relevant to the type;
    all of it is unverified draft material until the Founder approves. */
export interface DraftContent {
  // TikTok short-form
  hookOptions?: string[]; recommendedHook?: string; firstSentence?: string;
  outline?: string[]; talkingPoints?: string[]; closingLine?: string;
  cta?: string; captionDirection?: string; visual?: string; substackBridge?: string;
  // TikTok LIVE
  liveTitle?: string; opening?: string; primaryQuestion?: string;
  discussionBeats?: string[]; engagementPrompts?: string[]; transition?: string;
  // Substack Note
  noteCopy?: string; headline?: string; tiktokConnection?: string;
  // Substack essay outline
  headlineOptions?: string[]; thesis?: string; premise?: string; sections?: string[];
  readerPromise?: string; supportingArguments?: string[]; promotionAngle?: string;
}

/* --- the provider boundary (provider-agnostic) ---------------------------- */

export interface DraftRequest { type: DraftType; context: DraftContext; instruction: string; voice: string; }
export interface DraftProviderMeta { provider: string; model: string; }
export type DraftFailureReason = 'not_configured' | 'timeout' | 'invalid_response' | 'error';
export type DraftProviderResult =
  | { ok: true; content: DraftContent; meta: DraftProviderMeta }
  | { ok: false; reason: DraftFailureReason; message?: string };
export interface DraftProvider { name: string; draft(req: DraftRequest): Promise<DraftProviderResult>; }

/** A deterministic, offline provider for tests and preview. It fabricates NOTHING
    from thin air — it templates the APPROVED context into a structured first
    draft, and is clearly labelled a stub (never presented as a live model). */
export const deterministicDraftProvider: DraftProvider = {
  name: 'stub-preview',
  async draft(req: DraftRequest): Promise<DraftProviderResult> {
    const c = req.context;
    const idea = c.centralIdea || 'the core idea';
    const hook = c.hook || 'You are not behind.';
    const tp = c.talkingPoints.length ? c.talkingPoints : ['Reframe the moment', 'Name the fear', 'Offer one step'];
    const cta = c.callToAction || 'Follow for the rest';
    const content: DraftContent = {};
    if (req.type === 'tiktok_short') {
      content.hookOptions = [hook, `Here is what no one tells you about ${idea.toLowerCase()}.`, `Read this before you decide ${idea.toLowerCase()} is over.`];
      content.recommendedHook = hook;
      content.firstSentence = `Let me tell you why ${idea.toLowerCase()} is not what you think.`;
      content.outline = ['Open on the hook', 'Reframe the belief', ...tp.map((p) => `Beat: ${p}`), 'Land the turn', 'Close with the CTA'];
      content.talkingPoints = tp;
      content.closingLine = 'You get to choose the timeline.';
      content.cta = cta; content.captionDirection = 'Warm, direct; invite a save.';
      content.visual = 'Soft daylight, close and calm.';
      content.substackBridge = c.substackConnection || 'A companion Substack Note goes deeper.';
    } else if (req.type === 'tiktok_live') {
      content.liveTitle = `On ${idea}`; content.opening = `A calm welcome, then the frame: ${idea}.`;
      content.primaryQuestion = `What makes ${idea.toLowerCase()} feel so heavy — and what changes it?`;
      content.discussionBeats = [...tp.map((p) => `Discuss: ${p}`), 'Take a live question', 'Share one small practice'];
      content.engagementPrompts = ['Drop a 🌙 if this is you', 'Tell me where you are right now'];
      content.transition = c.substackConnection || 'Point viewers to the Substack essay.';
      content.cta = cta;
    } else if (req.type === 'substack_note') {
      content.noteCopy = `${hook} ${idea} — a short, honest note for anyone in the middle of it.`;
      content.headline = idea; content.closingLine = 'More soon.';
      content.tiktokConnection = c.tiktokConnection || 'Pairs with the TikTok on the same idea.'; content.cta = cta;
    } else {
      content.headlineOptions = [idea, `The Quiet Case for ${idea}`, `What ${idea} Really Asks of Us`];
      content.thesis = `${idea} is a choice, not a failure.`;
      content.premise = c.sourceEvidence || 'A recurring question deserves a considered answer.';
      content.sections = ['The premise', ...tp.map((p) => `Section: ${p}`), 'The turn', 'The invitation'];
      content.readerPromise = 'A gentler, clearer frame you can use.';
      content.supportingArguments = tp; content.cta = cta;
      content.promotionAngle = c.tiktokConnection || 'A TikTok hook draws readers to the essay.';
    }
    return { ok: true, content, meta: { provider: 'stub-preview', model: 'deterministic-preview' } };
  },
};

/* --- the draft record ----------------------------------------------------- */

export interface CreativeDraft {
  id: string;
  originIntelId: string;
  originOpportunityId: string;
  originAssignmentId: string;
  properties: string[];
  type: DraftType;
  instruction: string;        // narrow drafting instruction
  voice: string;              // selected voice direction
  context: DraftContext;      // the assembled source context
  content: DraftContent | null;
  generatedAt: string | null;
  providerMeta: DraftProviderMeta | null;
  status: DraftStatus;
  failureReason: DraftFailureReason | null;
  revisionInstruction: string;
  revisionNumber: number;
  founderFeedback: string;
  approvedContent: DraftContent | null;   // the Founder's final (possibly edited) copy
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  promotedRecommendationId?: string;
}

/** An assignment is eligible for drafting once it is approved (or already routed). */
export function isAssignmentEligibleForDraft(a: CreativeAssignment): boolean {
  return a.status === 'approved' || a.status === 'routed_to_work';
}

/** Request a draft — records the intent (status `requested`); nothing is generated
    until `generateDraft` runs against an authorised provider. */
export function makeCreativeDraft(
  input: { id: string; assignment: CreativeAssignment; type: DraftType; instruction?: string; voice?: string;
    context: DraftContext; createdBy?: string; },
  now: Date = new Date(),
): CreativeDraft | null {
  if (!input.id || !input.assignment || !DRAFT_TYPE_BY_ID.has(input.type)) return null;
  const by = input.createdBy && getChair(input.createdBy) ? input.createdBy : CHAIR_CREATIVE_DIRECTOR;
  const ts = now.toISOString();
  return {
    id: input.id,
    originIntelId: input.assignment.originIntelId,
    originOpportunityId: input.assignment.originOpportunityId,
    originAssignmentId: input.assignment.id,
    properties: input.assignment.properties.slice(),
    type: input.type,
    instruction: (input.instruction ?? '').trim(),
    voice: (input.voice ?? '').trim(),
    context: input.context,
    content: null, generatedAt: null, providerMeta: null,
    status: 'requested', failureReason: null,
    revisionInstruction: '', revisionNumber: 0, founderFeedback: '',
    approvedContent: null,
    createdAt: ts, updatedAt: ts, createdBy: by,
  };
}

/* --- generation (explicit, authorised, provider-injected) ----------------- */

/** Run a draft through a provider. Sets `generating` conceptually, then resolves
    to `draft_ready` (or `revised` after a revision) on success, or
    `generation_failed` with an honest reason on failure. NEVER fabricates content
    on failure. The provider is injected — tests pass a deterministic or failing
    one; the UI passes the offline stub (DEV) or the server-backed provider (PROD). */
export async function generateDraft(draft: CreativeDraft, provider: DraftProvider, now: Date = new Date()): Promise<CreativeDraft> {
  const req: DraftRequest = { type: draft.type, context: draft.context, instruction: draft.revisionInstruction || draft.instruction, voice: draft.voice };
  let result: DraftProviderResult;
  try { result = await provider.draft(req); }
  catch { result = { ok: false, reason: 'error', message: 'The drafting provider could not be reached.' }; }
  const ts = now.toISOString();
  if (!result.ok) {
    return { ...draft, status: 'generation_failed', failureReason: result.reason, updatedAt: ts };
  }
  const wasRevision = draft.status === 'revision_requested' || draft.revisionNumber > 0;
  return {
    ...draft, status: wasRevision ? 'revised' : 'draft_ready',
    content: result.content, generatedAt: ts, providerMeta: result.meta,
    failureReason: null, updatedAt: ts,
  };
}

/* --- review lifecycle ----------------------------------------------------- */

export function requestDraftRevision(draft: CreativeDraft, instruction: string = '', now: Date = new Date()): CreativeDraft {
  if (draft.status !== 'draft_ready' && draft.status !== 'revised') return draft;
  return { ...draft, status: 'revision_requested', revisionInstruction: instruction.trim(), revisionNumber: draft.revisionNumber + 1, updatedAt: now.toISOString() };
}
export function holdDraft(draft: CreativeDraft, now: Date = new Date()): CreativeDraft {
  if (!isOpenDraftStatus(draft.status)) return draft;
  return { ...draft, status: 'held', updatedAt: now.toISOString() };
}
export function declineDraft(draft: CreativeDraft, now: Date = new Date()): CreativeDraft {
  if (draft.status === 'approved') return draft;
  return { ...draft, status: 'declined', updatedAt: now.toISOString() };
}
/** The Founder approves — optionally editing or replacing the final copy first.
    Only a ready/revised draft can be approved; approval never comes from the AI. */
export function approveDraft(draft: CreativeDraft, finalContent: DraftContent | null = null, feedback: string = '', now: Date = new Date()): CreativeDraft {
  if (draft.status !== 'draft_ready' && draft.status !== 'revised') return draft;
  return { ...draft, status: 'approved', approvedContent: finalContent ?? draft.content, founderFeedback: feedback.trim(), updatedAt: now.toISOString() };
}
export function retryDraft(draft: CreativeDraft, now: Date = new Date()): CreativeDraft {
  if (draft.status !== 'generation_failed') return draft;
  return { ...draft, status: 'requested', failureReason: null, updatedAt: now.toISOString() };
}
function isOpenDraftStatus(s: DraftStatus): boolean {
  return s !== 'approved' && s !== 'declined';
}

/* --- truthfulness & cautions ---------------------------------------------- */

/** Honest cautions attached to every draft — it is unverified material, evidence
    may be weak, and some properties carry special sensitivity. Never asserts the
    content is fact or the Founder's own words before approval. */
export function draftCautions(draft: CreativeDraft): string[] {
  const out = ['AI-assisted draft — unverified. Not the Founder’s own words until approved.'];
  if (!draft.context.sourceEvidence) out.push('Supporting evidence is limited — verify claims before publishing.');
  if (!draft.context.trendingSupported && mentionsTrending(draft.content)) {
    out.push('Draft implies a trend the intelligence record does not support — remove or substantiate.');
  }
  if (draft.properties.includes('hr_baddie_society')) {
    out.push('HR content: could read as individualized legal advice — add a general-information disclaimer; this is not legal advice.');
  }
  if (draft.context.cautions) out.push(draft.context.cautions);
  return out;
}
function mentionsTrending(content: DraftContent | null): boolean {
  if (!content) return false;
  return /\b(trending|viral|guaranteed|blow up)\b/i.test(JSON.stringify(content));
}

/* --- the Founder-ready projection ----------------------------------------- */

export interface FounderDraftView {
  forWhat: string; opportunity: string; audience: string; platform: string;
  draftType: string; highlights: { label: string; value: string }[];
  connection: string; cta: string; cautions: string[]; decision: string;
}
export function founderDraftView(draft: CreativeDraft): FounderDraftView {
  const c = draft.approvedContent ?? draft.content;
  const highlights: { label: string; value: string }[] = [];
  const add = (label: string, value?: string): void => { if (value) highlights.push({ label, value }); };
  if (c) {
    add('Recommended hook', c.recommendedHook || (c.hookOptions && c.hookOptions[0]));
    add('Note', c.noteCopy);
    add('LIVE title', c.liveTitle);
    add('Thesis', c.thesis);
    add('First sentence', c.firstSentence);
  }
  return {
    forWhat: draft.context.centralIdea || 'A content draft',
    opportunity: draft.originOpportunityId,
    audience: draft.context.audience || 'Not specified',
    platform: draft.type.startsWith('tiktok') ? 'TikTok' : 'Substack',
    draftType: draftTypeLabel(draft.type),
    highlights,
    connection: draft.context.substackConnection || draft.context.tiktokConnection || 'None',
    cta: (c && c.cta) || draft.context.callToAction || 'To be defined',
    cautions: draftCautions(draft),
    decision: 'Approve, edit, request a revision, hold, or decline.',
  };
}

/* --- routing to work (idempotent, full-chain provenance) ------------------ */

export const DRAFT_PROMOTED_REC_PREFIX = 'rec_from_draft_';
export function draftRecommendationId(draft: CreativeDraft): string { return `${DRAFT_PROMOTED_REC_PREFIX}${draft.id}`; }
export function isDraftRoutable(draft: CreativeDraft): boolean {
  return draft.status === 'approved' && !draft.promotedRecommendationId;
}
export interface DraftRouteResult {
  draft: CreativeDraft; recommendations: Recommendation[]; recommendation: Recommendation | null; created: boolean;
}
/** Promote an APPROVED draft into the one recommendation store, carrying the whole
    chain (intel, opportunity, assignment, draft ids). Idempotent; no fabricated
    Founder approval (enters at preparing/pending); Register-derived Creative owner;
    concise execution summary — the full draft stays retrievable via provenance. */
export function routeDraftToWork(draft: CreativeDraft, recommendations: Recommendation[], now: Date = new Date()): DraftRouteResult {
  const priorId = draft.promotedRecommendationId ?? draftRecommendationId(draft);
  const existing = recommendations.find((r) => r.id === priorId) ?? null;
  if (existing) {
    const linked = draft.promotedRecommendationId === existing.id ? draft : { ...draft, promotedRecommendationId: existing.id, updatedAt: now.toISOString() };
    return { draft: linked, recommendations, recommendation: existing, created: false };
  }
  if (!isDraftRoutable(draft)) return { draft, recommendations, recommendation: null, created: false };
  const rec = makeSubmission({
    id: draftRecommendationId(draft), type: 'idea',
    title: draft.context.centralIdea || draftTypeLabel(draft.type),
    description: draftExecutionSummary(draft),
    ownerChairId: CHAIR_CREATIVE_DIRECTOR,
    originIntelId: draft.originIntelId, originOpportunityId: draft.originOpportunityId,
    originAssignmentId: draft.originAssignmentId, originDraftId: draft.id,
  }, now);
  if (!rec) return { draft, recommendations, recommendation: null, created: false };
  const linked: CreativeDraft = { ...draft, promotedRecommendationId: rec.id, updatedAt: now.toISOString() };
  return { draft: linked, recommendations: upsertRecommendation(recommendations, rec), recommendation: rec, created: true };
}
function draftExecutionSummary(draft: CreativeDraft): string {
  const c = draft.approvedContent ?? draft.content;
  const parts = [`${draftTypeLabel(draft.type)} — approved draft`];
  if (c?.recommendedHook) parts.push(`Hook: ${c.recommendedHook}`);
  if (c?.noteCopy) parts.push(`Note: ${c.noteCopy}`);
  if (c?.cta) parts.push(`CTA: ${c.cta}`);
  parts.push('Full approved draft retained via provenance (originDraftId).');
  return parts.join('\n\n');
}

/* --- derived views (pure) ------------------------------------------------- */

export function draftsForAssignment(assignmentId: string, list: CreativeDraft[]): CreativeDraft[] {
  return list.filter((d) => d.originAssignmentId === assignmentId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function draftsInProgress(list: CreativeDraft[]): CreativeDraft[] {
  return list.filter((d) => ['requested', 'generating', 'draft_ready', 'generation_failed', 'revision_requested', 'revised'].includes(d.status))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function draftsForFounder(list: CreativeDraft[]): CreativeDraft[] {
  return list.filter((d) => d.status === 'draft_ready' || d.status === 'revised').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export interface DraftStanding {
  requested: number; generating: number; ready: number; failed: number;
  revisionRequested: number; approved: number; total: number;
}
export function draftStanding(list: CreativeDraft[]): DraftStanding {
  const n = (s: DraftStatus): number => list.filter((d) => d.status === s).length;
  return {
    requested: n('requested'), generating: n('generating'), ready: n('draft_ready') + n('revised'),
    failed: n('generation_failed'), revisionRequested: n('revision_requested'), approved: n('approved'), total: list.length,
  };
}
export function draftAuthorLabel(draft: CreativeDraft): string { return getChair(draft.createdBy)?.title ?? draft.createdBy; }

/* --- storage -------------------------------------------------------------- */

export const DRAFT_KEY = `${STORAGE_ROOT}.creative-drafts.v1`;

export function isCreativeDraft(x: unknown): x is CreativeDraft {
  const o = x as CreativeDraft;
  return !!o && typeof o === 'object'
    && typeof o.id === 'string' && typeof o.originAssignmentId === 'string'
    && typeof o.type === 'string' && typeof o.status === 'string' && typeof o.createdAt === 'string';
}
export function normalizeCreativeDraft(d: CreativeDraft): CreativeDraft {
  const status = DRAFT_STATUS_BY_ID.has(d.status) ? d.status : 'requested';
  const type = DRAFT_TYPE_BY_ID.has(d.type) ? d.type : 'tiktok_short';
  const properties = Array.isArray(d.properties) ? d.properties.filter((p): p is string => typeof p === 'string') : [];
  const propsOk = Array.isArray(d.properties) && properties.length === d.properties.length;
  const revisionNumber = Number.isFinite(d.revisionNumber) ? d.revisionNumber : 0;
  const unchanged = d.status === status && d.type === type && propsOk && d.revisionNumber === revisionNumber;
  const s = (v: string | undefined): string => v ?? '';
  return unchanged ? d : {
    ...d, status, type, revisionNumber, properties: propsOk ? d.properties : properties,
    instruction: s(d.instruction), voice: s(d.voice), revisionInstruction: s(d.revisionInstruction),
    founderFeedback: s(d.founderFeedback),
    content: d.content ?? null, generatedAt: d.generatedAt ?? null, providerMeta: d.providerMeta ?? null,
    failureReason: d.failureReason ?? null, approvedContent: d.approvedContent ?? null,
    createdBy: d.createdBy && getChair(d.createdBy) ? d.createdBy : CHAIR_CREATIVE_DIRECTOR,
  };
}
export function loadDrafts(): CreativeDraft[] {
  return loadCollection(DRAFT_KEY, isCreativeDraft).map(normalizeCreativeDraft);
}
export function saveDrafts(list: CreativeDraft[]): void { saveCollection(DRAFT_KEY, list); }
export function upsertDraft(existing: CreativeDraft[], d: CreativeDraft): CreativeDraft[] {
  return [...existing.filter((x) => x.id !== d.id), d];
}
