# Content Model, Governance & Truthfulness

From **Sprint 04 · Part VIII**. Content now lives as **structured files** in
[`content/`](../content); the code that loads and governs it is
[`src/lib/content.ts`](../src/lib/content.ts) (loader) and
[`src/lib/governance.ts`](../src/lib/governance.ts) (the truthful rules, pure &
unit-tested).

> The House must never fake activity. Credibility is the whole institution.

## Two axes: publish state vs fixture

Every governed item carries both:

- **`status`** — `'published' | 'scheduled' | 'draft'`. The publish state a human
  controls. **Only `status: 'published'` is ever shown.** Nothing auto-promotes.
- **`fixture`** — `true` marks temporary content; drives the development-only flag
  (`.fixture-flag`, visible only when `<html data-env="development">`).

These are independent: a fixture can be "published" (it shows, clearly flagged in
dev) and real content can be "draft" (it does not show).

## Types

```ts
Governed    { status, fixture? }
Work        { id, slug, title, creator, medium, year, date, dek?, body[], media?, relations[], featured? } & Governed
JournalEntry{ date, week, body, signed } & Governed
Fragment    { id, text, active?, showFrom?, showUntil? } & Governed
HeldFrame   { id, week, date?, media } & Governed
// Modelled for later wings (not populated yet): Event, RecordingFlag, ClockState.
```

`body[]` is a small typed block list: `p`, `h2`, `pull`, `qa` (interview turn),
`note` (margin note) — rich editorial without a CMS.

## The structured content store

```
content/
  journal/*.json          one file per entry (archive grows by adding files)
  works/*.json            one file per article/interview
  writing-wall/*.json      curated fragments (array)
  held-frame/*.json       the curated Single Held Frame(s)
```

Loaded at **build time** via `import.meta.glob` (inlined, no runtime fetch). To
replace this with a CMS / Cloudflare data source later, swap the four loaders in
`content.ts` — the governance rules and the whole presentation layer stay put.

## Operational governance (the truthful rules)

| System | Source & control | Rule (enforced in `governance.ts`) |
| --- | --- | --- |
| **House Journal** | `content/journal/*.json` · Founder/Editor | **Manual publishing only.** Shows the latest `published` entry; if none new, the last published stays. Drafts never show. Never auto-generated. |
| **Writing Wall** | `content/writing-wall/*.json` · Editor | **Manual curation.** Exactly **one** fragment: a manually `active` one wins; else a `scheduled` one whose `showFrom`/`showUntil` window contains today; else **the wall rests**. Unattributed; always marked "in progress" so WIP is never implied as published. |
| **Held Frame** | `content/held-frame/*.json` · Art Director/Editor | **Manual selection.** The single latest `published` frame; else **it rests**. Real shots only; poster-first; muted; never a montage. |
| **Editorial works** | `content/works/*.json` · Editor | Only `published` works appear on the shelf and are linkable. Featured first. |
| **Now Recording / Salon** | — | **Not shown.** Deferred until bound to a real flag / calendar that fails to rest. |
| **Living Clock** | Real local clock | Reflects the visitor's real time; changes atmosphere only — now also carried onto the Front Desk / Journal. |

**Default to rest.** A held Journal, a bare wall and an unheld frame are correct
states — emptiness is never an error to paper over.

## Publishing workflow (for Melody)

1. **New Journal entry:** copy an existing file in `content/journal/`, rename it to
   the date, edit the text, set `"status": "published"`, and remove `"fixture": true`
   once it is real. Save. That is the whole publish step.
2. **Change the Writing Wall:** in `content/writing-wall/fragments.json`, set
   `"active": true` on the one fragment to show (and `false` on the others), or give
   it a `showFrom`/`showUntil` window to schedule it.
3. **Change the Held Frame:** add/replace a file in `content/held-frame/` for the
   new week and set it `published`; drop the final image at the `media.poster` path.
4. **New article/interview:** add a file in `content/works/` with `status`
   `draft` until ready, then `published`.

Nothing publishes itself; every change above is a deliberate human edit.

## The founder identity

The public identity is **"Luscious Honey"** / **"L.H."** — everywhere. The founder's
legal name appears **nowhere** in content, copy, comments, metadata or seed data
(Part IX · 17).

## Remaining fixtures (see the Sprint report)

The operational **systems are real**; the **content is still fixture** and marked as
such until Melody supplies the real pieces — 2 Journal entries, the curated Writing
Wall fragments, 1 interview, and the Held Frame image.
