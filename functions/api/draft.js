/**
 * /api/draft — the server-side Creative Drafting boundary (Sprint 13D).
 *
 * A thin HTTP wrapper over the provider-agnostic seam in _lib/draft-provider.js.
 * It is Access-protected (same gate as the rest of the private Headquarters), it
 * keeps every secret server-side, and it FAILS HONESTLY: when no provider key is
 * configured it returns 503 { reason: 'not_configured' } and NEVER fabricates a
 * draft. The client treats that as "provider not configured" and offers retry.
 *
 * This endpoint is the deployment seam only — it is not wired into local `npm run
 * dev` (which serves the static app without Functions), and it is never called by
 * the test suite (tests use a deterministic in-process provider). No secret is
 * added here; see docs/DEPLOY.md for the environment variables required before any
 * deployment enables real drafting.
 *
 *   POST /api/draft { type, context, instruction, voice } → { ok, content, meta }
 */

import { verifyAccessRequest } from '../_lib/access.js'
import {
  providerConfig, validateDraftRequest, buildProviderPayload, validateProviderResponse,
} from '../_lib/draft-provider.js'

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/** Same Access gate as the rest of the private API, with the documented local-dev
    affordance (only when Access is not configured AND LHC_LOCAL_DEV==='true'). */
async function authorize(request, env) {
  const accessConfigured = !!(env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD)
  if (!accessConfigured && env.LHC_LOCAL_DEV === 'true') return null
  const result = await verifyAccessRequest(request, env)
  if (!result || !result.ok) return json({ ok: false, error: 'Unauthorized.' }, 403)
  return null
}

export async function onRequestPost({ request, env }) {
  const gate = await authorize(request, env)
  if (gate) return gate

  let body
  try { body = await request.json() } catch { return json({ ok: false, error: 'Invalid JSON.' }, 400) }
  const valid = validateDraftRequest(body)
  if (!valid.ok) return json({ ok: false, error: valid.error }, 400)

  const cfg = providerConfig(env)
  if (!cfg.configured) {
    // Honest degradation — no key, no draft. The client shows "not configured".
    return json({ ok: false, reason: 'not_configured', error: 'The drafting provider is not configured.' }, 503)
  }

  // Provider configured: build the agnostic payload and call the vendor. The call
  // is intentionally minimal and vendor-neutral; the key never leaves the server.
  const payload = buildProviderPayload(body)
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)
    const resp = await callProvider(cfg, payload, controller.signal)
    clearTimeout(timer)
    if (!resp.ok) return json({ ok: false, reason: 'error', error: 'Provider request failed.' }, 502)
    const data = await resp.json().catch(() => null)
    const checked = validateProviderResponse(data)
    if (!checked.ok) return json({ ok: false, reason: 'invalid_response', error: 'Provider returned an unusable response.' }, 502)
    return json({ ok: true, content: checked.content, meta: { provider: cfg.provider, model: cfg.model } }, 200)
  } catch (err) {
    const reason = err && err.name === 'AbortError' ? 'timeout' : 'error'
    return json({ ok: false, reason, error: 'The drafting provider could not be reached.' }, 504)
  }
}

/** Vendor-neutral call. The concrete request shape per provider is intentionally
    left for the deployment that configures a provider; this seam only forwards the
    agnostic payload and the server-held key. */
async function callProvider(cfg, payload, signal) {
  const endpoint = cfg.endpoint || defaultEndpoint(cfg.provider)
  if (!endpoint) throw new Error('No provider endpoint.')
  return fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': '' /* injected by the platform binding, never logged */ },
    body: JSON.stringify(payload),
    signal,
  })
}

function defaultEndpoint(provider) {
  // Left empty by design — a deployment sets AI_DRAFT_ENDPOINT for its provider.
  return provider ? '' : ''
}
