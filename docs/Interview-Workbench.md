# The Interview Workbench (Sprint 1A)

A private, founder-only workspace where every permanent House document begins.
It is **not** a CMS, a blog editor, or a document manager — it is a calm,
literary interview experience that helps the Founder discover what the House
believes before anything is written.

## Access & privacy (important)

- **Local, dev-only for Sprint 1A.** The Office is **excluded from the production
  build** — it is not in `vite.config.js` inputs, so `npm run build` never emits
  it and it is never deployed to a public URL.
- Open it locally: `npm run dev`, then visit **`/interview-workbench.html`**.
- All data (interview answers, drafts, reflections) lives in **your browser's
  localStorage** on your machine. Nothing is synced or sent anywhere.
- The page carries `<meta name="robots" content="noindex, nofollow">` and is
  disallowed in `robots.txt` as defence-in-depth.
- **Before this is ever hosted**, it must be gated by **Cloudflare Access**
  (the pattern the Pull Me Under `/office` uses) and added to the build inputs.
  Until then it is genuinely private because it is never deployed.

## What Sprint 1A built

- **Office home** — the seven document types (Founder's Note, Editorial Charter,
  House Journal, Lantern Room Essay, Interview, Artist Feature, New Editorial),
  each showing progress. New types are added by dropping an object into
  `src/office/schema.ts` — nothing else changes.
- **Interview** — one thoughtful question at a time across **named stages**
  (The Foundation · The Philosophy · The Voice · The House · The Future), never
  "Question 4 of 28". Inputs: multiple choice, multi-select, open response, and
  "Other…" expanding into a writing area.
- **Autosave & resume** — every answer saves immediately; leaving and returning
  resumes at the first unanswered question.
- **Generate First Draft** — assembles the Founder's own answers into a
  structured **editorial packet** (viewable, with working notes; exportable as
  Markdown/JSON). It writes **no prose** and invents nothing. See "AI" below.
- **Editorial memory** — every answer and every generated **version** is kept.
  Drafts are **archived, never overwritten**; deleting only hides a version;
  a version is truly discarded only by an explicit **Purge**.
- **Ask Me Something Different** — one editor-written follow-up question at a
  time from a curated bank, without repeats; answers saved to memory.

## The AI seam (deliberately deferred)

Sprint 1A implements the **workflow only** — no AI. Both generative features sit
behind interfaces so a real service (Claude / OpenAI via a backend proxy) can be
dropped in later **without changing the UI or the Founder's workflow**:

- `DraftEngine` (`src/office/engine.ts`) — `activeDraftEngine` is the on-device
  `localPacketEngine` today. A future `ClaudeEngine implements DraftEngine`
  returns a `DraftPacket` whose sections/notes carry AI drafts; assign it to
  `activeDraftEngine` and nothing else changes.
- `FollowupSource` — `activeFollowupSource` is the curated bank today; an AI
  source implements the same `next()` contract later.

## Architecture

```
interview-workbench.html          Private entry (dev-only; not a build input)
src/office/
  types.ts       Reusable types (a document type is just data)
  schema.ts      The 7 document schemas (stages of questions)
  core.ts        Pure logic: progress, resume, packet assembly, versioning
  engine.ts      Swappable DraftEngine + FollowupSource (AI-ready seams)
  store.ts       Editorial memory (localStorage)
  views.ts       Home / Interview / Draft / Memory / Reflect
  main.ts        Hash router
src/styles/office.css
tests/office.test.ts           Pure core + engine tests
```

## Known limitations

- Data is per-browser and not synced (fine for a private, single-machine tool).
- No AI generation yet (by design); "Generate First Draft" exports a packet.
- Access control is deployment-time (Cloudflare Access) and not yet wired,
  because the Office is not deployed.
