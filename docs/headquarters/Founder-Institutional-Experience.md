# Founder Institutional Experience (FIX) — Version 1

**Status:** Implemented (presentation only); awaiting Founder approval.
**Purpose:** the Founder should experience Headquarters as a living institution whose Executive
Team is already at work — not as software. Everything shown is already true in the
institutional loop; this is **expression, not invention**. No engine, workflow, state, or
ownership was changed.

---

## 1. Founder Experience Principles

1. **The House has already been working.** The Founder arrives to prepared work, not an empty
   tool. Context is established before they act.
2. **Only what is already true.** Every statement derives from existing institutional state
   (initiatives, Founder Attention, the loop). No executive activity is fabricated.
3. **The Founder leads; they do not operate.** They give direction and judgment; the House
   coordinates execution. They are never asked to manage implementation.
4. **Stewardship in every transition.** Approval, completion, and record-entry each read as an
   institutional act, never a status change.
5. **The interface disappears; the House is present.** No implementation detail (storage,
   runtime, ledger, transport, pipeline) ever reaches the Founder.

---

## 2. Institutional Voice Guide

The House speaks with calm executive confidence — concise, institutional, never conversational.

**Say** (institutional responsibility): "The Executive Team has accepted your direction." ·
"The institution has accepted the completed work." · "This work is now part of the
institutional record." · "The Chief of Staff proposes it enter the record as a Journal entry."

**Never say** (implementation): task · processing · loading · running · localStorage · runtime ·
execution ledger · transport · adapter · engine · workflow · verification pipeline ·
institutional loop. These belong to the implementation, not the experience.

**Tone:** a bare status word ("Complete", "Running") is software; the same fact in an
institutional sentence ("The Executive Team has completed its review") is stewardship.

---

## 3. Executive Communication Standards

- **Executives are present through their work** — recommendations, completed reviews,
  dependencies, prepared decisions, institutional ownership, execution progress — never through
  chat, avatars, or simulated conversation.
- **The Chief of Staff is the institutional voice**: welcomes the Founder, establishes context,
  introduces recommendations, announces transitions, confirms ownership, communicates
  completion. Calm, concise, executive — not chatty.
- **Every statement derives from institutional data.** If the state does not contain it, the
  House does not say it.

---

## 4. Founder Journey

```mermaid
journey
    title A matter through Headquarters, in the Founder's experience
    section Arrival
      The Chief of Staff establishes context: 5: Founder
    section Bring a matter
      The Founder brings direction in their words: 5: Founder
      The Executive Team prepares one recommendation: 5: House
    section Judgment
      The Founder gives their word: 5: Founder
      "The Executive Team has accepted your direction": 5: House
    section The House works
      Executives hold their charges; the Founder may leave: 5: House
      "The institution has accepted the completed work": 5: House
    section The record
      "This work is now part of the institutional record": 5: House
```

At every step the Founder sees who owns the work and what the House has done — and investigates
nothing.

---

## 5. Version 1 Experience assessment

**The Founder test:** *Does the Founder feel they are leading an Executive Team, or operating
software?*

**Verdict: leading an Executive Team.** The arrival is the Chief of Staff establishing context;
executives are present through their prepared work; every transition (direction accepted →
completed work accepted → entered into the record) reads as institutional stewardship; and no
implementation language is exposed. All of it is a faithful expression of state that already
exists in the loop — nothing was invented.

**Changes made (presentation only, `main.ts`):** strengthened the approval/completion/record
transitions into institutional language; the arrival now speaks in the Chief of Staff's voice;
a completed matter's entry into the record is confirmed in the House Register (closing an
experience gap so the record-entry transition is reachable), with the duplicate control removed
from the active card; one implementation word ("pipeline") replaced.

**Not changed:** HOS, IEL, AEB, Runtime Boundary, Executive Workflow, Founder Attention,
Institutional Memory — consumed exactly as they exist. No new state, derivation, ownership, or
architecture.
