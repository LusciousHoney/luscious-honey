/**
 * Daily Briefing — pure aggregation over the submissions spine.
 *
 * `composeBriefing` is a PURE function (no DB, no env, no I/O) so it is fully
 * unit-testable. The Function `functions/api/headquarters/briefing.js` fetches
 * the submissions via the authoritative `listSubmissions` and passes them here.
 *
 * Category definitions are explicit and come from the shared contract
 * (shared/workflow.js). They are DISTINCT — "awaiting review" is deliberately
 * NOT "everything that isn't final":
 *
 *   • awaitingReview — needs a founder decision now: status ∈ AWAITING_REVIEW
 *                      (sent_for_review, under_review).
 *   • open           — in-flight: any status that is not a resolved outcome
 *                      (i.e. not published / not_accepted). Superset of awaiting.
 *   • resolved       — a final outcome: status ∈ FINAL_STATUSES
 *                      (published, not_accepted).
 *   • oldestAwaiting — among AWAITING_REVIEW items, the one with the earliest
 *                      `created_at` (arrival time is the wait clock).
 *   • recent         — the most recently touched items, by `updated_at` desc
 *                      (a status change or note bumps `updated_at`).
 */

import { STATUSES, isAwaitingReview, isOpen, isResolved } from '../../shared/workflow.js'

const RECENT_LIMIT = 5

export function composeBriefing(submissions, now = new Date()) {
  const list = Array.isArray(submissions) ? submissions : []

  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]))
  let awaitingReview = 0
  let open = 0
  let resolved = 0

  for (const s of list) {
    if (byStatus[s.status] !== undefined) byStatus[s.status] += 1
    if (isAwaitingReview(s.status)) awaitingReview += 1
    if (isOpen(s.status)) open += 1
    if (isResolved(s.status)) resolved += 1
  }

  // Oldest awaiting: earliest created_at among the awaiting-review items.
  const awaiting = list
    .filter((s) => isAwaitingReview(s.status))
    .sort((a, b) => msOf(a.created_at) - msOf(b.created_at))
  const oldest = awaiting[0] || null
  const oldestAwaiting = oldest
    ? {
        id: oldest.id,
        name: oldest.name,
        type: oldest.type,
        status: oldest.status,
        created_at: oldest.created_at,
        waitingDays: daysBetween(oldest.created_at, now),
      }
    : null

  // Recent: most recently updated items, newest first.
  const recent = [...list]
    .sort((a, b) => msOf(b.updated_at) - msOf(a.updated_at))
    .slice(0, RECENT_LIMIT)
    .map((s) => ({ id: s.id, name: s.name, type: s.type, status: s.status, updated_at: s.updated_at }))

  return {
    counts: { byStatus, awaitingReview, open, resolved, total: list.length },
    awaitingReview,
    open,
    resolved,
    oldestAwaiting,
    recent,
  }
}

// D1 stores timestamps as 'YYYY-MM-DD HH:MM:SS' (UTC). Parse robustly to ms.
function msOf(ts) {
  if (!ts) return 0
  const iso = String(ts).includes('T') ? ts : String(ts).replace(' ', 'T') + 'Z'
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? 0 : ms
}

function daysBetween(ts, now) {
  const then = msOf(ts)
  if (!then) return 0
  const ms = (now instanceof Date ? now.getTime() : Date.parse(now)) - then
  return Math.max(0, Math.floor(ms / 86400000))
}
