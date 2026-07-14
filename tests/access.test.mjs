/* =============================================================================
   Access-control tests — the Production Studio fail-closed gate.

   Exercises functions/_middleware.js + functions/_lib/access.js directly:
     - boundary-safe prefix matching (protected vs. lookalike public routes)
     - protected root, nested route, and static assets are denied without auth
     - public routes pass straight through
     - missing Access configuration  → deny (403)
     - missing token                 → deny (403)
     - invalid / expired / wrong-aud token → deny (403)
     - a real, valid Access JWT       → allowed (calls next())

   Valid/expired/invalid tokens are signed with a real ephemeral RSA key; the
   JWKS endpoint is mocked via globalThis.fetch so no network is touched.
   Run with:  npm test   (Node's built-in runner, no framework)
   ============================================================================= */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { onRequest, isProtectedPath } from '../functions/_middleware.js'

const TEAM = 'test-team.cloudflareaccess.com'
const AUD = 'test-aud-abc123'
const KID = 'test-kid-1'

// ── Ephemeral RSA key + mocked JWKS ─────────────────────────────────────────
const { publicKey, privateKey } = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true,
  ['sign', 'verify'],
)
const publicJwk = await crypto.subtle.exportKey('jwk', publicKey)
publicJwk.kid = KID
publicJwk.alg = 'RS256'
publicJwk.use = 'sig'

// A second, unrelated key — used to forge a same-kid token with a bad signature.
const wrong = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true,
  ['sign', 'verify'],
)

