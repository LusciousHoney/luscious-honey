# Luscious Honey Collective — Architecture Baseline & Audit (v1)

> **Status update — Collective Creative Intake Activation (Version 1).** Two of
> this baseline's open items are now activated (see §13 for details): the
> Headquarters Production Suite now provides a **working entrance** to the existing
> Voice Notes Studio, and the **Artist Submission framework** now supports six new
> creative pathways (Music, Book, Podcast, Visual Art, Event, Other Proposal)
> alongside the retained `artist_feature` pathway — through the *same* intake → D1 →
> Editorial Office → Headquarters pipeline. The status rows below are updated in
> place; the audit itself is unchanged.

> **Purpose.** This is a *handoff + audit* baseline, not an implementation sprint.
> It establishes an authoritative inventory of everything that currently exists in
> the Luscious Honey Collective repository, reconciles it against the stated
> architecture, and identifies where future work belongs. **No production code was
> modified to produce it.** Every claim below traces to a file in this repository.
>
> **Verification run for this audit:** `npx tsc --noEmit` → clean; `npm test` →
> **517 passing, 0 failing**. Dependencies were installed to run the checks; no
> source was touched.
>
> Headquarters Version 1 is treated as **complete and authoritative**. This
> document audits *integration points only* and does not redesign Headquarters.

---

## 1. Complete Ecosystem Inventory

The repository is a single Vite multi-page application deployed to **Cloudflare
Pages** (static `dist/` + Pages Functions), with a **D1** database and **Cloudflare
Access** gating the private surfaces. There is one repository; "applications" below
are *surfaces* (build inputs) within it, not separate repos.

### 1.1 Public surfaces (in the production build — `vite.config.js` rollup inputs)

| Surface | Entry | Role |
|---|---|---|
| **Reception** | `index.html` → `src/main.ts` | Public arrival: Spine Reveal, Front Desk / House Journal, Long Corridor, Now-Recording signal. |
| **Publishing Wing** | `publishing.html` → `src/publishing.ts` | Works shelf, editor's desk, Writing Wall. |
| **The Reader** | `reader.html` → `src/reader.ts` | One work on a reading plate. |
| **Press** | `press.html` → `src/press.ts` | House Journal archive (published entries). |
| **Artist Features intake** | `artist-features.html` → `src/artist-features.ts` | **The public Artist Submission form.** Posts to `/api/intake/artist-feature`. |
| **Tribute No. 01** | `tk-tribute.html` | Permanent Collection tribute page + guestbook. |
| **404** | `404.html` | Not-found. |

### 1.2 Private surfaces (in the build, gated by Cloudflare Access + `noindex`)

| Surface | Entry | Role |
|---|---|---|
| **Production Studio** (hub) | `production-studio/index.html` → `src/production-studio.ts` | Private hub. Currently holds exactly one tool: the Voice Notes Studio. |
| **Voice Notes Studio** | `public/production-studio/voice-notes/` | The recording/collaboration tool (see §6). |
| **Editorial Office** | `editorial-office/index.html` → `src/editorial-office.ts` (685 lines) | **The operational submission-review workspace** (Dashboard · Review · Detail). Reads/writes the submissions spine via `/api/submissions`. Authoritative review app. |
| **Headquarters** | `headquarters/index.html` → `src/headquarters/main.ts` (≈4,990 lines; `src/headquarters/` ≈13,900 lines total) | The founder's private residence — six wings + shared services + the full executive/institutional logic layer (see §9). |
| **Invitation** | `invitation/index.html` → `src/invitation/main.ts` | Founding Steward invitation experience; token-resolved server-side. |

### 1.3 Dev-only surfaces (explicitly **excluded** from the production build)

| Surface | Entry | Role |
|---|---|---|
| **Interview Workbench** | `interview-workbench.html` → `src/office/main.ts` (+ `src/office/{core,engine,schema,store,views,types}.ts`) | A document-authoring engine for the Founder's Note and other editorial documents. Header comments label it "Editorial Office", but it is a **distinct** thing from the Access-gated Editorial Office above, and is `npm run dev` only. |

> ⚠️ **Naming collision to resolve (documentation only).** Two different things
> answer to "Editorial Office": (a) `editorial-office/` — the deployed submission
> review app; (b) `src/office/` — the dev-only interview/document authoring engine.
> They share CSS (`src/styles/office.css`) but are separate apps. This baseline
> treats (a) as *the Editorial Office* and (b) as *the Interview Workbench*.

### 1.4 Backend (Cloudflare Pages Functions + shared contract + D1)

