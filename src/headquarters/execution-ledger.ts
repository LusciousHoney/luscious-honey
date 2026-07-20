/* =============================================================================
   Execution Ledger — operational runtime state for the Autonomous Execution
   Bridge. NOT institutional truth.

   The ledger tracks the transient lifecycle of a dispatched work order — is it
   prepared, dispatched, running, verified, succeeded, failed, or cancelled. It
   is deliberately SEPARATE from Institutional Memory: Memory is the settled
   record of what the House decided and produced; the ledger is the disposable
   runtime status of an execution attempt. Each record REFERENCES the
   authoritative initiative (`initiativeId`) and never becomes a second initiative
   system or a competing source of truth.

   ★ Persistence boundary (v1): local-first `localStorage`, per browser — the same
   boundary as the rest of Headquarters. Unattended cross-device or cloud
   execution would require a shared durable store (see the AEB roadmap); the
   ledger's shape is deliberately small so that move is a store swap, not a
   redesign.
   ============================================================================= */

import { loadCollection, saveCollection } from './executive-register.ts';

const LEDGER_KEY = 'lhc.hq.execution-ledger.v1';

/** The runtime status of a work order — operational, not institutional. */
export type ExecutionStatus =
  | 'prepared'              // a work order exists, not yet dispatched
  | 'dispatched'            // handed to a runtime adapter
  | 'running'              // the agent is performing the work
  | 'verification_required' // a result is back and awaits the House's verification
  | 'succeeded'            // verified and accepted
  | 'failed_recoverable'   // failed, but bounded recovery may proceed
  | 'failed_escalated'     // recovery exhausted; a Founder decision is required
  | 'cancelled';           // withdrawn before completion

export interface ExecutionRecord {
  id: string;              // = the work order id
  workOrderId: string;
  initiativeId: string;    // reference to the authoritative matter
  status: ExecutionStatus;
  attempts: number;        // recovery attempts spent
  createdAt: string;
  updatedAt: string;
}

function isRecord(x: unknown): x is ExecutionRecord {
  const r = x as ExecutionRecord;
  return !!r && typeof r.id === 'string' && typeof r.workOrderId === 'string'
    && typeof r.initiativeId === 'string' && typeof r.status === 'string';
}

export function loadLedger(): ExecutionRecord[] { return loadCollection(LEDGER_KEY, isRecord); }
export function saveLedger(records: ExecutionRecord[]): void { saveCollection(LEDGER_KEY, records); }

/** Add or replace a record by id — idempotent, so a re-render never duplicates. */
export function upsertRecord(records: ExecutionRecord[], record: ExecutionRecord): ExecutionRecord[] {
  return [...records.filter((r) => r.id !== record.id), record];
}

/** The current runtime status of a work order, if any. */
export function statusOf(records: ExecutionRecord[], workOrderId: string): ExecutionStatus | undefined {
  return records.find((r) => r.id === workOrderId)?.status;
}

/** Whether a work order is already live — the guard against duplicate dispatch. */
export function isLive(records: ExecutionRecord[], workOrderId: string): boolean {
  const s = statusOf(records, workOrderId);
  return s === 'dispatched' || s === 'running' || s === 'verification_required';
}

/** Advance (or open) a record to a new status — pure; returns the next ledger. */
export function advance(
  records: ExecutionRecord[], workOrderId: string, initiativeId: string,
  status: ExecutionStatus, now: Date = new Date(),
): ExecutionRecord[] {
  const at = now.toISOString();
  const existing = records.find((r) => r.id === workOrderId);
  const next: ExecutionRecord = existing
    ? { ...existing, status, updatedAt: at, attempts: existing.attempts + (status === 'failed_recoverable' ? 1 : 0) }
    : { id: workOrderId, workOrderId, initiativeId, status, attempts: 0, createdAt: at, updatedAt: at };
  return upsertRecord(records, next);
}
