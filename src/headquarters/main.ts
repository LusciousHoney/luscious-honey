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
import { timeOfDay, greeting, dayKey } from './time.ts';
import {
  fetchBriefing, fetchInbox, fetchItem, advanceStatus, addNote,
  inlineActions, STATUS_LABELS,
  type SubmissionDetail, type SubmissionStatus,
} from './adapters.ts';
import { operationsFlow, type OperationsFlow } from './operations.ts';
import {
  creativeStudio, REFERENCE_VOLUMES, DIRECTION_INSCRIPTION,
  type OpenManuscript,
} from './creative.ts';
import { archiveTree, archiveFilters } from './archive.ts';
import {
  CALENDAR_CATEGORIES, categoriesForRoom, eventsForRoom, upcoming, groupByDay,
  makeEvent, loadEvents, saveEvents,
} from './calendar.ts';
import { DICTATION_DESTINATIONS, makeDraft } from './dictation.ts';
import {
  productionSprint, RECORDING_NOTE, REVIEW_NOTE,
  type ProductionSprint,
} from './production.ts';
import { RELATIONSHIPS, SALON_LEDE, HORIZON_NOTE } from './growth.ts';
import { SAFEGUARDS, STUDY_LEDE, CONTINUITY_NOTE } from './business.ts';
import { CURRENT_SCENE, scenePictureHTML } from './scene.ts';
import { SUSPENDED_CARDS, LOWER_CARDS, FOUNDER_IDENTITY, type HospitalityCard } from './hospitality.ts';
import {
  SOUNDTRACK_PROVIDERS, soundtrackRooms, providerLabel,
  makePreference, preferenceFor, setPreference, clearPreference,
  loadPreferences, savePreferences,
} from './atmosphere.ts';
import {
  COS_SECTIONS, COS_HOME_SECTION, isCosSection,
  COS_EYEBROW, COS_TITLE, COS_LEDE,
  BRIEFING, DECISIONS, DOCKET,
  openChairViews, leadershipViews, appointmentsOnRecord, leadershipHistoryView,
  RESPONSES,
  docketStatusLabel, getResponse,
  decisionViews, openDecisions, archiveShelves,
  makeResponse, loadResponses, saveResponses, recordResponse, clearResponse,
  type CosSectionId, type DecisionView,
} from './chief-of-staff.ts';

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
// The scene is a REPLACEABLE asset (see scene.ts): the markup and focal point
// come from CURRENT_SCENE, so approved production artwork swaps in without any
// change here. `--hq-scene-focal` carries the landscape crop's focal point to CSS.
const SCENE_PICTURE = scenePictureHTML(CURRENT_SCENE);

function ensureAtmosphere(): void {
  if (document.querySelector('.hq-atmos')) return;
  const atmos = el('div', { class: 'hq-atmos', 'aria-hidden': 'true' });

  // The scene-artwork layer now carries the approved Executive Office render.
  // `data-hq-art` on <body> gates the artwork treatment (tint + text legibility):
  //   'on'     → the image decoded successfully; the room is the photograph.
  //   'failed' → the image errored; stay on the CSS environment (graceful).
  // Until either fires, the CSS environment renders — the residence is usable
  // before (and without) the artwork.
  const art = el('div', { class: 'hq-atmos__art', style: `--hq-scene-focal: ${CURRENT_SCENE.focal};` });
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
  // The two suspended cards float high in the scene (Today's Intention, Thought
  // of the Day). The greeting sits opposite them, so the hero reads as a spread.
  const suspended = el('div', { class: 'hq-hosp hq-hosp--suspended', 'aria-label': 'A few words for the morning' });
  for (const c of SUSPENDED_CARDS) suspended.append(hospitalityCard(c));

  const scene = el(
    'section',
    { class: 'hq-view hq-view--scene', 'aria-label': 'Executive Office' },
    el(
      'div',
      { class: 'hq-view__inner container' },
      el(
        'div',
        { class: 'hq-hero' },
        el(
          'div',
          { class: 'hq-hero__lede-col' },
          el('h1', { class: 'hq-title hq-title--greeting' },
            el('span', { class: 'hq-hero__greet-line' }, 'Good morning,'),
            el('span', { class: 'hq-hero__greet-line' }, `${FOUNDER_IDENTITY.name}.`)),
          el(
            'div',
            { class: 'hq-hero__sub' },
            el('p', { class: 'hq-lede' }, 'The House is awake.'),
            el('p', { class: 'hq-lede' }, 'Your day is ready when you are.'),
          ),
          el('p', { class: 'hq-hero__signoff' }, '— Chief of Staff'),
        ),
        suspended,
      ),
      renderLowerCards(),
      el(
        'nav',
        { class: 'hq-wings', 'aria-label': 'The wings of the residence' },
        wings,
      ),
    ),
  );

  root.replaceChildren(scene);
}

/* --- The five lower editorial cards along the sill (Sprint 10) ------------
   Today's Briefing · Priorities · From the House · Mindful Moment · Atmosphere.
   Opaque warm-parchment panels; the scenery stays the focal point. Today's
   Briefing is filled by the real Daily Briefing; Atmosphere opens the soundtrack
   control; the rest rest as calm editorial text. */
function renderLowerCards(): HTMLElement {
  const list = el('div', { class: 'hq-hosp__list' });
  for (const card of LOWER_CARDS) list.append(hospitalityCard(card));
  return el('section', { class: 'hq-hosp hq-hosp--lower', 'aria-label': 'The morning at a glance' }, list);
}

/* Honest destinations for each lower card's action button — real House routes,
   never fabricated data. Atmosphere opens the Soundscape control (a modal). */
const CARD_ROUTES: Record<string, string> = {
  briefing: '#/executive/desk',        // the Founder's Desk
  priorities: '#/chief-of-staff/docket', // the Docket
  house: '#/chief-of-staff',           // the Chief of Staff briefing
  mindful: '#/chief-of-staff',         // a calm, prepared space
};

function hospitalityCard(card: HospitalityCard): HTMLElement {
  const body = el('div', { class: 'hq-hcard__body' },
    el('p', { class: 'hq-hcard__eyebrow label' }, card.eyebrow),
    el('span', { class: 'hq-hcard__rule', 'aria-hidden': 'true' }));

  // A live card (Today's Briefing) is filled from the real Daily Briefing — the
  // honest awaiting-review line, never a fabricated count. A resting card carries
  // its curated editorial line.
  if (card.live) {
    const host = el('div', { class: 'hq-hcard__live', 'aria-busy': 'true' },
      el('p', { class: 'hq-briefing__line hq-briefing__line--quiet' }, 'Reading the desk…'));
    body.append(host);
    void mountBriefing(host);
  } else {
    body.append(el('p', { class: 'hq-hcard__line' }, card.body));
    if (card.attribution) body.append(el('p', { class: 'hq-hcard__attr' }, `— ${card.attribution}`));
  }

  const article = el('article', { class: 'hq-hcard', 'data-kind': card.kind }, body);

  // The lower cards carry a dark-oxblood action button along the bottom (aligned
  // across the row). Atmosphere opens the Soundscape modal; the rest are real
  // navigation links to honest House destinations. Suspended cards have none.
  if (card.action) {
    if (card.action === 'atmosphere') {
      const btn = el('button', { class: 'hq-hcard__btn', type: 'button' }, card.actionLabel ?? 'Open');
      btn.addEventListener('click', openAtmosphere);
      article.append(btn);
    } else {
      const href = CARD_ROUTES[card.action] ?? getRoom(HOME_ROOM)!.route;
      article.append(el('a', { class: 'hq-hcard__btn', href }, card.actionLabel ?? 'Open'));
    }
  }
  return article;
}

/* --- Atmosphere: the room-soundtrack preference control (Sprint 10) ---------
   Interface + preference model only (see atmosphere.ts): the founder assigns a
   preferred soundtrack to each room, and the House remembers it. NO streaming,
   auth, or playback — a future player reads these preferences. Reached from the
   Atmosphere hospitality card and every room's Quick Actions (no toolbar change). */