| Path | Role |
|---|---|
| `functions/api/intake/[type].js` | Generic public intake. Selects a manifest from the submission-type registry, validates, stores, sends acknowledgment. **Only `artist_feature` is registered.** |
| `functions/api/submissions.js` | Authoritative submissions API: reads + audited status/note writes. Re-validates every transition. |
| `functions/api/headquarters/briefing.js` | Daily Briefing derivation for Headquarters. |
| `functions/api/invitation/{view,advance,decision}.js` | Invitation lifecycle (token resolution, state advance, accept/decline). |
| `functions/api/draft.js` | Draft provider endpoint (AI-assisted drafting seam). |
| `functions/api/tribute/tk/guestbook.js` | Tribute guestbook. |
| `functions/_lib/*` | `submissions`, `submission-types`, `workflow`, `invitation`, `invitation-content`, `briefing`, `email`, `access`, `guestbook`, `draft-provider`. |
| `shared/workflow.js` (+ `.d.ts`) | **Single source of truth** for the editorial workflow (statuses, labels, inline transitions). Imported by *both* server and Headquarters client. |
| `migrations/*.sql` | D1 schema: `0001_submissions`, `0001_tribute_guestbook`, `0002_invitation_acceptances`, `0003_invitation_registry`, `0004_invitation_lifecycle`. |

### 1.5 Content & docs

- **Content** as structured files: `content/{journal,works,held-frame,writing-wall,now-recording}`.
- **Docs**: `docs/` (Architecture, Content-Model, Design-Tokens, Living-Clock, Accessibility, Asset-Manifest, Interview-Workbench, DEPLOY, Founder-Review-Mode), `docs/executive-headquarters/` (Design Language Standard, Experience Architecture), `docs/headquarters/` (≈20 institutional-architecture documents — the EOS / Council / Institutional-Loop constitution set), `docs/founder/` (voice, invitation, interview proposal).

---

## 2. Current Implementation Audit (by component)

### 2.1 Artist Studio / Artist Submission — ✅ core / 🚧 breadth
- **Public form:** `artist-features.html` + `src/artist-features.ts` — real, validated, honeypot + optional Turnstile. **Complete for the one supported type.**
- **Type registry:** `functions/_lib/submission-types.js` is a genuine reusable framework (`fields`, `validate`, `acknowledgment`, `editorSummary`, `describeType`, `listSubmissionTypes`) — but **only `artist_feature` is registered.** The Artist Feature type collects *Music URL, Social, Interest (Interview / Live Performance / both), Promoting now, Notes.*
- **Storage + workflow + audit + correspondence:** inherited from `functions/_lib/submissions.js` + `functions/api/submissions.js` + `shared/workflow.js`. **Complete.**
- **There is no separate "Artist Studio" application.** "Artist Studio" as used in the brief maps to *the Artist Feature intake + the submissions spine*, not a distinct code surface.

### 2.2 Editorial Office (submission review) — ✅ complete (for current types)
- `src/editorial-office.ts` (685 lines) + `src/styles/editorial-office.css`. Three in-app views (Dashboard · Review · Detail). Reads/writes the authoritative `/api/submissions`. In the production build, Access-gated. **This is the operational review workspace of record.**

### 2.3 Interview Workbench (document authoring) — 🚧 partially implemented (dev-only)
- `src/office/*` document engine. **Founder's Note** schema is fully realised (5 stages, ~40 questions); **Editorial Charter** and **House Journal** carry real multi-question schemas; **Lantern Essay, Interview, Artist Feature, New Editorial** are genuine *starter* schemas (one stage each). `DOC_TYPES` = 7 types. Persists to a store (`src/office/store.ts`). **Not in the production build** (dev-only by design — `docs/Interview-Workbench.md`).

### 2.4 Voice Notes Studio — ✅ complete (see §6)

### 2.5 Invitation system — ✅ complete
- Full lifecycle: `functions/_lib/invitation.js` (STATUS: invited → opened → considering → conversation_requested → reminder_scheduled → accepted/declined → planning_complete → ready_for_workspace), token **hashing** (raw token never stored), per-recipient atmospheric personalization, D1 registry (`0003`/`0004` migrations), governed published copy (`invitation-content.js`), client experience (`src/invitation/main.ts`, 312 lines), and CLI tooling (`scripts/create-invitation.mjs`). Server endpoints `view`/`advance`/`decision`. **Complete and self-contained.**

### 2.6 Headquarters — ✅ complete (Version 1) — audited as integration only (see §9)

### 2.7 Publishing / Press / Reader / Reception — ✅ complete (Sprint 01 vertical slice)
- The public House vertical slice is implemented against locked design tokens and the Living Clock; content is a labelled temporary fixture per `README.md` "Known limitations".

---

## 3. Component Ownership Matrix

*"Owner" = the application/surface that holds the behaviour today. This documents
current reality; **nothing is moved.***

