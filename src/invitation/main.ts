/* =============================================================================
   THE FOUNDING STEWARD INVITATION — a guided, paced experience.
   Welcome → the letter revealed in a few unhurried movements → a considered
   decision (Accept · Some Time · Talk First · Decline) → the state that follows.
   Imports the locked design system; no Headquarters chrome. One idea per screen;
   the House never rushes. Personalization is atmospheric only (a per-recipient
   accent) — it never speaks in the Founder's voice.
   ============================================================================= */

import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/responsive.css';
import '../styles/invitation.css';

import { renderMovements } from './render.js';

type Persona = { accent: string };
type ViewOk = {
  ok: true; recipientName: string; proposal: string;
  phase: 'open' | 'accepted' | 'declined' | 'reminder' | 'conversation';
  personalization: Persona; reminder: { period: string; at?: string } | null;
};
type ViewResult = ViewOk | { ok: false };

const root = document.getElementById('invitation') as HTMLElement;
let TOKEN = '';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  for (const c of kids) n.append(c);
  return n;
}
const takeToken = () => location.hash.replace(/^#\/?/, '').trim();
const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const postJSON = (url: string, body: object) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

/* --- Screen scaffolding ----------------------------------------------------
   Exactly one screen is active at a time. The incoming screen fades in (double
   rAF so the browser paints opacity:0 before transitioning); any outgoing screens
   fade out and are removed on a fixed timer. Deterministic — no transitionend
   race, no stacking under quick taps. */
function mount(section: HTMLElement): void {
  const dying = Array.from(root.querySelectorAll<HTMLElement>('.inv-screen'));
  for (const s of dying) { s.classList.remove('is-active'); setTimeout(() => s.remove(), 900); }
  root.append(section);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    section.classList.add('is-active');
    (section.querySelector<HTMLElement>('h1, h2, [tabindex]') ?? section)?.focus();
  }));
}
const screen = (cls: string) => el('section', { class: `inv-screen ${cls}`, tabindex: '-1' });
const eyebrow = (t: string) => el('p', { class: 'inv-eyebrow label' }, t);
function action(label: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = el('button', { class: `inv-action ${cls}`, type: 'button' }, label);
  b.addEventListener('click', onClick);
  return b;
}
const frame = (...kids: (Node | string)[]) => el('div', { class: 'inv-frame' }, ...kids);

/* --- Simple screens -------------------------------------------------------- */
function neutralScreen() {
  return screen('inv-neutral').appendAnd(frame(
    eyebrow('The Luscious Honey Collective'),
    el('h1', { class: 'inv-quiet', tabindex: '-1' }, 'This page is resting.'),
    el('p', { class: 'inv-lede' }, 'If you were expecting something here, the link may be incomplete. There is nothing you need to do.'),
  ));
}
function welcomeScreen(name: string, onOpen: () => void) {
  return screen('inv-welcome').appendAnd(frame(
    eyebrow('A private invitation'),
    el('h1', { class: 'inv-display', tabindex: '-1' }, name + ','),
    el('p', { class: 'inv-lede' }, 'A letter has been written for you.'),
    action('Open Your Invitation', onOpen),
  ));
}

// appendAnd helper on HTMLElement
declare global { interface HTMLElement { appendAnd(...n: (Node | string)[]): HTMLElement; } }
HTMLElement.prototype.appendAnd = function (...n) { this.append(...n); return this; };

/* --- The letter, unfolding at a human, reading-paced tempo -----------------
   One movement at a time; its lines arrive progressively, timed to the act of
   reading rather than a fixed clock — a fast reader is never delayed, a slow
   reader never rushed. The whole screen is a quiet affordance: a tap, click,
   Space or Enter draws the rest of the current thought in at once, and once it
   has fully arrived, carries you gently onward. Nothing to hunt for. Under
   reduced-motion the whole movement is simply present, already at rest. */
const READ_WPMS = 2.7 / 1000;            // ~162 wpm — unhurried, reflective
const READ_MIN_MS = 700;
const READ_MAX_MS = 4800;
function readingPause(node: Element): number {
  if (node.tagName === 'HR') return 360;
  const words = (node.textContent || '').trim().split(/\s+/).filter(Boolean).length;
  if (!words) return 300;
  return Math.min(READ_MAX_MS, Math.max(READ_MIN_MS, words / READ_WPMS));
}

