# The Executive Decision Constitution

**Status:** Approved architecture. Part of the Founder engine, under the
[[Executive-Operating-System-Charter]].
**Governs:** how decisions and approvals are made, recorded, timed, and honored across the
Executive Operating System — **on top of the systems that already exist**, never beside them.
**Depends on:** [[Executive-Manager-Constitution]] (authority tiers, attention model) and
[[Bridge-Contract-Executive-Manager-Chief-of-Staff]] (the flows).

This document defines behavior; it does not implement it. Critically, it creates **no new
decision store** — it names the existing ones and fixes their meaning.

---

## The doctrine

> **The Founder decides. Headquarters records the institution's decisions. The Executive
> Manager decides only when a decision reaches the Founder — never what the decision is.**

Decision-making already lives in the repository. This Constitution does not reinvent it; it
governs how the Founder engine and the bridge *relate* to it.

---

## The single source of truth (do not duplicate)

Repository fact, preserved as canon:

- **Recommendations are the single source of truth** for institutional decisions
  (`chief-of-staff-ops.ts` — the recommendation lifecycle). Every institutional decision *is*
  a Recommendation moving through its guarded lifecycle.
- **The Executive Work Queue is a derived projection** and owns nothing
  (`executive-work-queue.ts`). It never becomes a decision store.
- **The Register** owns Chair identities; **the Archive** owns preserved record. Neither is a
  decision store, and neither is Founder memory.

Nothing in EOS creates a second decision record. The Executive Manager **reads** these
through the Chief of Staff and **times** how they reach the Founder; it never holds its own
copy of an institutional decision.

---

## The three decision surfaces (existing) and their meaning

| Surface | Existing system | Holds | Owner |
|---|---|---|---|
| **Decisions** | Recommendations `awaiting_founder` | prepared decisions needing the Founder's word (approvals) | Chief of Staff prepares; **Founder decides** |
| **The Docket** | CoS Docket | open leadership *questions* — matters wanting consideration, not tasks | Chief of Staff curates; Founder considers |
| **Founder approvals** | Authority Tier 3 (EM Constitution) | yes/no acts only the Founder may give (spend, travel, external/irreversible commitments) | **Founder decides**; EM presents |

These are distinct and must stay distinct: **Decisions ≠ Docket.** A decision is a prepared
Recommendation awaiting a word; a Docket item is an open question awaiting consideration. The
Bridge Contract's *decision flow* binds to Decisions; there is no second "docket," and no new
approvals queue is introduced.

---

## How a decision travels (all owners, one path)

1. **Origin (institution).** A matter becomes a Recommendation inside Headquarters and moves
   through its lifecycle (triage → preparing → `awaiting_founder`). The Chief of Staff
   prepares it, with the thinking laid out. *Owner: Chief of Staff.*
2. **Timing & framing (Founder engine).** The Chief of Staff carries the prepared decision
   across the bridge. The Executive Manager classifies it in the **Founder Attention Model**
   (Ignore / Inform / Schedule / **Recommend** / **Approve** / Urgent) and decides *when and
   how* it reaches the Founder — never *what* it is. *Owner: Executive Manager (timing only).*
3. **Decision (Founder).** The Founder gives their word — Approve / Decline / Defer / Request
   Revision (the existing Founder decision set). *Owner: Founder, exclusively.*
4. **Execution (institution).** The decided Recommendation returns down the spine and executes
   within Headquarters; the record is the Recommendation itself. *Owner: Chief of Staff / the
   owning Chair.*

The Executive Manager appears only at step 2, and only to protect the Founder's attention.
It cannot make, alter, or substitute for the decision at step 3.

---

## Authority mapping

Approvals map one-to-one to the Executive Manager's four authority tiers
([[Executive-Manager-Constitution]], Article V):

- **Tier 1 (act independently)** — the EM arranges the Founder's engagement with a matter;
  no decision is made on the Founder's behalf.
- **Tier 2 (notify)** — the EM proceeds and informs; still no institutional decision.
- **Tier 3 (obtain approval)** — the matter becomes a **Founder approval**: presented,
  decided by the Founder, then executed. This is the approval flow.
- **Tier 4 (never)** — the EM never makes institutional decisions, never overrides an
  approval the Recommendation lifecycle already requires, and never represents a decision the
  Founder did not make.

---

## Recording, correction, and provenance

- **The record is the Recommendation.** A decision is recorded once, where it already lives.
  The Founder engine records only *that a matter was surfaced and when* (working context),
  not a duplicate of the decision.
- **Provenance is preserved, not forked.** The existing origin-chain on a Recommendation
  (intel → opportunity → assignment → draft → production → recommendation) remains the single
  provenance; the EM adds no competing lineage.
- **Correction follows the owning system.** An institutional decision is corrected inside the
  Recommendation lifecycle; the Founder's correction of *what the EM remembered about a
  matter* follows the Memory Constitution. The two corrections never cross.
- **Idempotence across the bridge.** A decision reaches the Founder once and executes once —
  no duplicated Recommendations, no duplicated interruptions (Bridge Contract, failure
  handling).

---

## What this document does not do

It builds nothing and stores nothing. It fixes the meaning of the existing decision surfaces
and forbids parallel ones. Implementation is governed by the Roadmap (Phase III, the Bridge
Layer) and begins only as a separately-approved sprint.
