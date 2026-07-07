/* =============================================================================
   ARRIVAL — The Spine Reveal. Sprint 04 · Frame 02 + Part V.
   First visit: emerge from dark, forward dolly down the spine, HARD 5s ceiling.
   Returning: no light-up; desk + Journal settle in (<=600ms).
   Reduced motion: land lit at the desk instantly.
   ============================================================================= */

import { getVisitor, markVisited, type Visitor } from './visitor-state';
import { prefersReducedMotion, prefersLightweight } from './motion';

export interface ArrivalOptions {
  root: HTMLElement;      // the arrival scene container
  onComplete?: () => void;
}

/**
 * Drives the arrival by setting a single data attribute the CSS animates
 * against. Keeping the choreography in CSS keeps JS lean and lets reduced
 * motion resolve purely by media query.
 */
export function runArrival({ root, onComplete }: ArrivalOptions): Visitor {
  const visitor = getVisitor();
  const reduced = prefersReducedMotion();
  const lightweight = prefersLightweight();

  // Announce state to CSS: [data-arrival="first|returning"] and modifiers.
  root.dataset.arrival = visitor;
  if (reduced) root.dataset.reduced = 'true';
  if (lightweight) root.dataset.lightweight = 'true';

  // The reveal is either the full 4.5s first-light-up, or instant.
  const instant = reduced || visitor === 'returning';
  const duration = instant ? 0 : 4500; // never exceed the 5s ceiling

  // Kick the transition on the next frame so the initial (dark) state paints.
  requestAnimationFrame(() => {
    root.dataset.lit = 'true';
  });

  window.setTimeout(() => {
    root.dataset.arrivalDone = 'true';
    markVisited();
    onComplete?.();
  }, duration);

  return visitor;
}

/** Let the visitor skip the light-up (Escape or click); jumps straight to lit. */
export function enableSkip(root: HTMLElement): void {
  const skip = () => {
    root.dataset.lit = 'true';
    root.dataset.arrivalDone = 'true';
  };
  root.addEventListener('click', skip, { once: true });
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') skip();
    },
    { once: true },
  );
}