function openAtmosphere(): void {
  openHqModal(atmospherePanel(), 'Atmosphere');
}

function atmospherePanel(): HTMLElement {
  const panel = el('section', { class: 'hq-atmo', 'aria-label': 'Atmosphere — room soundtracks' });
  panel.append(
    el('p', { class: 'hq-modal__eyebrow label' }, 'Atmosphere'),
    el('p', { class: 'hq-atmo__lede' },
      'Choose the soundtrack you would like waiting in each room. The House remembers your preference; the music itself arrives in a later chapter.'),
  );

  const rows = el('div', { class: 'hq-atmo__rooms' });
  for (const room of soundtrackRooms()) {
    rows.append(atmosphereRow(room.id, room.name));
  }
  panel.append(rows);
  return panel;
}

function atmosphereRow(roomId: ReturnType<typeof soundtrackRooms>[number]['id'], roomName: string): HTMLElement {
  const current = preferenceFor(loadPreferences(), roomId);

  const provider = el('select', { class: 'hq-atmo__in', 'aria-label': `Provider for ${roomName}` }) as HTMLSelectElement;
  for (const p of SOUNDTRACK_PROVIDERS) {
    const opt = el('option', { value: p.id }, p.label) as HTMLOptionElement;
    if (current?.provider === p.id) opt.selected = true;
    provider.append(opt);
  }
  const title = el('input', { class: 'hq-atmo__in hq-atmo__in--title', type: 'text',
    'aria-label': `Playlist for ${roomName}`, placeholder: 'Playlist or station', maxlength: '80' }) as HTMLInputElement;
  if (current?.title) title.value = current.title;
  const link = el('input', { class: 'hq-atmo__in', type: 'url',
    'aria-label': `Link for ${roomName} (optional)`, placeholder: 'Link (optional)' }) as HTMLInputElement;
  if (current?.url) link.value = current.url;

  const status = el('p', { class: 'hq-atmo__status', 'aria-live': 'polite' });
  const renderStatus = (pref: typeof current): void => {
    status.replaceChildren();
    if (pref) status.append(el('span', {}, `Preferred: ${pref.title} · ${providerLabel(pref.provider)}`));
    else status.append(el('span', { class: 'hq-atmo__status--none' }, 'No soundtrack chosen yet.'));
  };
  renderStatus(current);

  const save = el('button', { class: 'hq-action hq-atmo__save', type: 'button' }, 'Remember') as HTMLButtonElement;
  save.addEventListener('click', () => {
    const pref = makePreference({ roomId, provider: provider.value, title: title.value, url: link.value });
    if (!pref) { renderStatus(preferenceFor(loadPreferences(), roomId)); return; }
    savePreferences(setPreference(loadPreferences(), pref));
    renderStatus(pref);
  });

  const clear = el('button', { class: 'hq-atmo__clear', type: 'button' }, 'Clear') as HTMLButtonElement;
  clear.addEventListener('click', () => {
    savePreferences(clearPreference(loadPreferences(), roomId));
    provider.selectedIndex = 0; title.value = ''; link.value = '';
    renderStatus(null);
  });

  return el('div', { class: 'hq-atmo__room' },
    el('p', { class: 'hq-atmo__name' }, roomName),
    el('div', { class: 'hq-atmo__fields' }, provider, title, link),
    el('div', { class: 'hq-atmo__row-foot' }, status, el('div', { class: 'hq-atmo__actions' }, clear, save)));
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
  host.replaceChildren();   // the card supplies the "Today's Briefing" eyebrow

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
  // The card's own oxblood button is the single path into the Desk (no duplicate link).
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
  const archive = el('div', { class: 'hq-archive', 'aria-label': 'The Archive', 'aria-busy': 'true' },
    el('p', { class: 'hq-archive__eyebrow label' }, 'The Archive'),
    el('p', { class: 'hq-state__lede' }, 'Opening the archive…'));

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
        archive,
        el('div', { class: 'hq-library__lower' }, renderReferenceShelf(), renderInscription()),
      ),
    ),
  );

  root.replaceChildren(view);
  void mountLibrary(manuscript, archive);
}

/**
 * Fill the two living objects from the existing spine. The manuscript reads the
 * Daily Briefing; the Collection reads the published works. Honest states — the
 * table resting, the shelf waiting, offline — never fabricated pages. Each object
 * degrades on its own, so an offline shelf never blanks the open manuscript.
 */
async function mountLibrary(manuscriptHost: HTMLElement, archiveHost: HTMLElement): Promise<void> {
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

  // --- The Archive (from the published works) ---
  archiveHost.setAttribute('aria-busy', 'false');
  if (!pRes.ok) {
    archiveHost.replaceChildren(deskState(
      pRes.offline ? 'The Archive is offline' : 'The Archive couldn’t load',
      pRes.offline ? 'Your work is safe — try again in a moment.' : pRes.error,
    ));
  } else {
    mountArchive(archiveHost, pRes.data.submissions);
  }
}

/* --- The Archive: a searchable, filterable, hierarchical library ------------
   Replaces the bookshelf. A large search field, honest facet filters, a
   breadcrumb, and native <details> accordions (multiple open at once, touch- and
   keyboard-friendly). Larger typography; reads the same published works. */
