/* =============================================================================
   PUBLISHING WING — entry for /publishing (publishing.html).
   Renders the shelf of works, the House Journal card, and the Writing Wall.
   ============================================================================= */

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/publishing.css';
import './styles/responsive.css';

import { currentClockState, applyClock } from './lib/living-clock';
import { works, latestJournal, activeFragment, formatHouseDate as fmtDate, type Work } from './lib/content';

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
        <span class="fixture-flag">Fixture</span>
      </p>
      ${media}
      <h3 class="workcard__title">${work.title}</h3>
      ${work.dek ? `<p class="workcard__dek">${work.dek}</p>` : ''}
      <p class="metaline"><span class="meta">Read →</span></p>
    </a>`;
}

function boot(): void {
  applyClock(currentClockState());

  // Shelf of works — featured first, then the rest.
  const list = document.getElementById('work-list');
  if (list) {
    const ordered = [...works].sort((a, b) => Number(b.featured) - Number(a.featured));
    list.innerHTML = ordered.length
      ? ordered.map(workCard).join('')
      : `<p class="empty-state">The studio is dark tonight. Nothing is published yet.</p>`;
  }

  // House Journal card (latest dated entry; the last one stays if none new).
  const entry = latestJournal();
  if (entry) {
    const body = document.getElementById('journal-body');
    if (body) body.textContent = entry.body;
    const date = document.getElementById('journal-date');
    if (date) {
      date.textContent = fmtDate(entry.date);
      date.setAttribute('datetime', entry.date);
    }
  }

  // Writing Wall — one active fragment; unattributed.
  const frag = activeFragment();
  const fragEl = document.getElementById('fragment');
  if (frag && fragEl) fragEl.textContent = frag.text;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
