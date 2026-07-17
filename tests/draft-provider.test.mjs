/* =============================================================================
   Sprint 13D — the server-side draft provider boundary (functions/_lib). Pure,
   secret-free, provider-agnostic: configuration reporting, request validation,
   the agnostic prompt payload (context-only, no-trending rule), and response
   validation. No live service is called.
   ============================================================================= */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  providerConfig, validateDraftRequest, buildProviderPayload, validateProviderResponse, PROMPT_VERSION, DRAFT_TYPES,
} from '../functions/_lib/draft-provider.js'

test('providerConfig reports NOT configured without a key — honest degradation', () => {
  assert.equal(providerConfig({}).configured, false)
  assert.equal(providerConfig({ AI_DRAFT_PROVIDER: 'anthropic' }).configured, false, 'a vendor without a key is not configured')
  assert.equal(providerConfig({ AI_DRAFT_API_KEY: 'x' }).configured, false, 'a key without a vendor is not configured')
  const ok = providerConfig({ AI_DRAFT_PROVIDER: 'anthropic', AI_DRAFT_MODEL: 'm', AI_DRAFT_API_KEY: 'secret' })
  assert.equal(ok.configured, true)
  assert.equal(ok.provider, 'anthropic')
  assert.equal(ok.model, 'm')
})

test('the request body is validated for a supported type and a context', () => {
  assert.equal(validateDraftRequest(null).ok, false)
  assert.equal(validateDraftRequest({ type: 'nope', context: {} }).ok, false)
  assert.equal(validateDraftRequest({ type: 'tiktok_short' }).ok, false, 'missing context')
  assert.equal(validateDraftRequest({ type: 'tiktok_short', context: {} }).ok, true)
  assert.ok(DRAFT_TYPES.includes('substack_essay'))
})

test('the provider payload includes only relevant context and enforces the no-trending rule', () => {
  const payload = buildProviderPayload({
    type: 'tiktok_short', voice: 'Warmer', instruction: 'sharper',
    context: { centralIdea: 'starting over', talkingPoints: ['a', 'b'], audience: 'women', sourceEvidence: '', trendingSupported: false },
  })
  assert.equal(payload.promptVersion, PROMPT_VERSION)
  assert.equal(payload.type, 'tiktok_short')
  assert.match(payload.instructions, /Central idea: starting over/)
  assert.match(payload.instructions, /Do NOT claim the topic is trending/)
  assert.match(payload.instructions, /avoid factual and trend claims/i)
  assert.match(payload.instructions, /do not publish/i)
  // no secret and no unrelated data
  assert.doesNotMatch(JSON.stringify(payload), /api[_-]?key|secret|password/i)
})

test('a trend-supported context omits the no-trending warning', () => {
  const payload = buildProviderPayload({ type: 'tiktok_short', context: { centralIdea: 'x', trendingSupported: true, sourceEvidence: 'analytics' } })
  assert.doesNotMatch(payload.instructions, /Do NOT claim the topic is trending/)
})

test('provider responses are validated into usable content or rejected', () => {
  assert.equal(validateProviderResponse(null).ok, false)
  assert.equal(validateProviderResponse({}).reason, 'invalid_response')
  assert.equal(validateProviderResponse({ content: 'oops' }).reason, 'invalid_response')
  const good = validateProviderResponse({ content: { recommendedHook: 'h' } })
  assert.equal(good.ok, true)
  assert.equal(good.content.recommendedHook, 'h')
})