function mountArchive(host: HTMLElement, published: import('./adapters.ts').Submission[]): void {
  let query = '';
  let filter: string | null = null;
  const filters = archiveFilters(published);

  const search = el('input', {
    class: 'hq-archive__search', type: 'search', enterkeyhint: 'search',
    'aria-label': 'Search the archive', placeholder: 'Search the archive…', autocomplete: 'off',
  }) as HTMLInputElement;

  const chips = el('div', { class: 'hq-archive__filters', role: 'group', 'aria-label': 'Filter the archive' });
  const results = el('div', { class: 'hq-archive__results', 'aria-live': 'polite' });

  const renderChips = (): void => {
    chips.replaceChildren();
    const all = el('button', { class: 'hq-chip hq-archive__chip', type: 'button',
      'aria-pressed': filter === null ? 'true' : 'false' }, 'All');
    all.addEventListener('click', () => { filter = null; draw(); });
    chips.append(all);
    for (const f of filters) {
      const c = el('button', { class: 'hq-chip hq-archive__chip', type: 'button',
        'aria-pressed': filter === f ? 'true' : 'false' }, f);
      c.addEventListener('click', () => { filter = filter === f ? null : f; draw(); });
      chips.append(c);
    }
  };

  const draw = (): void => {
    const tree = archiveTree(published, query, filter);
    renderChips();

    // Breadcrumb — Archive › [filter] › “query”
    const crumbs: string[] = ['Archive'];
    if (filter) crumbs.push(filter);
    if (query.trim()) crumbs.push(`“${query.trim()}”`);
    const crumb = el('p', { class: 'hq-archive__crumb' }, crumbs.join('  ›  '));
    const count = el('p', { class: 'hq-archive__count' },
      tree.total === tree.grandTotal
        ? `${tree.grandTotal} work${tree.grandTotal === 1 ? '' : 's'}`
        : `${tree.total} of ${tree.grandTotal}`);

    results.replaceChildren(crumb, count);

    if (tree.grandTotal === 0) {
      results.append(el('p', { class: 'hq-archive__empty' },
        'The archive is waiting for its first bound work. As the House publishes, the shelves fill here.'));
      return;
    }
    if (tree.total === 0) {
      results.append(el('p', { class: 'hq-archive__empty' }, 'Nothing in the archive matches yet — try another word.'));
      return;
    }

    for (const cat of tree.categories) {
      const catBox = el('details', { class: 'hq-archive__cat', open: 'true' });
      catBox.append(el('summary', { class: 'hq-archive__cat-sum' },
        el('span', { class: 'hq-archive__cat-name' }, cat.label),
        el('span', { class: 'hq-archive__cat-n' }, String(cat.total))));
      for (const g of cat.groups) {
        const grp = el('details', { class: 'hq-archive__grp', open: 'true' });
        grp.append(el('summary', { class: 'hq-archive__grp-sum' },
          el('span', { class: 'hq-archive__grp-name' }, g.label),
          el('span', { class: 'hq-archive__grp-n' }, String(g.total))));
        const list = el('ul', { class: 'hq-archive__entries' });
        for (const e of g.entries) {
          const item = el('li', { class: 'hq-archive__entry' },
            el('p', { class: 'hq-archive__entry-title' }, e.name));
          if (e.summary) item.append(el('p', { class: 'hq-archive__entry-desc' }, e.summary));
          list.append(item);
        }
        grp.append(list);
        catBox.append(grp);
      }
      results.append(catBox);
    }
  };

  let t = 0;
  search.addEventListener('input', () => {
    query = search.value;
    window.clearTimeout(t);
    t = window.setTimeout(draw, 120);
  });

  host.replaceChildren(
    el('div', { class: 'hq-archive__head' },
      el('p', { class: 'hq-archive__eyebrow label' }, 'The Archive'),
      el('div', { class: 'hq-archive__searchwrap' },
        el('span', { class: 'hq-archive__search-ico', 'aria-hidden': 'true' }, '⌕'),
        search)),
    chips,
    results,
  );
  draw();
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

/* =============================================================================
   PRODUCTION SUITE — a glass studio for momentum without noise (Milestone 6).

   Route: #/production. The residence's most open, light-filled room, built around
   ONE architectural object: the Narration Desk — a floating oak desk with quietly
   alive displays, headphones, a tablet stand, and the warm brass recording lamp
   that stays quiet and ready and never simulates recording. Everything else
   supports it: a glass review room (environmental) and a vellum studio sprint
   (In Production · Preparing · Recently Finished) over the finishing tail of the
   existing spine. Reads only; no capture, no editing, no decision controls, and
   no doorway out — the founder stays inside the residence.
   ============================================================================= */
function renderProduction(root: HTMLElement, room: Room): void {
  setMode('seated');

  // The sprint arrives asynchronously; the room reads completely before it (the
  // Narration Desk and review room are furniture, present from the first frame).
  const sprint = el('section', { class: 'hq-sprint', 'aria-label': 'In the studio', 'aria-busy': 'true' },
    el('p', { class: 'hq-sprint__eyebrow label' }, 'In the studio'),
    el('p', { class: 'hq-state__lede' }, 'Looking in on the studio…'));

  const view = el(
    'section',
    { class: 'hq-view hq-view--seated hq-view--production', 'aria-label': room.name },
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
        el('p', { class: 'hq-lede' }, 'A glass studio for momentum without noise. Capable, and in motion — where cleared work is narrated, shaped, and finished.'),
      ),
      el(
        'div',
        { class: 'hq-studio' },
        buildNarrationDesk(),
        el('div', { class: 'hq-studio__lower' }, sprint, buildReviewRoom()),
      ),
    ),
  );

  root.replaceChildren(view);
  void mountSprint(sprint);
}

/**
 * THE NARRATION DESK — presented in the Headquarters editorial language, NOT as a
 * drawn scene. The room itself is the residence (the same architecture, glass,
 * light and materials that furnish every other wing); this is the quiet plaster
 * plate — brushed-brass hairline, generous negative space — that names where
 * narration and recording happen and holds the honest in-residence note. No
 * illustrated equipment: the room communicates purpose through its own
 * architecture, exactly as the Executive Office and Creative Director do.
 */
function buildNarrationDesk(): HTMLElement {
  return el('section', { class: 'hq-narration', role: 'group', 'aria-label': 'The Narration Desk' },
    el('p', { class: 'hq-narration__eyebrow label' }, 'The Narration Desk'),
    el('p', { class: 'hq-narration__line' }, RECORDING_NOTE));
}

/** THE REVIEW ROOM — environmental only, in the residence's own language: a quiet
    plaster note that simply says finished work is reviewed here. No dashboard,
    no controls, no data, no illustration. */
function buildReviewRoom(): HTMLElement {
  return el('aside', { class: 'hq-review', 'aria-label': 'The review room' },
    el('p', { class: 'hq-review__eyebrow label' }, 'The review room'),
    el('p', { class: 'hq-review__note' }, REVIEW_NOTE));
}

/**
 * Fill the studio sprint from the finishing tail of the spine. Three lanes over
 * the existing statuses — In Production (scheduled), Preparing (approved),
 * Recently Finished (published) — as a curated vellum sheet, not a backlog.
 * Honest states: the studio quiet, or offline. Reads only.
 */
async function mountSprint(host: HTMLElement): Promise<void> {
  const [scheduled, approved, published] = await Promise.all([
    fetchInbox('scheduled'), fetchInbox('approved'), fetchInbox('published'),
  ]);
  host.setAttribute('aria-busy', 'false');

  // Offline only if EVERY lane failed to load (a partial read still tells a story).
  if (!scheduled.ok && !approved.ok && !published.ok) {
    host.replaceChildren(deskState(
      scheduled.offline ? 'The studio is offline' : 'The studio couldn’t load',
      scheduled.offline ? 'Your work is safe — try again in a moment.' : scheduled.error,
    ));
    return;
  }

  const sprint = productionSprint({
    scheduled: scheduled.ok ? scheduled.data.submissions : null,
    approved:  approved.ok  ? approved.data.submissions  : null,
    published: published.ok ? published.data.submissions : null,
  });

  host.replaceChildren(...sprintContent(sprint));
}

function sprintContent(sprint: ProductionSprint): Node[] {
  const head = el('p', { class: 'hq-sprint__eyebrow label' }, 'In the studio');

  if (sprint.total === 0) {
    return [head, el('p', { class: 'hq-sprint__quiet' },
      'The studio is quiet. When work is cleared for production, it gathers here to be finished.')];
  }

  const lanes = el('ol', { class: 'hq-sprint__lanes' });
  for (const lane of sprint.lanes) {
    const col = el('li', { class: 'hq-sprint__lane', 'data-lane': lane.id },
      el('p', { class: 'hq-sprint__lane-label' }, lane.label));
    if (lane.items.length === 0) {
      col.append(el('p', { class: 'hq-sprint__lane-empty' }, lane.empty));
    } else {
      const ul = el('ul', { class: 'hq-sprint__pieces' });
      for (const it of lane.items) ul.append(el('li', { class: 'hq-sprint__piece' }, it.name));
      col.append(ul);
      if (lane.total > lane.items.length) {
        col.append(el('p', { class: 'hq-sprint__more' }, `and ${lane.total - lane.items.length} more`));
      }
    }
    lanes.append(col);
  }
  return [head, el('div', { class: 'hq-sprint__sheet' }, lanes)];
}

/* =============================================================================
   GROWTH STUDIO — a sunlit publishing salon overlooking the horizon (Milestone 7).

   Route: #/growth. The residence's most outward-looking room, answering "Where is
   the House finding resonance?" — in RELATIONSHIPS, never metrics. The horizon (the
   shared residence) is the hero; the content is the correspondence the House keeps
   with the world, presented in the residence's editorial language. No workflow
   data, no fetch, no numbers, no dashboard — purely architectural + editorial.
   ============================================================================= */
function renderGrowth(root: HTMLElement, room: Room): void {
  setMode('seated');

  // The correspondence: each relationship as a calm plaster card — a standing
  // conversation, never a statistic. Curated and spacious, a salon not a grid.
  const cards = el('ul', { class: 'hq-corr__list' });
  for (const r of RELATIONSHIPS) {
    cards.append(el('li', { class: 'hq-corr__card' },
      el('p', { class: 'hq-corr__name' }, r.name),
      el('p', { class: 'hq-corr__note' }, r.note)));
  }

  const salon = el(
    'section',
    { class: 'hq-corr', role: 'group', 'aria-label': 'The House’s conversations with the world' },
    el('p', { class: 'hq-corr__eyebrow label' }, 'Ongoing conversations'),
    cards,
    el('p', { class: 'hq-corr__horizon' }, HORIZON_NOTE),
  );

  const view = el(
    'section',
    { class: 'hq-view hq-view--seated hq-view--growth', 'aria-label': room.name },
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
        el('p', { class: 'hq-lede' }, SALON_LEDE),
      ),
      salon,
    ),
  );

  root.replaceChildren(view);
}

