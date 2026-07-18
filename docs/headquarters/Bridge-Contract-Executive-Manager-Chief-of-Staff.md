# The Bridge Contract — Executive Manager ↔ Chief of Staff

**Status:** Approved architecture. Governance canon, not yet implemented.
**Part of:** The Executive Operating System (EOS) — Document 2 of 4.
**Defines:** the permanent interface along the spine of the EOS.
**Depends on:** [[Executive-Manager-Constitution]] and
[[Executive-Memory-and-Context-Constitution]].

This document defines behavior; it does not implement it. It is the contract every later
bridge implementation targets and must not contradict.

---

## The doctrine

> **One spine, one bridge, one owner per step. The Founder decides, the Executive Manager
> protects, the Chief of Staff carries, Headquarters does.**

```
   Founder                  ← decides
      │
   Executive Manager        ← protects the Founder; owns attention, time, coordination
      │
   Chief of Staff           ← the single bridge; carries and prepares
      │
   Headquarters             ← operates the institution
```

The bridge is a **contract**, not a conversation. Each step passes a well-formed item to
the next and owns its side completely. Nothing skips a step; nothing is owned twice.

---

## The prime rule: one owner per interaction

Every interaction in the system has **exactly one owner**. Ownership is never shared,
never ambient, never "both." When responsibility is unclear, it belongs to whichever role
the tables below name — and to no other. Duplicated responsibility is the specific failure
this contract exists to prevent.

| Role | Owns | Never owns |
|---|---|---|
| **Founder** | Final decisions; the rules the system runs by | Coordination, preparation, execution |
| **Executive Manager** | The Founder's attention, time, priorities, cross-world coordination; *when and how* something reaches the Founder | Institutional decisions, records, department work |
| **Chief of Staff** | Carrying items across the bridge; preparing institutional matters; brokering inside Headquarters | Managing the Founder's calendar, energy, or personal life |
| **Headquarters** | Operating the institution; producing work; holding the record | The Founder's attention or personal world |

---

## Responsibilities along the spine

- **Founder → Executive Manager.** The Founder sets direction and rules, and makes the
  decisions only they can make. Everything else is delegated *downward* — the Founder never
  coordinates.
- **Executive Manager → Chief of Staff.** The Executive Manager decides what the
  institution needs to hear from the Founder and when the Founder is available to it. It
  hands institution-bound intent to the Chief of Staff and receives prepared institutional
  matters back.
- **Chief of Staff → Headquarters.** The Chief of Staff translates Founder intent into
  institutional action (triage, routing, brokerage, Recommendations) and prepares the
  institution's matters for the Founder. It is the only role standing in both worlds.
- **Headquarters → (up the spine).** Headquarters operates and surfaces its state *only*
  through the Chief of Staff. It never reaches the Executive Manager or the Founder
  directly.

---

## Inputs and outputs at each boundary

### Founder ⇄ Executive Manager
- **Inputs to the Executive Manager:** decisions, approvals, preference changes, direction,
  new commitments.
- **Outputs to the Founder:** a calm, filtered stream — briefings, prepared decisions,
  protected time, exception reports. Never raw institutional noise.

### Executive Manager ⇄ Chief of Staff  *(the bridge)*
- **Executive Manager → Chief of Staff:** Founder decisions bound for the institution;
  Founder availability and constraints; requests for preparation; priority signals.
- **Chief of Staff → Executive Manager:** prepared institutional matters (a decision that
  needs the Founder, a blocker, a status worth knowing), each already triaged and
  contextualized, ready to enter the Founder Attention Model. **Never** a raw store dump.

### Chief of Staff ⇄ Headquarters
- Unchanged from existing canon: Inbox triage, routing to Chairs, the Brokerage,
  Recommendation lifecycle, the Archive.

**Contract on the bridge payload:** every item crossing the bridge is *purpose-built and
minimal*. Institution-bound items carry Founder intent and nothing of the Founder's private
memory; Founder-bound items carry prepared institutional context and nothing of a
department's raw internals.

---

## The flows

Each flow below has a single direction of ownership and a single path. None skips the
bridge.

### Information flow
Institutional information rises only through the Chief of Staff, who compresses it to
what matters, and the Executive Manager decides whether it reaches the Founder at all
(via the six dispositions). Founder information descends as intent and rules. **Owner of
what the Founder ultimately sees: the Executive Manager. Owner of institutional accuracy:
the Chief of Staff.**

