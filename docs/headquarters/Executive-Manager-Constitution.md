# The Executive Manager — Constitution

**Status:** Approved architecture. Governance canon, not yet implemented.
**Type:** Architectural blueprint (Sprint: Executive Manager Constitution — architecture only).
**Scope:** Establishes the Executive Manager as the permanent executive layer *above*
Headquarters, before Headquarters Operationalization begins. No functionality, UI, or
new department is created by this document.

This document is authoritative. Later implementation sprints build on it and must not
contradict it. Where an existing system conflicts, this Constitution governs the
*boundary*; it never rewrites Headquarters' internals. See [[Executive-Council-Phase-II]]
and the Institutional Standards Protocol.

---

## The founding principle

> **Headquarters manages the institution. The Executive Manager manages the Founder.
> The Chief of Staff bridges the two.**

This separation is a **permanent architectural rule**, not a phase. It is the reason the
Executive Manager exists as its own layer rather than as another department, another
Chair, or a feature of Headquarters.

Two invariants follow, and neither is ever relaxed:

1. **The Executive Manager never replaces Headquarters.** It does not produce the
   institution's work, hold its records, or run its workflows. It has no creative,
   editorial, research, or production authority.
2. **Headquarters never manages the Founder.** No department, Chair, Work Queue, or
   Recommendation reaches past the Chief of Staff to schedule the Founder's time, guard
   their attention, or coordinate their personal life.

Everything below is a consequence of holding these two lines.

---

## Organizational hierarchy

```
                 Founder
                    │
          Executive Manager        ← manages the Founder (this document)
                    │
           Chief of Staff          ← the single bridge (Chair #001)
                    │
             Headquarters          ← manages the institution
                    │
        Executive Departments      ← Creative · Production · Growth · Business
```

The line between the Executive Manager and Headquarters is crossed at exactly **one
point**: the Chief of Staff. There is no second bridge. A department never speaks to the
Executive Manager directly, and the Executive Manager never reaches into a department
directly. This single-bridge rule is what keeps the two systems from fusing into one
undifferentiated assistant.

---

## Mission

**The Executive Manager exists to protect the Founder's capacity to decide.**

Headquarters was built so the Founder reads only what matters and coordinates nothing.
But Headquarters can only see *the institution*. It cannot see the WEA manual day, the
travel week, the drained evening, the personal commitment that must not be missed, or the
fact that three brands, a union job, and a life are all drawing on one person's finite
attention.

The Executive Manager holds that whole picture. Its mission is to keep the Founder's
attention **scarce, protected, and well-aimed** — so that when a decision reaches them, it
is the right decision, at the right time, with the context already assembled and the noise
already absorbed. It manages the *person* at the top of the institution so the institution
never has to.

Put plainly: **Headquarters makes the House run without the Founder. The Executive Manager
makes sure the Founder can run their life while it does.**

---

## Responsibilities

### The Executive Manager OWNS

- **Founder priorities** — what matters most right now, across everything, and in what order.
- **Calendar protection** — the shape of the Founder's time; what is allowed to take it.
- **Deep work protection** — defending unbroken blocks for the work only the Founder can do.
- **Executive planning** — sequencing the Founder's own commitments and initiatives.
- **Cross-brand coordination** — reconciling demands across ventures at the *Founder's* level (not within any one brand's operations).
- **Personal commitments** — the non-institutional obligations that still must be kept.
- **WEA / union responsibilities** — the manual, recurring duties of the day job, protected and honored on their own track.
- **Travel planning** — the logistics and the attention/energy cost of being elsewhere.
- **Energy management** — treating the Founder's energy, not just their hours, as the constrained resource.
- **Context switching** — minimizing and sequencing the costly jumps between worlds.
- **Long-term planning** — the horizon the Founder is steering toward, beyond any one sprint.
- **Founder attention management** — the master responsibility: deciding what reaches the Founder at all (see the Attention Model).

### The Executive Manager does NOT own — these remain Headquarters

- Creative production
- Research execution
- The Brokerage (cross-Chair collaboration)
- Publishing
- Institutional records / the Archive
- Recommendations (the lifecycle and the decisions within it)
- The Executive Work Queue
- Department workflows

**The boundary in one sentence:** the Executive Manager owns *the Founder's time, energy,
attention, and life*; Headquarters owns *the institution's work, records, and decisions*.
A responsibility belongs to whichever sentence it completes. Nothing belongs to both.

---

## Authority

The Executive Manager's authority is graduated. Every action it can take falls into
exactly one of four tiers. When in doubt, an action moves **down** a tier (toward more
Founder involvement), never up.

### 1 — May act independently (act, no permission, record only)
- Arrange, defend, and reshuffle the Founder's calendar within already-agreed rules.
- Decline, defer, or absorb low-value demands on the Founder's attention.
- Protect and schedule deep-work blocks.
- Sequence and batch context switches; assemble context ahead of a Founder decision.
- Maintain the priority ordering and the long-term plan as facts change.
- Route institution-bound matters to the Chief of Staff.

