# Headquarters — Master Plan v1 (planning only)

Internal planning. **No implementation, CSS, routes, or deployment.** Extends the
existing room-registry in [Architecture.md](Architecture.md); does not rebuild any
tool. Canonical inputs treated as fixed: Constitution of the House, Founder Voice
Profile, Founder Evidence Book, Founder Writing Source Map.

> The Constitution's article text is not in this repo. The principle keys below are
> the House's stated values (from the Voice Profile / Analysis). **Reconcile these
> labels to the Constitution's article numbers before building** — the mapping holds;
> only the labels may need renumbering.

## Principle key (P#)

P1 Collective over individual · P2 Protect & center overlooked voices (the torch) ·
P3 Feeling over polish · P4 Reciprocity (creator↔audience) · P5 Hospitality / care
with intention · P6 Dignity & fair compensation · P7 Cooperation, not competition ·
P8 Freedom & exploration; "no idea is impossible" · P9 Creativity + operations under
one roof ("we are the resource") · P10 Legacy & preservation ("protect it at all
cost") · P11 Truthfulness / never fake activity.

---

## 1 — Headquarters Master Plan (rooms → principles)

**Front of House (public site — live/planned):**

| Room | Principle | Purpose | Primary user | P/Priv | Dependencies | Related | Future expansion |
|---|---|---|---|---|---|---|---|
| Reception (arrival + Spine) | P5,P1,P10 | The front door; orient the visitor | Public visitor | Public | live | all public wings | daylit/seasonal states |
| Publishing Wing | P3,P2,P4 | Hold finished editorial work | Reader | Public | content model | Reader, Press | sub-sections by medium |
| The Reader | P3,P4 | One work on a reading plate | Reader | Public | Publishing | Publishing | audio/film readers |
| Press (Journal archive) | P11,P5,P10 | Dated, signed founder notes | Reader | Public | governance | Reception | tags, search |
| Productions signal (Now Recording) | P11,P9 | Honest live-session lamp | Reader | Public | recording flag | Studio (private) | "what's recording" line |
| Salon | P4,P1,P5 | A room of chairs; real events | Guest | Public | events calendar | Reception | live mode |
| Lantern | P2,P3 | One featured work on a plinth | Reader | Public | curation | Publishing, Archive | rotating single work |
| Archive | P10,P2 | Preserve works + relations | Reader | Public | works data | Lantern | 20-yr strata graph |

**Back of House (private Founder Wing — tools):**

| Room | Principle | Purpose | Primary user | P/Priv | Dependencies | Related | Future expansion |
|---|---|---|---|---|---|---|---|
| Founder Interview | P2,P3,P10 | Extract the founding voice | Founder | Private | schema | Packet, Memory | V2 questions; more doc types |
| Editorial Packet Generator | P10,P3 | Structure answers for drafting | Founder | Private | Interview | Memory, Writing Source Map | AI drafting engine (later) |
| Editorial Memory | P10,P11 | Keep every answer & version | Founder | Private | localStorage | Packet | export/backup ritual |
| Audio Studio | P9,P6,P8 | Recording, private artist sessions, export | Founder / invited artist | Private | own server | Productions signal, Publishing | Contributor onboarding |
| Founder Wing (Voice Profile / Analysis / Source Map) | P10 | Canonical voice reference | Founder / future AI | Private | packet | all writing | living updates |
| Creative Calendar | P9,P11 | Real schedule (drives Salon/Journal) | Founder | Private | — | Salon, Press | reminders |
| Artist Applications | P1,P2,P6 | Admit creators to the collective | Founder / applicant | Private | criteria (TBD) | Studio, Publishing | invite flow |
| Content Pipeline | P9,P3,P11 | Draft → review → publish states | Founder / editor | Private | works data | Publishing, Planning | assignments |
| Editorial Planning | P9,P3 | Decide what gets made | Founder | Private | Pipeline | Calendar | roadmaps |
| Production Tracking | P9,P11 | Status of in-flight production | Founder | Private | Pipeline | Studio | dashboards |
| Brand Assets | P10 | Logos, type, imagery of record | Founder / team | Private | — | all wings | asset manifest |
| Research Library | P2,P3 | References that inform editorial | Founder | Private | — | Planning | citations |

---

## 2 — Headquarters Navigation (a building, not a website)

- **Two doors, one building.**
  - *Public entrance* — **Reception / the Spine** (the cinematic arrival). The street
    door. Everything public hangs off the corridor.
  - *Private entrance* — **The Founder's Door** (Editorial Office). The staff
    entrance; gated (Cloudflare Access, future). Never linked from the public house.
- **Front of House (public wings)** branch off the Spine: Publishing → Reader; Press;
  Productions (signal only); Salon; Lantern; Archive. Navigation *is* architecture
  (doors on the corridor), per Sprint 04 — no menu bar.
- **Back of House (private Founder Wing)** is one dashboard, organized as **three
  clusters** rather than a dozen doors:
  1. **Writing** — Interview · Packet Generator · Editorial Memory · Voice Profile.
  2. **Production** — Audio Studio · (future) Production Tracking.
  3. **Operations** — (future) Calendar · Applications · Content Pipeline · Planning.
- **Room relationships (flow of work):**
  Interview → Packet → Voice Profile/Source Map → **drafts** → Content Pipeline →
  Publishing/Press (public). Studio → Productions signal + Publishing. Applications →
  admit creator → Studio/Publishing. Everything shipped → Archive (preservation).
- **Future expansion:** private rooms append to the registry (one entry each) inside
  the three clusters; public wings append to the Spine. The building grows by adding
  doors, never by redrawing the plan.

---

## 3 — Build Order

**Ready Now** (exist or extend existing with low risk)
- *Exist:* Reception, Publishing, Reader, Press (public); Interview, Packet, Memory,
  Audio Studio (private).
- *Next, low-risk extension:* the **private Founder Dashboard shell** (room registry
  → three clusters). Pure extension of the Editorial Office home.

**Needs Design**
- Lantern (public single work) — small, high symbolic value.
- Salon (public) · Archive (public graph).
- Content Pipeline · Creative Calendar · Editorial Planning (private ops).

**Needs Founder Decision**
- **Cloudflare Access** gate before any private wing is hosted (prerequisite).
- Now-Recording control transport (how the flag flips).
- **Artist Applications** admission criteria (she left "who we admit / what we owe"
  answers blank — see Voice-Analysis follow-ups).
- **Compensation model** (the money answers were "I don't understand the question").
- The **sensuality/exploration** space (needs a dedicated follow-up before it has a room).

**Future Phase**
- Salon live mode · Archive 20-yr graph · Production Tracking · Brand Assets ·
  Research Library · member/creator spaces.

**Priority (recommended order):**
1. Founder Dashboard shell (Ready Now — unifies the private wing).
2. Cloudflare Access decision (risk gate before hosting anything private).
3. Lantern (public, small, on-brand).
4. Now-Recording control (founder decision).
5. Ops rooms **only as real work demands them** (see Gap risk #4).

---

## 4 — Gap Analysis

**Duplicate systems**
- *Editorial Memory (app, localStorage)* vs *Founder Wing docs (repo)* — two
  "memories." **Simplify:** repo docs = canonical, permanent reference; app Memory =
  working answers/versions. Add an **export ritual** (packet → repo) so nothing lives
  only in one browser.
- *Packet Generator* vs *Writing Source Map* — overlap in "organizing answers."
  Keep distinct: Generator = mechanical structure; Source Map = human editorial
  judgment. No merge.

**Unnecessary rooms (for now)**
- Research Library, Brand Assets, Production Tracking — **premature**; defer to Future
  Phase. Building ops before throughput exists violates "no empty institution."

**Missing rooms**
- **Admissions / Onboarding** for creators — the founder cares deeply *who* is in the
  collective, but there's no path in. Elevate **Artist Applications** from "future" to
  a real near-term room (pending criteria).
- **Compensation / Dignity** mechanism — a strong stated value (P6) with no room.
- **The People / The Collective** (public) — the origin story is *the cast*; there is
  no public room honoring the people who *are* the collective. Consider a public
  "Collective" room off the Spine.

**Architectural risks**
1. **No access control yet.** Private tools are safe today only because they're
   dev-only/undeployed. **Cloudflare Access is the top prerequisite** before hosting.
2. **"Headquarters" is overloaded** (public building vs private tools). Adopt **Front
   of House / Back of House** language to end the ambiguity.
3. **Single-machine localStorage** = the canonical founder material can be lost.
   Mitigated once (packet committed); make export-to-repo a standing ritual.
4. **Building ahead of content.** Many reserved rooms risk an empty institution.
   Rule: *a room is built only when real work fills it* (the House's own truthfulness
   principle, P11).
5. **Studio on a separate origin.** Fine while local; must stay private and behind
   Access if ever unified.

**Recommended simplifications**
- Collapse 9 reserved private rooms → **3 clusters** (Writing / Production /
  Operations). One dashboard, three wings, not thirteen doors.
- Freeze Front-of-House at the four live pages + **Lantern** next; defer Salon/Archive
  until real events/works exist.
- One registry, one export ritual, one access gate. Grow by adding doors, on demand.
