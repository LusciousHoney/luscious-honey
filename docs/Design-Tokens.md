# Design Tokens

Locked from **Sprint 04 · Part VII**. Inherited from Vol. 01 and **not reopened**.
Source of truth in code: [`src/styles/tokens.css`](../src/styles/tokens.css).
Never hardcode these values in a component — reference the token.

## Colour (Honey is metal, never yellow)

| Token | Hex | Use |
| --- | --- | --- |
| `--alabaster` | `#F3EEE6` | Reading plates |
| `--linen` | `#E9E2D6` | Secondary plate |
| `--plaster` | `#C9BFB0` | Quiet text on dark |
| `--ink` | `#211D1A` | Body text on plates |
| `--ink-900` | `#17120E` | The dark of the house |
| `--umber` | `#4A3428` | Formal wood / captions on plate |
| `--oxblood` | `#7A3B34` | Editorial accent |
| `--terracotta` | `#B5623F` | Warm accent |
| `--brass` / `--brass-hi` | `#B08A4F` / `#D3B072` | Reveals, signage, focus |
| `--signal` | `#B5623F` | **Now Recording only** — a genuine live flag |

## Type

| Token | Family | Weights |
| --- | --- | --- |
| `--serif` | Newsreader | 200 / 300, italic — display + editorial |
| `--sans` | Archivo | 400 / 500 / 600 — labels, signage, UI |
| `--mono` | IBM Plex Mono | 400 / 500 — timestamps, meta (tracking 0.12–0.2em) |

Fluid scale via `clamp()`: `--fs-display`, `--fs-h1…h3`, `--fs-body`, `--fs-label`,
`--fs-meta`. Editorial reading width `--w-text: 720px`.

Fonts load from Google Fonts with `preconnect` + `display=swap`, only the needed
weights. Fallback stacks: Georgia (serif), system-ui (sans), ui-monospace (mono).

## Spacing / grid

- 8px base rhythm — `--s-1…--s-8` = 8/16/24/32/48/64/96/128.
- Grid: 12-col editorial, 24px gutter (`--gutter`).
- Containers: `--w-text` 720, `--w-max` 1160.
- Breakpoints: **640 / 1024 / 1440**. Section padding 128 desktop / 72 mobile.

## Surfaces, borders, shadow, z

- Radius **0** — sharp corners only.
- Borders: 1px hairline at `rgba(ink, .1–.16)` (`--hairline`).
- Shadow is **light-as-glow**, not a drop-box (`--glow-brass`, `--glow-lamp`,
  `--glow-plate`).
- Z-index philosophy: base 0 / media 10 / nav 110 / progress 120 / modal 200.
- **Focus ring** is brass and always visible (`--focus-ring`); never removed.

## Motion

| Token | Value | Use |
| --- | --- | --- |
| `--motion-instant` | 120ms | micro feedback |
| `--motion-quick` | 260ms | hover, focus |
| `--motion-settle` | 600ms | reveal, rise |
| `--motion-room` | 800ms | dissolve |
| `--motion-arrival` | 4500ms | first light-up (hard 5s ceiling) |

Easing: `--ease-settle`, `--ease-door`, `--ease-dissolve`, `--ease-camera`.
**Forbidden:** linear loops, spring/bounce, snap, spinners, carousels.

## Living Clock atmosphere hooks

`--clock-warmth` (0–1) and `--lamp` / `--pool` shift light temperature only —
never geometry or content. Set by `living-clock.ts`; read by the presentation layer.
