/* =============================================================================
   PUBLISHING WING — entry for /publishing (publishing.html).
   Renders the shelf of published works, the House Journal card (Living-Clock
   aware), the Writing Wall (one curated fragment, or rests), and the Single
   Held Frame. All content is governed: only what a human has published shows.
   ============================================================================= */

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/publishing.css';
import './styles/responsive.css';

import { currentClockState, applyClock } from './lib/living-clock';
import {
  publishedWorks, latestJournal, activeFragment, currentHeldFrame,
  formatHouseDate as fmtDate, houseTimestamp,
  type Work, type HeldFrame,
} from './lib/content';

// Fixture chips render in development only. `import.meta.env.DEV` is statically
// false in the production build, so these strings are dead-code-eliminated.
const fixtureFlag = (on?: boolean, text = 'Fixture'): string => {
  if (!import.meta.env.DEV || !on) return '';
  return `<span class="fixture-flag">${text}</span>`;
};

function workCard(work: Work): string {
  const media = work.media
    ? `<figure class="workcard__media media-slot" style="--slot-aspect: ${work.media.aspect}">
         <figcaption class="media-slot__label">Media slot · ${work.media.id}<br>${work.media.aspect} · poster-first</figcaption>
       </figure>`
    : '';
  return `
    <a class="workcard plate" href="/reader.html?work=${encodeURIComponent(work.slug)}"
       aria-label="${work.title} — ${work.medium}">
      <p class="metaline">
        <span class="label">${work.medium}</span>
        <span class="meta">${fmtDate(work.date)}</span>
        ${fixtureFlag(work.fixture)}
      </p>
      ${media}
      <h3 class="workcard__title">${work.title}</h3>
      ${work.dek ? `<p class="workcard__dek">${work.dek}</p>` : ''}
      <p class="metaline"><span class="meta">Read →</span></p>
    </a>`;
}

/** The Single Held Frame: poster-first, muted, real-shot-only. */
function heldFrameFigure(frame: HeldFrame): string {
  const m = frame.media;
  const poster = m.poster
    ? `<img class="held-frame__img" src="${m.poster}" alt="${m.alt}"
           width="1600" height="900" loading="lazy" decoding="async" />`
    : `<div class="media-slot" style="--slot-aspect:${m.aspect}">
         <span class="media-slot__label">Held frame slot · ${m.id}<br>${m.aspect} · poster-first</span>
       </div>`;
  return `
    <figcaption class="held-frame__cap metaline">
      <span class="label">The Held Frame</span>
      <span class="meta">Week ${frame.week}</span>
      ${fixtureFlag(frame.fixture)}
    </figcaption>
    <div class="media-frame held-frame__media" style="aspect-ratio:${m.aspect}">
      ${poster}
    </div>
    ${m.caption ? `<p class="held-frame__note meta">${m.caption}</p>` : ''}`;
}

function boot(): void {
  // --- Living Clock: atmosphere + time context on the Front Desk ----------
  const clock = currentClockState();
  applyClock(clock);
  const clockEl = document.getElementById('journal-clock');
  if (clockEl) clockEl.textContent = `The desk · ${clock.label}`;

  // --- Shelf of published works -------------------------------------------
  const list = document.getElementById('work-list');
  if (list) {
    const works = publishedWorks();
    list.innerHTML = works.length
      ? works.map(workCard).join('')
      : `<p class="empty-state">The studio is quiet. Nothing is published yet.</p>`;
  }

  // --- House Journal card (latest published; the last one stays) ----------
  const entry = latestJournal();
  const journalEl = document.getElementById('journal');
  if (entry) {
    const body = document.getElementById('journal-body');
    if (body) body.textContent = entry.body;
    const date = document.getElementById('journal-date');
    if (date) {
      const ts = houseTimestamp(entry.date);
      date.innerHTML = ts.timeLine ? `${ts.dateLine}<br>${ts.timeLine}` : ts.dateLine;
      date.setAttribute('datetime', entry.date);
    }
    if (import.meta.env.DEV && entry.fixture) {
      document.getElementById('wing-journal-heading')
        ?.insertAdjacentHTML('beforeend', ' <span class="fixture-flag">Fixture</span>');
    }
  } else if (journalEl) {
    journalEl.innerHTML =
      `<h2 class="label">The House Journal</h2>
       <p class="journal__body editorial">The desk is quiet this week.</p>`;
  }

  // --- Writing Wall — one curated fragment, or the wall rests -------------
  const frag = activeFragment();
  const fragEl = document.getElementById('fragment');
  const wallMark = document.getElementById('wall-mark');
  if (fragEl) {
    if (frag) {
      fragEl.textContent = frag.text;
      if (import.meta.env.DEV && frag.fixture) {
        wallMark?.insertAdjacentHTML('afterend', ' <span class="fixture-flag">Fixture</span>');
      }
    } else {
      fragEl.textContent = 'The wall is bare this week.';
      if (wallMark) wallMark.textContent = 'At rest';
    }
  }

  // --- The Single Held Frame — or it rests --------------------------------
  const held = currentHeldFrame();
  const heldEl = document.getElementById('held-frame');
  if (heldEl) {
    heldEl.innerHTML = held
      ? heldFrameFigure(held)
      : `<figcaption class="held-frame__cap"><span class="label">The Held Frame</span></figcaption>
         <p class="empty-state">No frame is held this week.</p>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