/* =============================================================================
   BUSINESS OFFICE — a private counsel's study where what's built is kept safe
   (Milestone 8 — the wing that completes the residence).

   Route: #/business. The residence's most rooted, permanent room, answering "How
   do we preserve what the House has built?" — protection before administration.
   The hero is THE ARCHIVE: a wall of archival records naming the subjects the
   House protects. No workflow data, no fetch, no numbers, no records, no
   dashboard, no current-priority task — the architecture carries the meaning.
   ============================================================================= */
function renderBusiness(root: HTMLElement, room: Room): void {
  setMode('seated');

  // The Archive — the subjects the House keeps and protects, each a calm walnut
  // record. Archival subjects only; never a record, a figure, or a status.
  const records = el('ul', { class: 'hq-arch__list' });
  for (const s of SAFEGUARDS) {
    records.append(el('li', { class: 'hq-arch__record' },
      el('p', { class: 'hq-arch__name' }, s.name),
      el('p', { class: 'hq-arch__note' }, s.note)));
  }

  const archive = el(
    'section',
    { class: 'hq-arch', role: 'group', 'aria-label': 'The archive — what the House keeps safe' },
    el('p', { class: 'hq-arch__eyebrow label' }, 'The archive'),
    records,
    el('p', { class: 'hq-arch__continuity' }, CONTINUITY_NOTE),
  );

  const view = el(
    'section',
    { class: 'hq-view hq-view--seated hq-view--business', 'aria-label': room.name },
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
        el('p', { class: 'hq-lede' }, STUDY_LEDE),
      ),
      archive,
    ),
  );

  root.replaceChildren(view);
}

/* =============================================================================
   OFFICE OF THE CHIEF OF STAFF — the founder's private executive WORKSPACE
   (Sprint 9A). NOT a room in the residence: Headquarters is architecturally
   complete, so the office is reached from the House Toolbar / Quick Actions and
   lives at #/chief-of-staff (with a calm section sub-route #/chief-of-staff/
   <section>), never appearing in the atrium or the wing rail. The office is data
   (see chief-of-staff.ts); this renders its six prepared sections. The Decision
   System is the one interactive foundation — the Founder's own responses are
   recorded and kept (localStorage, like the Calendar). No AI, no automation, no
   fetch: everything is prepared before the Founder arrives.
   ============================================================================= */
const COS_ROUTE = '#/chief-of-staff';
function renderChiefOfStaff(root: HTMLElement): void {
  setMode('seated');

  const section: CosSectionId = isCosSection(subSegment())
    ? (subSegment() as CosSectionId)
    : COS_HOME_SECTION;

  // The section navigation — the office's own quiet index. Briefing is home
  // (the bare route); the rest are sub-routes, so each section is deep-linkable.
  const nav = el('nav', { class: 'hq-cos__nav', 'aria-label': 'Sections of the office' });
  const navList = el('ul', { class: 'hq-cos__nav-list' });
  for (const s of COS_SECTIONS) {
    const href = s.id === COS_HOME_SECTION ? COS_ROUTE : `${COS_ROUTE}/${s.id}`;
    const link = el('a', {
      class: 'hq-cos__nav-link',
      href,
      ...(s.id === section ? { 'aria-current': 'page' } : {}),
    }, s.label);
    navList.append(el('li', { class: 'hq-cos__nav-item' }, link));
  }
  nav.append(navList);

  const body = el('div', { class: 'hq-cos__body' });
  const paint = () => body.replaceChildren(cosSectionView(section, paint));
  paint();

  const view = el(
    'section',
    { class: 'hq-view hq-view--seated hq-view--cos', 'aria-label': COS_TITLE },
    el(
      'div',
      { class: 'hq-view__inner container' },
      el(
        'div',
        { class: 'hq-seated__bar' },
        // Not a wing, so no wing rail — just the way back to the residence.
        el('a', { class: 'hq-back', href: getRoom(HOME_ROOM)!.route }, '← Return to the Executive Office'),
      ),
      el(
        'header',
        { class: 'hq-seated__head' },
        el('p', { class: 'hq-eyebrow label' }, COS_EYEBROW),
        el('h1', { class: 'hq-title hq-title--seated' }, COS_TITLE),
        el('p', { class: 'hq-lede' }, COS_LEDE),
      ),
      nav,
      body,
    ),
  );

  root.replaceChildren(view);
}

/** Build the body for one section. `repaint` lets interactive sections (the
    Decisions record) refresh in place after the Founder acts. */
function cosSectionView(section: CosSectionId, repaint: () => void): HTMLElement {
  switch (section) {
    case 'briefing':   return cosBriefing();
    case 'decisions':  return cosDecisions(repaint);
    case 'docket':     return cosDocket();
    case 'chairs':     return cosChairs();
    case 'leadership': return cosLeadership();
    case 'archive':    return cosArchive();
  }
}

/** A section intro: an eyebrow + one prepared line beneath it. */
function cosIntro(eyebrow: string, line: string): HTMLElement {
  return el('div', { class: 'hq-cos__intro' },
    el('p', { class: 'hq-cos__eyebrow label' }, eyebrow),
    el('p', { class: 'hq-cos__lead' }, line));
}

/** A titled block of prepared lines (Today's Priorities, Risks, and the like). */
function cosBlock(title: string, lines: string[]): HTMLElement {
  const list = el('ul', { class: 'hq-cos__lines' });
  for (const line of lines) list.append(el('li', { class: 'hq-cos__line' }, line));
  return el('section', { class: 'hq-cos__block' },
    el('h2', { class: 'hq-cos__block-title' }, title),
    list);
}

/* --- 1. Founder Briefing -------------------------------------------------- */
function cosBriefing(): HTMLElement {
  const tod = timeOfDay();
  const waiting = openDecisions(DECISIONS, loadResponses());

  // Decisions Waiting — the one live line, derived from the record so it can
  // never disagree with the Decisions section.
  const decisionsWaiting = el('section', { class: 'hq-cos__block' },
    el('h2', { class: 'hq-cos__block-title' }, 'Decisions Waiting'));
  if (waiting.length === 0) {
    decisionsWaiting.append(el('p', { class: 'hq-cos__quiet' },
      'Nothing awaits your decision. Everything prepared has been answered.'));
  } else {
    const line = waiting.length === 1
      ? 'One recommendation is prepared and waiting for your word.'
      : `${spellCount(waiting.length)} recommendations are prepared and waiting for your word.`;
    decisionsWaiting.append(el('p', { class: 'hq-cos__lead' }, line));
    const list = el('ul', { class: 'hq-cos__lines' });
    for (const v of waiting) list.append(el('li', { class: 'hq-cos__line' }, v.decision.title));
    decisionsWaiting.append(list);
    decisionsWaiting.append(el('a', { class: 'hq-cos__more', href: '#/chief-of-staff/decisions' },
      'Review the decisions →'));
  }

  return el('div', { class: 'hq-cos__section hq-cos__section--briefing' },
    el('section', { class: 'hq-cos__welcome' },
      el('p', { class: 'hq-cos__eyebrow label' }, `${greeting(tod)}`),
      el('p', { class: 'hq-cos__welcome-line' }, BRIEFING.goodMorning)),
    cosBlock('Today’s Priorities', BRIEFING.todaysPriorities),
    decisionsWaiting,
    cosBlock('Progress Since Yesterday', BRIEFING.progressSinceYesterday),
    cosBlock('Risks', BRIEFING.risks),
    cosBlock('Looking Ahead', BRIEFING.lookingAhead),
    el('aside', { class: 'hq-cos__note', role: 'note' },
      el('p', { class: 'hq-cos__note-label label' }, 'A note from your Chief of Staff'),
      el('p', { class: 'hq-cos__note-body' }, BRIEFING.chiefOfStaffNote)),
  );
}

