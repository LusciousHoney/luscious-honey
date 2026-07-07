# Architecture

## Stack

- **Vite 5** — build + dev server (multi-page).
- **Vanilla TypeScript** — no UI framework. The JS budget is deliberately tiny
  (~1 KB gzip per page) so the spatial view never blocks first paint of the
  semantic directory (Sprint 04 · Part IX performance budget).
- **CSS custom properties** — all design decisions live as tokens
  (`src/styles/tokens.css`); components never hardcode values.
- Target host: **Cloudflare Pages** (static `dist/`).

This mirrors the *Pull Me Under* stack (Vite + vanilla TS + Cloudflare) so the two
productions can share primitives later, without coupling now.

## Why no framework

The House is content-first and mostly static. Frames are photographic; interaction
is scroll, hover, focus and links. A framework would add JS weight that fights the
performance budget and the "interface is the frame; the work is the picture" idea.
If a future wing needs richer state (the Archive relation-graph, the Salon live
stream), it can be introduced there in isolation.

## File structure

```
index.html            Reception (arrival + Front Desk + Long Corridor)
publishing.html       Publishing Wing
reader.html           The Reader (one work)
vite.config.js        Multi-page inputs (add wings here, never ahead of content)

src/
  main.ts             Reception entry
  publishing.ts       Publishing entry
  reader.ts           Reader entry
  lib/
    living-clock.ts   Time-state logic (pure) + document application
    visitor-state.ts  First vs returning (local flag; NOT auth/identity)
    arrival.ts        The Spine Reveal choreography (CSS-driven)
    corridor.ts       Spatial dolly vs Indexed Spine
    motion.ts         Reduced-motion + low-power helpers
    content.ts        Content model + fixture data + date helper
    wings.ts          The doors along the spine
  styles/
    tokens.css        LOCKED design tokens (Part VII)
    base.css          Reset, type, links, focus, buttons, plates
    components.css     Journal, WorkCard, Writing Wall, Reader, media, states
    reception.css      Arrival scene, Front Desk, corridor spine
    publishing.css     Wing + Reader layout
    responsive.css     Structural desktop/tablet/mobile switch

tests/
  logic.test.ts       Living Clock + visitor-state unit tests (node:test)

docs/                 This documentation
```

## Separation of concerns (the three axes)

Sprint 04 requires time state, content, and visual presentation to stay separable
and testable. They are:

1. **Time-state logic** — `living-clock.ts` returns plain data (`ClockState`);
   it never touches the DOM except through the explicit `applyClock()` seam.
2. **Content** — `content.ts` holds typed data only; no presentation.
3. **Presentation** — CSS reads `data-*` attributes and CSS variables set by the
   logic layer. Swapping copy, data, or imagery never requires touching motion or
   layout code.

## Visitor state & motion

- **First arrival** runs the 4.5 s Spine Reveal (hard 5 s ceiling); **returning**
  skips the light-up and settles at the desk (`arrival.ts` + `reception.css`).
- **Reduced motion** and **low-power / small screens** drop to the **Indexed
  Spine** (`corridor.ts`), a flat keyboard-walkable directory — a first-class path,
  not a fallback.
- All choreography is expressed via `data-*` attributes so reduced motion resolves
  by media query with no JS branching in the hot path.

## Deployment (what's still required)

- A Cloudflare Pages project pointing at this repo, build command `npm run build`,
  output dir `dist/`.
- Optional `_redirects` / clean-URL config if we want `/publishing` instead of
  `/publishing.html` (a Pages concern; the app is URL-shape agnostic).
- `robots.txt` is included. No secrets, DNS, or domain changes are made here.
- **No deploy is automated.** Production release is a human step, on approval.
