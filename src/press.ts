/* =============================================================================
   PRESS — entry for /press (press.html). A small Journal archive.
   Editorial, not bloggy: a dated ledger of the House Journal on a reading plate.
   Published entries only; drafts never appear (governance enforces this).
   ============================================================================= */

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/publishing.css';
import './styles/responsive.css';

import { currentClockState, applyClock } from './lib/living-clock';
import { journalArchive, houseTimestamp, type JournalEntry } from './lib/content';

function esc(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function entry(e: JournalEntry): string {
  const ts = houseTimestamp(e.date);
  return `
    <article class="archive__entry">
      <time class="meta archive__date" datetime="${e.date}">
        ${esc(ts.dateLine)} · week ${e.week}
        ${import.meta.env.DEV && e.fixture ? '<span class="fixture-flag">Fixture</span>' : ''}
        ${ts.timeLine ? `<br>${esc(ts.timeLine)}` : ''}
      </time>
      <p class="archive__body">${esc(e.body)}</p>
      <p class="archive__sign">— ${esc(e.signed)}</p>
    </article>`;
}

function boot(): void {
  applyClock(currentClockState());

  const el = document.getElementById('archive');
  if (!el) return;

  const entries = journalArchive(); // published only, newest first
  el.innerHTML = entries.length
    ? entries.map(entry).join('')
    : `<p class="empty-state">The desk is quiet. No entries have been published yet.</p>`;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