/* --- 2. Decision System (interactive record) ------------------------------ */
function cosDecisions(repaint: () => void): HTMLElement {
  const responses = loadResponses();
  const views = decisionViews(DECISIONS, responses);

  const list = el('div', { class: 'hq-cos__decisions' });
  for (const v of views) list.append(cosDecisionCard(v, repaint));

  return el('div', { class: 'hq-cos__section' },
    cosIntro('Decisions', 'Each is prepared with a recommendation and the thinking behind it. Give your word when you are ready; your answer is kept.'),
    list);
}

function cosDecisionCard(v: DecisionView, repaint: () => void): HTMLElement {
  const d = v.decision;
  const recorded = v.response ? getResponse(v.response.response) : null;

  const card = el('article', {
    class: 'hq-cos__decision',
    ...(v.archived ? { 'data-archived': 'true' } : {}),
  });

  card.append(
    el('h3', { class: 'hq-cos__decision-title' }, d.title),
    el('p', { class: 'hq-cos__decision-summary' }, d.summary),
    cosField('Recommendation', d.recommendation),
    cosField('Reasoning', d.reasoning),
  );

  const tradeList = el('ul', { class: 'hq-cos__tradeoffs' });
  for (const t of d.tradeOffs) tradeList.append(el('li', {}, t));
  card.append(el('div', { class: 'hq-cos__field' },
    el('p', { class: 'hq-cos__field-label label' }, 'Trade-offs'),
    tradeList));

  card.append(cosField('Requested of you', d.requestedAction));

  // The recorded answer (if any), shown back plainly before the controls.
  const status = el('p', { class: 'hq-cos__decision-status' });
  if (recorded && v.response) {
    status.classList.add('is-answered');
    const when = formatWhen(v.response.respondedAt);
    status.append(
      el('span', { class: 'hq-cos__answer-label' }, `Your answer: ${recorded.label}`),
      el('span', { class: 'hq-cos__answer-echo' }, `${recorded.echo}${when ? ` · ${when}` : ''}`),
    );
    if (v.response.note) {
      status.append(el('span', { class: 'hq-cos__answer-note' }, `“${v.response.note}”`));
    }
  } else {
    status.append(el('span', { class: 'hq-cos__answer-label hq-cos__answer-label--awaiting' },
      'Awaiting your decision'));
  }
  card.append(status);

  // Optional note — captured with whichever response the Founder gives next.
  const noteId = `note_${d.id}`;
  const noteInput = el('input', {
    class: 'hq-cos__note-input',
    id: noteId,
    type: 'text',
    maxlength: '160',
    placeholder: 'Add a note (optional) — e.g. the change you would make',
    ...(v.response?.note ? { value: v.response.note } : {}),
  }) as HTMLInputElement;
  card.append(el('div', { class: 'hq-cos__note-field' },
    el('label', { class: 'hq-cos__note-input-label label', for: noteId }, 'Your note'),
    noteInput));

  // The six responses. The recorded one is marked; choosing any records it.
  const controls = el('div', { class: 'hq-cos__responses', role: 'group',
    'aria-label': `Your response to “${d.title}”` });
  for (const r of RESPONSES) {
    const chosen = v.response?.response === r.id;
    const btn = el('button', {
      class: 'hq-cos__response',
      type: 'button',
      'aria-pressed': chosen ? 'true' : 'false',
    }, r.label) as HTMLButtonElement;
    btn.addEventListener('click', () => {
      const made = makeResponse({ decisionId: d.id, response: r.id, note: noteInput.value });
      if (!made) return;
      saveResponses(recordResponse(loadResponses(), made));
      repaint();
    });
    controls.append(btn);
  }
  card.append(controls);

  // Withdraw — return the decision to waiting, keeping nothing.
  if (v.response) {
    const withdraw = el('button', { class: 'hq-cos__withdraw', type: 'button' },
      'Withdraw this answer') as HTMLButtonElement;
    withdraw.addEventListener('click', () => {
      saveResponses(clearResponse(loadResponses(), d.id));
      repaint();
    });
    card.append(withdraw);
  }

  return card;
}

/** A labelled field: a small label over a line of prepared prose. */
function cosField(label: string, body: string): HTMLElement {
  return el('div', { class: 'hq-cos__field' },
    el('p', { class: 'hq-cos__field-label label' }, label),
    el('p', { class: 'hq-cos__field-body' }, body));
}

/* --- 3. Docket ------------------------------------------------------------ */
function cosDocket(): HTMLElement {
  const list = el('div', { class: 'hq-cos__docket' });
  for (const item of DOCKET) {
    const card = el('article', { class: 'hq-cos__docket-item' },
      el('div', { class: 'hq-cos__docket-head' },
        el('h3', { class: 'hq-cos__docket-question' }, item.question),
        el('span', { class: 'hq-cos__tag label', 'data-status': item.status },
          docketStatusLabel(item.status))),
      cosField('Background', item.background),
      cosField('Recommendation', item.recommendation),
      el('p', { class: 'hq-cos__docket-owner' },
        el('span', { class: 'label' }, 'Owner'), ` ${item.owner}`));
    list.append(card);
  }
  return el('div', { class: 'hq-cos__section' },
    cosIntro('Docket', 'The active questions before the House — matters that want leadership consideration, not tasks to complete.'),
    list);
}

/* --- 4. Open Chairs — derived from the Executive Register ----------------- */
function cosChairs(): HTMLElement {
  const chairs = openChairViews();
  const list = el('div', { class: 'hq-cos__chairs' });
  for (const chair of chairs) {
    const resp = el('ul', { class: 'hq-cos__chair-resp' });
    for (const r of chair.responsibilities) resp.append(el('li', {}, r));
    const head = el('div', { class: 'hq-cos__chair-head' },
      el('h3', { class: 'hq-cos__chair-name' },
        `Chair #${String(chair.ordinal).padStart(3, '0')} — ${chair.title}`),
      el('span', { class: 'hq-cos__tag label', 'data-status': chair.status },
        chair.statusLabel));
    const card = el('article', { class: 'hq-cos__chair' },
      head,
      el('p', { class: 'hq-cos__chair-purpose' }, chair.purpose),
      cosField('Charge', chair.charge),
      el('div', { class: 'hq-cos__field' },
        el('p', { class: 'hq-cos__field-label label' }, 'Standing Responsibilities'),
        resp));
    if (chair.establishedOn) {
      card.append(el('p', { class: 'hq-cos__chair-established' },
        el('span', { class: 'label' }, 'Established'), ` ${chair.establishedOn}`));
    }
    list.append(card);
  }
  return el('div', { class: 'hq-cos__section' },
    cosIntro('Open Chairs', 'The seats the House is preparing to fill, drawn from the Executive Register. Each is described in full before anyone is ever invited to it. No recruitment yet — this is the ground being made ready.'),
    list);
}

