/**
 * Notification services — the outbound layer on the submissions spine.
 *
 * Closes the two gaps the operational audit named: nobody is told when a
 * submission arrives, and a matter gone quiet surfaces to no one unless the
 * Founder opens Headquarters. Composition on the EXISTING D1 spine only —
 * no new engine, no client-side store, nothing touches localStorage.
 *
 * Invariants:
 *   * The notification row is written BEFORE any send is attempted, so a
 *     failed (or unconfigured) send is itself a durable D1 record.
 *   * 'arrival' fires at most once per submission (partial unique index,
 *     migrations/0005_notifications.sql) — retries can never double-notify.
 *   * 'stale' re-notification is bounded by a cooldown against the latest
 *     'stale' row for that submission.
 *   * A send failure NEVER throws to the caller: intake must keep returning
 *     201 to the submitter regardless of the House's own notification fate.
 *
 * Env (all optional; absence is recorded honestly, never fabricated):
 *   ARRIVAL_NOTIFY_EMAIL  — where new-arrival notices go (the submissions desk).
 *   SWEEP_NOTIFY_EMAIL    — where gone-quiet digest notices go.
 *   STALE_AFTER_HOURS     — hours in a non-terminal status before a submission
 *                           counts as stale (default 48).
 *   STALE_COOLDOWN_HOURS  — minimum hours between 'stale' notices for the same
 *                           still-stale submission (default 72).
 */

import { FINAL_STATUSES, STATUS_LABELS } from '../../shared/workflow.js'
import { sendEmail, compact, escapeHtml } from './email.js'

export const DEFAULT_STALE_AFTER_HOURS = 48
export const DEFAULT_STALE_COOLDOWN_HOURS = 72

/* --- configuration (pure, testable) ---------------------------------------- */

function positiveHours(raw, fallback) {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function staleAfterHours(env) {
  return positiveHours(env && env.STALE_AFTER_HOURS, DEFAULT_STALE_AFTER_HOURS)
}

export function staleCooldownHours(env) {
  return positiveHours(env && env.STALE_COOLDOWN_HOURS, DEFAULT_STALE_COOLDOWN_HOURS)
}

function cleanAddress(raw) {
  const to = typeof raw === 'string' ? raw.trim() : ''
  return to || null
}

/** Where new-arrival notices go (the submissions desk). */
export function arrivalRecipient(env) {
  return cleanAddress(env && env.ARRIVAL_NOTIFY_EMAIL)
}

/** Where gone-quiet digest notices go. */
export function sweepRecipient(env) {
  return cleanAddress(env && env.SWEEP_NOTIFY_EMAIL)
}

/* --- staleness decisions (pure, testable) ----------------------------------- */

/** A submission is stale when its status is non-terminal and it last moved at
    or beyond the threshold. Boundary inclusive: exactly `thresholdHours` old
    counts as stale. Unparseable timestamps are NOT stale (never guess). */
export function isStale(submission, now, thresholdHours) {
  if (!submission || FINAL_STATUSES.includes(submission.status)) return false
  const moved = Date.parse(sqliteUtc(submission.updated_at || submission.created_at))
  if (!Number.isFinite(moved)) return false
  return now.getTime() - moved >= thresholdHours * 3600_000
}

/** May a fresh 'stale' notice go out, given the latest prior one? Boundary
    inclusive: exactly `cooldownHours` since the last notice re-arms it. */
export function cooldownElapsed(lastNoticeAt, now, cooldownHours) {
  if (!lastNoticeAt) return true
  const last = Date.parse(sqliteUtc(lastNoticeAt))
  if (!Number.isFinite(last)) return true
  return now.getTime() - last >= cooldownHours * 3600_000
}

/** D1/SQLite datetime('now') yields "YYYY-MM-DD HH:MM:SS" (UTC, no zone).
    Normalise to ISO-with-Z so Date.parse reads it as UTC, not local time.
    Strings that already carry a zone or 'T' pass through unchanged. */
export function sqliteUtc(ts) {
  const s = String(ts || '')
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s) ? s.replace(' ', 'T') + 'Z' : s
}

