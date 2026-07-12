/**
 * Canonical editorial workflow — the single status model for ALL submission
 * types (Artist Features today; Author Features, Creator Spotlights, etc.
 * tomorrow). The future Editorial Office UI consumes these values; it does not
 * define its own.
 *
 * This is intentionally a flat, any-to-any set for V1: the editor may move a
 * submission to any status. (A stricter transition graph can be layered on
 * later without changing storage.)
 */

export const STATUSES = [
  'draft',
  'sent_for_review',
  'under_review',
  'changes_requested',
  'approved',
  'scheduled',
  'published',
  'not_accepted',
]

// Where a fresh PUBLIC submission enters the workflow.
export const INITIAL_PUBLIC_STATUS = 'sent_for_review'

// Human labels for surfaces that render the workflow.
export const STATUS_LABELS = {
  draft: 'Draft',
  sent_for_review: 'Sent for Review',
  under_review: 'Under Review',
  changes_requested: 'Changes Requested',
  approved: 'Approved',
  scheduled: 'Scheduled',
  published: 'Published',
  not_accepted: 'Not Accepted',
}

export function isStatus(value) {
  return STATUSES.includes(value)
}
