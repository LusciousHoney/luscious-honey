/**
 * GET /api/headquarters/briefing — the Executive Office Daily Briefing.
 *
 * A READ-ONLY aggregation over the existing submissions spine. The Headquarters
 * owns no data and adds no table: this endpoint calls the authoritative
 * `listSubmissions` and the pure `composeBriefing`, then attaches a one-line
 * editorial summary (from the submission-type registry) to the oldest-awaiting
 * and recent items — exactly the enrichment `/api/submissions` already uses.
 *
 * Protected by Cloudflare Access (functions/_lib/access.js). Mirrors the
 * local-dev affordance in functions/api/submissions.js: when Access is not
 * configured AND env.LHC_LOCAL_DEV==='true' (gitignored .dev.vars), the gate is
 * skipped for local testing; in production Access is configured, so real
 * verification always runs. Fails closed on every unauthorized path.
 */

import { verifyAccessRequest } from '../../_lib/access.js'
import { listSubmissions } from '../../_lib/submissions.js'
import { composeBriefing } from '../../_lib/briefing.js'
import { getSubmissionType } from '../../_lib/submission-types.js'
import { STATUS_LABELS } from '../../_lib/workflow.js'

export async function onRequestGet({ request, env }) {
  const gate = await authorize(request, env)
  if (gate) return gate
  if (!env.LHC_DB) return json({ ok: false, error: 'Database not connected.' }, 503)

  try {
    const submissions = await listSubmissions(env, {})
    const briefing = composeBriefing(submissions, new Date())

    if (briefing.oldestAwaiting) briefing.oldestAwaiting.summary = summarizeOne(submissions, briefing.oldestAwaiting.id)
    briefing.recent = briefing.recent.map((r) => ({ ...r, summary: summarizeOne(submissions, r.id) }))

    return json({ ok: true, generatedAt: new Date().toISOString(), statusLabels: STATUS_LABELS, ...briefing }, 200)
  } catch (err) {
    console.error('briefing GET error:', err)
    return json({ ok: false, error: 'The desk encountered an issue.' }, 500)
  }
}

// A short editorial summary for an item, from its type's own renderer.
function summarizeOne(submissions, id) {
  const sub = submissions.find((s) => s.id === id)
  if (!sub) return ''
  const type = getSubmissionType(sub.type)
  try { return type && type.editorSummary ? type.editorSummary(sub.fields) : '' }
  catch { return '' }
}

async function authorize(request, env) {
  const access = await verifyAccessRequest(request, env)
  if (!access.configured) {
    if (env.LHC_LOCAL_DEV === 'true') {
      console.warn('[briefing] Access not configured — LHC_LOCAL_DEV local bypass active.')
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