/* --- arrival notice (idempotent) -------------------------------------------- */

/**
 * Record + send the one arrival notice for a new submission. Idempotent: the
 * partial unique index makes the INSERT a no-op on any retry, and no second
 * email is attempted. Never throws.
 *
 * @returns {Promise<{ok:boolean, duplicate?:boolean, notificationId?:number, error?:string}>}
 */
export async function recordAndSendArrival(env, { id, type, name }) {
  try {
    const to = arrivalRecipient(env)
    const subject = `New submission on the desk — ${typeTitle(type)} from ${String(name || 'an artist')}`

    const insert = await env.LHC_DB.prepare(`
      INSERT OR IGNORE INTO notifications (submission_id, kind, channel, recipient, subject, delivery_status)
      VALUES (?, 'arrival', 'email', ?, ?, ?)
    `).bind(id, to, subject, to ? 'sending' : 'not_configured').run()

    // Unique index absorbed the insert → this arrival was already recorded.
    if (!insert.meta || !insert.meta.changes) return { ok: true, duplicate: true }
    const notificationId = insert.meta.last_row_id

    if (!to) {
      // Recorded honestly; nothing to send. The panel still shows the arrival.
      return { ok: true, notificationId }
    }

    await deliver(env, notificationId, {
      to,
      subject,
      text: arrivalText({ id, type, name }),
      html: arrivalHtml({ id, type, name }),
    })
    return { ok: true, notificationId }
  } catch (err) {
    // Best-effort by contract — but the failure must not be silent. Try to
    // leave a durable failed row; if even that fails, log.
    try {
      await env.LHC_DB.prepare(`
        INSERT OR IGNORE INTO notifications (submission_id, kind, channel, delivery_status, delivery_error)
        VALUES (?, 'arrival', 'email', 'failed', ?)
      `).bind(id, compact('Arrival notice threw: ' + (err && err.message))).run()
    } catch (e2) {
      console.error('notifications: could not record arrival failure:', e2)
    }
    return { ok: false, error: compact(err && err.message) }
  }
}

/* --- stale sweep (cooldown-bounded) ------------------------------------------ */

/**
 * Scan the spine for submissions sitting in a non-terminal status past the
 * threshold, record one 'stale' notice per newly-due submission, and send a
 * single digest email covering them. Submissions still inside the cooldown of
 * their last stale notice are counted but not re-notified. Never throws.
 *
 * @returns {Promise<{ok:boolean, stale:number, notified:number, skippedCooldown:number, error?:string}>}
 */
export async function sweepStale(env, now = new Date()) {
  try {
    const threshold = staleAfterHours(env)
    const cooldown = staleCooldownHours(env)
    const to = sweepRecipient(env)

    const { results: rows } = await env.LHC_DB.prepare(`
      SELECT s.id, s.type, s.status, s.submitter_name AS name, s.created_at, s.updated_at,
             (SELECT MAX(n.created_at) FROM notifications n
               WHERE n.submission_id = s.id AND n.kind = 'stale') AS last_stale_at
      FROM submissions s
      WHERE s.status NOT IN (${FINAL_STATUSES.map(() => '?').join(', ')})
      ORDER BY s.updated_at ASC
    `).bind(...FINAL_STATUSES).all()

    const stale = rows.filter((r) => isStale(r, now, threshold))
    const due = stale.filter((r) => cooldownElapsed(r.last_stale_at, now, cooldown))
    const skippedCooldown = stale.length - due.length
    if (due.length === 0) return { ok: true, stale: stale.length, notified: 0, skippedCooldown }

    const subject = due.length === 1
      ? `A matter has gone quiet — ${typeTitle(due[0].type)} from ${due[0].name}`
      : `${due.length} matters have gone quiet on the desk`

    // Record every due notice BEFORE the send, so the attempt is durable.
    const ids = []
    for (const r of due) {
      const ins = await env.LHC_DB.prepare(`
        INSERT INTO notifications (submission_id, kind, channel, recipient, subject, delivery_status)
        VALUES (?, 'stale', 'email', ?, ?, ?)
      `).bind(r.id, to, subject, to ? 'sending' : 'not_configured').run()
      ids.push(ins.meta && ins.meta.last_row_id)
    }

    if (to) {
      await deliver(env, ids, {
        to,
        subject,
        text: staleText(due, threshold),
        html: staleHtml(due, threshold),
      })
    }
    return { ok: true, stale: stale.length, notified: due.length, skippedCooldown }
  } catch (err) {
    console.error('notifications: stale sweep failed:', err)
    return { ok: false, stale: 0, notified: 0, skippedCooldown: 0, error: compact(err && err.message) }
  }
}

