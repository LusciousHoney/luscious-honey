# EOS — Implementation Milestone 1 Specification

**Status:** Specification only. **Not implemented in this sprint.**
**Governs the build of:** the smallest coherent operational foundation that brings the
Executive Operating System closer to functioning.
**Grounded in:** the live code (`executive-work-queue.ts`, `chief-of-staff-ops.ts`, `main.ts`)
and the [[Executive-Manager-Constitution]] Founder Attention Model.

---

## The one behavior

> **Founder Attention v0 — the institutional matters already in the derived Executive Work
> Queue are classified into the six attention dispositions and surfaced to the Founder
> through the existing Executive Office summary.**

This is the Executive Manager's signature faculty (deciding *what reaches the Founder*),
built as **pure logic over data that already exists**, surfaced through a readout that
already exists. One observable end-to-end behavior — not scaffolding.

Chosen because it is the lowest-risk possible first step: pure, additive, reversible,
single-source-preserving, and immediately observable.

---

## Exact scope

**In:**
1. A new pure module `src/headquarters/executive-attention.ts`:
   - `type Disposition = 'ignore' | 'inform' | 'schedule' | 'recommend' | 'approve' | 'urgent'`
     plus an ordered, labelled `DISPOSITIONS` table.
   - `classifyAttention(item: QueueItem): Disposition` — a pure function deriving the
     disposition **only** from fields the `QueueItem` already carries (`office`, `status`,
     `priority`, `requiredAction`, `dueState`). No new fields, no store reads.
   - `deriveFounderAttention(items: QueueItem[]): FounderAttentionView` — groups the queue by
     disposition; pure and idempotent (deriving twice yields identical output).
   - `loadFounderAttention()` — convenience that calls the existing `loadWorkQueue()`.
2. A minimal, additive readout in the **existing** Executive Office summary
   (`mountExecSummary`, `main.ts`): the summary gains a Founder-Attention line-up (e.g.
   "1 to approve · 2 to consider · 3 for your awareness"). **No new page, route, or wing.**

**Initial classification mapping** (tunable later — the Founder owns the threshold):

| QueueItem condition | Disposition |
|---|---|
| `status: hidden` | Ignore |
| `status: completed` | Inform (recently finished) |
| `status: waiting` (owned by a Chair/office, in motion) | Inform |
| `office: founder`, actionable, `priority: critical` | **Urgent** |
| `office: founder`, actionable, `requiredAction: 'Awaiting Founder'` | **Approve** |
| `office: founder`, actionable, `dueState: soon` | Schedule |
| `office: founder`, actionable, otherwise | **Recommend** |
| actionable but owned by a non-Founder office | Inform |

---

## Existing components to reuse (do not rebuild)

- `loadWorkQueue()` / `deriveWorkQueue()` / `QueueItem` — the derived projection over
  Recommendations and the pipeline. **Read only.**
- `chief-of-staff-ops.ts` — the Recommendation lifecycle. **Untouched.**
- `executive-register.ts` — Chair identities. **Untouched.**
- `mountExecSummary` / `.hq-execsummary` (`main.ts`, existing CSS) — the readout host. Extend
  additively; do not restyle.
- The test pattern of `tests/executive-work-queue.test.ts` (pure `node --test`).

---

## Data ownership

- **No new store, no new source of truth.** `executive-attention.ts` owns nothing — it is a
  *derivation over a derivation*, exactly as the Work Queue is a derivation over
  Recommendations.
- **Recommendations remain the single source of truth**; the Work Queue remains the derived
  projection; Founder Attention is a further read-only projection.
- The Executive Manager holds **no institutional decision record** (per
  [[Executive-Decision-Constitution]]).

---

## Boundaries

- **Institution-only for M1.** Personal, WEA, Travel, and the other worlds
  ([[Founder-Operational-World-Model]]) are **out** — they arrive in the Roadmap's World
  Layer (Phase IV).
- **Read across the bridge, never into a Chair.** The module reads only the already-projected
  queue; it never touches a department's internals, never writes, never advances a lifecycle.
- **No decisions made.** Classification decides *how a matter is surfaced*, never *what the
  decision is*.
- **No Experience Standardization.** The readout reuses existing markup/tokens; no redesign
  (Roadmap Phase VI is last).

---

## Acceptance criteria

1. `executive-attention.ts` compiles under `tsc --noEmit` with no new errors.
2. `classifyAttention` returns the mapped disposition for every representative `QueueItem`
   shape; `deriveFounderAttention` is pure and idempotent.
3. A `QueueItem` already hidden/promoted classifies as **Ignore** (no Founder noise; no
   duplication of a promoted record).
4. The Executive Office summary shows the Founder-Attention line-up derived from live
   localStorage state, with honest counts.
5. No change to Recommendation, Register, or Work Queue behavior (existing tests still pass
   unchanged).

## Tests

- New `tests/executive-attention.test.ts` (`node --test`, added to the `test` script):
  - one case per disposition via representative queue items;
  - idempotence (`deriveFounderAttention` twice → deep-equal);
  - a hidden/promoted item → Ignore (no double-surface);
  - ordering of `DISPOSITIONS` (urgent → … → ignore) is stable.
- All existing suites must remain green (currently **401** on merged main).

## Browser verification

- Start the dev server; seed a realistic chain (as done for Sprint 13F) so at least one
  `awaiting_founder` Recommendation and one waiting item exist.
- Confirm the Executive Office summary renders the Founder-Attention line-up with correct
  counts; confirm an item routed/promoted does **not** appear as Founder-actionable.
- **Zero console errors.** Screenshot the summary as proof.

## Production-safety requirements

- `npm run check:prod` passes (all shipped pages `data-env=production`, no fixture markup).
- No secret, no network call, no new external dependency; pure client logic.
- The Executive Office remains a private surface; nothing new is exposed publicly.

## Explicit exclusions

- No new page, route, wing, studio, or CoS section.
- No Personal / WEA / Travel / cross-world data.
- No writes to any store; no lifecycle changes; no Recommendation creation.
- No bridge message schema beyond the single read path.
- No UI redesign, theming, or Experience Standardization.
- No AI, no external service.

---

## Branch & commit strategy

- **Depends on:** ratification of EOS v1.0 (the single gate). Reads only systems already in
  `origin/main` (`05b2300`); the governance docs are reference, not a code dependency.
- **Branch:** `feature/eos-m1-founder-attention`, cut fresh from `origin/main`.
- **Commits:** one focused feature commit — `executive-attention.ts` + its tests + the
  additive `mountExecSummary` line-up. Keep the pure module and the readout in the same
  commit so the end-to-end behavior lands whole.
- **Flow:** branch → implement → `tsc` + tests + build + `check:prod` + browser verify → open
  PR → **stop before merge and deploy** (standing flow). No deployment.

---

## Why this milestone (and not more)

It is the smallest slice that is genuinely *end-to-end* and genuinely *the Executive
Manager*: it exercises the boundary (EM reads institutional matters only through the derived
queue), the single-source rule (owns nothing), and the signature faculty (attention
classification) — while touching no working system. Broader scaffolding (bridge schemas, the
world model, decision records) would add surface without adding an observable behavior, and
is deferred to its proper Roadmap phase.
