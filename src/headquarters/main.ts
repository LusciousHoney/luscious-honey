/* =============================================================================
   EXECUTIVE TEAM HEADQUARTERS — entry, arrival ceremony + hash router.

   Milestone 2 — Headquarters Arrival and the Executive Office.

   One Headquarters. Wings are ROOM VIEWS within it — not separate applications —
   mounted by a hash router, exactly as the Editorial Office mounts its views.

   Two states, per the approved theatrical model:
     • Scene  — the Executive Office: a bright first-of-summer morning; the day
                begins here, the six wings in view.
     • Seated — inside a wing, at its work surface (reserved for later milestones),
                with the room atmosphere dimmed behind the surface.

   Ambient FOUNDATION only: a time-of-day light state and a once-a-day Morning
   Arrival. No audio, no live weather, no wing workflows — those are later
   milestones. The Headquarters owns PRESENTATION and SESSION MEMORY only; it
   reads no operational data and holds no source of truth.
   ============================================================================= */

import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/components.css';
import '../styles/headquarters.css';

import { ROOMS, HOME_ROOM, getRoom, isRoomId, type Room, type RoomId } from './rooms.ts';
import { loadLastRoom, saveLastRoom, shouldPlayArrival, markArrivalSeen } from './memory.ts';
import { timeOfDay, greeting } from './time.ts';
import {
  fetchBriefing, fetchInbox, fetchItem, advanceStatus, addNote,
  inlineActions, STATUS_LABELS,
  type SubmissionDetail, type SubmissionStatus,
} from './adapters.ts';
import { operationsFlow, type OperationsFlow } from './operations.ts';
import {
  creativeStudio, REFERENCE_VOLUMES, DIRECTION_INSCRIPTION,
  type OpenManuscript, type CollectionVolume,
} from './creative.ts';

/* --- small helpers ------------------------------------------------------- */

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return node;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Reflect the current mode on <body.hq-page data-hq-mode> so CSS can theme the
    scene. The residence tokens and their time-of-day / seated overrides are all
    scoped to `.hq-page`, so these attributes must live on that element. */
function setMode(mode: 'scene' | 'seated'): void {
  document.body.setAttribute('data-hq-mode', mode);
}

/** Reflect the ambient light state on <body.hq-page data-tod>. Atmosphere only. */
function setTimeOfDay(): void {
  document.body.setAttribute('data-tod', timeOfDay());
}

/* --- the always-present atmosphere layer --------------------------------- */

/**
 * The morning light, the sky beyond the glass, and the soft foliage shadow.
 * Purely decorative and hidden from assistive technology — the room reads
 * completely without it (Build Bible §14: decorative imagery hidden; core usable
 * with scene art missing). It lives behind the app and dims when Seated.
 */
// The Executive Office scene render, as responsive derivatives (AVIF → WebP →
// JPEG). A dedicated portrait crop is art-directed in below 900px; the landscape
// frame is width-responsive above it. Decorative (alt="", aria-hidden), deferred
// (decoding async, low priority), and it never reserves layout — it fills the
// fixed `.hq-atmos__art` box, so a slow or failed load causes no shift and the
// CSS environment simply shows through underneath. Assets: public/headquarters/scene/.
const SCENE = '/headquarters/scene';
const SCENE_PICTURE = `
  <picture>
    <source media="(max-width: 900px)" type="image/avif" srcset="${SCENE}/exec-mobile.avif">
    <source media="(max-width: 900px)" type="image/webp" srcset="${SCENE}/exec-mobile.webp">
    <source media="(max-width: 900px)" srcset="${SCENE}/exec-mobile.jpg">
    <source type="image/avif" srcset="${SCENE}/exec-1024.avif 1024w, ${SCENE}/exec-1400.avif 1400w" sizes="100vw">
    <source type="image/webp" srcset="${SCENE}/exec-1024.webp 1024w, ${SCENE}/exec-1400.webp 1400w" sizes="100vw">
    <img class="hq-atmos__art-img" alt="" aria-hidden="true" loading="lazy" decoding="async" fetchpriority="low"
         src="${SCENE}/exec-1400.jpg"
         srcset="${SCENE}/exec-1024.jpg 1024w, ${SCENE}/exec-1400.jpg 1400w" sizes="100vw">
  </picture>`;

function ensureAtmosphere(): void {
  if (document.querySelector('.hq-atmos')) return;
  const atmos = el('div', { class: 'hq-atmos', 'aria-hidden': 'true' });

  // The scene-artwork layer now carries the approved Executive Office render.
  // `data-hq-art` on <body> gates the artwork treatment (tint + text legibility):
  //   'on'     → the image decoded successfully; the room is the photograph.
  //   'failed' → the image errored; stay on the CSS environment (graceful).
  // Until either fires, the CSS environment renders — the residence is usable
  // before (and without) the artwork.
  const art = el('div', { class: 'hq-atmos__art' });
  art.innerHTML = SCENE_PICTURE;
  const img = art.querySelector('img');
  if (img) {
    const reveal = () => { document.body.setAttribute('data-hq-art', 'on'); img.classList.add('is-loaded'); };
    if (img.complete && img.naturalWidth > 0) reveal();
    else {
      img.addEventListener('load', reveal, { once: true });
      img.addEventListener('error', () => document.body.setAttribute('data-hq-art', 'failed'), { once: true });
    }
  }

  atmos.append(
    // The CSS-rendered environment (the fallback beneath the artwork).
    el('div', { class: 'hq-atmos__sky' }),
    el('div', { class: 'hq-atmos__sun' }),
    el('div', { class: 'hq-atmos__floor' }),
    el('div', { class: 'hq-atmos__foliage' }),
    // The architectural artwork, then the time-of-day light laid over it.
    art,
    el('div', { class: 'hq-atmos__tint' }),
  );
  document.body.prepend(atmos);
}

