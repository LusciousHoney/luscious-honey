/* =============================================================================
   EXECUTIVE OFFICE — data adapters.

   The ONLY seam between the Headquarters and the outside world. Thin wrappers
   over the existing, authoritative endpoints — the Headquarters reads the
   submissions spine and performs a few audited decisions through it; it owns no
   data and holds no source of truth.

     • Daily Briefing   ← GET  /api/headquarters/briefing   (read)
     • One Inbox        ← GET  /api/submissions?status=      (read)
     • Submission detail← GET  /api/submissions?id=          (read)
     • Advance status   → POST /api/submissions {id,status}  (audited write)
     • Internal note    → POST /api/submissions {id,note}    (audited write)

   Every call degrades gracefully: a network failure returns `{ ok:false,
   offline:true }` so the room stays usable and can show an honest offline state.
   Valid inline actions are derived from the shared workflow contract; the server
   re-validates every requested transition.
   ============================================================================= */

import {
  STATUS_LABELS,
  inlineActions,
  type SubmissionStatus,
  type InlineAction,
} from '../../shared/workflow.js';

export { STATUS_LABELS, inlineActions };
export type { SubmissionStatus, InlineAction };

export interface Submission {
  id: number;
  type: string;
  status: SubmissionStatus;
  name: string;
  email: string;
  fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  summary?: string;
}

export interface ThreadMessage {
  id: number; kind: string; channel: string | null; author: string | null;
  body: string; delivery_status: string | null; created_at: string;
}
export interface AuditEvent {
  id: number; actor: string; action: string;
  from_status: string | null; to_status: string | null; detail: string | null; created_at: string;
}
export interface SubmissionDetail extends Submission {
  messages: ThreadMessage[];
  events: AuditEvent[];
}

export interface BriefingItem {
  id: number; name: string; type: string; status: SubmissionStatus;
  created_at?: string; updated_at?: string; waitingDays?: number; summary?: string;
}
export interface Briefing {
  generatedAt: string;
  statusLabels: Record<string, string>;
  counts: { byStatus: Record<string, number>; awaitingReview: number; open: number; resolved: number; total: number };
  awaitingReview: number;
  open: number;
  resolved: number;
  oldestAwaiting: BriefingItem | null;
  recent: BriefingItem[];
}

/** A uniform result: ok+data, or a failure the UI can render honestly. */
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; offline?: boolean; status?: number; error: string };

async function getJson<T>(url: string): Promise<Result<T>> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: 'application/json' }, credentials: 'same-origin' });
  } catch {
    return { ok: false, offline: true, error: 'The desk is offline.' };
  }
  return readBody<T>(res);
}

async function postJson<T>(body: unknown): Promise<Result<T>> {
  let res: Response;
  try {
    res = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, offline: true, error: 'The desk is offline.' };
  }
  return readBody<T>(res);
}

async function readBody<T>(res: Response): Promise<Result<T>> {
  let payload: any = null;
  try { payload = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok || (payload && payload.ok === false)) {
    return { ok: false, status: res.status, error: (payload && payload.error) || `Request failed (${res.status}).` };
  }
  return { ok: true, data: payload as T };
}

/* --- reads ---------------------------------------------------------------- */

export function fetchBriefing(): Promise<Result<Briefing>> {
  return getJson<Briefing>('/api/headquarters/briefing');
}

export function fetchInbox(status?: SubmissionStatus): Promise<Result<{ submissions: Submission[] }>> {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return getJson<{ submissions: Submission[] }>(`/api/submissions${q}`);
}

export function fetchItem(id: number): Promise<Result<{ submission: SubmissionDetail }>> {
  return getJson<{ submission: SubmissionDetail }>(`/api/submissions?id=${id}`);
}

/* --- audited writes (through the existing authoritative API) --------------- */

export function advanceStatus(id: number, status: SubmissionStatus): Promise<Result<{ status: SubmissionStatus }>> {
  return postJson<{ status: SubmissionStatus }>({ id, status });
}

export function addNote(id: number, note: string): Promise<Result<{ messageId: number }>> {
  return postJson<{ messageId: number }>({ id, note });
}

/* --- notifications (read; state lives in D1, never in the client) ----------- */

export interface HouseNotification {
  id: number;
  submission_id: number;
  kind: 'arrival' | 'stale' | string;
  channel: string;
  recipient: string | null;
  subject: string | null;
  delivery_status: 'sending' | 'sent' | 'failed' | 'not_configured' | string;
  delivery_error: string | null;
  created_at: string;
  sent_at: string | null;
  type: string | null;
  status: string | null;
  name: string | null;
}

export interface StaleReading {
  id: number; type: string; status: string; name: string;
  created_at: string; updated_at: string;
}

export interface NotificationState {
  notifications: HouseNotification[];
  stale: StaleReading[];
  config: { arrivalConfigured: boolean; sweepConfigured: boolean; staleAfterHours: number };
}

export function fetchNotifications(): Promise<Result<NotificationState>> {
  return getJson<NotificationState>('/api/notifications');
}