| Component | Current owner | System of record | Correct home? |
|---|---|---|---|
| Public House (Reception/Corridor/Publishing/Reader/Press) | Reception app (`src/`) | `content/*` files | ✅ Yes |
| **Artist Submission (intake)** | Public Artist Features form + `functions/api/intake` | D1 `submissions` | ✅ Yes |
| **Submission review / decisions** | **Editorial Office** (`editorial-office/`) | D1 `submissions` (via `/api/submissions`) | ✅ Yes — authoritative |
| Founder inline decisions on submissions | Headquarters (Executive Office) | Same `/api/submissions` (audited) | ✅ Yes — references, never replaces |
| Editorial document authoring (Founder's Note, etc.) | **Interview Workbench** (`src/office/`, dev-only) | `src/office/store.ts` | ✅ Yes (dev tool) |
| **Voice Notes Studio** (recording/collaboration/export) | Production Studio (`public/production-studio/voice-notes/`) | None (in-memory + downloaded ZIP/JSON files) | ✅ Housed under Production Studio; **not yet wired to the HQ Production Suite** (see §6/§9) |
| Invitation lifecycle | Invitation app + `functions/_lib/invitation` | D1 invitation registry/lifecycle | ✅ Yes |
| Daily Briefing | `functions/api/headquarters/briefing` → HQ | Derived from `submissions` | ✅ Yes |
| Workflow contract (statuses/transitions) | `shared/workflow.js` | Itself (single source of truth) | ✅ Yes — shared by server + client |
| Executive/Institutional cognition & pipeline | Headquarters (`src/headquarters/*`) | HQ presentation + client session memory; institutional derivations | ✅ Yes (V1) |
| Tribute + guestbook | `tk-tribute.html` + `functions/api/tribute/tk/guestbook` | D1 `tribute_guestbook` | ✅ Yes |

**Nothing was found living in the wrong application.** The only structural note is
the **dual "Editorial Office" name** (§1.3) — a documentation/naming issue, not a
misplacement of behaviour.

---

## 4. Completion Status Matrix

Legend: ✅ Complete · 🚧 Partial · 📋 Designed (doc/schema exists, not built) · 💡 Concept only (named in brief, no repo evidence)

| System | Status | Evidence |
|---|---|---|
| Public House vertical slice | ✅ | `index/publishing/reader/press` + `src/` + tests |
| Artist Submission — Artist Feature type | ✅ | `submission-types.js`, `intake/[type].js`, public form |
| Artist Submission — Music/Interview/Live Performance | ✅ | fields within `artist_feature` |
| Artist Submission — Music / Book / Podcast / Visual Art / Event / Other Proposal | ✅ | **Activated (V1).** Six pathways registered from `shared/submission-forms.js` via a `buildType()` factory in `submission-types.js`; public form at `/submit`; verified end-to-end (intake → D1 → Editorial Office → Headquarters). |
| Editorial Office (review app) | ✅ | `src/editorial-office.ts` + `/api/submissions` |
| Submission workflow + audit + correspondence | ✅ | `shared/workflow.js`, `functions/_lib/submissions.js` |
| Interview Workbench (doc authoring) | 🚧 | Founder's Note complete; other doc types starter schemas; dev-only |
| Voice Notes Studio | ✅ | `public/production-studio/voice-notes/` (script.js 2,744 lines) |
| Voice Notes Studio ↔ Headquarters integration | ✅ | **Activated (V1).** HQ Production Suite Narration Desk now renders a real entrance (`VOICE_NOTES_STUDIO` in `production.ts`; `buildNarrationDesk` in `main.ts`) linking to `/production-studio/voice-notes/` with the Collective → Production → Voice Notes Studio breadcrumb. Linked, not rebuilt. |
| Invitation system | ✅ | `functions/_lib/invitation.js` + migrations `0002–0004` |
| Headquarters — 6 wings + shared services | ✅ | `rooms.ts` (all `live`), `main.ts`, `HEADQUARTERS.md` |
| Headquarters — Executive Workflow / Chief of Staff / Council Phase III pipeline | ✅ | `executive-workflow`, `chief-of-staff-ops`, `growth-intelligence` → `content-opportunity` → `creative-assignment` → `creative-draft` → `production-readiness` (all wired into `main.ts`, all tested) |
| Headquarters — Cognitive layer (Founder Attention, Executive Memory/Context/Judgment) | ✅ (logic) | `founder-attention`, `executive-memory`, `executive-context`, `executive-judgment` + tests. Judgment/Context/Memory are **logic-only**, not surfaced in the client UI. |
| Headquarters — Execution layer (Runtime Boundary, Execution Bridge, Institutional Loop, Ledger) | ✅ (logic) | `execution-runtime`, `execution-bridge`, `institutional-loop`, `execution-ledger` + tests. `execution-runtime`/`institutional-loop` are logic-only (no client host). |
| Creator Studio (as a distinct app) | 💡 | **No repo evidence** of a surface named "Creator Studio." The Voice Notes Studio's left panel is labelled "Creator Dashboard"; HQ's "Creative Director" wing is the nearest built analogue. |
| Creator Relationships | 🚧 | HQ **Growth Studio** renders `RELATIONSHIPS` (`growth.ts`); no CRM/persistence. Editorial correspondence exists per-submission. |
| Creator desks | 💡 | No creator-facing desk/portal exists. Voice Notes Studio has an Owner/**Contributor** package flow (offline, file-based), which is the only creator-collaboration surface. |
| Podcast / Spoken word / Music / Book / Visual art workflows | 📋/💡 | Referenced only in HQ pipeline comments and invitation copy; no dedicated per-medium workflow surfaces. Interview & Artist Feature exist as *doc-authoring starters* in the Interview Workbench. |
| Growth (department) | ✅ (V1 shell + intelligence pipeline) | HQ `growth.ts` (relationships/salon copy) + `growth-intelligence.ts` (research desk, tested) |
| Production (department) | ✅ (V1 view) | HQ `production.ts` maps finishing-tail statuses to lanes |

---

## 5. Dependency Map

```
Cloudflare Access + D1  ──┬─► Editorial Office (review)
                          ├─► Headquarters (reads briefing + submissions)
                          └─► Invitation (registry/lifecycle)

shared/workflow.js  ──► functions/api/submissions.js ──► Editorial Office
                    └─► src/headquarters/adapters.ts  ──► Headquarters inline decisions

functions/_lib/submission-types.js ──► /api/intake/[type] ──► D1 submissions
        (adding a type here lights up storage, workflow, audit, Office, HQ for free)

HQ Council Phase III pipeline (all inside Headquarters):
  growth-intelligence ─► content-opportunity ─► creative-assignment
                        ─► creative-draft ─► production-readiness
  (each an annotation layer LINKED to the prior; never a copy)

HQ Execution loop (logic-only in V1):
  headquarters-os ─► executive-loop ─► execution-bridge ─► execution-runtime
                  ─► institutional-loop ─► institutional-memory ─► (back to HOS)

HQ Cognitive layer (logic-only in V1):
  founder-attention (M1) ─► executive-memory (M2) ─► executive-context (M3)
                          ─► executive-judgment
```

**What must be true before each thing is "complete":**

- **Artist Studio (submission) considered complete** ⇐ decide the *supported
  submission types* (Book/Podcast/Photography/Visual Art/Events). Each new type =
  one registry entry in `submission-types.js` + one public form. Everything
  downstream (storage, review, audit, HQ inline decisions) is already inherited.
- **Depends on Voice Notes Studio:** nothing else in the repo currently depends on
  it — it is standalone. The *only* pending dependency is the **reverse**: the HQ
  Production Suite's in-residence "recording position" is a placeholder awaiting a
  decision to route to (or embed) Voice Notes Studio.
- **Depends on Artist Submission:** Editorial Office review, HQ Daily Briefing, HQ
  Executive Office inline decisions, and the Council Phase III pipeline's notion of
  incoming work all read the `submissions` spine.
- **Depends on Headquarters:** the Council pipeline, cognitive layer, and execution
  loop all live inside HQ; per policy they are **not to be redesigned**.
- **May proceed independently:** Voice Notes Studio (offline tool), Invitation
  system, the public House content, the Tribute.

---

## 6. Voice Notes Studio Assessment

- **Exists?** ✅ Yes, and it is substantial: `public/production-studio/voice-notes/`
  — `script.js` (2,744 lines), `index.html` (358 lines), `styles.css`, plus
  `audio/`/`images/` asset folders and a README.
- **Where it lives:** served through the House build at
  **`/production-studio/voice-notes`** *and* runnable standalone offline via
  `npm run studio` (`scripts/serve-voice-notes-studio.mjs`, kept out of `public/`
  so it never ships).
- **Correctly housed under Production?** ✅ Yes — it is the sole tool under the
  private **Production Studio** hub (`production-studio/index.html`), gated by
  Access, `noindex`, robots-disallowed.
- **Functionality that exists (complete):** Creator Dashboard + live 9:16 phone
  preview; **Owner / Contributor roles**; **Episode Packages** (`Episode-NNN.zip`
  carrying `episode.json` + `/audio` + `/avatars` + README); Master / Contributor /
  Return package types; per-note *or* single-mastered audio (WAV/MP3/M4A); add /
  reorder / delete notes; character avatars; recording countdown/settle/gap
  settings; **Preview** + **Recording Mode**; **in-browser WebM export**
  (1080×1920, MediaRecorder + Web Audio mixing) with placeholder-safe silence;
  JSON save/load/duplicate.
- **What remains unfinished (by the tool's own docs):** **MP4 export** (WebM only
  today); no persistence/accounts/cloud (deliberate — in-memory + downloaded
  files); **no integration with the Headquarters Production Suite** (HQ's
  `RECORDING_NOTE` explicitly says a capture destination "opens here inside the
  residence soon"); it is branded around *Pull Me Under* / "Honey × Khalil" rather
  than a general Collective creator flow.
- **Recommendation:** **Do not rebuild.** Future work is *integration* (surface it
  from the HQ Production Suite) and optional *MP4 export*, not reconstruction.

---

## 7. Artist Submission Assessment

- **Exists?** ✅ Pipeline exists end-to-end for **one** type.
- **Where:** public form `artist-features.html`; generic endpoint
  `functions/api/intake/[type].js`; type manifest `functions/_lib/submission-types.js`;
  storage/audit/correspondence `functions/_lib/submissions.js`; workflow contract
  `shared/workflow.js`; review UI `editorial-office/`; founder decisions via
  Headquarters.
- **Supported submission types today:** **Artist Feature only** (`artist_feature`),
  covering *Interview / Live Performance / Interview + Live Performance* with a
  Music link. **Book, Podcast, Photography, Visual Art, Events, Other = not
  registered** (framework-ready, 📋).
- **Review/integration coverage:**
  - **Founder review** — ✅ HQ Executive Office inline decisions (`adapters.ts` +
    `INLINE_TRANSITIONS`, server-re-validated).
  - **Editorial review** — ✅ Editorial Office (full flat any-to-any workflow).
  - **Creator review** — ❌ No creator-facing review/status portal (submitters get
    only the emailed acknowledgment; no login).
  - **Publishing integration** — 🚧 `published` status exists and flows to Press;
    no automatic hand-off from an accepted submission to a published work object.
  - **Production integration** — 🚧 HQ Production Suite reads `scheduled/approved/
    published` as lanes, but there is **no link from a submission to Voice Notes
    Studio** capture.
  - **Growth integration** — 📋 HQ Growth Intelligence pipeline is about *external*
    opportunities, not inbound submissions; no wiring from submissions → growth.
  - **Headquarters integration** — ✅ Briefing + inline decisions read the spine.
- **What remains:** decide + register the additional submission *types*; decide
  whether creators get any status visibility; decide the accepted-submission →
  published-work and → production-capture hand-offs.

---

## 8. Creator Workflow Assessment

**How creator work flows today (repository reality):**

1. A creator submits via the **public Artist Feature form** → `submissions` (D1).
2. **Editorial Office** reviews and drives status (draft → sent_for_review →
   under_review → changes_requested → approved → scheduled → published /
   not_accepted).
3. **Headquarters Executive Office** offers the founder a *narrow inline decision*
   subset on the same items (start review / approve / request changes / decline).
4. **Headquarters Production Suite** presents approved/scheduled/published items as
   finishing lanes (view only).
5. Separately, **Voice Notes Studio** runs an *offline, file-based* Owner↔Contributor
   collaboration (this is the only place a creator co-produces with the House), with
   **no connection to the submissions spine.**
6. **Interview Workbench** (dev-only) authors editorial documents (Founder's Note
   etc.) — a founder tool, not a creator flow.

**Duplicate workflows:** The submission status model appears in two review surfaces
(Editorial Office = full; Headquarters = narrow inline). This is **intentional and
non-duplicative** — both read the *same* `shared/workflow.js` and the *same*
`/api/submissions`; Headquarters "references systems of record, never replaces
them" (HEADQUARTERS.md). No conflicting second source of truth was found.

**Missing transitions (gaps, not bugs):**
- No transition from **accepted submission → creator collaboration** (Voice Notes
  Studio is disconnected from the spine).
- No transition from **accepted submission → published work object** on the public
  House (Press/Reader read `content/*` files, not `submissions`).
- No **creator-facing** state at all after the acknowledgment email.

**Ownership recommendation (only where necessary):** keep review ownership exactly
as-is — **Editorial Office owns the operational workflow; Headquarters references
it.** If a creator-facing status view is ever wanted, it should be a *new* surface
reading the spine read-only, not a move of existing behaviour.

---

## 9. Headquarters Integration Assessment

*Headquarters V1 is authoritative and is not modified. Only integration points are
audited.*

- **Room model:** all six wings (`executive, operations, creative, production,
  growth, business`) are `live` in `rooms.ts`; rooms are data; a reserved
  `PresenceSlot` exists for a future Presence Layer (intentionally empty in V1).
- **The one external seam:** `src/headquarters/adapters.ts` — the *only* I/O to the
  outside. Reads `/api/headquarters/briefing` and `/api/submissions`; performs
  audited status/note writes. Degrades to honest offline states. HQ **owns no
  source of truth.** This seam is clean and correct.
- **Wired institutional/executive layer (rendered via `main.ts`, all tested):**
  chief-of-staff (+ ops), executive-register, executive-workflow,
  institutional-memory, headquarters-os, executive-loop, execution-bridge,
  executive-work-queue, executive-attention, and the **Council Phase III content
  pipeline** growth-intelligence → content-opportunity → creative-assignment →
  creative-draft → production-readiness.
- **Logic-only layer (complete + tested, but NOT surfaced in the client UI):**
  `institutional-loop`, `execution-runtime`, `execution-ledger`,
  `executive-judgment`, `executive-context`, `executive-memory`. These are the
  governing systems the founder's brief names as complete — Institutional Executive
  Loop, Execution Runtime Boundary, Executive Memory & Context, Executive Judgment.
  They are **pure, tested logic awaiting a runtime host** (per their own doctrine
  the runtime is intentionally passive and not the browser). `founder-attention`
  is transitively wired via `executive-workflow`/`headquarters-os`/`institutional-memory`.
- **Integration points that are placeholders by design (honest, not broken):**
  - **Production Suite recording position** — reserved for an in-residence capture
    destination (candidate: Voice Notes Studio). *This is the single most concrete
    integration gap.*
  - **Speech / dictation** — `dictation.ts` `Transcriber` seam (manual, `isLive:false`).
  - **Google Calendar** — `loadEvents`/`saveEvents` localStorage seam.
  - **Notifications** — honest "nothing needs you" placeholder.
  - **Archive scale** — new submission types light up categories automatically via
    `CATEGORY_OF`.
- **Verdict:** Headquarters integration is architecturally sound and self-consistent.
  **Do not modify.** The only *new* integration worth planning is Production Suite →
  Voice Notes Studio (a founder decision, not a redesign).

---

## 10. Architectural Map (canonical)

```
                       Cloudflare Access + D1 + Pages Functions
                                       │
        ┌──────────────────────────────┼───────────────────────────────┐
        │                              │                               │
   PUBLIC HOUSE                 PRIVATE OPERATIONS                 HEADQUARTERS
   (Reception, Corridor,        (Editorial Office,                (the governing
    Publishing, Reader,          Production Studio,                institution — V1
    Press, Tribute,              Invitation)                       complete)
    Artist Features form)                                                │
        │                              │                               │
        │  submit (Artist Feature)     │  review + decide              │  references,
        └──────────────► D1 `submissions` ◄──────────────┐           │  never owns
                          ▲            │                 │           │
                          │            ▼                 │           ▼
                  functions/api/intake  Editorial Office  │   adapters.ts (only seam)
                  functions/_lib/*      (system of record)│   ├─ Daily Briefing (read)
                  shared/workflow.js ◄──────── shared ────┴─► ├─ One Inbox (read)
                                                              └─ Inline decisions (audited write)

   LUSCIOUS HONEY COLLECTIVE — internal departments (Headquarters wings):
     Executive Office ── the atrium; briefing + inline decisions
     Operations ─────── flow board (briefing)
     Creative Director  manuscript + Archive (published works)
     Production Suite    finishing lanes; RESERVED in-residence recording position ┄┄► Voice Notes Studio (not yet wired)
     Growth Studio ──── relationships + Growth Intelligence pipeline
     Business Office ── the Archive of record

   HEADQUARTERS internal engines:
     Executive Workflow · Chief of Staff · Council Phase III pipeline
       (intelligence → opportunity → assignment → draft → production-readiness)   [wired + tested]
     Execution loop: HOS → Executive Loop → Execution Bridge → Runtime Boundary
       → Institutional Loop → Institutional Memory                                [logic-only + tested]
     Cognitive layer: Founder Attention → Executive Memory → Context → Judgment   [logic-only + tested]

   PRODUCTION STUDIO (private hub)
     └─ Voice Notes Studio ── standalone; Owner/Contributor packages; WebM export
                              (no backend, no spine link)  ── STANDALONE, self-contained

   INVITATION ── token-hashed registry + lifecycle (D1) ── self-contained
```

---

## 11. Recommended Implementation Order

*Grounded strictly in repository evidence, dependencies, and ownership. No completed
system is rebuilt. Each item awaits Founder approval; this is a recommendation, not
a commitment.*

1. **Resolve the "Editorial Office" naming collision (docs only).** Rename the
   dev-only `src/office/` engine to *Interview Workbench* in code comments/headers
   so the two apps are unambiguous. Zero behavioural risk; removes the single
   biggest source of audit confusion. *(No dependency.)*

2. **Decide the Artist Submission type roadmap** (Book / Podcast / Photography /
   Visual Art / Events / Other). This is the highest-leverage *building* work
   because the framework already inherits storage, review, audit, HQ decisions, and
   Archive categorisation — each type is ~one registry entry + one public form.
   *Sequence types by the Founder's editorial priority.* *(Depends on: Artist
   Submission framework — already ✅.)*

3. **Wire the Headquarters Production Suite → Voice Notes Studio integration.** This
   is the only concrete, already-signposted integration gap
   (`production.ts::RECORDING_NOTE`). Decide: link out to the Studio, or embed a
   capture entry point. *(Depends on: Voice Notes Studio ✅ + HQ ✅; a Founder
   decision, not a redesign.)*

4. **Decide the accepted-submission → published-work hand-off.** Today Press/Reader
   read `content/*` files while decisions live in `submissions`. If the House wants
   an accepted Artist Feature to become a published work without manual re-entry,
   design a thin promotion step. *(Depends on: Artist Submission ✅ + Content model
   ✅.)*

5. **(Optional) Creator-facing status view.** Only if the Founder wants submitters
   to see progress. Build as a *new* read-only surface over the spine; do not move
   Editorial Office behaviour. *(Depends on: Artist Submission ✅.)*

6. **(Optional / deferred) Voice Notes Studio MP4 export** and the HQ future seams
   (speech, Google Calendar, notifications) — each is an isolated, already-designed
   drop-in. *(Independent.)*

> **Explicitly NOT recommended:** rebuilding Voice Notes Studio, the Invitation
> system, the Editorial Office review app, the submissions spine, or any part of
> Headquarters V1 (Operating System, Institutional Executive Loop, Founder
> Attention, Autonomous Execution Bridge, Execution Runtime Boundary, Institutional
> Memory, Executive Workflow). All are complete per repository evidence.

---

## 12. Success-Criteria Check

- ✅ No completed work recreated (audit only; no production code modified).
- ✅ No architecture duplicated (the two review surfaces share one source of truth).
- ✅ Every Collective component has an identified owner (§3).
- ✅ Voice Notes Studio fully accounted for (§6) — exists, complete, correctly housed.
- ✅ Artist Submission fully accounted for (§7) — one type live, framework ready.
- ✅ Roadmap based on repository evidence, not memory (§11).
- ✅ Verification run: `tsc` clean; **517/517 tests pass**.

**STOP — awaiting Founder approval before any implementation.**

---

## 13. Version 1 Activation — Collective Creative Intake

*Implemented after this baseline was approved. Documented here per the milestone's
documentation requirement. The pipeline, D1 schema, and Headquarters architecture
are unchanged — this activates existing framework seams; it does not add
architecture.*

### Supported submission types (the registry)

The intake registry (`functions/_lib/submission-types.js`) now serves **seven**
creative pathways. `artist_feature` keeps its own bespoke module and dedicated
form; the other six are generated by a `buildType()` factory from a single shared
field spec (`shared/submission-forms.js`), so the public form and the server
validator can never drift.

| Type id | Title | Form |
|---|---|---|
| `artist_feature` | Interview / Artist Feature | `/artist-features.html` (retained, unchanged) |
| `music` | Music | `/submit` (Music) |
| `book` | Book or Literary Work | `/submit` (Book) |
| `podcast` | Podcast or Audio Program | `/submit` (Podcast) |
| `visual_art` | Visual Art or Photography | `/submit` (Visual Art) |
| `event` | Event or Live Experience | `/submit` (Event) |
| `other_proposal` | Other Creative Proposal | `/submit` (Other) |

**Shared intake, collected once for the six new pathways:** who is submitting
(`self` / Collective representative / recommender — so the Founder can propose an
artist who is not submitting personally), submitter name, contact email, artist
name, relationship (shown only when not self), title, description, links, supporting
materials, timing, and **proposed Collective involvement** (Creator Relationships,
Editorial, Publishing, Production, Growth, Interview or live presentation — areas of
responsibility, not workflow engines; nothing is auto-accepted). Each pathway adds a
few type-specific fields only.

### Submission ownership & review path (unchanged)

`/submit` and `/artist-features.html` → `POST /api/intake/:type` (validate) →
D1 `submissions` (one record; no second store, no manual re-entry) →
**Editorial Office** review (institutional type titles + involvement now render
clearly) → **Headquarters** Daily Briefing + audited inline decisions. Verified
end-to-end against Wrangler Pages dev + local D1 (intake 201/422, list/detail/filter,
briefing, audited status change) and in-browser (both forms, Editorial Office,
Headquarters entrance).

### Voice Notes Studio entry point

Headquarters **Production Suite → Narration Desk** now renders a real entrance
(`VOICE_NOTES_STUDIO` descriptor in `production.ts`; `buildNarrationDesk` in
`main.ts`) that links to the existing `/production-studio/voice-notes/` surface with
the breadcrumb **The Luscious Honey Collective → Production → Voice Notes Studio**.
Headquarters links to the Studio; it does not embed or rebuild it. Both surfaces stay
behind the same Cloudflare Access gate (`functions/_middleware.js`, unchanged).

### Intentional Version 1 limitations

- No creator-facing status portal (submitters still receive only the emailed
  acknowledgment) — out of scope, as in the baseline.
- No automatic accepted-submission → published-work or → Voice Notes capture hand-off.
- Involvement areas are *proposals*; the Founder/House remain authoritative — nothing
  is auto-accepted and no executive activity is fabricated.
- `artist_feature` keeps its original narrower schema (retained, not migrated onto the
  shared spec).
- No scheduler, remote worker, or headless runtime introduced.

### Verification (this milestone)

`tsc` clean · **531/531 tests pass** (incl. new `tests/submission-types.test.mjs`) ·
production build OK (`submit` bundle emitted) · `check:prod` passes (13 pages) ·
browser verification green (25/25 app checks; the only failing network request is the
sandbox-blocked external Google Fonts stylesheet).

---

## 14. Version 1 Activation — Approved Creative Matter

*Implemented after §13, on the merged main. Completes the first real operational
lifecycle for the Artist Studio: an accepted submission becomes a coordinated
creative matter across the Collective's existing areas of responsibility. Pure
derivation — no new store, no new engine, no new workflow state, no fabricated
activity.*

### Approved-submission activation (the seam)

Before this milestone, the Founder's Desk dead-ended after acceptance
(`inlineActions('approved') → []` → "Nothing to decide here"). That seam
(`renderDetail` in `src/headquarters/main.ts`) now derives and presents an
**accepted creative matter** whenever a submission's status is `approved`,
`scheduled`, or `published`. The derivation lives in
`src/headquarters/creative-matter.ts` — a pure projection over the existing
submissions spine + canonical workflow status:

- keeps a **durable reference** (`submissionId`) to the origin, never a copy;
- carries only the institutional fields needed to coordinate (type, artist,
  requester + relationship, approved direction, assets/links, requested
  involvement, decision, status, responsible areas, key dates, disposition);
- is **idempotent** — one submission derives exactly one matter
  (`activateMatters` keys by id), so re-processing never activates twice;
- introduces **no new workflow state** — `active` vs `settled` is read from the
  existing `approved`/`scheduled` vs `published` statuses.

### Ownership boundaries (unchanged)

Artist Submission owns intake; Editorial owns review; the Founder owns the decision
(accept / revise / pause / decline); Executive Workflow owns advancing accepted
matters; Creator Relationships, Editorial, Production, Publishing, and Growth own
their existing responsibilities; Institutional Memory owns settled outcomes. This
module only **derives and presents** — it transfers and duplicates nothing.

### Responsibility derivation (by creative type + requested involvement)

`matterResponsibilities(type, involvement)` returns the responsible areas from a
per-type base, refined by the requested involvement — never a claim that work has
happened. Book/Visual Art pull in Production only when a recording/reading/spoken
element is requested; Event pulls in Editorial/Publishing only when coverage is
requested; **Other Creative Proposal never silently assigns every area** — it needs
the requested involvement or the Founder's direction.

### Voice Notes Studio handoff

`voiceNotesEligibility(...)` marks a matter audio-eligible for inherently-audio
types (Interview/Artist Feature, Music, Podcast) or when a spoken/recorded element
was requested. Production then presents a **direct handoff** to the existing
`/production-studio/voice-notes/` surface with the matter's context (artist,
purpose, notes) shown beside the entrance. **Non-audio matters are never routed to
the Studio.** The Studio is linked, not rebuilt or embedded.

**Limitation (documented, not worked around):** the existing Voice Notes Studio has
no parameter intake, so context is carried in the Headquarters panel beside the
entrance rather than injected into the Studio. No parallel state model was invented.

### Founder experience

After acceptance the Founder sees institutional stewardship, e.g. *"The Executive
Team has accepted your direction. Creator Relationships will hold the relationship
with the artist and their context, Editorial will prepare the feature, Production
will coordinate the interview recording in the Voice Notes Studio…"* — only areas
actually derived, and **no implementation language** (adapter/runtime/engine/
ledger/pipeline/localStorage/work order). A single next recommendation opens the
correct existing workspace (Voice Notes Studio, Editorial Office, or the Archive).

### Active Creative Matter view

Surfaced on the **existing** Executive Office → Founder's Desk (a new **In
Coordination** grouping over the existing statuses; no new dashboard). All status
derives from authoritative state; there are no decorative progress percentages.

### Attended automation limitations

The House derives responsibilities, prepares the recommendation, and opens the
correct workspace. It does **not** claim Production, Publishing, or Growth completed
work, and it introduces no scheduler or headless runtime. Execution remains
attended: the Founder opens the Studio / Office and carries the work forward.

### Complete Artist Feature / Interview lifecycle (verified)

Submission → Editorial Office review → Founder acceptance at the Desk → accepted
creative matter (Creator Relationships + Editorial + Production + Publishing +
Growth) → direct Voice Notes Studio handoff → next recommendation → completion
(`published`) settling into the House's record. Verified in-browser end-to-end
(desktop + mobile) plus the other registered types (Music routes to the Studio;
Visual Art and Book do not, as derived).

### Remaining genuine Artist Studio gaps

- No creator-facing status portal (submitters still receive only the emailed
  acknowledgment).
- No automatic accepted-matter → published-work object promotion (Press/Reader read
  `content/*`, not `submissions`).
- The Voice Notes Studio cannot yet ingest matter context as parameters.
- Executive Workflow's Initiative store is not fed by matters (the matter is a
  presentation-time derivation, by design for V1).

### Verification (this milestone)

`tsc` clean · **543/543 tests pass** (incl. new `tests/creative-matter.test.ts`, 12
tests) · production build OK · `check:prod` passes (13 pages) · browser vertical-slice
verification green (15/15, desktop + mobile; the only failing network request is the
sandbox-blocked external Google Fonts stylesheet).
