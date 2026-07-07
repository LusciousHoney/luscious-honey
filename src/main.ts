/* =============================================================================
   RECEPTION — entry for / (index.html).
   Wires: Living Clock greeting, the Spine Reveal arrival, the corridor spine,
   and the House Journal card at the desk. Everything degrades to the static
   HTML already in the document; JS only enhances.
   ============================================================================= */

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/reception.css';
import './styles/responsive.css';

import { currentClockState, applyClock } from './lib/living-clock';
import { runArrival, enableSkip } from './lib/arrival';
import { initCorridor } from './lib/corridor';
import { latestJournal, formatHouseDate, currentRecording } from './lib/content';

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function boot(): void {
  // --- Living Clock: atmosphere + time-aware greeting ---------------------
  const clock = currentClockState();
  applyClock(clock);
  const greeting = byId('greeting');
  if (greeting) greeting.textContent = clock.greeting;
  const clockLabel = byId('clock-label');
  if (clockLabel) clockLabel.textContent = clock.label;

  // --- House Journal card (real latest dated entry; last one stays) --------
  const entry = latestJournal();
  if (entry) {
    const body = byId('journal-body');
    if (body) body.textContent = entry.body;
    const date = byId('journal-date');
    if (date) {
      date.textContent = formatHouseDate(entry.date);
      date.setAttribute('datetime', entry.date);
    }
    const flag = byId('journal-fixture');
    if (flag) flag.hidden = !entry.fixture;
  }

  // --- Productions: the Brass Studio Lamp (truthful Now-Recording signal) --
  const rec = currentRecording();
  const lamp = byId('productions-lamp');
  if (lamp) lamp.dataset.active = String(rec.active);
  const recState = byId('productions-state');
  if (recState) {
    recState.textContent = rec.active && rec.detail
      ? `Recording now — ${rec.detail}`
      : rec.label;
  }
  const prodDoor = byId('productions-door');
  if (prodDoor) prodDoor.classList.toggle('door--live', rec.active);

  // --- The Long Corridor (spatial or Indexed Spine) -----------------------
  const spine = byId('spine');
  if (spine) initCorridor(spine);

  // --- Arrival: the Spine Reveal ------------------------------------------
  const scene = byId('arrival');
  if (scene) {
    enableSkip(scene);
    runArrival({ root: scene });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