/* --- room navigation rail (secondary; available inside every wing) ------- */

/**
 * The direct-navigation rail. Visually secondary, room NAMES (not icons alone),
 * keyboard-reachable — so the founder is one action from the atrium and one
 * action from any other wing, without a corporate sidebar tree (Build Bible §8).
 */
function renderRail(current: RoomId): HTMLElement {
  const list = el('ul', { class: 'hq-rail__list' });
  for (const room of ROOMS) {
    const isHere = room.id === current;
    const link = el(
      'a',
      {
        class: 'hq-rail__link',
        href: room.route,
        'data-status': room.status,
        ...(isHere ? { 'aria-current': 'page' } : {}),
      },
      room.name,
    );
    list.append(el('li', { class: 'hq-rail__item' }, link));
  }
  return el('nav', { class: 'hq-rail', 'aria-label': 'The wings of the residence' }, list);
}

/* --- room views ---------------------------------------------------------- */

/**
 * SCENE — the Executive Office. A bright first-of-summer morning: a warm
 * greeting, the room's emotional intention, and the six wings as thresholds.
 * Desktop reads as a cinematic room; mobile becomes the Indexed Headquarters
 * (same markup — headquarters.css chooses the presentation).
 */
function renderScene(root: HTMLElement): void {
  setMode('scene');
  const tod = timeOfDay();

  const wings = el('ul', { class: 'hq-wings__list' });
  for (const room of ROOMS) {
    const item = el('li', { class: 'hq-wing', 'data-room': room.id, 'data-status': room.status });
    const link = el(
      'a',
      { class: 'hq-wing__link', href: room.route },
      el('span', { class: 'hq-wing__name' }, room.name),
      el('span', { class: 'hq-wing__blurb' }, room.blurb),
    );
    if (room.status === 'reserved') {
      link.append(el('span', { class: 'hq-wing__badge label' }, 'In preparation'));
    } else if (room.kind === 'atrium') {
      link.append(el('span', { class: 'hq-wing__badge label' }, 'You are here'));
    }
    item.append(link);
    wings.append(item);
  }

  // The Daily Briefing — a single quiet plaster-document note, orientation only.
  // Filled asynchronously; the room reads completely before it arrives.
  const briefing = el('aside', { class: 'hq-briefing', 'aria-label': 'Today at the desk', 'aria-busy': 'true' },
    el('p', { class: 'hq-briefing__eyebrow label' }, 'Today'),
    el('p', { class: 'hq-briefing__line' }, 'Reading the desk…'),
  );

  const scene = el(
    'section',
    { class: 'hq-view hq-view--scene', 'aria-label': 'Executive Office' },
    el(
      'div',
      { class: 'hq-view__inner container' },
      el(
        'div',
        { class: 'hq-hero' },
        el('p', { class: 'hq-eyebrow label' }, `${greeting(tod)} · Executive Office`),
        el('h1', { class: 'hq-title' }, 'The day begins with possibility.'),
        el(
          'p',
          { class: 'hq-lede' },
          'Morning light across the limestone, the terrace open to clean air, the writing table waiting. Every wing of the residence opens from here.',
        ),
        briefing,
      ),
      el(
        'nav',
        { class: 'hq-wings', 'aria-label': 'The wings of the residence' },
        wings,
      ),
    ),
  );

  root.replaceChildren(scene);
  void mountBriefing(briefing);
}

/**
 * Fill the Daily Briefing from the submissions spine. Restraint by design: one
 * decision-relevant line (what awaits the founder), the oldest waiting item, and
 * one path into the Desk. Honest states — clear / offline / a quiet nudge — never
 * a grid of KPI cards. Reads only; the Desk is where work happens.
 */
async function mountBriefing(host: HTMLElement): Promise<void> {
  const res = await fetchBriefing();
  host.setAttribute('aria-busy', 'false');
  host.replaceChildren();
  host.append(el('p', { class: 'hq-briefing__eyebrow label' }, 'Today'));

  if (!res.ok) {
    host.append(el('p', { class: 'hq-briefing__line hq-briefing__line--quiet' },
      res.offline ? 'The desk is offline — your work is safe; try again shortly.' : 'The briefing is resting.'));
    return;
  }

  const b = res.data;
  const awaiting = b.awaitingReview;
  const headline =
    awaiting === 0 ? 'The desk is clear.'
    : awaiting === 1 ? 'One submission awaits your review.'
    : `${awaiting} submissions await your review.`;
  host.append(el('p', { class: 'hq-briefing__line' }, headline));

  if (b.oldestAwaiting) {
    const o = b.oldestAwaiting;
    const wait = o.waitingDays && o.waitingDays > 0 ? `, ${o.waitingDays} day${o.waitingDays === 1 ? '' : 's'}` : '';
    host.append(el('p', { class: 'hq-briefing__meta' }, `Longest wait: ${o.name}${wait}`));
  } else if (b.open > 0) {
    host.append(el('p', { class: 'hq-briefing__meta' }, `${b.open} in motion · nothing needs a decision right now.`));
  }

  host.append(el('a', { class: 'hq-briefing__enter', href: `${getRoom(HOME_ROOM)!.route}/desk` },
    awaiting > 0 ? 'Go to the Founder’s Desk →' : 'Open the Founder’s Desk →'));
}

/**
 * SEATED — inside a wing. Shell only: a titled work surface with an honest
 * placeholder, the room rail, and a clear way back to the Executive Office.
 * The scene atmosphere dims behind the surface (focused work).
 */
