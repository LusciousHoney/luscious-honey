/**
 * Draft provider boundary — the narrow, provider-AGNOSTIC seam for the Creative
 * Drafting Assistant (Sprint 13D). Pure, server-side, and testable: it reads the
 * provider configuration from environment variables, builds a provider-agnostic
 * request payload, and validates a response shape. It holds NO secret in code and
 * hardcodes NO vendor.
 *
 * Configuration (all server-side env, set only in the Pages project — NEVER in the
 * repo, client, or logs):
 *   AI_DRAFT_PROVIDER   e.g. "anthropic" | "openai" | "stub"   (which vendor)
 *   AI_DRAFT_MODEL      the model id for that vendor
 *   AI_DRAFT_API_KEY    the vendor API key (secret; required to be "configured")
 *   AI_DRAFT_ENDPOINT   optional override of the vendor endpoint
 *
 * When no key is configured the boundary reports `configured: false`, and the
 * endpoint returns an honest "not configured" status — it NEVER fabricates output.
 */

/** Read the provider configuration from env. `configured` is false unless a key is
    present, so the app degrades honestly with no secret and no default vendor. */
export function providerConfig(env) {
  const e = env || {}
  const provider = String(e.AI_DRAFT_PROVIDER || '').trim().toLowerCase()
  const model = String(e.AI_DRAFT_MODEL || '').trim()
  const hasKey = typeof e.AI_DRAFT_API_KEY === 'string' && e.AI_DRAFT_API_KEY.trim().length > 0
  const endpoint = String(e.AI_DRAFT_ENDPOINT || '').trim()
  return { configured: !!provider && hasKey, provider, model, endpoint }
}

/** The supported draft types the endpoint will accept. */
export const DRAFT_TYPES = ['tiktok_short', 'tiktok_live', 'substack_note', 'substack_essay']

/** Validate the client request body. Returns { ok, error }.  */
export function validateDraftRequest(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Missing request body.' }
  if (!DRAFT_TYPES.includes(body.type)) return { ok: false, error: 'Unsupported draft type.' }
  if (!body.context || typeof body.context !== 'object') return { ok: false, error: 'Missing draft context.' }
  return { ok: true }
}

/** Build a provider-agnostic request payload from approved context. Only the fields
    the content needs are included — no unrelated records, no hidden Founder data.
    A short prompt-version tag is recorded for reproducibility (no secret stored). */
export const PROMPT_VERSION = 'draft-v1'
export function buildProviderPayload({ type, context, instruction, voice }) {
  const c = context || {}
  const lines = [
    `Task: prepare a ${type} DRAFT for review. Draft only — do not publish.`,
    voice ? `Voice: ${voice}` : '',
    instruction ? `Instruction: ${instruction}` : '',
    c.centralIdea ? `Central idea: ${c.centralIdea}` : '',
    c.hook ? `Hook direction: ${c.hook}` : '',
    Array.isArray(c.talkingPoints) && c.talkingPoints.length ? `Talking points: ${c.talkingPoints.join('; ')}` : '',
    c.audience ? `Audience: ${c.audience}` : '',
    c.tone ? `Tone: ${c.tone}` : '',
    c.callToAction ? `CTA: ${c.callToAction}` : '',
    c.sourceEvidence ? `Observed evidence (do not exceed it): ${c.sourceEvidence}` : 'No strong evidence — avoid factual and trend claims.',
    c.trendingSupported ? '' : 'Do NOT claim the topic is trending or viral.',
    c.cautions ? `Cautions: ${c.cautions}` : '',
    'Return structured draft fields. Mark nothing as fact. Do not imitate a living creator’s voice.',
  ].filter(Boolean)
  return { promptVersion: PROMPT_VERSION, type, instructions: lines.join('\n') }
}

/** Validate a provider's structured response into a DraftContent-ish object. */
export function validateProviderResponse(json) {
  if (!json || typeof json !== 'object') return { ok: false, reason: 'invalid_response' }
  const content = json.content && typeof json.content === 'object' ? json.content : null
  if (!content) return { ok: false, reason: 'invalid_response' }
  return { ok: true, content }
}