const CERTS_URL = `https://${TEAM}/cdn-cgi/access/certs`
globalThis.fetch = async (url) => {
  if (String(url) === CERTS_URL) {
    return new Response(JSON.stringify({ keys: [publicJwk] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  throw new Error(`unexpected fetch in test: ${url}`)
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function b64url(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function signJwt(payload, { key = privateKey, kid = KID, alg = 'RS256' } = {}) {
  const header = b64url(JSON.stringify({ alg, kid, typ: 'JWT' }))
  const body = b64url(JSON.stringify(payload))
  const sig = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, key, new TextEncoder().encode(`${header}.${body}`))
  return `${header}.${body}.${b64url(sig)}`
}

const now = () => Math.floor(Date.now() / 1000)
const CONFIG = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD }
const NEXT_BODY = 'OK-NEXT-PASSTHROUGH'

function ctx(path, { headers = {}, env = CONFIG, host = 'luscioushoneycollective.com' } = {}) {
  const request = new Request(`https://${host}${path}`, { headers })
  return {
    request,
    env,
    next: async () => new Response(NEXT_BODY, { status: 200 }),
  }
}

async function run(path, opts) {
  return onRequest(ctx(path, opts))
}

// ── 1) Boundary-safe prefix matching ────────────────────────────────────────
test('isProtectedPath: protected root, nested, and assets match', () => {
  for (const p of [
    '/production-studio',
    '/production-studio/',
    '/production-studio/voice-notes',
    '/production-studio/voice-notes/',
    '/production-studio/voice-notes/index.html',
    '/production-studio/voice-notes/script.js',
    '/production-studio/voice-notes/styles.css',
    '/production-studio/voice-notes/serve.mjs',
    '/PRODUCTION-STUDIO/', // case-insensitive
    '/editorial-office',   // second private area, same gate
    '/editorial-office/',
    '/editorial-office/submission-review',
    '/EDITORIAL-OFFICE/', // case-insensitive
    '/headquarters',       // third private area, same gate
    '/headquarters/',
    '/headquarters/executive',
    '/HEADQUARTERS/',      // case-insensitive
  ]) {
    assert.equal(isProtectedPath(p), true, `expected protected: ${p}`)
  }
})

test('isProtectedPath: public + lookalike routes are NOT matched', () => {
  for (const p of [
    '/',
    '/index.html',
    '/publishing.html',
    '/press.html',
    '/production-studio-notes',   // boundary: hyphen, not a slash
    '/production-studiox',        // boundary: extra char
    '/production-studioabc/thing',
    '/not/production-studio',     // prefix not at path start
    '/editorial-office-notes',    // boundary: hyphen, not a slash
    '/editorial-officex',         // boundary: extra char
    '/headquarters-news',         // boundary: hyphen, not a slash
    '/headquartersx',             // boundary: extra char
    '/artist-features',           // the PUBLIC intake page is never gated
  ]) {
    assert.equal(isProtectedPath(p), false, `expected public: ${p}`)
  }
})

// ── 2) Public routes pass through untouched ─────────────────────────────────
test('public route → next() is called (no gate)', async () => {
  const res = await run('/publishing.html')
  assert.equal(res.status, 200)
  assert.equal(await res.text(), NEXT_BODY)
})

test('lookalike public route → next() is called (path boundary)', async () => {
  const res = await run('/production-studio-notes', { env: {} }) // even with no config
  assert.equal(res.status, 200)
  assert.equal(await res.text(), NEXT_BODY)
})

// ── 3) Missing configuration → deny ─────────────────────────────────────────
test('protected root, no Access config → 403', async () => {
  const res = await run('/production-studio/', { env: {} })
  assert.equal(res.status, 403)
})

test('protected root, partial config (team only) → 403', async () => {
  const res = await run('/production-studio', { env: { ACCESS_TEAM_DOMAIN: TEAM } })
  assert.equal(res.status, 403)
})

// ── 4) Missing token → deny (config present) ────────────────────────────────
test('protected root, configured but no token → 403', async () => {
  const res = await run('/production-studio/')
  assert.equal(res.status, 403)
})

test('protected nested asset, no token → 403', async () => {
  for (const p of [
    '/production-studio/voice-notes/',
    '/production-studio/voice-notes/index.html',
    '/production-studio/voice-notes/script.js',
    '/production-studio/voice-notes/serve.mjs',
  ]) {
    const res = await run(p)
    assert.equal(res.status, 403, `expected 403 for ${p}`)
  }
})

test('Headquarters root, configured but no token → 403 (fails closed)', async () => {
  const res = await run('/headquarters/')
  assert.equal(res.status, 403)
})

test('Headquarters nested route, no token → 403', async () => {
  const res = await run('/headquarters/executive')
  assert.equal(res.status, 403)
})

// ── 5) Invalid / expired / wrong-aud tokens → deny ──────────────────────────
test('garbage token → 403', async () => {
  const res = await run('/production-studio/', { headers: { 'Cf-Access-Jwt-Assertion': 'not-a-jwt' } })
  assert.equal(res.status, 403)
})

test('expired token (valid signature) → 403', async () => {
  const token = await signJwt({ aud: AUD, iat: now() - 7200, exp: now() - 3600 })
  const res = await run('/production-studio/', { headers: { 'Cf-Access-Jwt-Assertion': token } })
  assert.equal(res.status, 403)
})

test('wrong audience → 403', async () => {
  const token = await signJwt({ aud: 'some-other-aud', iat: now(), exp: now() + 3600 })
  const res = await run('/production-studio/', { headers: { 'Cf-Access-Jwt-Assertion': token } })
  assert.equal(res.status, 403)
})

test('bad signature (same kid, wrong key) → 403', async () => {
  const token = await signJwt({ aud: AUD, iat: now(), exp: now() + 3600 }, { key: wrong.privateKey })
  const res = await run('/production-studio/', { headers: { 'Cf-Access-Jwt-Assertion': token } })
  assert.equal(res.status, 403)
})

// ── 6) A real, valid token → allowed ────────────────────────────────────────
test('valid token → next() is called (200 passthrough)', async () => {
  const token = await signJwt({ aud: AUD, iat: now(), exp: now() + 3600, email: 'editor@example.com' })
  const res = await run('/production-studio/voice-notes/', { headers: { 'Cf-Access-Jwt-Assertion': token } })
  assert.equal(res.status, 200)
  assert.equal(await res.text(), NEXT_BODY)
})