function renderSeated(root: HTMLElement, room: Room): void {
  setMode('seated');

  const surface =
    room.status === 'reserved'
      ? renderEmptyState(room)
      : el(
          'div',
          { class: 'hq-surface', role: 'group', 'aria-label': `${room.name} work surface` },
          el('p', { class: 'hq-surface__note' }, 'The work surface for this wing arrives in a later milestone.'),
        );

  const seated = el(
    'section',
    { class: 'hq-view hq-view--seated', 'aria-label': room.name },
    el(
      'div',
      { class: 'hq-view__inner container' },
      el(
        'div',
        { class: 'hq-seated__bar' },
        el('a', { class: 'hq-back', href: getRoom(HOME_ROOM)!.route }, '← Return to the Executive Office'),
        renderRail(room.id),
      ),
      el(
        'header',
        { class: 'hq-seated__head' },
        el('p', { class: 'hq-eyebrow label' }, room.name),
        el('h1', { class: 'hq-title hq-title--seated' }, room.name),
        el('p', { class: 'hq-lede' }, room.blurb),
      ),
      surface,
    ),
  );

  root.replaceChildren(seated);
}

/** EMPTY — an honest "in preparation" panel for a wing with no system of record yet. */
function renderEmptyState(room: Room): HTMLElement {
  return el(
    'div',
    { class: 'hq-state hq-state--empty', role: 'note' },
    el('p', { class: 'hq-state__title' }, 'In preparation'),
    el(
      'p',
      { class: 'hq-state__lede' },
      `The ${room.name} is reserved. It will open when there is real work for it to hold — the residence does not furnish empty rooms.`,
    ),
  );
}

/* =============================================================================
   OPERATIONS OFFICE — the flow view (Milestone 4).

   Route: #/operations. A DIFFERENT room from the Executive Office: not another
   inbox and not a decision surface, but the room of alignment — "is the House's
   work flowing well, and what is stalling?". One architectural object: an
   operations board on the wall (a calm standup/plans board) showing the pipeline
   of work across stages, the longest wait, an in-motion/resolved summary, and a
   single quiet routing line into the Founder's Desk where decisions are made.

   It reads only the EXISTING Daily Briefing (GET /api/headquarters/briefing) and
   shapes it with the pure `operationsFlow` helper. No submission rows, no detail,
   no correspondence, no decision controls, no writes — those live at the Desk /
   Editorial Office. Operations summarises and escalates; it never re-decides here.
   ============================================================================= */
function renderOperations(root: HTMLElement, room: Room): void {
  setMode('seated');

  // The board arrives asynchronously; the room reads completely before it does.
  const board = el('div', { class: 'hq-board', 'aria-label': 'The flow of the House’s work', 'aria-busy': 'true' },
    el('p', { class: 'hq-state__lede' }, 'Reading the board…'));

  const view = el(
    'section',
    { class: 'hq-view hq-view--seated hq-view--operations', 'aria-label': room.name },
    el(
      'div',
      { class: 'hq-view__inner container' },
      el(
        'div',
        { class: 'hq-seated__bar' },
        el('a', { class: 'hq-back', href: getRoom(HOME_ROOM)!.route }, '← Return to the Executive Office'),
        renderRail(room.id),
      ),
      el(
        'header',
        { class: 'hq-seated__head' },
        el('p', { class: 'hq-eyebrow label' }, room.name),
        el('h1', { class: 'hq-title hq-title--seated' }, room.name),
        el('p', { class: 'hq-lede' }, 'The flow of the House’s work — where it sits, and what is waiting. Decisions are made at the Founder’s Desk; this is the room that keeps them in view.'),
      ),
      board,
    ),
  );

  root.replaceChildren(view);
  void mountOperationsBoard(board);
}

/**
 * Fill the operations board from the submissions spine. Honest states — loading /
 * offline / error / empty — never a fabricated dashboard. On success: the pipeline
 * as ordered lanes with counts, an in-motion/resolved summary, the longest wait,
 * and one routing line to the Desk. Observational only; nothing here is a control.
 */
async function mountOperationsBoard(host: HTMLElement): Promise<void> {
  const res = await fetchBriefing();
  host.setAttribute('aria-busy', 'false');

  if (!res.ok) {
    host.replaceChildren(deskState(
      res.offline ? 'The board is offline' : 'The board couldn’t load',
      res.offline ? 'Your work is safe — try again in a moment.' : res.error,
    ));
    return;
  }

  const flow = operationsFlow(res.data);

  // Nothing has moved through the House yet — stay honestly empty (House P11: no
  // faked activity), not a grid of zeroes.
  if (flow.total === 0) {
    host.replaceChildren(deskState(
      'The board is quiet',
      'No work is in the House yet. As submissions arrive and move, the pipeline will fill in here — you’ll see the flow at a glance.',
    ));
    return;
  }

  host.replaceChildren(operationsBoard(flow));
}

/** The board itself, as furniture: a header summary, the stage lanes, and a foot
    with the longest wait and the single routing line to the Desk. */