/* --- 5. Leadership Records — derived from Register history ----------------- */
function cosLeadership(): HTMLElement {
  // Each Chair's truthful current standing, derived from the Register.
  const holders = el('ul', { class: 'hq-cos__holders' });
  for (const c of leadershipViews()) {
    const holder = el('li', { class: 'hq-cos__holder' },
      el('p', { class: 'hq-cos__holder-chair' },
        `Chair #${String(c.ordinal).padStart(3, '0')} — ${c.title}`),
      el('p', { class: 'hq-cos__holder-name' }, c.standing));
    if (c.operatingNote) {
      holder.append(el('p', { class: 'hq-cos__holder-standing' }, c.operatingNote));
    }
    if (c.founderNote) {
      holder.append(el('p', { class: 'hq-cos__holder-standing' },
        el('span', { class: 'label' }, 'Founder’s note'), ` ${c.founderNote}`));
    }
    holders.append(holder);
  }

  // Appointments — only real records; honestly empty until the first letter.
  const onRecord = appointmentsOnRecord();
  const appts = el('div', { class: 'hq-cos__block' },
    el('h2', { class: 'hq-cos__block-title' }, 'Appointments'));
  if (onRecord.length === 0) {
    appts.append(el('p', { class: 'hq-cos__quiet' },
      'No appointments have been made yet. Every Chair is established but not yet formally appointed; when the first is seated, its letter is kept here.'));
  } else {
    const list = el('ul', { class: 'hq-cos__lines' });
    for (const a of onRecord) {
      list.append(el('li', { class: 'hq-cos__line' },
        `${a.appointee} — ${a.chairId}${a.effectiveDate ? ` · ${a.effectiveDate}` : ''}`));
    }
    appts.append(list);
  }

  // Leadership history — the preserved Register entries, oldest first.
  const history = el('ol', { class: 'hq-cos__history' });
  for (const e of leadershipHistoryView()) {
    history.append(el('li', { class: 'hq-cos__history-entry' },
      el('span', { class: 'hq-cos__history-when label' }, e.on),
      el('span', { class: 'hq-cos__history-event' }, e.event)));
  }

  return el('div', { class: 'hq-cos__section' },
    cosIntro('Leadership Records', 'Who holds each charge, how it was given, and the story of the House’s leadership as it grows.'),
    el('section', { class: 'hq-cos__block' },
      el('h2', { class: 'hq-cos__block-title' }, 'Chairs & Charges'),
      holders),
    appts,
    el('section', { class: 'hq-cos__block' },
      el('h2', { class: 'hq-cos__block-title' }, 'Leadership History'),
      history),
  );
}

/* --- 6. Archive ----------------------------------------------------------- */
function cosArchive(): HTMLElement {
  const recorded = loadResponses().length;
  const shelves = archiveShelves(recorded);

  const grid = el('ul', { class: 'hq-cos__shelves' });
  for (const s of shelves) {
    const shelf = el('li', { class: 'hq-cos__shelf' },
      el('div', { class: 'hq-cos__shelf-head' },
        el('h3', { class: 'hq-cos__shelf-name' }, s.label),
        el('span', { class: 'hq-cos__shelf-count label' },
          s.count > 0 ? `${s.count} kept` : 'Empty')),
      el('p', { class: 'hq-cos__shelf-note' }, s.note),
      el('p', { class: 'hq-cos__shelf-state' },
        s.count > 0 ? 'Held in the record.' : s.emptyLine));
    grid.append(shelf);
  }

  return el('div', { class: 'hq-cos__section' },
    cosIntro('Archive', 'The institutional record, given its shelves. Each category is ready the moment a document exists — the House keeps what it decides.'),
    grid);
}

/* --- small shared helpers for the office ---------------------------------- */

/** Spell out small counts for the Briefing's prose (falls back to digits). */
function spellCount(n: number): string {
  const words = ['zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  return words[n] ?? String(n);
}

/** A gentle, human "when" from an ISO datetime (date only; never a raw stamp). */
function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  } catch { return ''; }
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

  closeHqModal();   // any open House modal closes when the founder navigates

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

  // The Office of the Chief of Staff is an operational WORKSPACE, not a room in
  // the residence (Headquarters is architecturally complete). It is reached from
  // the House Toolbar / Quick Actions, lives at #/chief-of-staff, and is handled
  // here — before the room registry — so it never appears in the atrium or rail.
  if (seg === 'chief-of-staff') {
    renderChiefOfStaff(root);
    window.scrollTo({ top: 0 });
    root.setAttribute('tabindex', '-1');
    root.focus({ preventScroll: true });
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
  } else if (room.id === 'production') {
    // The Production Suite — a glass studio for momentum without noise.
    renderProduction(root, room);
  } else if (room.id === 'growth') {
    // The Growth Studio — a sunlit publishing salon overlooking the horizon.
    renderGrowth(root, room);
  } else if (room.id === 'business') {
    // The Business Office — a private counsel's study where what's built is kept safe.
    renderBusiness(root, room);
  } else {
    renderSeated(root, room);
  }

  // Minimal navigation transition only: return focus to the top of the surface.
  window.scrollTo({ top: 0 });
  root.setAttribute('tabindex', '-1');
  root.focus({ preventScroll: true });
}

/* =============================================================================
   HEADQUARTERS SHARED SERVICES — Dictation + Calendar (Usability sprint).
   One quiet launcher, available in every room; two calm overlays. Native to the
   residence, touch-first. NO speech API and NO backend: transcripts and scheduled
   events are the founder's own and persist client-side (localStorage), architected
   so a real Web Speech / Google Calendar integration drops in without UI change.
   ============================================================================= */
const DRAFTS_KEY = 'lhc.hq.dictation.v1';

function currentRoomId(): RoomId {
  const seg = currentSegment();
  return isRoomId(seg) ? seg : HOME_ROOM;
}

let hqModal: HTMLElement | null = null;
let hqModalOpener: HTMLElement | null = null;
function closeHqModal(): void {
  hqModal?.remove(); hqModal = null;
  document.body.classList.remove('hq-modal-open');   // release the background
  document.removeEventListener('keydown', hqModalKey);
  // Return focus to whatever opened the dialog (keyboard/screen-reader courtesy).
  if (hqModalOpener && document.contains(hqModalOpener)) hqModalOpener.focus({ preventScroll: true });
  hqModalOpener = null;
}
function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])')];
}
function hqModalKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') { closeHqModal(); return; }
  if (e.key !== 'Tab' || !hqModal) return;
  // Contain Tab focus within the open dialog.
  const items = focusables(hqModal);
  if (items.length === 0) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
function openHqModal(panel: HTMLElement, label: string): void {
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  closeHqModal();
  hqModalOpener = opener;
  const scrim = el('div', { class: 'hq-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': label });
  scrim.addEventListener('click', (e) => { if (e.target === scrim) closeHqModal(); });
  const close = el('button', { class: 'hq-modal__close', type: 'button', 'aria-label': 'Close' }, '×');
  close.addEventListener('click', closeHqModal);
  scrim.append(el('div', { class: 'hq-modal__sheet' }, close, panel));
  document.body.append(scrim);
  document.body.classList.add('hq-modal-open');   // lock background scroll/interaction
  hqModal = scrim;
  document.addEventListener('keydown', hqModalKey);
  requestAnimationFrame(() => scrim.classList.add('is-in'));
  // Move focus into the dialog: the first meaningful control, else the close button.
  const target = focusables(panel)[0] ?? close;
  target.focus({ preventScroll: true });
}

const MIC_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 11a6 6 0 0 0 12 0"/><path d="M12 17v4"/></svg>`;

/** DICTATION — tap the mic, write the transcript, choose a destination, save.
    The mic arms the field (no fake listening — there is no speech API yet). */