function movementScreen(name: string, movements: string[], i: number, onNext: () => void) {
  const s = screen('inv-proposal inv-open');
  const article = el('article', { class: 'inv-letter plate' });
  article.innerHTML = movements[i];
  const blocks = Array.from(article.children) as HTMLElement[];
  for (const b of blocks) b.classList.add('inv-block');

  const cueBtn = el('button', { class: 'inv-cue-btn', type: 'button' }, "When you're ready");
  s.append(el('div', { class: 'inv-frame inv-reading' },
    el('h1', { class: 'inv-sr-only', tabindex: '-1' }, `An invitation for ${name} — part ${i + 1} of ${movements.length}`),
    article,
    el('div', { class: 'inv-cue' }, cueBtn),
  ));

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let idx = 0;
  let timer = 0;
  let advanced = false;

  const showCue = (): void => { cueBtn.classList.add('is-shown'); };
  const revealAll = (): void => { while (idx < blocks.length) blocks[idx++].classList.add('is-revealed'); showCue(); };
  const step = (): void => {
    const node = blocks[idx++];
    node.classList.add('is-revealed');
    timer = window.setTimeout(idx < blocks.length ? step : showCue, readingPause(node));
  };

  const teardown = (): void => {
    if (timer) { clearTimeout(timer); timer = 0; }
    s.removeEventListener('click', onScreen);
    document.removeEventListener('keydown', onKey);
  };
  const goNext = (): void => { if (advanced) return; advanced = true; teardown(); onNext(); };
  const hasten = (): void => {
    if (idx < blocks.length) { if (timer) { clearTimeout(timer); timer = 0; } revealAll(); }
    else goNext();
  };
  // A click (not a scroll-drag — a scroll gesture never fires click) anywhere on
  // the screen quietly continues. Selections and controls are left alone.
  function onScreen(e: MouseEvent): void {
    const t = e.target as HTMLElement | null;
    if (t && t.closest('button, a')) return;              // the cue owns its own activation
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;                  // let a reader select / re-read freely
    hasten();
  }
  function onKey(e: KeyboardEvent): void {
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'Spacebar') { e.preventDefault(); hasten(); }
  }

  cueBtn.addEventListener('click', goNext);
  s.addEventListener('click', onScreen);
  document.addEventListener('keydown', onKey);

  if (reduce || !blocks.length) revealAll();
  else timer = window.setTimeout(step, 420);              // the first line, once the plate has settled
  return s;
}

/* --- The decision ---------------------------------------------------------- */
function decisionScreen(name: string) {
  const s = screen('inv-decision');
  s.append(frame(
    eyebrow('When you are ready'),
    el('h1', { class: 'inv-display', tabindex: '-1' }, 'How would you like to reply?'),
    el('p', { class: 'inv-lede' }, 'There is no wrong answer, and no hurry. Choose what is true for you.'),
    el('div', { class: 'inv-choices' },
      action('I Accept the Invitation', () => decide('accept'), 'inv-choice inv-choice--accept'),
      action("I'd Like Some Time", () => mount(timeScreen(name)), 'inv-choice'),
      action("Let's Talk Before I Decide", () => decide('talk'), 'inv-choice'),
      action('I Respectfully Decline', () => mount(declineConfirmScreen(name)), 'inv-choice inv-choice--quiet'),
    ),
  ));
  return s;
}

function timeScreen(name: string) {
  const s = screen('inv-sub');
  const periods = ['a few days', 'one week', 'two weeks'];
  s.append(frame(
    eyebrow('Take the time you need'),
    el('h1', { class: 'inv-quiet', tabindex: '-1' }, 'When shall the House check back?'),
    el('p', { class: 'inv-lede' }, 'The invitation will be held for you, exactly as it is.'),
    el('div', { class: 'inv-choices' },
      ...periods.map((p) => action(titleCase(p), () => decide('time', p), 'inv-choice')),
      action('Actually, take me back', () => mount(decisionScreen(name)), 'inv-choice inv-choice--quiet'),
    ),
  ));
  return s;
}

function declineConfirmScreen(name: string) {
  const s = screen('inv-sub');
  s.append(frame(
    eyebrow('Only if it is right for you'),
    el('h1', { class: 'inv-quiet', tabindex: '-1' }, 'Respectfully decline?'),
    el('p', { class: 'inv-lede' }, 'This closes the invitation gently. It changes nothing about the regard behind it.'),
    el('div', { class: 'inv-choices' },
      action('Yes, respectfully decline', () => decide('decline'), 'inv-choice inv-choice--quiet'),
      action('No, take me back', () => mount(decisionScreen(name)), 'inv-choice'),
    ),
  ));
  return s;
}