function operationsBoard(flow: OperationsFlow): HTMLElement {
  const summary =
    flow.inMotion === 0
      ? 'All at rest — nothing in motion just now.'
      : `${flow.inMotion} in motion · ${flow.resolved} at rest`;

  const head = el('div', { class: 'hq-board__head' },
    el('p', { class: 'hq-board__eyebrow label' }, 'The House today'),
    el('p', { class: 'hq-board__summary' }, summary));

  // The pipeline as an ORDERED list of lanes (flow reads left → right). The lanes
  // are observational — no lane is a button; the only action is the routing line.
  const stages = el('ol', { class: 'hq-board__stages' });
  for (const s of flow.stages) {
    const lane = el('li', {
      class: 'hq-board__stage', 'data-stage': s.id,
      ...(s.id === flow.busiestId && s.count > 0 ? { 'data-busiest': 'true' } : {}),
    },
      el('span', { class: 'hq-board__count' }, String(s.count)),
      el('span', { class: 'hq-board__label' }, s.label),
      el('span', { class: 'hq-board__note' }, s.note),
    );
    stages.append(lane);
  }

  // The foot: the longest wait (the one stall worth naming), then the routing line.
  const foot = el('div', { class: 'hq-board__foot' });
  if (flow.oldest) {
    const days = flow.oldest.waitingDays && flow.oldest.waitingDays > 0
      ? `, ${flow.oldest.waitingDays} day${flow.oldest.waitingDays === 1 ? '' : 's'}` : '';
    foot.append(el('p', { class: 'hq-board__wait' }, `Waiting longest: ${flow.oldest.name}${days}`));
  } else {
    foot.append(el('p', { class: 'hq-board__wait hq-board__wait--calm' }, 'Nothing is waiting on you.'));
  }

  const deskRoute = `${getRoom(HOME_ROOM)!.route}/desk`;
  foot.append(
    flow.awaiting > 0
      ? el('a', { class: 'hq-board__route', href: deskRoute },
          `${flow.awaiting} awaiting a decision → Go to the Founder’s Desk`)
      : el('a', { class: 'hq-board__route hq-board__route--quiet', href: deskRoute },
          'Open the Founder’s Desk →'),
  );

  return el('div', { class: 'hq-board__inner', role: 'group', 'aria-label': 'Operations board' },
    head, stages, foot);
}

/* =============================================================================
   CREATIVE DIRECTOR — the library where the making lives (Milestone 5).

   Route: #/creative. A private editorial LIBRARY — the residence's warmest, most
   interior room — never a design studio, mood board, or dashboard. It expresses
   creative stewardship: the shape of what the House makes, held as a reading room
   rather than a queue.

   Two living objects, both from EXISTING data via the pure `creativeStudio`
   helper: the ONE open manuscript (the piece last in motion, from the briefing's
   `recent`) and the Collection (the made body of work, from published
   submissions). Around them, environmental furniture — a restrained reference
   library and one engraved line — that reads completely before any data arrives.

   Reads only; no decision controls, no writes, no new endpoint. It never routes
   into the Editorial Office: the founder stays inside the residence (per founder
   decision — a graceful in-residence placeholder holds the writing room's future
   seat). The Editorial Office remains the operational review workspace elsewhere.
   ============================================================================= */
function renderCreative(root: HTMLElement, room: Room): void {
  setMode('seated');

  // The two living objects arrive asynchronously; the room reads completely
  // before they do (the reference library and the inscription are furniture).
  const manuscript = el('div', { class: 'hq-manuscript', 'aria-label': 'The open manuscript', 'aria-busy': 'true' },
    el('p', { class: 'hq-manuscript__eyebrow label' }, 'On the table'),
    el('p', { class: 'hq-manuscript__resting' }, 'Turning to the page you left…'));
  const collection = el('div', { class: 'hq-collection', 'aria-label': 'The Collection', 'aria-busy': 'true' },
    el('p', { class: 'hq-collection__eyebrow label' }, 'The Collection'),
    el('p', { class: 'hq-state__lede' }, 'Reading the spines…'));

  const view = el(
    'section',
    { class: 'hq-view hq-view--seated hq-view--creative', 'aria-label': room.name },
    el(
      'div',
      { class: 'hq-view__inner container' },
      el(
        'div',
        { class: 'hq-seated__bar' },
        el('a', { class: 'hq-back', href: getRoom(HOME_ROOM)!.route }, '← Return to the Executive Office'),
        renderRail(room.id),
      ),
      el(
        'header',
        { class: 'hq-seated__head' },
        el('p', { class: 'hq-eyebrow label' }, room.name),
        el('h1', { class: 'hq-title hq-title--seated' }, room.name),
        el('p', { class: 'hq-lede' }, 'A private library where the making lives. The work is alive and waiting — kept warm for whenever you return to it.'),
      ),
      el(
        'div',
        { class: 'hq-library' },
        manuscript,
        el('div', { class: 'hq-library__lower' }, collection, renderReferenceShelf()),
        renderInscription(),
      ),
    ),
  );

  root.replaceChildren(view);
  void mountLibrary(manuscript, collection);
}

/**
 * Fill the two living objects from the existing spine. The manuscript reads the
 * Daily Briefing; the Collection reads the published works. Honest states — the
 * table resting, the shelf waiting, offline — never fabricated pages. Each object
 * degrades on its own, so an offline shelf never blanks the open manuscript.
 */
async function mountLibrary(manuscriptHost: HTMLElement, collectionHost: HTMLElement): Promise<void> {
  const [bRes, pRes] = await Promise.all([fetchBriefing(), fetchInbox('published')]);

  // --- The open manuscript (from the briefing) ---
  manuscriptHost.setAttribute('aria-busy', 'false');
  if (!bRes.ok) {
    manuscriptHost.replaceChildren(deskState(
      bRes.offline ? 'The reading light is off' : 'The page couldn’t be found',
      bRes.offline ? 'Your work is safe — try again in a moment.' : bRes.error,
    ));
  } else {
    const { manuscript } = creativeStudio(bRes.data, null);
    manuscriptHost.replaceChildren(...manuscriptContent(manuscript));
  }

  // --- The Collection (from the published works) ---
  collectionHost.setAttribute('aria-busy', 'false');
  if (!pRes.ok) {
    collectionHost.replaceChildren(deskState(
      pRes.offline ? 'The Collection is offline' : 'The Collection couldn’t load',
      pRes.offline ? 'Your work is safe — try again in a moment.' : pRes.error,
    ));
  } else {
    const { collection, collectionTotal } = creativeStudio(null, pRes.data.submissions);
    collectionHost.replaceChildren(...collectionContent(collection, collectionTotal));
  }
}

