# Private Headquarters — Information Architecture (planning only)

Planning document. **No public pages. No code changes.** Extends the existing
Editorial Office; does not redesign or replace any working tool.

## Principle

Headquarters is the founder's private building. Each capability is a **room**.
Rooms are **data**, not bespoke pages — the same pattern the interview already
uses (a document type is a schema object). A room registry lets new rooms be
added by appending one entry, never by re-architecting.

## Current rooms (built — do not redesign)

| Room | Status | Entry today |
| --- | --- | --- |
| Founder Interview | live | `#/write/:doc` (Editorial Office) |
| Editorial Packet Generator | live | `#/draft/:doc` |
| Editorial Memory | live | `#/memory` |
| Audio Studio | live (relocated) | `npm run studio` → `localhost:8080` (own server) |

## Reserved rooms (future — stubs only, build when real)

Publishing · Interviews · Creative Calendar · Artist Applications · Content
Pipeline · Brand Assets · Research Library · Editorial Planning · Production
Tracking.

Each is reserved as a **registry entry** that renders a "not yet furnished" room
(the same honest pattern the public corridor uses for unbuilt wings). No empty
routes, no fake tools.

## Proposed room registry (extends, does not replace)

A single list the Office home + router read from — additive to today's code:

```ts
// src/office/rooms.ts  (future)
interface Room {
  id: string;
  name: string;
  blurb: string;
  status: 'live' | 'reserved';
  kind: 'internal' | 'external';   // internal = hash route; external = own server
  route?: string;                  // internal: '#/write/founders-note'
  launch?: { script: string; url: string }; // external: { 'npm run studio', 'localhost:8080' }
  access: 'founder';               // permissions tier (see below)
}
```

- **Internal rooms** (Interview, Packet, Memory, and future Publishing/Calendar
  /etc.) mount into the existing `#office-app` hash router — no new HTML entry,
  no new build input.
- **External rooms** (Audio Studio) keep their own self-contained server and are
  surfaced as a launch card. The registry records the script + URL; the Office
  home renders it. This is exactly how the Studio card works today, generalized.

The Office home becomes a **Founder Dashboard** rendered from the registry:
`live` rooms are enterable; `reserved` rooms show a quiet "in preparation" state.

## Navigation model

- One dashboard, grouped by section (Writing · Production · Planning · Library).
- Hash routing for internal rooms (already in `main.ts`); deep-linkable.
- The Studio (external) and any future external tool link out by launch card.
- Future public-facing "wings" stay in the **public** Headquarters site and are
  never mixed into this private dashboard.

## Permissions architecture

- **Tier: founder-only.** Every room is private. Enforcement today is deployment
  exclusion + local-only data (see Privacy). When Headquarters is ever hosted,
  the gate is **Cloudflare Access** (the pattern PMU's `/office` uses) in front
  of the whole private surface — one policy, all rooms.
- Room-level `access` field is reserved so a future **Contributor** tier (e.g.
  an artist invited into a single Studio session) can be granted per-room without
  touching other rooms. The Audio Studio already models Owner/Contributor
  internally; the registry mirrors that at the building level.

## Privacy / build exclusion (invariant for every room)

- Internal rooms: `interview-workbench.html` is **not** a Vite input → never in
  `dist`. Future internal rooms mount into the same page, inheriting exclusion.
- External rooms: served by their own `serve.mjs`, not under `public/`, not a
  Vite input → never in `dist`.
- Rule for any new room: **private tools are never a build input and never under
  `public/`.** `npm run check:prod` continues to guard the public surface.

## What this sprint does NOT do

No rooms are built. No routes added. No existing tool changed. This is the map;
construction happens in later, scoped sprints, one room at a time.
