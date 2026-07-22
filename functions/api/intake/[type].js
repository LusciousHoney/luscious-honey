/**
 * POST /api/intake/:type — public editorial intake (any submission type).
 *
 * Generic entry point for every public submission form. The `:type` selects a
 * manifest from the submission-type registry, which validates the payload
 * server-side; the shared submission service stores it, logs the audit event,
 * and sends the branded acknowledgment. Artist Features posts to
 * /api/intake/artist-feature; future types reuse this endpoint unchanged.
 *
 * Responses never leak internal error detail. On failure the client keeps the
 * submitter's typed values and can retry.
 */

import { getSubmissionType } from '../../_lib/submission-types.js'
import { createSubmission } from '../../_lib/submissions.js'
import { recordAndSendArrival } from '../../_lib/notifications.js'

export async function onRequest({ request, params, env }) {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed.' }, 405)
  }

  // URLs are kebab-case (/api/intake/artist-feature); registry ids are
  // snake_case (artist_feature), matching the stored submissions.type value.
  const typeId = String(params.type || '').replace(/[^a-z0-9_-]/gi, '').replace(/-/g, '_')
  const type = getSubmissionType(typeId)
  if (!type) {
    return json({ ok: false, error: 'Unknown submission type.' }, 404)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, error: 'We couldn’t read that submission. Please try again.' }, 400)
  }

  // Honeypot: a hidden field real people never fill. Spam that fills it gets a
  // normal-looking success, but nothing is stored. Always on, zero friction.
  if (String(body.company || '').trim()) {
    return json({ ok: true }, 201)
  }

  // Cloudflare Turnstile, only enforced when a secret is configured.
  if (env.TURNSTILE_SECRET_KEY) {
    const ok = await verifyTurnstile(env.TURNSTILE_SECRET_KEY, body.turnstileToken, request)
    if (!ok) {
      return json({ ok: false, error: 'We couldn’t verify your submission. Please refresh and try again.' }, 403)
    }
  }

  // Authoritative server-side validation, owned by the type manifest.
  const v = type.validate(body)
  if (!v.ok) {
    return json({ ok: false, errors: v.errors, error: 'Please check the highlighted fields.' }, 422)
  }

  if (!env.LHC_DB) {
    console.error('LHC_DB binding is not configured.')
    return json({ ok: false, error: 'We’re unable to receive submissions right now. Please try again shortly.' }, 503)
  }

  try {
    const { id } = await createSubmission(env, {
      type: type.id,
      name: v.name,
      email: v.email,
      fields: v.fields,
      acknowledgment: typeof type.acknowledgment === 'function' ? type.acknowledgment({ name: v.name }) : null,
    })
    // House arrival notice — recorded in D1 before any send; idempotent per
    // submission; a send failure is a durable 'failed' row, never a thrown
    // error (the submitter's 201 does not depend on the House's own notice).
    await recordAndSendArrival(env, { id, type: type.id, name: v.name })
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return json({
        ok: false,
        error: 'It looks like you’ve already introduced yourself — your note is already on the desk.',
      }, 409)
    }
    console.error('Submission create error:', err)
    return json({ ok: false, error: 'Something went wrong on our end. Please try again shortly.' }, 500)
  }

  return json({ ok: true }, 201)
}

async function verifyTurnstile(secret, token, request) {
  if (!token) return false
  try {
    const form = new FormData()
    form.append('secret', secret)
    form.append('response', String(token))
    const ip = request.headers.get('CF-Connecting-IP')
    if (ip) form.append('remoteip', ip)
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    })
    const data = await res.json()
    return !!(data && data.success)
  } catch {
    return false
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'cache-control': 'no-store' },
  })
}