/* --- panel reads -------------------------------------------------------------- */

/** Recent notices, newest first, joined to their submissions for display. */
export async function listNotifications(env, limit = 30) {
  const { results } = await env.LHC_DB.prepare(`
    SELECT n.id, n.submission_id, n.kind, n.channel, n.recipient, n.subject,
           n.delivery_status, n.delivery_error, n.created_at, n.sent_at,
           s.type, s.status, s.submitter_name AS name
    FROM notifications n
    LEFT JOIN submissions s ON s.id = n.submission_id
    ORDER BY n.created_at DESC, n.id DESC
    LIMIT ?
  `).bind(limit).all()
  return results
}

/* --- shared delivery + copy --------------------------------------------------- */

/** Send one email and settle the given notification row(s) sent/failed. */
async function deliver(env, idOrIds, message) {
  const ids = Array.isArray(idOrIds) ? idOrIds.filter(Boolean) : [idOrIds]
  let result
  try {
    result = await sendEmail(env, message)
  } catch (err) {
    result = { ok: false, error: compact('Send threw: ' + (err && err.message)) }
  }
  const marks = ids.map((nid) => result.ok
    ? env.LHC_DB.prepare(`
        UPDATE notifications
        SET delivery_status = 'sent', provider_id = ?, delivery_error = NULL, sent_at = datetime('now')
        WHERE id = ?`).bind(result.id, nid).run()
    : env.LHC_DB.prepare(`
        UPDATE notifications SET delivery_status = 'failed', delivery_error = ? WHERE id = ?
      `).bind(compact(result.error), nid).run())
  await Promise.all(marks)
  return result
}

function typeTitle(type) {
  return String(type || 'submission').replace(/_/g, ' ')
}

function statusLabel(status) {
  return (STATUS_LABELS && STATUS_LABELS[status]) || String(status || '')
}

function arrivalText({ id, type, name }) {
  return [
    `A new ${typeTitle(type)} submission from ${name} has arrived on the desk.`,
    '',
    `Review it in the Editorial Office: /editorial-office/ (submission #${id}).`,
    '',
    '— The Luscious Honey Collective',
  ].join('\n')
}

function arrivalHtml({ id, type, name }) {
  return `<p>A new <strong>${escapeHtml(typeTitle(type))}</strong> submission from <strong>${escapeHtml(String(name || ''))}</strong> has arrived on the desk.</p>
<p>Review it in the Editorial Office (submission #${Number(id)}).</p>
<p>— The Luscious Honey Collective</p>`
}

function staleLine(r, threshold) {
  return `#${r.id} · ${typeTitle(r.type)} from ${r.name} — ${statusLabel(r.status)} since ${String(r.updated_at || '').slice(0, 10)}`
}

function staleText(due, threshold) {
  return [
    `These matters have sat unmoved past ${threshold} hours:`,
    '',
    ...due.map((r) => `  • ${staleLine(r, threshold)}`),
    '',
    'They are waiting in the Editorial Office: /editorial-office/',
    '',
    '— The Luscious Honey Collective',
  ].join('\n')
}

function staleHtml(due, threshold) {
  const items = due.map((r) => `<li>${escapeHtml(staleLine(r, threshold))}</li>`).join('')
  return `<p>These matters have sat unmoved past ${Number(threshold)} hours:</p><ul>${items}</ul>
<p>They are waiting in the Editorial Office.</p><p>— The Luscious Honey Collective</p>`
}