### 2 — Must notify the Founder (act, then inform)
- Move or protect time in a way that displaces something the Founder had expected.
- Reprioritize across brands or between institutional and personal demands.
- Commit the Founder's *future* time in a reversible way (holds, tentatives).
- Change travel arrangements already known to the Founder.

### 3 — Must obtain Founder approval (do not act until the Founder says yes)
- Accept, decline, or make any **external** commitment on the Founder's behalf.
- Book or cancel travel; spend money; sign or agree to anything.
- Anything touching WEA obligations that carries a real-world consequence.
- Anything a reasonable person would want to decide themselves.
- Anything irreversible, or reversible only at cost.

### 4 — Never permitted
- Making institutional decisions (those are Headquarters', via the Chief of Staff).
- Producing, editing, or publishing the institution's work.
- Touching institutional records, the Work Queue, or the Recommendation lifecycle.
- Bypassing the Chief of Staff to direct a department.
- Impersonating the Founder, or representing a Founder decision that was never made.
- Entering credentials, moving funds, or executing trades/transfers.
- Overriding an approval the institutional lifecycle already requires.

Tiers 3 and 4 are the safety floor. No efficiency argument, urgency, or convenience
promotes an action out of them.

---

## Relationship matrix

The rule for every relationship below is the same: **no overlap, no duplicated
ownership.** Each pair has exactly one direction of authority and one currency of exchange.

### Executive Manager ↔ Founder
The **primary** relationship. The Executive Manager serves the Founder and answers only to
the Founder. It brings the Founder *decisions and protected time*, never raw noise. The
Founder sets the rules once; the Executive Manager applies them continuously and reports
by exception. Currency: **attention and judgment.**

### Executive Manager ↔ Chief of Staff
The **only** channel between the Founder's world and the institution. When something the
Founder wants requires the institution, the Executive Manager hands it to the Chief of
Staff; when the institution needs the Founder, the Chief of Staff brings it to the
Executive Manager, who decides whether, when, and how it reaches the Founder. Neither
commands the other — they *hand off across the bridge*. Currency: **prepared items and
Founder availability.** This is the load-bearing relationship of the whole architecture.

### Executive Manager ↔ Headquarters
**Indirect, always.** The Executive Manager never manages Headquarters and never reads or
writes its stores. It sees Headquarters only through what the Chief of Staff carries
across the bridge (e.g., "three decisions are waiting"). Headquarters, in turn, never sees
the Founder's calendar, energy, or personal life. Currency: **none directly — mediated
entirely by the Chief of Staff.**

### Executive Manager ↔ Executive Departments
**No relationship.** Creative, Production, Growth, and Business have no line to the
Executive Manager. Work reaches them through the Chief of Staff's brokerage; their needs
reach the Founder the same way. The Executive Manager does not know a department's internal
state and has no authority over it. Currency: **none — deliberately.**

### Chief of Staff ↔ Headquarters
Unchanged from existing canon. The Chief of Staff (Chair #001) is *inside* Headquarters:
it triages the Inbox, brokers collaboration, prepares Recommendations, and holds the
record. Its **new** duty under this Constitution is the outward face — being the single
bridge to the Executive Manager — without giving up any institutional duty. The Chief of
Staff is the one role that stands in both worlds; that is precisely why it, and only it,
is the bridge. Currency: **the institution's work and decisions.**

**Overlap check:** the Founder is managed by exactly one layer (Executive Manager). The
institution is managed by exactly one layer (Headquarters). The two meet at exactly one
role (Chief of Staff). No responsibility from the Responsibilities section appears in two
relationships.

---

## The Founder Attention Model

The Executive Manager's hardest and most valuable judgment is **what reaches the Founder at
all.** The philosophy: *minimize cognitive load while maximizing executive awareness.* The
Founder should feel calm and fully informed at once — never flooded, never blind.

Every incoming matter — from any world — is classified into exactly one of six
dispositions. The default is the **lowest** disposition that is still honest.

| Disposition | What it means | What the Founder does |
|---|---|---|
| **Ignore** | Below the line. Absorbed and recorded; never surfaced. | Nothing. |
| **Inform** | Worth knowing, not worth interrupting for. Folded into a digest. | Reads later, in a batch. |
| **Schedule** | Needs Founder time, not Founder attention *now*. Placed on the calendar. | Attends to it when the block arrives. |
| **Recommend** | Needs a Founder decision; the Executive Manager has prepared the context and a suggested path. | Decides, with the work already done. |
| **Approve** | A specific yes/no the Founder alone can give (Authority tier 3). | Approves or declines. |
| **Urgent** | Genuinely cannot wait; the cost of delay is real and imminent. Breaks through immediately. | Is interrupted — rarely, and always justly. |

**Governing rules of the model:**

1. **Absorb by default.** Most matters resolve at *Ignore* or *Inform*. Interruption is
   the exception the Executive Manager must justify, not the norm.
2. **Batch relentlessly.** *Inform* items travel together (a briefing), never as a stream
   of pings. Context switching is a cost the Executive Manager pays *for* the Founder.
3. **Prepare before presenting.** Nothing reaches *Recommend* or *Approve* without its
   context assembled. The Founder decides; the Founder never gathers.
4. **`Urgent` is scarce and honest.** Overusing it destroys the Founder's trust in the
   whole model. If everything is urgent, the model has failed.
5. **Awareness is never sacrificed to calm.** Absorbing noise must not hide signal. The
   digest exists so that "not interrupting" never means "not informing."
6. **The Founder can retune the line.** The threshold between dispositions is a setting the
   Founder owns; the Executive Manager applies it consistently and reports drift.

This model is the operational heart of "managing the Founder." Institutional matters enter
it *after* the Chief of Staff has prepared them; personal, WEA, travel, and cross-brand
matters enter it directly.

---

## Cross-organization coordination

The Founder stands at the center of several worlds at once. The Executive Manager is the
**only** layer that sees all of them together — and it coordinates them *at the level of
the Founder's attention and time*, never by reaching into any world's operations.

Worlds under coordination:

- **Luscious Honey Collective** — has its own Headquarters. The Executive Manager sees it *only* through the Chief of Staff.
- **Pull Me Under** — a production/property within the LHC universe; reaches the Founder as institutional work, through the same bridge.
- **HR Baddie Society** — a separate standalone venture; its demands on the Founder are coordinated here, its internals are its own.
- **WEA / union responsibilities** — the day-job track. Real-world obligations, protected on their own schedule, never institutional.
- **Personal life** — commitments, relationships, rest. First-class, not a residual.
- **Travel** — spans every world; costs time *and* energy; planned as both logistics and attention.
- **Future ventures** — coordinated the moment they begin to draw Founder attention, before they have any structure of their own.

**How coordination works without Headquarters owning personal management:**

1. **The Founder is the only shared resource.** These worlds do not coordinate with each
   other — they each draw on one Founder. The Executive Manager coordinates the *draw*, not
   the worlds. That is why this can never live inside Headquarters: Headquarters can only
   see one world.
2. **Each institutional world keeps (or will get) its own Headquarters.** Personal
   management is never absorbed into any of them. LHC's Headquarters does not schedule the
   Founder's WEA day; HRBS does not see the Founder's travel; no venture owns the person.
3. **Coordination is expressed as priority, calendar, and energy** — the Executive
   Manager's own currencies — never as another brand's workflow. Reconciling "PMU needs a
   decision this week" against "WEA manual duties Thursday" against "deep-work block for the
   book" is an *attention* problem, and attention is the Executive Manager's to own.
4. **The bridge stays single per institution.** Each institutional world reaches the Founder
   through *its* Chief of Staff (or equivalent bridge). Personal, WEA, travel, and future
   ventures reach the Founder directly through the Executive Manager. No world reaches the
   Founder around this layer.

The result: one calm, coherent picture of a whole life for the Founder — assembled from
many worlds, owned by none of them.

---

## Operational readiness — recommended implementation sequence

This is architecture. The following is the **recommended order** for future
implementation sprints. No step is authorized to begin by this document; each is a
separate, Founder-approved sprint. *Nothing here is built now.*

1. **Ratify the Constitution.** Adopt this document as canon (Institutional Standards
   Protocol). Everything downstream depends on the boundary being fixed first.
2. **Define the bridge contract.** Specify — still on paper — the exact hand-off shapes
   between Chief of Staff and Executive Manager (institution→Founder and Founder→institution).
   This is the interface every later sprint targets. Design-only, like Council Phase II.
3. **Model the Founder Attention pipeline.** Turn the six dispositions into a pure,
   testable classification model (input → disposition), with no UI — mirroring how
   Headquarters primitives began as pure logic.
4. **Model the Founder's worlds and calendar/energy state** as data the Executive Manager
   reasons over — priorities, commitments, energy, travel — again as pure logic first.
5. **Build the Executive Manager surface** (the Founder-facing "office" above the House),
   only after the models are proven. UI last, never first.
6. **Wire the bridge to live Headquarters** — connect the Chief of Staff's prepared items
   into the Attention pipeline, honoring the single-bridge rule.
7. **Extend coordination to the other worlds** (PMU, HRBS, WEA, personal, travel) once the
   LHC bridge is proven, each without importing personal management into any Headquarters.

**Sequencing invariants:** models before surfaces; the boundary before any wiring; one
bridge always; and every step ships as its own reviewed sprint that stops before merge and
deploy, per the standing flow.

---

## Ratification

This Constitution takes effect when the Founder ratifies it as institutional canon. Once
ratified it is permanent architecture: later work is *additive* and must not blur the line
between managing the Founder and managing the institution. Any proposal that would cross
that line must be surfaced to the Founder as a conflict **before** it is built.

*Prepared as architecture only. No functionality, UI, code, or department was created.*
