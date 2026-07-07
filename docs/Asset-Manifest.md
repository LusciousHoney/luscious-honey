# Asset Manifest

Final production imagery/film is still being created. This build uses **documented
placeholder treatments** (`.media-slot` — a hairline-framed hatch with the slot id
and aspect) that preserve composition, aspect ratio, responsive and loading
behaviour. **No random or stock imagery is used.** Final assets can drop into these
slots without structural redesign.

Rules for every slot: reserve dimensions (no layout shift) · poster/fallback first
· video only on intent (never autoplay) · lazy-load below the fold · mobile ships
stills. Assets must match their Sprint 04 frame lock list (field 25).

## Slots used in this slice

| Asset ID | Purpose | Route / Component | Aspect | Desktop | Tablet | Mobile | Format | Target size | Poster / fallback | Alt-text | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `frame-02-spine-reveal` | Arrival hero — the Dark Spine | `/` · `.arrival__spine-glow` | 16:9 | Full-bleed corridor + light-up | Portrait spine head | Lit Desk card (no corridor) | CSS now → AVIF/WebP + poster | ≤ 320 KB | CSS gradient stand-in | "Standing at the reception desk, looking down a warm dark corridor to a glowing room." | **Placeholder (CSS)** |
| `frame-04-editors-desk` | House Journal backdrop | `/`, `/publishing` · `.journal` | 3:2 | Over-shoulder desk | same | Top accent glow | AVIF/WebP | ≤ 180 KB | CSS lamp glow | "Over-the-shoulder view of a walnut desk under a single brass lamp, an open dated page beneath the light." | **Placeholder (CSS)** |
| `frame-03-corridor-loop` | Corridor ambient depth | `/` · spatial spine | 21:9 | Ambient loop, muted | Reduced parallax | Not shown (Indexed Spine) | MP4/WebM + poster | ≤ 1.2 MB loop | Poster still | Decorative; corridor described in text | **Placeholder (CSS)** |
| `m-desk` (reader lead) | Reader lead image | `/reader` · `.media-frame` | 3:2 | Inline lead | same | Full-width | AVIF/WebP | ≤ 200 KB | `.media-slot` | Per work `media.alt` | **Placeholder (slot)** |
| `frame-06-writing-wall` | Writing Wall plaster ground | `/publishing` · `.writing-wall` | 16:9 | Plaster texture behind fragment | same | Panel | AVIF/WebP or CSS | ≤ 160 KB | CSS plaster wash | Decorative; fragment is live text | **Placeholder (CSS)** |

## Forward slots (not in this slice — do not build ahead of content)

`frame-01-exterior`, `frame-05-now-recording` (active/inactive pair, bound to a
real flag), `frame-07/08-salon` (day/event), `frame-09-lantern`,
`frame-10/11-archive` (launch / twenty-year), `frame-12-exterior-lantern`.

Each will follow the same slot contract above and its 27-point Sprint 04 spec.

## How to replace a placeholder

1. Export the asset to its target format(s) at the aspect above.
2. Drop it in `public/media/` and point the component's `poster`/`src` at it.
3. The `.media-slot` element is replaced by a real `<img>`/`<video>`; layout does
   not move because the aspect ratio is already reserved.
