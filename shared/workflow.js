/* =============================================================================
   SUBMISSION WORKFLOW — environment-neutral contract (the SINGLE source of truth).

   Imported by BOTH the Cloudflare Functions (server) and the Headquarters client.
   Contains ONLY data + tiny pure helpers: status values, human labels, the
   briefing category definitions, and the founder's safe inline transitions.

   It holds NO database, authentication, audit, or request-handling logic — none
   of that may enter the browser bundle. The submissions API remains authoritative
   and re-validates every requested transition.
   ============================================================================= */

// The canonical editorial statuses (order = lifecycle order).
export const STATUSES = [
  'draft',
  'sent_for_review',
  'under_review',
  'changes_requested',
  'approved',
  'scheduled',
  'published',
  'not_accepted',
];

// Where a fresh PUBLIC submission enters the workflow.
export const INITIAL_PUBLIC_STATUS = 'sent_for_review';

// Human labels for any surface that renders a status.
export const STATUS_LABELS = {
  draft: 'Draft',
  sent_for_review: 'Sent for Review',
  under_review: 'Under Review',
  changes_requested: 'Changes Requested',
  approved: 'Approved',
  scheduled: 'Scheduled',
  published: 'Published',
  not_accepted: 'Not Accepted',
};

export function isStatus(value) {
  return STATUSES.includes(value);
}

/* --- Briefing category definitions (explicit; see functions/_lib/briefing.js) -
   These are DISTINCT sets — "awaiting review" is NOT "everything not final". */

// Needs a founder decision right now.
export const AWAITING_REVIEW = ['sent_for_review', 'under_review'];
// Resolved outcomes (the work is done).
export const FINAL_STATUSES = ['published', 'not_accepted'];

// Open = in-flight = any status that is not a resolved outcome. (Superset of
// AWAITING_REVIEW: also includes approved/scheduled/changes_requested/draft.)
export function isAwaitingReview(status) { return AWAITING_REVIEW.includes(status); }
export function isResolved(status) { return FINAL_STATUSES.includes(status); }
export function isOpen(status) { return isStatus(status) && !isResolved(status); }

/* --- Founder inline decisions ------------------------------------------------
   The FEW high-value transitions the Executive Office may perform on an item,
   keyed by its CURRENT status. Deeper/rarer moves (drafting, scheduling,
   publishing) stay in the Editorial Office. Final states offer no inline action. */
export const INLINE_TRANSITIONS = {
  sent_for_review:   ['under_review', 'approved', 'changes_requested', 'not_accepted'],
  under_review:      ['approved', 'changes_requested', 'not_accepted'],
  changes_requested: ['under_review', 'not_accepted'],
  approved:          [],
  scheduled:         [],
  draft:             [],
  published:         [],
  not_accepted:      [],
};

// Imperative, founder-facing verbs for the action controls.
export const ACTION_LABELS = {
  under_review: 'Start review',
  approved: 'Approve',
  changes_requested: 'Request changes',
  not_accepted: 'Decline',
};

function actionLabel(status) {
  return ACTION_LABELS[status] || STATUS_LABELS[status] || status;
}

// Whether `to` is a valid founder inline decision from `from`.
export function isInlineTransition(from, to) {
  return (INLINE_TRANSITIONS[from] || []).includes(to);
}

// The valid inline actions for an item's current status: [{ status, label }].
// The Executive Office renders ONLY these; nothing universal.
export function inlineActions(currentStatus) {
  return (INLINE_TRANSITIONS[currentStatus] || []).map((status) => ({
    status,
    label: actionLabel(status),
  }));
}