/* --- Outcome screens ------------------------------------------------------- */
function heldScreen(name: string, period?: string) {
  const s = screen('inv-held');
  s.append(frame(
    eyebrow('The House will wait'),
    el('h1', { class: 'inv-display', tabindex: '-1' }, 'It will keep.'),
    el('p', { class: 'inv-lede' }, period ? `We'll hold your invitation for ${period}. Come back whenever you're ready — there's no rush.` : "We'll hold your invitation. Come back whenever you're ready."),
    action("I'm ready to decide", () => mount(decisionScreen(name)), 'inv-quiet-action'),
  ));
  return s;
}
function waitingScreen() {
  return screen('inv-wait').appendAnd(frame(
    eyebrow('A conversation first'),
    el('h1', { class: 'inv-display', tabindex: '-1' }, "Let's talk soon."),
    el('p', { class: 'inv-lede' }, 'Luscious Honey has been let know. When you have spoken, return to this same link and your reply will be waiting.'),
  ));
}
function declinedScreen() {
  return screen('inv-declined').appendAnd(frame(
    eyebrow('With warmth'),
    el('h1', { class: 'inv-display', tabindex: '-1' }, 'Thank you for reading.'),
    el('p', { class: 'inv-lede' }, 'The invitation has closed, and the regard behind it has not. You are always welcome to the work.'),
  ));
}
function welcomeToHouseScreen(onSettle: () => void) {
  const s = screen('inv-house');
  s.append(frame(
    eyebrow('The Luscious Honey Collective'),
    el('h1', { class: 'inv-display', tabindex: '-1' }, 'Welcome to the House.'),
    el('p', { class: 'inv-lede' }, 'You are received. The next step is simply a conversation — we will shape what comes next together.'),
  ));
  setTimeout(onSettle, 4200);
  return s;
}
function takingShapeScreen() {
  return screen('inv-shape').appendAnd(frame(
    el('div', { class: 'inv-ember', 'aria-hidden': 'true' }),
    el('h1', { class: 'inv-display', tabindex: '-1' }, 'Something is taking shape.'),
    el('p', { class: 'inv-lede' }, 'When we have spoken and planned together, your place in the House will be made ready. Nothing is rushed.'),
  ));
}
const goClosing = () => mount(welcomeToHouseScreen(() => mount(takingShapeScreen())));

/* --- Decision submission --------------------------------------------------- */
let deciding = false;
function decide(choice: string, reminderPeriod?: string): void {
  if (deciding) return;
  deciding = true;
  const active = root.querySelector<HTMLElement>('.inv-screen.is-active');
  active?.classList.add('is-working');
  postJSON('/api/invitation/decision', { token: TOKEN, choice, reminderPeriod })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      deciding = false;
      active?.classList.remove('is-working');
      if (!res.ok || !data.ok) throw new Error(data.error || 'not stored');
      route(data.phase, data.reminder);
    })
    .catch(() => {
      deciding = false;
      active?.classList.remove('is-working');
      if (active && !active.querySelector('.inv-retry')) {
        (active.querySelector('.inv-frame') || active).append(
          el('p', { class: 'inv-retry', role: 'status' }, 'We could not record your reply just yet. Your place is kept — please try again in a moment.'));
      }
    });
}

/* --- Routing --------------------------------------------------------------- */
let RECIPIENT = '';
function route(phase: string, reminder?: { period?: string } | null): void {
  switch (phase) {
    case 'accepted': goClosing(); break;
    case 'declined': mount(declinedScreen()); break;
    case 'conversation': mount(waitingScreen()); break;
    case 'reminder': mount(heldScreen(RECIPIENT, reminder?.period)); break;
    default: mount(decisionScreen(RECIPIENT));
  }
}

function beginExperience(name: string, proposal: string): void {
  const movements = renderMovements(proposal);
  const showMovement = (i: number): void => {
    mount(movementScreen(name, movements, i, () => {
      if (i + 1 < movements.length) showMovement(i + 1);
      else mount(decisionScreen(name));
    }));
  };
  mount(welcomeScreen(name, () => showMovement(0)));
}

async function boot(): Promise<void> {
  TOKEN = takeToken();
  if (!TOKEN) { mount(neutralScreen()); return; }
  let result: ViewResult;
  try { result = await (await postJSON('/api/invitation/view', { token: TOKEN })).json(); }
  catch { result = { ok: false }; }
  if (!result.ok) { mount(neutralScreen()); return; }

  RECIPIENT = result.recipientName;
  if (result.personalization?.accent && result.personalization.accent !== 'house') {
    root.classList.add(`inv-accent-${result.personalization.accent}`);
  }
  if (result.phase === 'open') beginExperience(result.recipientName, result.proposal);
  else route(result.phase, result.reminder);
}

boot();