/** The open manuscript — one piece, lying open as though the founder just stepped
    away. Read-only; it never leaves the residence. When nothing is in motion, the
    table rests, honestly and still warm. */
function manuscriptContent(m: OpenManuscript | null): Node[] {
  if (!m) {
    return [
      el('p', { class: 'hq-manuscript__eyebrow label' }, 'The table'),
      el('p', { class: 'hq-manuscript__resting' },
        'No page lies open just now. The table is clear, the reading light still warm — begin whenever you like.'),
    ];
  }
  const nodes: Node[] = [
    el('p', { class: 'hq-manuscript__eyebrow label' }, 'Left open'),
    el('h2', { class: 'hq-manuscript__title' }, m.name),
  ];
  if (m.summary) nodes.push(el('p', { class: 'hq-manuscript__summary' }, m.summary));
  // A graceful in-residence placeholder: the residence holds the page. It never
  // routes out to the Editorial Office — the founder stays home. When a writing
  // room is built inside Headquarters, this line becomes its threshold.
  nodes.push(el('p', { class: 'hq-manuscript__hold' },
    'The page waits on the table, kept exactly as you left it. The writing room opens here soon.'));
  return nodes;
}

/** The Collection — the House's made works as bound volumes on a shelf. Curated,
    newest-first, spacious. Honest when the shelf is still bare. */
function collectionContent(volumes: CollectionVolume[], total: number): Node[] {
  const head = el('div', { class: 'hq-collection__head' },
    el('p', { class: 'hq-collection__eyebrow label' }, 'The Collection'));
  if (total > 0) {
    head.append(el('p', { class: 'hq-collection__meta' },
      total === 1 ? 'One bound work' : `${total} bound works${total > volumes.length ? ` · ${volumes.length} shown` : ''}`));
  }

  if (volumes.length === 0) {
    return [head, el('p', { class: 'hq-collection__empty' },
      'Nothing is bound here yet. As the House publishes its first works, they take their place on the shelf.')];
  }

  const shelf = el('ul', { class: 'hq-collection__shelf' });
  for (const v of volumes) {
    const vol = el('li', { class: 'hq-volume' },
      el('span', { class: 'hq-volume__title' }, v.name));
    if (v.summary) vol.append(el('span', { class: 'hq-volume__note' }, v.summary));
    shelf.append(vol);
  }
  return [head, shelf];
}

/** The reference library — a restrained run of bound volumes as ARCHITECTURE, not
    interface. Decorative furniture (like the scene's plants), so it is hidden from
    assistive technology and carries no controls. */
function renderReferenceShelf(): HTMLElement {
  const shelf = el('aside', { class: 'hq-reference', 'aria-hidden': 'true' });
  const row = el('ul', { class: 'hq-reference__row' });
  for (const v of REFERENCE_VOLUMES) {
    row.append(el('li', { class: 'hq-reference__vol', 'data-kind': v.kind },
      el('span', { class: 'hq-reference__spine' }, v.title)));
  }
  shelf.append(row, el('span', { class: 'hq-reference__ledge' }));
  return shelf;
}

/** The direction plate — one line engraved into the oak, discovered rather than
    announced. Given a role so it is read as the room's quiet inscription. */
function renderInscription(): HTMLElement {
  return el('p', { class: 'hq-inscription', role: 'note', 'aria-label': 'Engraved above the shelves' },
    DIRECTION_INSCRIPTION);
}

/** ERROR — an unrecognised route. Offers the way home rather than a dead end. */
function renderError(root: HTMLElement): void {
  setMode('seated');
  root.replaceChildren(
    el(
      'section',
      { class: 'hq-view hq-view--seated' },
      el(
        'div',
        { class: 'hq-view__inner container' },
        el(
          'div',
          { class: 'hq-state hq-state--error', role: 'alert' },
          el('p', { class: 'hq-state__title' }, 'This corridor doesn’t lead anywhere'),
          el('p', { class: 'hq-state__lede' }, 'There is no room at that address.'),
          el('a', { class: 'hq-back', href: getRoom(HOME_ROOM)!.route }, '← Return to the Executive Office'),
        ),
      ),
    ),
  );
}

/**
 * ACCESS-DENIED — a styled panel for completeness. The AUTHORITATIVE gate is the
 * edge middleware (functions/_middleware.js), which returns 403 via Cloudflare
 * Access BEFORE this page is ever served — a denied founder never reaches this
 * code. This view exists so the state is designed and reachable for review at
 * `#/denied`; it is not, and must not be treated as, a security control.
 */
function renderAccessDenied(root: HTMLElement): void {
  setMode('seated');
  root.replaceChildren(
    el(
      'section',
      { class: 'hq-view hq-view--seated' },
      el(
        'div',
        { class: 'hq-view__inner container' },
        el(
          'div',
          { class: 'hq-state hq-state--denied', role: 'alert' },
          el('p', { class: 'hq-eyebrow label' }, 'Headquarters · private'),
          el('p', { class: 'hq-state__title' }, 'This Headquarters is private'),
          el('p', { class: 'hq-state__lede' }, 'A valid House identity is required. Sign in through Cloudflare Access to continue.'),
          el('a', { class: 'hq-back', href: '/' }, '← Return to the corridor'),
        ),
      ),
    ),
  );
}

