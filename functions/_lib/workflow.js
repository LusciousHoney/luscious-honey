/**
 * Canonical editorial workflow (server view).
 *
 * The status values, labels, and transition metadata now live in the
 * environment-neutral contract at shared/workflow.js — the SINGLE source of
 * truth shared by the Functions and the Headquarters client. This module simply
 * re-exports that contract so existing server imports (functions/api/submissions.js,
 * functions/_lib/submissions.js) keep working unchanged, and adds nothing of its
 * own. The submissions API remains authoritative: it re-validates every status.
 *
 * The status model stays flat/any-to-any for the Editorial Office (the complete
 * review workspace); the founder's *inline* decisions in the Headquarters are the
 * narrower `INLINE_TRANSITIONS` subset, also defined in the shared contract.
 */

export {
  STATUSES,
  INITIAL_PUBLIC_STATUS,
  STATUS_LABELS,
  isStatus,
  AWAITING_REVIEW,
  FINAL_STATUSES,
  isAwaitingReview,
  isResolved,
  isOpen,
  INLINE_TRANSITIONS,
  ACTION_LABELS,
  isInlineTransition,
  inlineActions,
} from '../../shared/workflow.js'
