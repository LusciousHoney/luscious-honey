/**
 * TK Guest Book endpoint — /api/tribute/tk/guestbook
 *
 *   POST  (public)  — leave a reflection. Stored as `pending`; never shown
 *                     publicly until Luscious Honey approves it by hand.
 *   GET   (admin)   — retrieve pending submissions. Gated by Cloudflare Access
 *                     (fails closed, exactly like the Production Studio), so
 *                     only an authenticated House identity can read the queue.
 *
 * Storage is Cloudflare D1, binding name `DB` (see wrangler.toml / DEPLOY.md).
 * Abuse protection: honeypot field, server-side length limits + validation,
 * control-char stripping, and IP-hash rate limiting. If `DB` is not bound the
 * POST returns 503 rather than pretending to succeed.
 */

import { validate, TRIBUTE_ID } from '../../../_lib/guestbook.js'
import { verifyAccessRequest } from '../../../_lib/access.js'

// Rate-limit thresholds, per client IP (hashed).
const MIN_GAP_SECONDS = 20     // reject a second submission within 20s
const MAX_PER_HOUR = 10        // reject after 10 submissions in a rolling hour

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  })
}

// SHA-256 the client IP so we never store a raw address. Salted with the
// tribute id so the same visitor's hash isn't portable across tributes.
async function hashIp(ip) {
  const data = new TextEncoder().encode(`${TRIBUTE_ID}:${ip || 'unknown'}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(digest)
  let hex = ''
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex
}

// ── POST — public submission ────────────────────────────────────────────────
export async function onRequestPost(context) {
  const { request, env } = context

  if (!env || !env.DB) {
    return json({ ok: false, error: 'The guest book is temporarily unavailable. Please try again later.' }, 503)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, error: 'Malformed submission.' }, 400)
  }

  const result = validate(body)

  // Honeypot tripped: pretend success so bots learn nothing. Nothing is stored.
  if (!result.ok && result.spam) {
    return json({ ok: true })
  }
  if (!result.ok) {
    return json({ ok: false, error: result.error }, 400)
  }

  const ip = request.headers.get('CF-Connecting-IP') || ''
  const ipHash = await hashIp(ip)

  // Rate limit: reads against this ip_hash's recent history.
  try {
    const recent = await env.DB.prepare(
      `SELECT
         COUNT(*) AS hourly,
         MAX(created_at) AS last_at
       FROM tribute_guestbook
       WHERE tribute_id = ?1
         AND ip_hash = ?2
         AND created_at >= datetime('now', '-1 hour')`,
    ).bind(TRIBUTE_ID, ipHash).first()

    if (recent) {
      if (recent.hourly >= MAX_PER_HOUR) {
        return json({ ok: false, error: 'You’ve left several reflections recently. Please try again later.' }, 429)
      }
      if (recent.last_at) {
        const gap = await env.DB.prepare(
          `SELECT (julianday('now') - julianday(?1)) * 86400 AS seconds`,
        ).bind(recent.last_at).first()
        if (gap && gap.seconds != null && gap.seconds < MIN_GAP_SECONDS) {
          return json({ ok: false, error: 'That was quick — please wait a moment before submitting again.' }, 429)
        }
      }
    }

    await env.DB.prepare(
      `INSERT INTO tribute_guestbook (tribute_id, display_name, reflection, status, created_at, ip_hash)
       VALUES (?1, ?2, ?3, 'pending', datetime('now'), ?4)`,
    ).bind(TRIBUTE_ID, result.value.display_name, result.value.reflection, ipHash).run()
  } catch {
    return json({ ok: false, error: 'We couldn’t save your reflection. Please try again.' }, 500)
  }

  return json({ ok: true })
}

// ── GET — admin retrieval (Cloudflare Access gated, fails closed) ────────────
export async function onRequestGet(context) {
  const { request, env } = context

  const access = await verifyAccessRequest(request, env)
  if (!access.configured || !access.ok) {
    return json(
      { ok: false, error: 'A valid Cloudflare Access identity is required.' },
      403,
      { 'x-robots-tag': 'noindex, nofollow' },
    )
  }

  if (!env || !env.DB) {
    return json({ ok: false, error: 'Database not bound.' }, 503, { 'x-robots-tag': 'noindex, nofollow' })
  }

  const url = new URL(request.url)
  const status = (url.searchParams.get('status') || 'pending').toLowerCase()
  const allowed = new Set(['pending', 'active', 'declined', 'all'])
  const filter = allowed.has(status) ? status : 'pending'

  try {
    const query = filter === 'all'
      ? env.DB.prepare(
          `SELECT id, tribute_id, display_name, reflection, status, created_at, approved_at, approved_by
           FROM tribute_guestbook
           WHERE tribute_id = ?1
           ORDER BY created_at DESC
           LIMIT 500`,
        ).bind(TRIBUTE_ID)
      : env.DB.prepare(
          `SELECT id, tribute_id, display_name, reflection, status, created_at, approved_at, approved_by
           FROM tribute_guestbook
           WHERE tribute_id = ?1 AND status = ?2
           ORDER BY created_at DESC
           LIMIT 500`,
        ).bind(TRIBUTE_ID, filter)

    const { results } = await query.all()
    return json(
      { ok: true, status: filter, count: results.length, submissions: results },
      200,
      { 'x-robots-tag': 'noindex, nofollow' },
    )
  } catch {
    return json({ ok: false, error: 'Query failed.' }, 500, { 'x-robots-tag': 'noindex, nofollow' })
  }
}
