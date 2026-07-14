/* Types for the environment-neutral workflow contract (shared/workflow.js), so
   the TypeScript Headquarters client imports it fully typed without `allowJs`. */

export type SubmissionStatus =
  | 'draft'
  | 'sent_for_review'
  | 'under_review'
  | 'changes_requested'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'not_accepted';

export const STATUSES: SubmissionStatus[];
export const INITIAL_PUBLIC_STATUS: SubmissionStatus;
// A label lookup — indexable by any string (values arrive from the DB as strings).
export const STATUS_LABELS: Record<string, string>;
export function isStatus(value: unknown): value is SubmissionStatus;

export const AWAITING_REVIEW: SubmissionStatus[];
export const FINAL_STATUSES: SubmissionStatus[];
export function isAwaitingReview(status: string): boolean;
export function isResolved(status: string): boolean;
export function isOpen(status: string): boolean;

export const INLINE_TRANSITIONS: Record<SubmissionStatus, SubmissionStatus[]>;
export const ACTION_LABELS: Partial<Record<SubmissionStatus, string>>;
export function isInlineTransition(from: string, to: string): boolean;

export interface InlineAction { status: SubmissionStatus; label: string; }
export function inlineActions(currentStatus: string): InlineAction[];
