/**
 * /api/submissions — the private, reusable review API.
 *
 * This is a SERVICE, not a UI: the canonical Editorial Office ("Dashboard for
 * LHC" sprint) will consume these endpoints. It intentionally does not render
 * or own any workspace of its own.
 *
 * Protected by Cloudflare Access (verified in functions/_lib/access.js). Fails
 * closed on every unauthorized path.
 *
 *   GET  /api/submissions?type=&status=      → list (filters optional)
 *   GET  /api/submissions?id=<n>             → one, with correspondence + audit
 *   POST /api/submissions { id, status }     → change status (audited)
 *   POST /api/submissions { id, note }        → add an internal editor note
 *
 * Local-dev affordance: when Access is NOT configured (no ACCESS_TEAM_DOMAIN /
 * ACCESS_AUD) AND env.LHC_LOCAL_DEV==='true' (set only via the gitignored
 * .dev.vars), the gate is skipped for local testing. In production Access is
 * configured, so this is inert and real verification always runs.
 */

import { verifyAccessRequest } from '../_lib/access.js'
import { STATUSES, STATUS_LABELS } from '../_lib/workflow.js'
import { listSubmissions, getSubmission, changeStatus, addMessage } from '../_lib/submissions.js'
import { listSubmissionTypes, getSubmissionType } from '../_lib/submission-types.js'

// A short editorial summary from a type's own renderer, when available.
function summarize(sub) {
  const type = getSubmissionType(sub.type)
  try { return type && type.editorSummary ? type.editorSummary(sub.fields) : '' }
  catch { return '' }
}

export async function onRequestGet({ request, env }) {
  const gate = await authorize(request, env)
  if (gate) return gate
  if (!env.LHC_DB) return json({ ok: false, error: 'Database not connected.' }, 503)

  const url = new URL(request.url)
  const idParam = url.searchParams.get('id')

  try {
    if (idParam) {
      const id = Number(idParam)
      if (!Number.isInteger(id) || id <= 0) return json({ ok: false, error: 'Invalid id.' }, 400)
      const submission = await getSubmission(env, id)
      if (!submission) return json({ ok: false, error: 'Submission not found.' }, 404)
      submission.summary = summarize(submission)
      return json({ ok: true, statuses: STATUSES, statusLabels: STATUS_LABELS, types: listSubmissionTypes(), submission }, 200)
    }

    const type = url.searchParams.get('type') || undefined
    const status = url.searchParams.get('status') || undefined
    if (status && !STATUSES.includes(status)) return json({ ok: false, error: 'Unsupported status filter.' }, 400)

    const submissions = (await listSubmissions(env, { type, status })).map(s => ({ ...s, summary: summarize(s) }))
    return json({ ok: true, statuses: STATUSES, statusLabels: STATUS_LABELS, types: listSubmissionTypes(), submissions }, 200)
  } catch (err) {
    console.error('submissions GET error:', err)
    return json({ ok: false, error: 'The desk encountered an issue.' }, 500)
  }
}

export async function onRequestPost({ request, env }) {
  const gate = await authorize(request, env)
  if (gate) return gate
  if (!env.LHC_DB) return json({ ok: false, error: 'Database not connected.' }, 503)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, error: 'Invalid request body.' }, 400)
  }

  const id = Number(body.id)
  if (!Number.isInteger(id) || id <= 0) return json({ ok: false, error: 'A valid submission id is required.' }, 400)

  const actor = editorIdentity(request)

  try {
    // Add an internal editor note.
    if (body.note !== undefined) {
      const note = String(body.note == null ? '' : body.note).trim().slice(0, 2000)
      if (!note) return json({ ok: false, error: 'The note is empty.' }, 400)
      const r = await addMessage(env, id, { kind: 'internal_note', body: note, author: actor })
      if (!r.ok) return json({ ok: false, error: r.error }, r.code || 400)
      return json({ ok: true, id, messageId: r.messageId }, 200)
    }

    // Change status.
    if (body.status !== undefined) {
      const r = await changeStatus(env, id, String(body.status || '').trim(), actor)
      if (!r.ok) return json({ ok: false, error: r.error }, r.code || 400)
      return json({ ok: true, id, status: r.status }, 200)
    }

    return json({ ok: false, error: 'Nothing to update.' }, 400)
  } catch (err) {
    console.error('submissions POST error:', err)
    return json({ ok: false, error: 'The desk encountered an issue.' }, 500)
  }
}

// The verified Access identity (email) becomes the audit actor when available.
function editorIdentity(request) {
  return request.headers.get('Cf-Access-Authenticated-User-Email') || 'editor'
}

async function authorize(request, env) {
  const access = await verifyAccessRequest(request, env)
  if (!access.configured) {
    if (env.LHC_LOCAL_DEV === 'true') {
      console.warn('[submissions] Access not configured — LHC_LOCAL_DEV local bypass active.')
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
