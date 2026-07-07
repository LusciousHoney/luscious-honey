/* =============================================================================
   THE READER — entry for /reader (reader.html).
   Renders one work on a solid reading plate (AAA contrast). No next/prev, no
   grid — one work at a time. Body blocks render from the content model.
   ============================================================================= */

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/publishing.css';
import './styles/responsive.css';

import { getWork, works, formatHouseDate as fmtDate, type BodyBlock, type Work } from './lib/content';

function esc(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function block(b: BodyBlock): string {
  switch (b.type) {
    case 'h2': return `<h2>${esc(b.text)}</h2>`;
    case 'p': return `<p>${esc(b.text)}</p>`;
    case 'pull': return `<blockquote class="pull">${esc(b.text)}</blockquote>`;
    case 'note': return `<aside class="margin-note">${esc(b.text)}</aside>`;
    case 'qa':
      return `<div class="qa">
        <p class="qa__q">${esc(b.q)}</p>
        <p class="qa__a">${esc(b.a)}</p>
      </div>`;
  }
}

function render(work: Work): string {
  const media = work.media
    ? `<figure class="media-frame" style="aspect-ratio:${work.media.aspect}">
         <div class="media-slot" style="--slot-aspect:${work.media.aspect}">
           <span class="media-slot__label">Media slot · ${esc(work.media.id)}<br>${esc(work.media.aspect)} · poster-first, lazy</span>
         </div>
         ${work.media.caption ? `<figcaption>${esc(work.media.caption)}</figcaption>` : ''}
       </figure>`
    : '';

  return `
    <p class="reader__kicker metaline">
      <span class="label">${esc(work.medium)}</span>
      <span class="meta">${esc(fmtDate(work.date))}</span>
      <span class="fixture-flag">Temporary editorial fixture — not a published piece</span>
    </p>
    <h1 class="reader__title">${esc(work.title)}</h1>
    ${work.dek ? `<p class="reader__dek">${esc(work.dek)}</p>` : ''}
    <p class="reader__byline metaline">
      <span class="label">By ${esc(work.creator)}</span>
      <span class="meta">The House · Publishing</span>
    </p>
    ${media}
    <div class="reader__body">
      ${work.body.map(block).join('\n')}
    </div>`;
}

function boot(): void {
  const el = document.getElementById('reader');
  if (!el) return;

  const slug = new URLSearchParams(location.search).get('work') ?? works[0]?.slug;
  const work = slug ? getWork(slug) : undefined;

  if (!work) {
    el.innerHTML = `<p class="empty-state">That page isn’t on the shelf.
      <a href="/publishing.html">Return to the wing →</a></p>`;
    return;
  }

  document.title = `${work.title} — Luscious Honey Collective`;
  el.innerHTML = render(work);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
