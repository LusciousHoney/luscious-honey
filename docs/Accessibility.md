# Accessibility

Target: **WCAG 2.2 AA** (Sprint 04 asks AAA on body text; reading plates meet it).

## Implemented in this slice

- **Semantic directory under the metaphor.** The corridor is a real
  `<nav><ul>` of labelled links; the spatial view is an enhancement over it.
- **Landmarks & headings.** `banner` / `main` / `contentinfo`, one `<h1>` per
  destination, ordered `h2`/`h3`.
- **Skip link** to the directory / main content on every page.
- **Keyboard.** All open doors and links are reachable and operable; not-yet-open
  doors are non-interactive `<span aria-disabled="true">` (not fake links, not
  focus traps).
- **Visible focus.** Brass focus ring (`--focus-ring`), always shown, never removed.
- **State by text, not colour.** Door states read "STUDIO DARK", "RESTING",
  "NOT YET OPEN"; the future Now-Recording lamp exposes text + `aria-live`.
- **Contrast.** Body text is ink `#211D1A` on alabaster `#F3EEE6` (~14:1) — AAA.
  Quiet text on dark uses plaster/brass at AA+.
- **Touch targets.** Directory rows and buttons are ≥44px.
- **Reduced motion.** `prefers-reduced-motion` → Indexed Spine, instant arrival,
  no dolly/parallax, opacity-only transitions. A first-class path.
- **Media.** Every media slot reserves its aspect ratio (no layout shift) and
  carries alt-text architecture; real media will ship captions/transcripts.
- **No essential info by motion, colour or sound alone.**

## Manual QA performed

- Keyboard-only walk: Reception → Publishing → Reader and back, via Tab/Enter.
- Desktop (spatial corridor, scroll dolly) and mobile (Indexed Spine) verified in
  preview. No console errors on any route.

## Still to test before launch

- Full screen-reader pass (VoiceOver / NVDA) on real content.
- Automated axe / Lighthouse a11y run in CI.
- Captions/transcripts once real media is delivered.
