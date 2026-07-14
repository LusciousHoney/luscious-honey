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
function ensureAtmosphere(): void {
  if (document.querySelector('.hq-atmos')) return;
  const atmos = el('div', { class: 'hq-atmos', 'aria-hidden': 'true' });
  atmos.append(
    // The CSS-rendered environment (the default today): sky, light, floor, foliage.
    el('div', { class: 'hq-atmos__sky' }),
    el('div', { class: 'hq-atmos__sun' }),
    el('div', { class: 'hq-atmos__floor' }),
    el('div', { class: 'hq-atmos__foliage' }),
    // Rendering seam for FUTURE architectural artwork. Both layers are inert
    // until a later milestone defines the scene-asset tokens in CSS: `__art`
    // holds the per-time-of-day scene image (none today → the CSS environment
    // above shows through), and `__tint` carries the time-of-day light *over*
    // the artwork. No navigation, interaction, or state depends on them; they
    // are purely decorative and covered by the `.hq-atmos` aria-hidden.
    el('div', { class: 'hq-atmos__art' }),
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
      ),
      el(
        'nav',
        { class: 'hq-wings', 'aria-label': 'The wings of the residence' },
        wings,
      ),
    ),
  );

  root.replaceChildren(scene);
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
  if (room.kind === 'atrium') renderScene(root);
  else renderSeated(root, room);

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
export { renderScene, renderSeated, renderError, renderAccessDenied };
export type { Room, RoomId };
