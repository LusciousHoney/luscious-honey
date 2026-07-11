/**
 * Cloudflare Access JWT verification — WebCrypto only, no npm dependency.
 *
 * Reused from the Pull Me Under Property Manager gate. Verifies the
 * `Cf-Access-Jwt-Assertion` header against the team's JWKS endpoint
 * (https://${ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs), checking the RS256
 * signature, audience, and expiry. Fails closed on every error path — missing
 * config, missing token, bad signature, expired token, or wrong audience all
 * resolve to "not authorized" with no further detail leaked.
 *
 * NOTE: This LHC copy deliberately omits the PMU preview-test bypass. There is
 * no way to skip verification here; preview deployments are only reachable when
 * covered by a real Cloudflare Access application (see docs/DEPLOY.md).
 *
 * Usage:
 *   const access = await verifyAccessRequest(request, env)
 *   if (!access.configured) → config missing (ACCESS_TEAM_DOMAIN / ACCESS_AUD)
 *   if (!access.ok)         → missing/invalid/expired token
 *   access.payload          → decoded JWT claims, once verified
 */

// Module-level JWKS cache, keyed by team domain (a single Worker isolate
// may in principle serve multiple domains across requests).
const jwksCache = new Map()

export async function verifyAccessRequest(request, env) {
  const teamDomain = env && env.ACCESS_TEAM_DOMAIN
  const aud        = env && env.ACCESS_AUD

  if (!teamDomain || !aud) {
    return { ok: false, configured: false }
  }

  const token = request.headers.get('Cf-Access-Jwt-Assertion')
  if (!token) {
    return { ok: false, configured: true }
  }

  try {
    const payload = await verifyJwt(token, teamDomain, aud)
    return payload ? { ok: true, configured: true, payload } : { ok: false, configured: true }
  } catch {
    // Any parsing/crypto/network failure fails closed as unauthorized.
    return { ok: false, configured: true }
  }
}

async function verifyJwt(token, teamDomain, aud) {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [headerB64, payloadB64, sigB64] = parts

  const header  = JSON.parse(base64UrlDecodeToString(headerB64))
  const payload = JSON.parse(base64UrlDecodeToString(payloadB64))

  if (header.alg !== 'RS256' || !header.kid) return null

  const key = await getSigningKey(teamDomain, header.kid)
  if (!key) return null

  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  const signature     = base64UrlDecodeToBytes(sigB64)

  const valid = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    signature,
    signingInput,
  )
  if (!valid) return null

  // ── Claim validation ────────────────────────────────────────────────────
  const now = Math.floor(Date.now() / 1000)
  const CLOCK_SKEW_SECONDS = 60

  const audClaim = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
  if (!audClaim.includes(aud)) return null

  if (typeof payload.exp !== 'number' || now >= payload.exp + CLOCK_SKEW_SECONDS) return null

  // iat must exist, be a number, and not be in the future beyond clock skew.
  if (typeof payload.iat !== 'number' || payload.iat > now + CLOCK_SKEW_SECONDS) return null

  return payload
}

async function getSigningKey(teamDomain, kid) {
  let jwks = jwksCache.get(teamDomain)

  let key = jwks && findKey(jwks, kid)
  if (!key) {
    // Cache miss (or first request for this domain) — (re)fetch JWKS.
    jwks = await fetchJwks(teamDomain)
    if (!jwks) return null
    jwksCache.set(teamDomain, jwks)
    key = findKey(jwks, kid)
  }
  if (!key) return null

  return crypto.subtle.importKey(
    'jwk',
    key,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )
}

function findKey(jwks, kid) {
  return (jwks.keys || []).find(k => k.kid === kid) || null
}

async function fetchJwks(teamDomain) {
  try {
    const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function base64UrlToBase64(input) {
  let b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4) b64 += '='
  return b64
}

function base64UrlDecodeToString(input) {
  return atob(base64UrlToBase64(input))
}

function base64UrlDecodeToBytes(input) {
  const binary = atob(base64UrlToBase64(input))
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