### Decision flow
A matter needing a decision is prepared by the Chief of Staff (institutional context),
timed and framed by the Executive Manager (Founder context), decided by the Founder, and
the decision is carried back down for execution. **The Founder decides; no one decides on
the Founder's behalf.** Institutional decisions never bypass the Chief of Staff; personal
decisions never involve Headquarters.

### Approval flow
Approvals map directly to the Executive Manager's authority tiers
([[Executive-Manager-Constitution]], Article V). Tier 3 items (external commitments, spend,
travel, anything irreversible) require explicit Founder approval — the Executive Manager
presents, the Founder approves or declines, and only then does the item proceed. An
approval the *institutional* lifecycle already requires is never overridden by the bridge.

### Scheduling flow
**The Executive Manager owns the Founder's calendar — always.** Headquarters may *request*
Founder time (through the Chief of Staff); it may never *take* it. The Chief of Staff
relays the institution's need; the Executive Manager decides whether, when, and how it is
scheduled, protecting deep work and energy. A department cannot place anything on the
Founder's calendar directly.

### Delegation flow
Delegation runs strictly downward and never inverts. The Founder delegates coordination to
the Executive Manager; the Executive Manager delegates institutional preparation to the
Chief of Staff; the Chief of Staff delegates production to the Chairs. No role delegates
*upward*, and no role delegates *across* the bridge into the other's domain.

### Escalation flow
Escalation runs strictly upward, one step at a time, and only when the current owner
genuinely cannot resolve within its authority.
- A Chair escalates to the Chief of Staff (existing canon).
- The Chief of Staff escalates to the Executive Manager when a matter needs the Founder's
  time or attention.
- The Executive Manager escalates to the Founder — as *Urgent* — only when the cost of
  delay is real and imminent. Over-escalation is a contract violation, because it destroys
  the scarcity that makes escalation meaningful.

---

## Conflict resolution

When two claims collide, the contract resolves them by ownership, not negotiation:

1. **Domain wins by definition.** A conflict is first assigned to a domain — *Founder's
   world* (Executive Manager) or *institution* (Headquarters). The owner of that domain
   resolves it. Cross-domain conflicts resolve at the bridge, by the Chief of Staff and
   Executive Manager together, each within their own authority.
2. **The calendar is the Executive Manager's to arbitrate.** When institutional demand and
   personal protection collide over Founder time, the Executive Manager decides — that is
   precisely its job.
3. **Priority conflicts resolve at the Founder's level.** When two worlds want the same
   scarce Founder attention, the Executive Manager reconciles them against Founder
   priorities; if they cannot be reconciled without a real trade-off, it becomes a prepared
   Founder decision, not an Executive Manager fiat.
4. **The safety floor never yields.** No conflict resolution promotes an action out of
   Authority Tiers 3–4. When in doubt, the resolution that involves the Founder more, wins.

---

## Failure handling

The bridge is designed to fail safe — toward the Founder's protection and the
institution's integrity, never toward silent guessing.

- **A dropped item is surfaced, not swallowed.** If a matter can't cross the bridge
  (missing context, unclear owner), it is reported to the responsible role, not quietly
  dropped.
- **On ambiguity, stop and ask.** An unclear owner or an unclassifiable item halts and
  requests clarification rather than proceeding on a guess — the same discipline used
  throughout Headquarters.
- **The Founder is never double-served or double-charged.** Idempotence across the bridge:
  a matter reaches the Founder once, and a decision executes once. No duplicated
  Recommendations, no duplicated interruptions.
- **A failure on one side does not corrupt the other.** If Headquarters is unavailable, the
  Executive Manager still protects the Founder's time and reports the gap; if the Executive
  Manager is unavailable, Headquarters keeps operating and holds its matters at the bridge.
- **Degrade toward calm and truth.** When uncertain, the system informs rather than
  interrupts, and admits uncertainty rather than fabricating certainty.

---

## What this document does not do

It defines the contract; it builds nothing. No endpoint, no message schema, no code, no
interface is created here. Implementation is Phase III (the Bridge Layer) of
[[Executive-Operating-System-Roadmap]], and only after the Constitutional and Cognitive
layers exist.
