# Executive Team Headquarters

The founder's private, Cloudflare Access–protected residence at `/headquarters`. One
single-page app (hash router) styled as a calm, editorial residence — "9 a.m. on the
first day of summer." It owns **presentation and session memory only**; it reads the
existing submissions spine and holds no source of truth. This document is the map for
maintainers and future integrations.

## Source layout

| File | Responsibility |
|---|---|
| `src/headquarters/main.ts` | Entry, arrival ceremony, hash router, all room renderers, shared services (Toolbar, Search, Dictation, Calendar, Notifications, Quick Actions), the modal. |
| `src/headquarters/rooms.ts` | The room **registry** (data): six wings, ids, routes, status. Add/alter rooms here. |
| `src/headquarters/adapters.ts` | The **only** seam to the outside: thin wrappers over `/api/headquarters/briefing` and `/api/submissions`. Degrades to honest offline states. |
| `src/headquarters/{operations,creative,production,growth,business}.ts` | Pure, per-room derivations/content (no DOM, no I/O). |
| `src/headquarters/{archive,calendar,dictation}.ts` | Pure logic for the three shared systems. |
| `src/headquarters/{time,memory}.ts` | Time-of-day + once-a-day arrival; client session memory (localStorage). |
| `src/styles/headquarters.css` | All `.hq-*` presentation. |
| `tests/*.test.ts` | Pure unit tests (`node --test`); run via `npm test`. |

## Room architecture

All six wings are `live`. Each is a hash route rendered by a `render<Room>()` in
`main.ts` into `#hq-app`, over the shared (frozen) residence atmosphere. Rooms share the
editorial material language: plaster/limestone plates, a brushed-brass hairline, serif
type, generous negative space, `.hq-state` honest empty/offline states.

| Route | Room | Reads |
|---|---|---|
| `#/executive` | Executive Office (atrium) + Founder's Desk (`#/executive/desk`) | briefing + submissions |
| `#/operations` | Operations Office — flow board | briefing |
| `#/creative` | Creative Director — manuscript + **Archive** | briefing + published |
| `#/production` | Production Suite — studio sprint | published/approved/scheduled |
| `#/growth` | Growth Studio — correspondence | none (editorial) |
| `#/business` | Business Office — the Archive of record | none (editorial) |

**Rooms are data** (`rooms.ts`): a new wing is a registry entry + a `render` dispatch;
the router and atrium never hard-code a room.

## Shared services (House-wide, not rooms)

Mounted once in `boot()` via `mountHouseToolbar()`; available in every room.

### The House Toolbar (`.hq-bar`)
A residence-wide bar of services (not app navigation): **Search · Dictate · Calendar ·
Notifications · Actions**. iPad-first labels, icon-only on phone, keyboard-reachable,
reduced-motion honoured, centred at the foot so it never obstructs content. Each opens a
calm modal sheet (`openHqModal`) with focus containment + focus restore.

### The Archive (`archive.ts`, rendered in Creative Director)
A premium knowledge library (replaced the old Collection bookshelf): a large search
field, keyword search over name/summary, honest facet filters, breadcrumbs, and native
multi-open `<details>` accordions. `archiveTree(published, query, filter)` groups works
by a **future-ready taxonomy** (`ARCHIVE_TAXONOMY`: Books, Interviews, Characters,
Narration, Production, Marketing, Assets, Research, Universe, Residents, Templates) via
`CATEGORY_OF` (type → category); **only populated categories render** — empty ones are
omitted, never fabricated.

### The Calendar (`calendar.ts`)
A shared scheduling service. `CALENDAR_CATEGORIES` (Founder, Editorial, Production,
Publishing, Growth, Business, LIVE Events, Focus Time) each map to a room, so
`eventsForRoom` / `categoriesForRoom` give each office a filtered view; home is the
Executive Office (all categories). `makeEvent` validates; `loadEvents`/`saveEvents`
persist to `localStorage` (`lhc.hq.calendar.v1`). Events are the founder's own — never
fabricated.

### Dictation (`dictation.ts`)
Tap mic → transcript → choose destination (`DICTATION_DESTINATIONS`, incl. Calendar) →
save (`makeDraft`). The mic is honest (there is no speech API — the founder types the
transcript). Drafts persist to `localStorage` (`lhc.hq.dictation.v1`); a Calendar
destination hands the transcript to the scheduling panel.

### Notifications
An **honest placeholder** — "Nothing needs you right now." No counts, no red badge, no
fabricated activity. Marked *not yet connected*.

### Quick Actions
Per-room action sets (`quickActions(room)`), each routing into a **real** service
(dictation, calendar, global search, or navigation). Nothing fabricated; any future-only
action would be clearly labelled *not yet connected*.

## Future integration seams (where real backends drop in)

- **Speech** — `dictation.ts`'s `Transcriber` seam (`manualTranscriber`, `isLive:false`).
  Replace with a Web Speech / server transcriber; the Dictation UI is unchanged.
- **Google Calendar** — replace `loadEvents`/`saveEvents` in `calendar.ts` with an API
  client; the event model, filtering, and views are unchanged.
- **Notifications** — populate `notificationsPanel` from a real (honest) source when one
  exists.
- **Archive scale** — add new submission types to `CATEGORY_OF`; new categories light up
  automatically as data arrives. Data still flows through `adapters.ts` only.

## Extension points

- **New room** → append to `ROOMS` (`rooms.ts`) + add a `render` branch in `route()`.
- **New Quick Action** → add to the room's array in `quickActions()`.
- **New calendar category** → add to `CALENDAR_CATEGORIES` with its `room`.
- **New dictation destination** → add to `DICTATION_DESTINATIONS`.

## Constraints (do not violate)

No backend/DB/migration/workflow/auth changes from the client. No fabricated data,
counts, or activity. Frozen systems (arrival, Scene Asset Foundation, artwork pipeline,
rendering architecture, time-of-day, existing rendering seams) are not redesigned. The
Editorial Office remains the operational review workspace; Headquarters references
systems of record, never replaces them.

## Verify

```
npx tsc --noEmit
npm run verify        # build + node --test + production fixture-safety
```
