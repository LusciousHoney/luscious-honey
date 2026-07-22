/**
 * /api/notifications — the House's notice desk.
 *
 *   GET  → recent notification state + a live staleness reading, for the
 *          Headquarters Notifications panel. Access-gated like /api/submissions.
 *   POST {action:'sweep'} → run the stale sweep (record + send digests).
 *          Callable by a verified Access session, OR by an external scheduler
 *          presenting `Authorization: Bearer <NOTIFY_SWEEP_KEY>` — Cloudflare
 *          Pages has no native cron trigger, so the sweep is exposed as an
 *          idempotent, cooldown-bounded endpoint any scheduler can drive.
 *
 * All state is D1 (migrations/0005_notifications.sql). Nothing here reads or
 * writes client storage.
 */

import { verifyAccessRequest } from '../_lib/access.js'
import {
  listNotifications, sweepStale, isStale, staleAfterHours, notifyRecipient,
} from '../_lib/notifications.js'
import { FINAL_STATUSES } from '../../shared/workflow.js'

export async function onRequestGet({ request, env }) {
  const gate = await authorize(request, env)
  if (gate) return gate
  if (!env.LHC_DB) return json({ ok: false, error: 'Database not connected.' }, 503)

  try {
    const [notifications, staleNow] = await Promise.all([
      listNotifications(env),
      currentlyStale(env),
    ])
    return json({
      ok: true,
      notifications,
      stale: staleNow,
      config: {
        recipientConfigured: !!notifyRecipient(env),
        staleAfterHours: staleAfterHours(env),
      },
    }, 200)
  } catch (err) {
    console.error('notifications GET error:', err)
    return json({ ok: false, error: 'The notice desk encountered an issue.' }, 500)
  }
}

export async function onRequestPost({ request, env }) {
  // A scheduler key authorizes the sweep without an Access session; otherwise
  // the same Access gate as every private API applies.
  if (!(await sweepKeyAuthorized(request, env))) {
    const gate = await authorize(request, env)
    if (gate) return gate
  }
  if (!env.LHC_DB) return json({ ok: false, error: 'Database not connected.' }, 503)

  let body = {}
  try { body = await request.json() } catch { /* action may be implied */ }
  if ((body.action || 'sweep') !== 'sweep') {
    return json({ ok: false, error: 'Unsupported action.' }, 400)
  }

  const result = await sweepStale(env)
  return json(result, result.ok ? 200 : 500)
}

/** The live staleness reading for the panel — display only; sends nothing. */
async function currentlyStale(env) {
  const threshold = staleAfterHours(env)
  const now = new Date()
  const { results } = await env.LHC_DB.prepare(`
    SELECT id, type, status, submitter_name AS name, created_at, updated_at
    FROM submissions
    WHERE status NOT IN (${FINAL_STATUSES.map(() => '?').join(', ')})
    ORDER BY updated_at ASC
    LIMIT 100
  `).bind(...FINAL_STATUSES).all()
  return results.filter((r) => isStale(r, now, threshold))
}

async function sweepKeyAuthorized(request, env) {
  const key = env && typeof env.NOTIFY_SWEEP_KEY === 'string' ? env.NOTIFY_SWEEP_KEY : ''
  if (!key) return false
  const header = request.headers.get('Authorization') || ''
  return header === `Bearer ${key}`
}

async function authorize(request, env) {
  const access = await verifyAccessRequest(request, env)
  if (!access.configured) {
    if (env.LHC_LOCAL_DEV === 'true') {
      console.warn('[notifications] Access not configured — LHC_LOCAL_DEV local bypass active.')
      return null
    }
    return json({ ok: false, error: 'Cloudflare Access is not configured for this deployment.' }, 503)
  }
  if (!access.ok) return json({ ok: false, error: 'Unauthorized — no valid Cloudflare Access session.' }, 401)
  return null
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'cache-control': 'no-store' },
  })
}
