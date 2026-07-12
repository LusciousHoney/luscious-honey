/**
 * Submission services — the reusable core the future Editorial Office UI (the
 * "Dashboard for LHC" sprint) will consume. Every submission type shares these
 * services: creation, the correspondence thread, the append-only audit trail,
 * and the canonical workflow. Nothing here is Artist-Feature-specific.
 *
 * Storage: Cloudflare D1 (env.LHC_DB), tables from migrations/0001_submissions.sql.
 */

import { STATUSES, INITIAL_PUBLIC_STATUS } from './workflow.js'
import { sendEmail, compact } from './email.js'

/**
 * Create a submission from a validated type payload, log the 'created' audit
 * event, and (best-effort) send + record the branded acknowledgment as the
 * first correspondence message. Never throws to the caller on email failure —
 * the submission is saved regardless.
 *
 * @returns { id }
 */
export async function createSubmission(env, { type, name, email, fields, acknowledgment }) {
  const insert = await env.LHC_DB.prepare(`
    INSERT INTO submissions (type, status, submitter_name, submitter_email, fields)
    VALUES (?, ?, ?, ?, ?)
  `).bind(type, INITIAL_PUBLIC_STATUS, name, email, JSON.stringify(fields || {})).run()

  const id = insert.meta && insert.meta.last_row_id

  await logEvent(env, id, {
    actor: 'public',
    action: 'created',
    to_status: INITIAL_PUBLIC_STATUS,
    detail: type,
  })

  if (acknowledgment) {
    await sendAcknowledgment(env, { submissionId: id, to: email, acknowledgment })
  }

  return { id }
}

// Send the acknowledgment email and record it as message #1 with delivery state.
async function sendAcknowledgment(env, { submissionId, to, acknowledgment }) {
  // Create the message row first (delivery pending), so it exists even if the
  // send throws.
  const msg = await env.LHC_DB.prepare(`
    INSERT INTO submission_messages
      (submission_id, kind, channel, author, body, delivery_status)
    VALUES (?, 'acknowledgment', 'email', 'system', ?, 'sending')
  `).bind(submissionId, acknowledgment.text || '').run()
  const messageId = msg.meta && msg.meta.last_row_id

  try {
    const result = await sendEmail(env, { to, ...acknowledgment })
    if (result.ok) {
      await env.LHC_DB.prepare(`
        UPDATE submission_messages
        SET delivery_status = 'sent', provider_id = ?, delivery_error = NULL
        WHERE id = ?
      `).bind(result.id, messageId).run()
    } else {
      await env.LHC_DB.prepare(`
        UPDATE submission_messages
        SET delivery_status = 'failed', delivery_error = ?
        WHERE id = ?
      `).bind(compact(result.error), messageId).run()
    }
  } catch (err) {
    await env.LHC_DB.prepare(
      `UPDATE submission_messages SET delivery_status = 'failed', delivery_error = ? WHERE id = ?`
    ).bind(compact('Send threw: ' + (err && err.message)), messageId).run()
  }

  await logEvent(env, submissionId, { actor: 'system', action: 'message_added', detail: 'acknowledgment' })
}

// List submissions, newest first, optionally filtered by type and/or status.
export async function listSubmissions(env, { type, status, limit = 300 } = {}) {
  const where = []
  const binds = []
  if (type)   { where.push('type = ?');   binds.push(type) }
  if (status) { where.push('status = ?'); binds.push(status) }
  const sql = `
    SELECT id, type, status, submitter_name, submitter_email, fields, created_at, updated_at
    FROM submissions
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY created_at DESC
    LIMIT ?`
  binds.push(limit)
  const { results } = await env.LHC_DB.prepare(sql).bind(...binds).all()
  return results.map(rowToSubmission)
}

// One submission with its full correspondence thread and audit trail.
export async function getSubmission(env, id) {
  const row = await env.LHC_DB.prepare(`
    SELECT id, type, status, submitter_name, submitter_email, fields, created_at, updated_at
    FROM submissions WHERE id = ?
  `).bind(id).first()
  if (!row) return null

  const [{ results: messages }, { results: events }] = await Promise.all([
    env.LHC_DB.prepare(`
      SELECT id, kind, channel, author, body, delivery_status, provider_id, delivery_error, created_at
      FROM submission_messages WHERE submission_id = ? ORDER BY created_at ASC
    `).bind(id).all(),
    env.LHC_DB.prepare(`
      SELECT id, actor, action, from_status, to_status, detail, created_at
      FROM submission_events WHERE submission_id = ? ORDER BY created_at ASC
    `).bind(id).all(),
  ])

  return { ...rowToSubmission(row), messages, events }
}

// Change status with validation + audit. actor is the editor identity.
export async function changeStatus(env, id, newStatus, actor) {
  if (!STATUSES.includes(newStatus)) return { ok: false, error: 'Unsupported status.', code: 400 }
  const row = await env.LHC_DB.prepare('SELECT status FROM submissions WHERE id = ?').bind(id).first()
  if (!row) return { ok: false, error: 'Submission not found.', code: 404 }

  if (row.status !== newStatus) {
    await env.LHC_DB.prepare(
      `UPDATE submissions SET status = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(newStatus, id).run()
    await logEvent(env, id, {
      actor: actor || 'editor',
      action: 'status_changed',
      from_status: row.status,
      to_status: newStatus,
    })
  }
  return { ok: true, id, status: newStatus }
}

// Add a message to the thread. kind 'internal_note' is editor-only (never sent,
// never public); kind 'outbound' could later be emailed. V1 adds notes only.
export async function addMessage(env, id, { kind, body, author }) {
  const row = await env.LHC_DB.prepare('SELECT id FROM submissions WHERE id = ?').bind(id).first()
  if (!row) return { ok: false, error: 'Submission not found.', code: 404 }

  const res = await env.LHC_DB.prepare(`
    INSERT INTO submission_messages (submission_id, kind, channel, author, body)
    VALUES (?, ?, NULL, ?, ?)
  `).bind(id, kind, author || 'editor', body).run()

  await logEvent(env, id, { actor: author || 'editor', action: 'message_added', detail: kind })
  return { ok: true, id, messageId: res.meta && res.meta.last_row_id }
}

// ── internal ────────────────────────────────────────────────────────────────
async function logEvent(env, submissionId, { actor, action, from_status = null, to_status = null, detail = null }) {
  await env.LHC_DB.prepare(`
    INSERT INTO submission_events (submission_id, actor, action, from_status, to_status, detail)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(submissionId, actor, action, from_status, to_status, detail).run()
}

function rowToSubmission(r) {
  let fields = {}
  try { fields = JSON.parse(r.fields || '{}') } catch { fields = {} }
  return {
    id: r.id,
    type: r.type,
    status: r.status,
    name: r.submitter_name,
    email: r.submitter_email,
    fields,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }
}
