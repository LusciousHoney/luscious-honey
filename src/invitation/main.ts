/* =============================================================================
   THE FOUNDING STEWARD INVITATION — entry for /invitation/.
   An isolated, single-path editorial experience: Welcome → Open Your Invitation
   → the approved proposal → I'm Ready to Begin → Welcome to the House → Your
   Workspace Is Taking Shape. It imports the locked design system but inherits no
   Headquarters rail, room router, toolbar, or application chrome. One idea and
   one primary action per screen; the House never rushes.
   ============================================================================= */

import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/responsive.css';
import '../styles/invitation.css';

import { renderProposal } from './render.js';

type ViewOk = { ok: true; recipientName: string; proposal: string; status: 'open' | 'accepted' };
type ViewResult = ViewOk | { ok: false };

const root = document.getElementById('invitation') as HTMLElement;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(c);
  return node;
}

/** Read the private token from the URL fragment. The token is the private link
    itself, so it is kept in the fragment (never a query parameter): a refresh can
    re-resolve it and restore the accepted closing state instead of the neutral
    page, and the fragment is never sent in a request URL or a Referer header. */
function takeToken(): string {
  return location.hash.replace(/^#\/?/, '').trim();
}

async function postJSON(url: string, token: string): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}

/* --- Screen scaffolding ---------------------------------------------------- */

let current: HTMLElement | null = null;

function mount(section: HTMLElement, focusTarget?: HTMLElement): void {
  const prev = current;
  root.append(section);
  // Force a frame so the incoming section can transition in.
  requestAnimationFrame(() => {
    section.classList.add('is-active');
    if (prev) {
      prev.classList.remove('is-active');
      prev.addEventListener('transitionend', () => prev.remove(), { once: true });
      // Fallback removal in case transitionend does not fire (reduced motion).
      setTimeout(() => prev.remove(), 900);
    }
    (focusTarget ?? section.querySelector<HTMLElement>('h1, h2, [tabindex]') ?? section)?.focus();
  });
  current = section;
}

function screen(cls: string): HTMLElement {
  return el('section', { class: `inv-screen ${cls}`, tabindex: '-1' });
}

function eyebrow(text: string): HTMLElement {
  return el('p', { class: 'inv-eyebrow label' }, text);
}

function primaryAction(label: string, onActivate: () => void): HTMLButtonElement {
  const btn = el('button', { class: 'inv-action', type: 'button' }, label);
  btn.addEventListener('click', onActivate);
  return btn;
}

/* --- The screens ----------------------------------------------------------- */

function neutralScreen(): HTMLElement {
  const s = screen('inv-neutral');
  s.append(
    el('div', { class: 'inv-frame' },
      eyebrow('The Luscious Honey Collective'),
      el('h1', { class: 'inv-quiet', tabindex: '-1' }, 'This page is resting.'),
      el('p', { class: 'inv-lede' }, 'If you were expecting something here, the link may be incomplete. There is nothing you need to do.'),
    ),
  );
  return s;
}

function welcomeScreen(recipientName: string, onOpen: () => void): HTMLElement {
  const s = screen('inv-welcome');
  s.append(
    el('div', { class: 'inv-frame' },
      eyebrow('A private invitation'),
      el('h1', { class: 'inv-display', tabindex: '-1' }, recipientName + ','),
      el('p', { class: 'inv-lede' }, 'A letter has been written for you.'),
      primaryAction('Open Your Invitation', onOpen),
    ),
  );
  return s;
}

function acceptingState(beginButton: HTMLButtonElement): void {
  beginButton.disabled = true;
  beginButton.textContent = 'One moment…';
  beginButton.classList.add('is-working');
}

function welcomeToHouseScreen(onSettle: () => void): HTMLElement {
  const s = screen('inv-house');
  s.append(
    el('div', { class: 'inv-frame' },
      eyebrow('The Luscious Honey Collective'),
      el('h1', { class: 'inv-display', tabindex: '-1' }, 'Welcome to the House.'),
      el('p', { class: 'inv-lede' }, 'You are received. There is nothing more to sign, and nothing to hurry.'),
    ),
  );
  // The arrival settles, unhurried, into the closing screen.
  setTimeout(onSettle, 4200);
  return s;
}

function takingShapeScreen(): HTMLElement {
  const s = screen('inv-shape');
  s.append(
    el('div', { class: 'inv-frame' },
      el('div', { class: 'inv-ember', 'aria-hidden': 'true' }),
      el('h1', { class: 'inv-display', tabindex: '-1' }, 'Your workspace is taking shape.'),
      el('p', { class: 'inv-lede' }, 'A place is being prepared for you. When it is ready, we will begin it together.'),
    ),
  );
  return s;
}

/* --- Flow ------------------------------------------------------------------ */

function runAcceptance(beginButton: HTMLButtonElement, token: string): void {
  acceptingState(beginButton);
  postJSON('/api/invitation/accept', token)
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (res.ok && data && data.ok) {
        goToClosing();
        return;
      }
      throw new Error((data && data.error) || 'not stored');
    })
    .catch(() => {
      // Keep DaVonna's place; never imply success. Offer a warm retry.
      beginButton.disabled = false;
      beginButton.classList.remove('is-working');
      beginButton.textContent = 'Try Again';
      const holder = beginButton.parentElement!;
      if (!holder.querySelector('.inv-retry')) {
        holder.prepend(el('p', { class: 'inv-retry', role: 'status' },
          'We could not record your response just yet. Your place is kept — please try again in a moment.'));
      }
    });
}

function goToClosing(): void {
  mount(welcomeToHouseScreen(() => mount(takingShapeScreen())));
}

function start(recipientName: string, proposalMarkdown: string, token: string): void {
  const begin = () => {
    // Build the proposal screen with a Begin action wired to acceptance.
    const btn = primaryAction("I'm Ready to Begin", () => {});
    const proposal = proposalScreenWithButton(recipientName, proposalMarkdown, btn);
    btn.addEventListener('click', () => runAcceptance(btn, token));
    mount(proposal);
  };
  mount(welcomeScreen(recipientName, begin));
}

/** Proposal screen variant that accepts a pre-built Begin button. */
function proposalScreenWithButton(recipientName: string, proposalMarkdown: string, btn: HTMLButtonElement): HTMLElement {
  const s = screen('inv-proposal inv-open');
  const article = el('article', { class: 'inv-letter plate' });
  article.innerHTML = renderProposal(proposalMarkdown);
  s.append(
    el('div', { class: 'inv-frame inv-reading' },
      el('h1', { class: 'inv-sr-only', tabindex: '-1' }, `An invitation for ${recipientName}`),
      article,
      el('div', { class: 'inv-begin' }, btn),
    ),
  );
  return s;
}

async function boot(): Promise<void> {
  const token = takeToken();
  if (!token) { mount(neutralScreen()); return; }

  let result: ViewResult;
  try {
    const res = await postJSON('/api/invitation/view', token);
    result = await res.json();
  } catch {
    result = { ok: false };
  }

  if (!result.ok) { mount(neutralScreen()); return; }

  // A refresh after acceptance resolves straight to the closing state.
  if (result.status === 'accepted') { goToClosing(); return; }

  start(result.recipientName, result.proposal, token);
}

boot();
