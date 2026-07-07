# Content Model & Truthfulness

From **Sprint 04 · Part VIII**. Code: [`src/lib/content.ts`](../src/lib/content.ts).

> The House must never fake activity. Credibility is the whole institution.

## Types (locked shape)

```ts
Work        { id, slug, title, creator, medium, year, date, dek?, body[], media?, relations[], status, featured? }
JournalEntry{ date, week, body, signed, status }
Fragment    { id, text, active, status }
// Modelled for later wings (not populated in this slice):
// Event, RecordingFlag, HeldShot, ClockState (derived)
```

`body[]` is a small typed block list: `p`, `h2`, `pull` (pull-quote), `qa`
(interview turn), `note` (margin note). This keeps editorial rich without a CMS.

`status: 'published' | 'scheduled' | 'draft' | 'fixture'` distinguishes real work
from temporary fixtures.

## Truthfulness rules (enforced here)

| System | Rule in this slice |
| --- | --- |
| House Journal | Real dated entries, signed `L.H.`. If none new, the last dated entry stays. Never auto-generated. |
| Now Recording | **Not shown.** Deferred until bound to a real session flag that fails to dark. |
| Writing Wall | One genuine, curated unfinished fragment; unattributed. |
| Salon / Lantern / Archive | Doors visible as architecture but **rest / not-yet-open** — no fake events, features or padded records. |
| Living Clock | Reflects the visitor's real local time; changes atmosphere only. |

**Default to rest.** A dark lamp, a resting Salon and a held Journal are correct
states — emptiness is never an error to paper over.

## The founder identity

The public identity is **"Luscious Honey"** / **"L.H."** — used everywhere. The
founder's legal name appears **nowhere** in content, copy, comments, metadata or
seed data. This is a hard rule (Part IX · 17).

## Fixtures in this slice

All editorial content is marked `status: 'fixture'` and surfaced with a visible
development flag (`.fixture-flag`) that renders **only** when
`<html data-env="development">`. In a production build the flag is hidden and the
fixtures must be replaced with real, CMS-backed content before launch:

- 2 House Journal entries (fixture)
- 2 Writing Wall fragments (fixture)
- 1 editorial interview, *"Opening the House"* (fixture) — the Reader item

## Replacing fixtures with a real source

`content.ts` exposes the data behind small functions (`latestJournal`,
`activeFragment`, `getWork`). Swap those for `fetch()` calls to the future CMS /
Cloudflare data source without touching any presentation code.
