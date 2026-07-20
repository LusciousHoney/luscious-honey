/* =============================================================================
   Execution Runtime Boundary (ERB) v1 — the passive execution runtime.

   The runtime is intentionally UNINTELLIGENT. It has exactly one responsibility:
   execute a bounded work order and return structured evidence. Nothing more.

   ★ The runtime NEVER: determines policy, derives recommendations, decides
     priorities, interprets Founder intent, modifies institutional history,
     bypasses verification, or updates institutional state. Only Headquarters
     does those — through the Autonomous Execution Bridge (verification), the
     Execution Ledger (operational state), Institutional Memory (settled record),
     and the Institutional Executive Loop (what happens next).

   ★ This module introduces NO institutional engine, executive, or workflow. It
     formalizes a transport-independent runtime CONTRACT and a TRANSPORT
     abstraction, and enforces loop discipline: every returned execution
     re-enters Headquarters (verification → acceptance → memory → IEL) and never
     ends outside it. It composes the AEB; it decides nothing.
   ============================================================================= */

import {
  renderAgentBrief, verifyResult,
  type WorkOrder, type AgentResult, type Prepared, type Verdict,
} from './execution-bridge.ts';
import { advance, type ExecutionStatus, type ExecutionRecord } from './execution-ledger.ts';

/* --- transport-independent runtime vocabulary ------------------------------ */

/** The runtime's liveness view of a work order — operational, never institutional. */
export type RuntimeState = 'idle' | 'accepted' | 'working' | 'returned' | 'cancelled' | 'lost';

/** What crosses the transport OUTWARD — a brief and nothing institutional. */
export interface DispatchEnvelope { workOrderId: string; brief: string; }

export interface Heartbeat { workOrderId: string; state: RuntimeState; at: string; }
export interface RuntimeStatusReport { workOrderId: string; state: RuntimeState; }
export interface CancelAck { workOrderId: string; state: 'cancelled'; }

/* --- the runtime contract (structural, transport-independent) --------------- */

/**
 * The formal runtime interface. Every operation is structural and does not bind
 * to any particular runtime — Claude Code is only one implementation. The runtime
 * returns evidence; it forms no verdict and touches no institutional store.
 */
export interface ExecutionRuntime {
  readonly id: string;
  readonly label: string;
  readonly unattended: boolean;
  /** Turn a work order into a transport envelope (a rendered brief). */
  dispatch(order: WorkOrder): Prepared<DispatchEnvelope>;
  /** Accept structured evidence back — pass-through only; the runtime never
      verifies or accepts (that is Headquarters). Returns the same result. */
  receiveResult(result: AgentResult): AgentResult;
  /** Withdraw a work order before completion. */
  cancel(workOrderId: string): CancelAck;
  /** Report liveness for a work order. */
  heartbeat(workOrderId: string, state: RuntimeState, now?: Date): Heartbeat;
  /** The runtime's current view of a work order, mapped from its ledger status
      (the runtime reads operational status; it owns none). */
  status(workOrderId: string, ledgerStatus?: ExecutionStatus): RuntimeStatusReport;
}

/** Map the operational (ledger) status to the runtime's coarse liveness state. */
export function runtimeStateOf(ledgerStatus?: ExecutionStatus): RuntimeState {
  switch (ledgerStatus) {
    case 'dispatched':            return 'accepted';
    case 'running':               return 'working';
    case 'verification_required':
    case 'succeeded':
    case 'failed_recoverable':
    case 'failed_escalated':      return 'returned';
    case 'cancelled':             return 'cancelled';
    default:                      return 'idle';
  }
}

/* --- the transport abstraction --------------------------------------------- */

/** A transport moves envelopes out to a runtime and results back in. It carries
    no institutional knowledge — only the envelope and the structured result. */
export interface Transport {
  readonly id: string;
  readonly unattended: boolean;
  /** Send an envelope toward the runtime. v1 manual: surfaces the brief to a human. */
  send(envelope: DispatchEnvelope): void;
  /** Poll for a returned result. v1 manual: none until a human returns one. */
  poll(workOrderId: string): AgentResult | null;
}

/** v1's manual transport — the brief is surfaced to a human, who returns the
    result by hand. Stateless and attended by design. */
export const manualTransport: Transport = {
  id: 'manual',
  unattended: false,
  send: () => { /* the House renders the brief; a human carries it. No side effect here. */ },
  poll: () => null,
};

/** The conceptual transports the boundary is designed for — none requires an
    architectural change to adopt; only `manual` is implemented in v1. */
export const TRANSPORTS = [
  { id: 'manual',         label: 'Manual Claude Code',         unattended: false, implemented: true },
  { id: 'claude-headless',label: 'Headless Claude Code',       unattended: true,  implemented: false },
  { id: 'github-actions', label: 'GitHub Actions',             unattended: true,  implemented: false },
  { id: 'cloud-worker',   label: 'Cloud worker',               unattended: true,  implemented: false },
  { id: 'remote-runner',  label: 'Remote runner',              unattended: true,  implemented: false },
] as const;

/* --- the v1 runtime: manual Claude Code ------------------------------------ */

/** The manual Claude Code runtime — dispatch renders the brief; receiveResult is
    a pass-through; it forms no verdict and owns no state. Attended by design. */
export const manualClaudeCodeRuntime: ExecutionRuntime = {
  id: 'claude-code-manual',
  label: 'Claude Code (manual)',
  unattended: false,
  dispatch(order) {
    const brief = renderAgentBrief(order);
    return brief.ok ? { ok: true, value: { workOrderId: order.id, brief: brief.value } } : brief;
  },
  receiveResult: (result) => result,   // evidence in, unchanged — Headquarters verifies
  cancel: (workOrderId) => ({ workOrderId, state: 'cancelled' }),
  heartbeat: (workOrderId, state, now = new Date()) => ({ workOrderId, state, at: now.toISOString() }),
  status: (workOrderId, ledgerStatus) => ({ workOrderId, state: runtimeStateOf(ledgerStatus) }),
};

/* --- loop discipline: every execution re-enters Headquarters --------------- */

/** How a returned execution re-enters the institutional loop. */
export interface Ingestion {
  verdict: Verdict;               // from the AEB verification gate (Headquarters)
  nextStatus: ExecutionStatus;    // the operational status the ledger advances to
  ledger: ExecutionRecord[];      // the advanced ledger
  reentersLoop: true;             // no execution ends outside Headquarters
}

const VERDICT_TO_STATUS: Record<Verdict, ExecutionStatus> = {
  accepted:                'succeeded',
  verification_required:   'verification_required',
  recoverable_failure:     'failed_recoverable',
  founder_review_required: 'failed_escalated',
  rejected_scope_violation:'failed_escalated',
};

/**
 * Receive a runtime's result and route it back through Headquarters — the runtime
 * never skips this. The AEB verifies (the runtime's word is not trusted), the
 * ledger advances, and control returns to the loop. This composes; it decides
 * nothing new and creates no state of its own.
 */
export function ingestExecution(
  order: WorkOrder, result: AgentResult, ledger: ExecutionRecord[], now: Date = new Date(),
): Ingestion {
  const { verdict } = verifyResult(order, result);
  const nextStatus = VERDICT_TO_STATUS[verdict];
  return {
    verdict,
    nextStatus,
    ledger: advance(ledger, order.id, order.initiativeId, nextStatus, now),
    reentersLoop: true,
  };
}