/* =============================================================================
   THE DESK — the Executive Office seated work state (the Founder’s Desk).
   Route: #/executive/desk. One queue for every submission, over the existing
   submissions spine. A few audited decisions happen here; the Editorial Office
   remains the complete review workspace. HQ owns no data.
   ============================================================================= */

// Founder-oriented groupings over the existing workflow states (the data model
// and API are unchanged; grouping is a presentation concern). The Editorial
// Office remains the detailed, per-status workflow environment.
type DeskGroup = 'review' | 'waiting' | 'done' | 'all';
interface GroupDef {
  id: DeskGroup;
  label: string;
  statuses: SubmissionStatus[] | null; // null = everything
  empty: { title: string; lede: string };
}
const DESK_GROUPS: GroupDef[] = [
  { id: 'review', label: 'Needs My Review', statuses: ['sent_for_review', 'under_review'],
    empty: { title: 'Nothing needs you right now', lede: 'When a submission is waiting on your decision, it will rest here.' } },
  { id: 'waiting', label: 'Waiting on Others', statuses: ['changes_requested', 'approved', 'scheduled'],
    empty: { title: 'Nothing in waiting', lede: 'Submissions back with a creator, or moving toward publication, will appear here.' } },
  { id: 'done', label: 'Completed', statuses: ['published', 'not_accepted'],
    empty: { title: 'Nothing completed yet', lede: 'Published and closed submissions gather here in time.' } },
  { id: 'all', label: 'Everything', statuses: null,
    empty: { title: 'The desk is clear', lede: 'No submissions yet. When one arrives, it will be waiting here.' } },
];
function groupDef(id: DeskGroup): GroupDef { return DESK_GROUPS.find((g) => g.id === id) || DESK_GROUPS[0]; }

let deskFilter: DeskGroup = 'review';
let deskSelectedId: number | null = null;

function renderDesk(root: HTMLElement): void {
  setMode('seated');

  const filters = el('div', { class: 'hq-deskbar__filters', role: 'group', 'aria-label': 'Show' });
  for (const g of DESK_GROUPS) {
    const chip = el('button', {
      class: 'hq-chip', type: 'button', 'data-filter': g.id,
      'aria-pressed': deskFilter === g.id ? 'true' : 'false',
    }, g.label);
    chip.addEventListener('click', () => { deskFilter = g.id; deskSelectedId = null; renderDesk(root); });
    filters.append(chip);
  }

  const list = el('div', { class: 'hq-inbox', id: 'hq-inbox', 'aria-live': 'polite', 'aria-busy': 'true' },
    el('p', { class: 'hq-state__lede' }, 'Opening the inbox…'));
  const detail = el('div', { class: 'hq-detail', id: 'hq-detail' },
    el('p', { class: 'hq-detail__empty' }, 'Choose a submission to read it.'));

  const desk = el(
    'section',
    { class: 'hq-view hq-view--seated hq-view--desk', 'aria-label': 'Founder’s Desk' },
    el(
      'div',
      { class: 'hq-view__inner container' },
      el(
        'div',
        { class: 'hq-seated__bar' },
        el('a', { class: 'hq-back', href: getRoom(HOME_ROOM)!.route }, '← Return to the Executive Office'),
        renderRail(HOME_ROOM),
      ),
      el(
        'header',
        { class: 'hq-seated__head' },
        el('p', { class: 'hq-eyebrow label' }, 'Executive Office'),
        el('h1', { class: 'hq-title hq-title--seated' }, 'Founder’s Desk'),
        el('p', { class: 'hq-lede' }, 'Every submission, gathered in one place. Make the few decisions that are yours to make; the Editorial Office keeps the full review.'),
      ),
      el('div', { class: 'hq-deskbar' }, filters),
      el('div', { class: 'hq-desk' }, list, detail),
    ),
  );

  root.replaceChildren(desk);
  window.scrollTo({ top: 0 });
  void loadInbox(root);
  if (deskSelectedId != null) void loadDetail(root, deskSelectedId);
}

async function loadInbox(root: HTMLElement): Promise<void> {
  const host = root.querySelector('#hq-inbox') as HTMLElement | null;
  if (!host) return;
  // Fetch every submission and group client-side — the founder groupings are a
  // presentation layer over the existing statuses; the API is unchanged.
  const res = await fetchInbox();
  host.setAttribute('aria-busy', 'false');

  if (!res.ok) {
    host.replaceChildren(deskState(
      res.offline ? 'The desk is offline' : 'The desk couldn’t load',
      res.offline ? 'Your work is safe — try again in a moment.' : res.error,
    ));
    return;
  }
  const def = groupDef(deskFilter);
  const items = (res.data.submissions || []).filter((s) => def.statuses === null || def.statuses.includes(s.status));
  if (items.length === 0) {
    host.replaceChildren(deskState(def.empty.title, def.empty.lede));
    return;
  }

  const ul = el('ul', { class: 'hq-inbox__list' });
  for (const s of items) {
    const row = el('button', {
      class: 'hq-inbox__row', type: 'button', 'data-id': String(s.id),
      ...(s.id === deskSelectedId ? { 'aria-current': 'true' } : {}),
    },
      el('span', { class: 'hq-inbox__name' }, s.name),
      el('span', { class: 'hq-inbox__meta' }, `${typeLabel(s.type)} · ${fmtAge(s.created_at)}`),
      el('span', { class: 'hq-inbox__summary' }, s.summary || ''),
      statusPill(s.status),
    );
    row.addEventListener('click', () => { deskSelectedId = s.id; markSelected(root, s.id); void loadDetail(root, s.id); });
    ul.append(el('li', {}, row));
  }
  host.replaceChildren(ul);
}

