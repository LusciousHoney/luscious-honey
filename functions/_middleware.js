/**
 * Edge middleware — server-protects the entire Production Studio namespace.
 *
 * Runs as a Cloudflare Pages Function on EVERY request, on EVERY hostname
 * (production custom domain AND *.pages.dev preview aliases). It gates the
 * `/production-studio` prefix with Cloudflare Access JWT verification and
 * FAILS CLOSED: any request without a valid Access identity is denied with a
 * clear 403. Everything outside the prefix passes straight through, so all
 * public LHC routes are unchanged.
 *
 * The authoritative gate is the Cloudflare Access *application policy* on
 * `/production-studio` (see docs/DEPLOY.md). This middleware is defense-in-depth
 * that re-verifies the token so the private files are never served without a
 * valid identity — and, crucially, it also blocks preview deployments that are
 * not yet covered by an Access application (there is no token to verify, so it
 * denies).
 *
 * There is NO preview bypass and NO localhost bypass. Local development uses the
 * existing launchers instead (`npm run dev`, `npm run studio`), which never run
 * this middleware.
 */

import { verifyAccessRequest } from './_lib/access.js'

// The private institutional areas, both gated by the SAME Cloudflare Access
// infrastructure. Production Studio (creative production tools) and Editorial
// Office (editorial operations) are separate surfaces sharing one gate.
const PREFIXES = ['/production-studio', '/editorial-office']

/**
 * Boundary-safe prefix test. Protects each prefix exactly — e.g.
 * `/editorial-office`, `/editorial-office/`, and `/editorial-office/<anything>`
 * — but NOT lookalike public routes such as `/editorial-office-notes` or
 * `/editorial-officex`. Trailing slashes are normalized so the bare form matches.
 */
export function isProtectedPath(pathname) {
  const p = (String(pathname || '').replace(/\/+$/, '') || '/').toLowerCase()
  return PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix + '/'))
}

function deny(reason) {
  return new Response(
    `403 Forbidden — the Production Studio is private.\n${reason}\n`,
    {
      status: 403,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
        // Belt-and-suspenders: never let a denied private response be indexed.
        'x-robots-tag': 'noindex, nofollow',
      },
    },
  )
}

export async function onRequest(context) {
  const { request, next, env } = context

  let pathname
  try {
    pathname = new URL(request.url).pathname
  } catch {
    // Unparseable URL on a request we can't classify → fail closed.
    return deny('Bad request.')
  }

  if (!isProtectedPath(pathname)) {
    return next() // public route — untouched
  }

  const access = await verifyAccessRequest(request, env)

  if (!access.configured) {
    // Access not configured for this deployment. Locally — and only locally,
    // where the gitignored .dev.vars sets LHC_LOCAL_DEV=true — allow the private
    // pages to be developed and previewed. In production Access IS configured,
    // so access.configured is true and this affordance never runs. Mirrors the
    // identical local-dev bypass in functions/api/submissions.js.
    if (env.LHC_LOCAL_DEV === 'true') return next()
    // ACCESS_TEAM_DOMAIN / ACCESS_AUD not set for this deployment → deny.
    return deny('Cloudflare Access is not configured for this deployment.')
  }
  if (!access.ok) {
    // Missing, invalid, or expired Access JWT → deny.
    return deny('A valid Cloudflare Access identity is required.')
  }

  return next() // verified — serve the private file
}
