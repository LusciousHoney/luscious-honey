# Executive Council — Phase II: Cross-Chair Collaboration

**Status:** Approved operating model. Foundations implemented in Sprint 12G.
**Baseline:** the Founding Council is complete — Chairs #001 Chief of Staff, #002
Creative Director, #003 Head of Production, #004 Director of Growth.

This document is the approved specification that guides Phase II implementation. It
is authoritative: later sprints (12H onward) build on it, and must not contradict it.

---

## The doctrine

> **The Chair proposes; the office disposes.**

A Chair never hands work to another Chair directly. It **proposes** a collaboration —
"this is ready for Growth," or "I need Creative to confirm this stays on-voice." The
**Chief of Staff brokers** it. The work flows between Chairs, but the *coordination of
that flow* always passes through the office. There is no direct, unrecorded
Chair-to-Chair routing — that is the invariant, not a limitation.

## Invariants (carried forward from Phase I)

1. **One Register** — the single source of Chair identities. Collaboration targets are
   validated against it; no Chair id is ever hardcoded.
2. **One operational store** — the single source of executive work.
3. **One guarded lifecycle** — collaboration is expressed as *annotations beside* the
   existing lifecycle, never as a second workflow engine.
4. **No direct, unrecorded Chair-to-Chair routing** — every transfer is office-brokered
   and recorded.
5. **The Founder decides; the Founder does not coordinate.** Collaboration never turns
   the Founder into an operational router, and never bypasses an approval the lifecycle
   already requires.

## Two primitives — and only two

### Handoff — *ownership moves*
An office-brokered transfer of ownership from one Chair to another.

`proposed → authorized (office) → accepted (ownership moves)`
with off-ramps `declined` (returns to the office) and `withdrawn`.

- The **owning Chair proposes**; nothing moves yet.
- The **office authorizes**; still nothing moves — this is the brokerage that makes a
  later transfer legitimate.
- The **receiving Chair accepts**; only now does ownership move, directly to them. A
  Chair can never take ownership silently — acceptance requires a prior authorization.
- The sending Chair's stage history is **preserved** (never erased); the handoff records
  the sending stage as provenance.

### Consultation — *ownership stays*
A bounded question → answer between the owning Chair and a consulted Chair. Ownership
never changes. Exactly one question and one recorded answer — **not** a thread, chat,
comment system, or executive inbox conversation.

## The five approved Founder decisions

1. **Handoff authority.** The Chief of Staff's office may broker Chair-to-Chair handoffs
   without separate Founder approval. Founder approval is still required wherever the
   underlying recommendation lifecycle already requires a Founder decision — collaboration
   must never bypass an existing approval requirement.
2. **Handoff continuity.** Direct ownership transfer to the receiving Chair, brokered by
   the office, with an append-only institutional trail. The work does not return to an
   unowned Chief-of-Staff queue between every Chair, but the office must authorize and
   record every transfer.
3. **Consultation weight.** One focused question and one recorded answer. No threaded
   messaging, chat, comments, or inbox conversation system.
4. **Declining work.** A receiving Chair who declines or cannot accept work returns it to
   the Chief of Staff's office — never directly back to the sending Chair.
5. **Chain completion.** The final Chair's valid completion closes the shared
   recommendation record. All handoff and consultation history is preserved as
   institutional provenance.

## How it sits on the architecture

Two append-only annotations live on the **one shared record** (the same
`Recommendation` every Chair already shares) — no new store, no new lifecycle:

- `collaborationTrail: Handoff[]` — the record's provenance.
- `consultations: Consultation[]` — bounded question→answer requests.

Collaboration may only begin on **owned, executing** work (`isCollaborable`). That single
gate upholds decision #1: `awaiting_founder`, `preparing`, `held`, `complete`, and
`withdrawn` records can never be handed off or consulted, so an approval the lifecycle
still requires is never bypassed. No new top-level lifecycle status is introduced;
handoff/consultation state lives inside the annotations.

Because a Chair completing its stage (`creativeComplete` / `productionComplete` /
`growthComplete`) closes the record, a Chair that intends to pass work on **hands off
instead of completing** — completion is terminal and belongs to the final Chair
(decision #5).

## Scope boundaries

Permanently out of scope: direct Chair-to-Chair channels that bypass the office. Out of
scope for Phase II generally: AI, notifications, messaging, threaded comments, automatic
handoffs, automatic dependency resolution, workload balancing, calendars, meetings,
deployment, and any Headquarters visual redesign. The word is **standards**, never "canon."

## Implementation status & roadmap

- **12G — Collaboration foundations (this sprint).** Data model, guards, pure functions,
  derived views, normalization, tests. No UI.
- **12H — Consultation depth / office brokerage seams** (proposed next).
- **12I — The Brokerage** — the Chief-of-Staff office view for pending handoffs and open
  consultations.
- **12J — Chair proposal controls + provenance** in the rooms.
- **12K — Escalation & chain-completion provenance** for the Founder.