function markSelected(root: HTMLElement, id: number): void {
  root.querySelectorAll('.hq-inbox__row').forEach((r) => {
    if (r.getAttribute('data-id') === String(id)) r.setAttribute('aria-current', 'true');
    else r.removeAttribute('aria-current');
  });
}

async function loadDetail(root: HTMLElement, id: number): Promise<void> {
  const host = root.querySelector('#hq-detail') as HTMLElement | null;
  if (!host) return;
  host.replaceChildren(el('p', { class: 'hq-detail__empty' }, 'Opening…'));
  const res = await fetchItem(id);
  if (!res.ok) {
    host.replaceChildren(deskState(
      res.offline ? 'Offline' : 'Couldn’t open this submission',
      res.offline ? 'Your work is safe. Try again shortly.' : res.error,
    ));
    return;
  }
  renderDetail(root, host, res.data.submission);
}

function renderDetail(root: HTMLElement, host: HTMLElement, s: SubmissionDetail): void {
  const head = el('div', { class: 'hq-detail__head' },
    el('div', { class: 'hq-detail__title' },
      el('h2', {}, s.name), statusPill(s.status)),
    el('p', { class: 'hq-detail__sub' }, `${typeLabel(s.type)} · ${s.email} · arrived ${fmtAge(s.created_at)}`),
  );
  if (s.summary) head.append(el('p', { class: 'hq-detail__summary' }, s.summary));

  // Valid inline decisions ONLY — derived from the shared transition rules for
  // this item's CURRENT status. The submissions API re-validates on the server.
  const actions = el('div', { class: 'hq-detail__actions', role: 'group', 'aria-label': 'Decisions' });
  const available = inlineActions(s.status);
  if (available.length === 0) {
    actions.append(el('p', { class: 'hq-detail__resolved' }, 'Nothing to decide here — the Editorial Office holds the full review.'));
  } else {
    for (const a of available) {
      const btn = el('button', { class: 'hq-action', type: 'button', 'data-to': a.status }, a.label);
      btn.addEventListener('click', () => { void doAdvance(root, host, s.id, a.status, btn); });
      actions.append(btn);
    }
  }

  // Internal note (audited through the existing API; never emailed, never public).
  const noteField = el('textarea', { class: 'hq-note__field', rows: '2', 'aria-label': 'Internal note', placeholder: 'Add a private note…' }) as HTMLTextAreaElement;
  const noteBtn = el('button', { class: 'hq-action hq-action--ghost', type: 'button' }, 'Add note');
  noteBtn.addEventListener('click', () => { void doNote(root, host, s.id, noteField, noteBtn); });
  const note = el('div', { class: 'hq-note' }, noteField, noteBtn);

  // The correspondence + audit trail (read-only), newest at the bottom.
  const thread = el('div', { class: 'hq-thread' }, el('p', { class: 'hq-thread__label label' }, 'History'));
  const entries = [
    ...s.messages.map((m) => ({ at: m.created_at, who: m.author || 'system', text: noteText(m), kind: 'note' })),
    ...s.events.map((e) => ({ at: e.created_at, who: e.actor, text: eventText(e), kind: 'event' })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  for (const e of entries) {
    thread.append(el('div', { class: `hq-thread__row hq-thread__row--${e.kind}` },
      el('span', { class: 'hq-thread__meta' }, `${fmtAge(e.at)} · ${e.who}`),
      el('span', { class: 'hq-thread__text' }, e.text)));
  }

  host.replaceChildren(head, actions, note, thread);
}

async function doAdvance(root: HTMLElement, host: HTMLElement, id: number, status: SubmissionStatus, btn: HTMLButtonElement): Promise<void> {
  btn.disabled = true; btn.textContent = 'Saving…';
  const res = await advanceStatus(id, status);
  if (!res.ok) {
    btn.disabled = false; btn.textContent = 'Try again';
    host.prepend(el('p', { class: 'hq-detail__error' }, res.offline ? 'Offline — not saved.' : res.error));
    return;
  }
  // The spine is authoritative — re-read the item and the list to reflect it.
  await loadDetail(root, id);
  void loadInbox(root);
}

async function doNote(root: HTMLElement, host: HTMLElement, id: number, field: HTMLTextAreaElement, btn: HTMLButtonElement): Promise<void> {
  const body = field.value.trim();
  if (!body) { field.focus(); return; }
  btn.disabled = true; btn.textContent = 'Saving…';
  const res = await addNote(id, body);
  if (!res.ok) {
    btn.disabled = false; btn.textContent = 'Try again';
    host.prepend(el('p', { class: 'hq-detail__error' }, res.offline ? 'Offline — not saved.' : res.error));
    return;
  }
  await loadDetail(root, id);
}

/* --- desk helpers -------------------------------------------------------- */

function deskState(title: string, lede: string): HTMLElement {
  return el('div', { class: 'hq-state hq-state--empty', role: 'note' },
    el('p', { class: 'hq-state__title' }, title),
    el('p', { class: 'hq-state__lede' }, lede));
}

function statusPill(status: string): HTMLElement {
  return el('span', { class: 'hq-pill', 'data-status': status }, STATUS_LABELS[status] || status);
}

function typeLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function noteText(m: { body: string; kind: string }): string {
  return m.kind === 'internal_note' ? `Note: ${m.body}` : m.body;
}

function eventText(e: { action: string; from_status: string | null; to_status: string | null; detail: string | null }): string {
  if (e.action === 'status_changed') {
    return `Moved ${e.from_status ? (STATUS_LABELS[e.from_status] || e.from_status) + ' → ' : ''}${STATUS_LABELS[e.to_status || ''] || e.to_status}`;
  }
  if (e.action === 'created') return 'Submitted';
  if (e.action === 'message_added') return e.detail === 'acknowledgment' ? 'Acknowledgment sent' : 'Note added';
  return e.action;
}

// Compact relative age from a D1 'YYYY-MM-DD HH:MM:SS' (UTC) timestamp.
function fmtAge(ts: string): string {
  if (!ts) return '';
  const iso = ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z';
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* --- Morning Arrival ceremony -------------------------------------------- */

/**
 * The first open of the day. A brief warm light-up before the residence resolves
 * — never on every navigation. Hard ceiling of 4s and ALWAYS skippable (button,
 * click, or any key). Under reduced motion it does not play at all; the founder
 * lands directly in a complete room (Build Bible §9.3, §4.2).
 */
function playArrival(done: () => void): void {
  // The arrival is the residence's eternal first-of-summer morning — it always
  // greets as morning, regardless of the real clock. The time-of-day greeting is
  // a real-world courtesy shown in the scene, not in this ceremony.
  const overlay = el('div', { class: 'hq-arrival', role: 'dialog', 'aria-label': 'Entering the Headquarters' });
  const enter = el('button', { class: 'hq-arrival__enter', type: 'button' }, 'Enter');
  overlay.append(
    el(
      'div',
      { class: 'hq-arrival__inner' },
      el('p', { class: 'hq-arrival__wordmark wordmark' }, 'Luscious Honey Collective'),
      el('p', { class: 'hq-arrival__greeting' }, 'Good morning.'),
      el('p', { class: 'hq-arrival__line' }, 'You’re safe. You’re well. It’s a beautiful morning.'),
      enter,
    ),
  );

  let finished = false;
  let timer = 0;
  const finish = (): void => {
    if (finished) return;
    finished = true;
    window.clearTimeout(timer);
    overlay.removeEventListener('click', finish);
    document.removeEventListener('keydown', onKey);
    overlay.classList.add('is-leaving');
    const cleanup = (): void => { overlay.remove(); done(); };
    // Let the exit fade run, but never block the founder from the work.
    overlay.addEventListener('transitionend', cleanup, { once: true });
    window.setTimeout(cleanup, 700);
  };
  const onKey = (e: KeyboardEvent): void => { if (e.key) finish(); };

  overlay.addEventListener('click', finish);
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  // Reveal on the next frame so the entrance transition runs.
  requestAnimationFrame(() => overlay.classList.add('is-in'));
  enter.focus({ preventScroll: true });

  timer = window.setTimeout(finish, 3200); // well under the 4s ceiling
}

let arrivalHandled = false;

/** Play the arrival at most once per session-load, and only once per calendar day. */
function maybePlayArrival(then: () => void): void {
  if (arrivalHandled || !shouldPlayArrival()) { then(); return; }
  arrivalHandled = true;
  if (prefersReducedMotion()) { markArrivalSeen(); then(); return; }
  playArrival(() => { markArrivalSeen(); then(); });
}

/* --- router -------------------------------------------------------------- */

/** Parse the leading segment of the hash, e.g. '#/operations' → 'operations'. */
function currentSegment(): string {
  return location.hash.replace(/^#\/?/, '').split('/')[0] ?? '';
}

/** The second segment, e.g. '#/executive/desk' → 'desk'. */
function subSegment(): string {
  return location.hash.replace(/^#\/?/, '').split('/')[1] ?? '';
}

function route(): void {
  const root = document.getElementById('hq-app');
  if (!root) return;

  const seg = currentSegment();

  // Empty hash → restore the last room from Headquarters Memory (or the atrium).
  if (seg === '') {
    const restored = loadLastRoom();
    location.replace(`${location.pathname}${getRoom(restored ?? HOME_ROOM)!.route}`);
    return;
  }

  if (seg === 'denied') {
    renderAccessDenied(root);
    return;
  }

  if (!isRoomId(seg)) {
    renderError(root);
    return;
  }

  const room = getRoom(seg)!;
  saveLastRoom(room.id); // remember where we are, for the next return
  if (room.kind === 'atrium') {
    // The Executive Office has a seated work state: the Founder’s Desk.
    if (room.id === HOME_ROOM && subSegment() === 'desk') renderDesk(root);
    else renderScene(root);
  } else if (room.id === 'operations') {
    // The Operations Office is the first department with a real, room-first
    // purpose — the flow view over the spine. Every other live department keeps
    // the generic seated placeholder until its own milestone.
    renderOperations(root, room);
  } else if (room.id === 'creative') {
    // The Creative Director room — the library where the making lives.
    renderCreative(root, room);
  } else {
    renderSeated(root, room);
  }

  // Minimal navigation transition only: return focus to the top of the surface.
  window.scrollTo({ top: 0 });
  root.setAttribute('tabindex', '-1');
  root.focus({ preventScroll: true });
}

function boot(): void {
  setTimeOfDay();
  ensureAtmosphere();
  window.addEventListener('hashchange', route);
  // The Morning Arrival wraps the first render of the day, then the residence
  // resolves to wherever the founder last was.
  maybePlayArrival(route);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

// Re-exported for tests and future milestones (kept off the module's happy path).
export { renderScene, renderSeated, renderOperations, renderCreative, renderError, renderAccessDenied };
export type { Room, RoomId };
