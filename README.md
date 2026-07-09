# Luscious Honey Collective — Headquarters

The digital Headquarters of the Luscious Honey Collective: *a house for storytellers.*
This repository is the **Production Sprint 01 vertical slice** — the first working
end-to-end walk through the House:

> **Arrival → Front Desk → Long Corridor → Publishing Wing → one editorial Reader**

It is a **new, standalone production**, built to become the eventual root experience
of **LusciousHoney.org**. It shares design-system DNA with the *Pull Me Under*
residence site but is architecturally independent and does not depend on it.
(The *Pull Me Under* residence will later become one destination within the
Productions wing — integration is deferred until both are production-ready.)

The canonical source of truth is **Sprint 04 — Production Definition ("Lock the
House")**. Nothing visual here is invented; every token, motion value, frame and
rule traces to that pack.

---

## Quick start (for Melody)

```bash
npm install      # first time only
npm run dev      # open http://localhost:5173  (Vite prints the exact URL)
```

That's it. The site opens at **Reception**. Scroll to walk the corridor; click
**Publishing** to enter the editorial wing; open the article to read it.

> Nothing is published or deployed by running this. It only runs on your computer.

### Other commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Live preview while you work (auto-reloads on save). |
| `npm run build` | Produces the optimized `dist/` for deployment. |
| `npm run preview` | Serves the built `dist/` locally to check the real build. |
| `npm test` | Runs the logic tests (Living Clock + visitor state). |

---

## What's in this slice

| Route | File | The room |
| --- | --- | --- |
| `/` | `index.html` | **Reception** — the Spine Reveal arrival, the Front Desk / House Journal, and the Long Corridor. |
| `/publishing.html` | `publishing.html` | **Publishing Wing** — the works shelf, the editor's desk, the Writing Wall. |
| `/reader.html?work=…` | `reader.html` | **The Reader** — one work on a solid reading plate. |
| `/press.html` | `press.html` | **Press** — the House Journal archive (published entries only). |

Door `02` (Productions) shows a truthful **Now-Recording signal** — the Brass Studio
Lamp, dark unless a real session is live. Door `03` (Press) opens the **Journal
archive**. Doors `04–06` (Salon, Lantern, Archive) appear on the spine as
**architecture** but are honestly *not yet furnished* — not fake rooms, not empty
routes. Future wings are built only when real content exists for them.

### Private tools (not public)

- **Editorial Office** — a founder-only workspace at `/editorial-office.html`,
  available in `npm run dev` only. It is **excluded from the production build** and
  never deployed. See [`docs/Editorial-Office.md`](docs/Editorial-Office.md).

---

## Documentation

- [`docs/Architecture.md`](docs/Architecture.md) — stack, structure, how the pieces fit.
- [`docs/Design-Tokens.md`](docs/Design-Tokens.md) — the locked token set (Part VII).
- [`docs/Content-Model.md`](docs/Content-Model.md) — the data model + truthfulness rules (Part VIII).
- [`docs/Living-Clock.md`](docs/Living-Clock.md) — time-state architecture (Part V).
- [`docs/Accessibility.md`](docs/Accessibility.md) — WCAG 2.2 AA targets + reduced motion.
- [`docs/Asset-Manifest.md`](docs/Asset-Manifest.md) — media slots awaiting final imagery.

---

## Deployment assumptions

Intended for **Cloudflare Pages** (static output from `npm run build` → `dist/`),
matching the Collective's existing deployment strategy. No deployment configuration
is committed yet and **no deploy happens automatically** — see
[`docs/Architecture.md`](docs/Architecture.md) for what will be required.

## Content

Real editorial content lives as structured files in [`content/`](content) and is
governed by manual publish states — see [`docs/Content-Model.md`](docs/Content-Model.md)
for the plain-language publishing workflow (how to post a Journal entry, change the
Writing Wall, or swap the Held Frame).

## Known limitations (this slice)

- The operational **systems are real** (Journal, Writing Wall, Held Frame,
  editorial works, governance); the **content is still a clearly-labelled temporary
  fixture** until real pieces are supplied.
- Final photography/film for the 11 media slots is not yet delivered; slots use
  documented placeholder treatments that preserve composition and aspect ratio.
- Deferred by design: Now-Recording live flag, Salon live mode, the Archive graph,
  and returning-visitor recognition beyond the local first/return flag.
