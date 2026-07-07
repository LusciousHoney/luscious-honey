# The Living Clock

From **Sprint 04 · Part V + VIII**. Code:
[`src/lib/living-clock.ts`](../src/lib/living-clock.ts).

The Clock reflects the visitor's **real** local time of day. It changes atmosphere
only — light temperature, warmth, the greeting line — and **never** geometry or
content truth. Seven atmospheres are envisioned; this slice implements the four
required states.

## States

| State | Hours (local) | Greeting (Newsreader italic) | Warmth |
| --- | --- | --- | --- |
| `morning` | 05:00–11:59 | "Good morning. The house is waking." | 0.55 |
| `afternoon` | 12:00–16:59 | "Good afternoon. The work is underway." | 0.35 |
| `evening` | 17:00–22:59 | "Good evening. The studio is still lit." | 0.85 |
| `late` | 23:00–04:59 | "It's late. A lamp is still on." | 1.00 |

Greetings are micro-copy within the established voice (Part IX permits this);
they are not from the frame lock lists.

## How it is wired (three seams)

1. **Logic (pure, testable):** `stateForHour(hour)` and `clockStateFor(date)`
   return a `ClockState { tod, warmth, greeting, label }`. No DOM. Covered by
   `tests/logic.test.ts`.
2. **Application:** `applyClock(state)` sets `<html data-tod="…">` and the
   `--clock-warmth` CSS variable. This is the only DOM seam.
3. **Presentation:** CSS reads `--clock-warmth` to scale the lamp/door-pool glow
   and can key off `[data-tod]`. Swapping visuals never touches the logic.

## Where it appears

- **Reception** — the time-aware greeting and the desk label.
- **Front Desk / House Journal** — the desk carries a Living-Clock line
  ("The desk · Sunday · evening") and the Journal lamp warmth scales with
  `--clock-warmth`.
- **The Held Frame** — its glow breathes with the hour (`--clock-warmth`).

The architecture is unchanged: every surface reads the same `applyClock()` output;
no new time logic was added.

## Reduced motion

Transitions between states are gradual crossfades over minutes. Under
`prefers-reduced-motion`, the state is simply **set on load** with no animated
shift (Part V).

## Extending to seven atmospheres / seasons

Add states to `stateForHour` (or a season function) and map new `warmth` / greeting
values. Because presentation only reads `--clock-warmth` and `[data-tod]`, new
states need no component changes — only tokens and copy.