function dictationPanel(): HTMLElement {
  const status = el('p', { class: 'hq-dict__status' },
    'Tap the microphone, then speak — or write your note below.');
  const mic = el('button', { class: 'hq-dict__mic', type: 'button', 'aria-pressed': 'false', 'aria-label': 'Dictate' });
  mic.innerHTML = MIC_SVG;
  const field = el('textarea', { class: 'hq-dict__field', rows: '4',
    'aria-label': 'Transcript', placeholder: 'Your note…' }) as HTMLTextAreaElement;
  mic.addEventListener('click', () => {
    const armed = mic.getAttribute('aria-pressed') === 'true';
    mic.setAttribute('aria-pressed', armed ? 'false' : 'true');
    status.textContent = armed ? 'Tap the microphone, then speak — or write your note below.'
      : 'Go ahead — dictate naturally. (Type it here for now; voice arrives soon.)';
    field.focus();
  });

  const dest = el('select', { class: 'hq-dict__dest', 'aria-label': 'Destination' }) as HTMLSelectElement;
  for (const d of DICTATION_DESTINATIONS) dest.append(el('option', { value: d.id }, `${d.label} — ${d.hint}`));

  const save = el('button', { class: 'hq-action hq-dict__save', type: 'button' }, 'Save');
  const wrap = el('section', { class: 'hq-dict', 'aria-label': 'Dictation' },
    el('p', { class: 'hq-modal__eyebrow label' }, 'Dictation'),
    el('div', { class: 'hq-dict__miczone' }, mic, status),
    field,
    el('div', { class: 'hq-dict__row' },
      el('label', { class: 'hq-dict__lbl' }, 'Send to'), dest, save));

  save.addEventListener('click', () => {
    const draft = makeDraft(field.value, dest.value);
    if (!draft) { field.focus(); return; }
    if (draft.destination === 'calendar') { openHqModal(calendarPanel(draft.text), 'Headquarters Calendar'); return; }
    try {
      const raw = localStorage.getItem(DRAFTS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.push(draft); localStorage.setItem(DRAFTS_KEY, JSON.stringify(arr));
    } catch { /* client-only; ignore */ }
    const label = DICTATION_DESTINATIONS.find((d) => d.id === draft.destination)?.label ?? draft.destination;
    wrap.replaceChildren(
      el('p', { class: 'hq-modal__eyebrow label' }, 'Dictation'),
      el('p', { class: 'hq-dict__done' }, `Saved to ${label}.`),
      el('p', { class: 'hq-dict__note' }, 'Held in the residence — kept for when this destination’s home is wired.'));
  });
  return wrap;
}

/** CALENDAR — a Headquarters service, home in the Executive Office, with a
    filtered view for whichever room it is opened from. Schedule → held client-side. */
function calendarPanel(prefill = ''): HTMLElement {
  const room = currentRoomId();
  const home = room === HOME_ROOM;
  const cats = home ? CALENDAR_CATEGORIES : categoriesForRoom(room);
  const active = new Set(cats.map((c) => c.id));
  const wrap = el('section', { class: 'hq-cal', 'aria-label': 'Headquarters Calendar' });
  const list = el('div', { class: 'hq-cal__list', 'aria-live': 'polite' });
  const chips = el('div', { class: 'hq-cal__filters', role: 'group', 'aria-label': 'Filter by category' });

  const labelOf = (id: string): string => CALENDAR_CATEGORIES.find((c) => c.id === id)?.label ?? id;

  const drawList = (): void => {
    const all = loadEvents();
    const scoped = home ? all : eventsForRoom(all, room);
    const shown = upcoming(scoped.filter((e) => active.has(e.category)), dayKey(), 40);
    list.replaceChildren();
    if (shown.length === 0) {
      list.append(el('p', { class: 'hq-cal__empty' },
        'Nothing scheduled yet. Add the first event below — it stays here in the residence.'));
      return;
    }
    for (const day of groupByDay(shown)) {
      const box = el('div', { class: 'hq-cal__day' }, el('p', { class: 'hq-cal__date' }, day.date));
      for (const e of day.events) {
        const ev = el('div', { class: 'hq-cal__event', 'data-cat': e.category },
          el('span', { class: 'hq-cal__cat' }, labelOf(e.category)),
          el('span', { class: 'hq-cal__title' }, e.title));
        if (e.note) ev.append(el('span', { class: 'hq-cal__evnote' }, e.note));
        box.append(ev);
      }
      list.append(box);
    }
  };

  const drawChips = (): void => {
    chips.replaceChildren();
    for (const c of cats) {
      const chip = el('button', { class: 'hq-chip hq-cal__chip', type: 'button', 'data-cat': c.id,
        'aria-pressed': active.has(c.id) ? 'true' : 'false' }, c.label);
      chip.addEventListener('click', () => {
        if (active.has(c.id)) active.delete(c.id); else active.add(c.id);
        chip.setAttribute('aria-pressed', active.has(c.id) ? 'true' : 'false');
        drawList();
      });
      chips.append(chip);
    }
  };

  // Scheduling workflow
  const title = el('input', { class: 'hq-cal__in', type: 'text', 'aria-label': 'Event', placeholder: 'What’s happening?' }) as HTMLInputElement;
  title.value = prefill;
  const date = el('input', { class: 'hq-cal__in', type: 'date', 'aria-label': 'Date' }) as HTMLInputElement;
  date.value = dayKey();
  const cat = el('select', { class: 'hq-cal__in', 'aria-label': 'Category' }) as HTMLSelectElement;
  for (const c of cats) cat.append(el('option', { value: c.id }, c.label));
  const add = el('button', { class: 'hq-action', type: 'button' }, 'Schedule');
  add.addEventListener('click', () => {
    const evt = makeEvent({ title: title.value, date: date.value, category: cat.value });
    if (!evt) { title.focus(); return; }
    const all = loadEvents(); all.push(evt); saveEvents(all);
    title.value = ''; active.add(evt.category);
    drawChips(); drawList();
  });

  wrap.append(
    el('p', { class: 'hq-modal__eyebrow label' }, home ? 'Headquarters Calendar · Executive Office' : `Calendar · ${getRoom(room)!.name}`),
    chips,
    list,
    el('div', { class: 'hq-cal__form' },
      el('p', { class: 'hq-cal__form-eyebrow label' }, 'Schedule'),
      el('div', { class: 'hq-cal__form-row' }, title),
      el('div', { class: 'hq-cal__form-row hq-cal__form-row--split' }, date, cat, add)),
  );
  drawChips(); drawList();
  return wrap;
}

/* --- Global Search (a House service; searches the archive) ----------------- */
function globalSearchPanel(): HTMLElement {
  const search = el('input', { class: 'hq-archive__search', type: 'search', enterkeyhint: 'search',
    'aria-label': 'Search the House', placeholder: 'Search the House…', autocomplete: 'off' }) as HTMLInputElement;
  const results = el('div', { class: 'hq-gsearch__results', 'aria-live': 'polite' },
    el('p', { class: 'hq-archive__empty' }, 'Loading the archive…'));
  let works: import('./adapters.ts').Submission[] | null = null;

  const draw = (): void => {
    const q = search.value.trim();
    results.replaceChildren();
    if (works === null) { results.append(el('p', { class: 'hq-archive__empty' }, 'The archive is offline just now.')); return; }
    if (!q) { results.append(el('p', { class: 'hq-archive__empty' }, 'Type a word to search the House’s work.')); return; }
    const tree = archiveTree(works, q, null);
    if (tree.total === 0) { results.append(el('p', { class: 'hq-archive__empty' }, 'Nothing matches yet — try another word.')); return; }
    const list = el('ul', { class: 'hq-gsearch__list' });
    for (const cat of tree.categories) for (const g of cat.groups) for (const e of g.entries) {
      const a = el('li', { class: 'hq-gsearch__hit' },
        el('span', { class: 'hq-gsearch__crumb' }, `${cat.label} · ${g.label}`),
        el('span', { class: 'hq-gsearch__name' }, e.name));
      if (e.summary) a.append(el('span', { class: 'hq-gsearch__desc' }, e.summary));
      list.append(a);
    }
    results.append(el('p', { class: 'hq-archive__count' }, `${tree.total} result${tree.total === 1 ? '' : 's'}`), list);
  };

  let t = 0;
  search.addEventListener('input', () => { window.clearTimeout(t); t = window.setTimeout(draw, 120); });
  void fetchInbox('published').then((res) => { works = res.ok ? res.data.submissions : null; draw(); });

  return el('section', { class: 'hq-gsearch', 'aria-label': 'Global search' },
    el('p', { class: 'hq-modal__eyebrow label' }, 'Search the House'),
    el('div', { class: 'hq-archive__searchwrap' },
      el('span', { class: 'hq-archive__search-ico', 'aria-hidden': 'true' }, '⌕'), search),
    results);
}

/* --- Notifications — an honest placeholder (no counts, no fabricated activity) - */
function notificationsPanel(): HTMLElement {
  return el('section', { class: 'hq-notes', 'aria-label': 'Notifications' },
    el('p', { class: 'hq-modal__eyebrow label' }, 'Notifications'),
    el('p', { class: 'hq-notes__empty' }, 'Nothing needs you right now.'),
    el('p', { class: 'hq-notes__note' },
      'When the House has something to surface, it will appear here — quietly, and never as a red badge. (Not yet connected.)'));
}

/* --- Room-specific Quick Actions — each routes into a real House service ----- */
interface QuickAction { label: string; run: () => void; soon?: boolean; }
function quickActions(room: RoomId): QuickAction[] {
  const dictate = (): void => openHqModal(dictationPanel(), 'Dictation');
  const schedule = (): void => openHqModal(calendarPanel(), 'Headquarters Calendar');
  const search = (): void => openHqModal(globalSearchPanel(), 'Search the House');
  const go = (route: string) => (): void => { closeHqModal(); location.hash = route; };
  const common: Record<RoomId, QuickAction[]> = {
    executive: [{ label: 'Open the Chief of Staff', run: go('#/chief-of-staff') }, { label: 'Dictate', run: dictate }, { label: 'Schedule', run: schedule }, { label: 'Search', run: search }],
    operations: [{ label: 'Dictate Observation', run: dictate }, { label: 'Schedule Follow-up', run: schedule }, { label: 'Open Founder’s Desk', run: go('#/executive/desk') }, { label: 'Search', run: search }],
    creative: [{ label: 'Dictate', run: dictate }, { label: 'Open Archive', run: go('#/creative') }, { label: 'Schedule Creative Time', run: schedule }, { label: 'Search', run: search }],
    production: [{ label: 'Dictate Production Note', run: dictate }, { label: 'Schedule Session', run: schedule }, { label: 'Open Calendar', run: schedule }, { label: 'Search', run: search }],
    growth: [{ label: 'Dictate Idea', run: dictate }, { label: 'Schedule Conversation', run: schedule }, { label: 'Open Calendar', run: schedule }, { label: 'Search', run: search }],
    business: [{ label: 'Dictate Note', run: dictate }, { label: 'Schedule Follow-up', run: schedule }, { label: 'Open Archive', run: go('#/creative') }, { label: 'Search', run: search }],
  };
  // Atmosphere is available house-wide via Quick Actions (an existing mechanism —
  // the House Toolbar itself is unchanged), so any room's soundtrack is one tap away.
  const base = common[room] ?? common.executive;
  return [...base, { label: 'Atmosphere', run: openAtmosphere }];
}
function quickActionsPanel(): HTMLElement {
  const room = currentRoomId();
  const panel = el('section', { class: 'hq-qa', 'aria-label': 'Quick actions' },
    el('p', { class: 'hq-modal__eyebrow label' }, `Quick actions · ${getRoom(room)!.name}`));
  const grid = el('div', { class: 'hq-qa__grid' });
  for (const a of quickActions(room)) {
    const btn = el('button', { class: 'hq-qa__btn', type: 'button' }, a.label);
    if (a.soon) btn.append(el('span', { class: 'hq-qa__soon' }, 'not yet connected'));
    btn.addEventListener('click', a.run);
    grid.append(btn);
  }
  panel.append(grid);
  return panel;
}

/**
 * THE HOUSE TOOLBAR — one Headquarters-wide bar of House SERVICES, now seated
 * along the TOP of the residence (Sprint 10). Same services, routes, labels, and
 * behaviour — a visual repositioning only. Chief of Staff · Search · Dictate ·
 * Calendar · Notifications · Actions at the left; the Founder identity (display
 * only) at the right. iPad-first labels; icon-only on phone; keyboard-reachable.
 */
function mountHouseToolbar(): void {
  if (document.querySelector('.hq-bar')) return;
  const svc = (label: string, glyph: string, open: () => void, aria = label): HTMLButtonElement => {
    const b = el('button', { class: 'hq-bar__btn', type: 'button', 'aria-label': aria }) as HTMLButtonElement;
    b.innerHTML = `<span class="hq-bar__ico" aria-hidden="true">${glyph}</span><span class="hq-bar__lbl">${label}</span>`;
    b.addEventListener('click', open);
    return b;
  };
  const services = el('div', { class: 'hq-bar__services', role: 'group', 'aria-label': 'House services' },
    // The Office of the Chief of Staff — the founder's operational workspace,
    // reached from here rather than being a room in the residence. It navigates
    // (a full surface) instead of opening a modal like the other services.
    svc('Chief of Staff', ICON_COS, () => { closeHqModal(); location.hash = COS_ROUTE; },
      'Open the Office of the Chief of Staff'),
    svc('Search', ICON_SEARCH, () => openHqModal(globalSearchPanel(), 'Search the House')),
    svc('Dictate', ICON_MIC, () => openHqModal(dictationPanel(), 'Dictation')),
    svc('Calendar', ICON_CAL, () => openHqModal(calendarPanel(), 'Headquarters Calendar')),
    svc('Notifications', ICON_BELL, () => openHqModal(notificationsPanel(), 'Notifications')),
    svc('Actions', ICON_STAR, () => openHqModal(quickActionsPanel(), 'Quick actions')),
  );

  // The Founder identity — display only, no account management. A restrained
  // name/role with a small brass monogram crest (decorative).
  const crest = FOUNDER_IDENTITY.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const identity = el('div', { class: 'hq-bar__identity' },
    el('span', { class: 'hq-bar__id-text' },
      el('span', { class: 'hq-bar__id-name' }, FOUNDER_IDENTITY.name),
      el('span', { class: 'hq-bar__id-sep', 'aria-hidden': 'true' }, '·'),
      el('span', { class: 'hq-bar__id-role' }, FOUNDER_IDENTITY.role)),
    el('span', { class: 'hq-bar__id-crest', 'aria-hidden': 'true' }, crest),
  );

  const bar = el('nav', { class: 'hq-bar', 'aria-label': 'Headquarters' }, services, identity);
  document.body.append(bar);
  document.body.classList.add('hq-has-topbar');   // clear + retire the static masthead
}

/** The Soundscape pill — a separate, always-present control at the bottom-right
    that opens the room-soundtrack preference model (the same Atmosphere panel;
    no playback/OAuth/streaming). A real, accessible button; never baked into the
    scene. Also reachable from the Atmosphere card and Quick Actions. */
function mountSoundscapePill(): void {
  if (document.querySelector('.hq-soundscape')) return;
  const pill = el('button', { class: 'hq-soundscape', type: 'button',
    'aria-label': 'Soundscape — choose room soundtracks' }) as HTMLButtonElement;
  pill.innerHTML = `<span class="hq-soundscape__ico" aria-hidden="true">${ICON_NOTE}</span><span class="hq-soundscape__lbl">Soundscape</span>`;
  pill.addEventListener('click', openAtmosphere);
  document.body.append(pill);
}

const ICON_NOTE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>`;

const ICON_COS = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3.5h6v2.5H9z"/><path d="M8.5 11h7M8.5 15h4.5"/></svg>`;
const ICON_SEARCH = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>`;
const ICON_MIC = MIC_SVG;
const ICON_CAL = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9h17M8 3v4M16 3v4"/></svg>`;
const ICON_BELL = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>`;
const ICON_STAR = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 4l2.2 4.9L19.5 9l-4 3.6 1.1 5.4L12 15.8 7.4 18l1.1-5.4-4-3.6 5.3-.1z"/></svg>`;

function boot(): void {
  setTimeOfDay();
  ensureAtmosphere();
  mountHouseToolbar();
  mountSoundscapePill();
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
export { renderScene, renderSeated, renderOperations, renderCreative, renderProduction, renderGrowth, renderBusiness, renderChiefOfStaff, renderError, renderAccessDenied };
export type { Room, RoomId };
