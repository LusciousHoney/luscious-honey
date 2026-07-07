/* =============================================================================
   THE LONG CORRIDOR — the Dark Spine. Sprint 04 · Frame 03 + Part V/VI.
   Desktop: scroll walks you deeper — a slow forward dolly + gentle parallax on
   the door reveals; hover warms a door-pool. Reduced motion / low power / small
   screens: the Indexed Spine — a flat, keyboard-walkable list of doors, no
   camera move. Navigation is architecture; doors are real labelled links.
   ============================================================================= */

import { prefersReducedMotion, prefersLightweight } from './motion';

export function initCorridor(spine: HTMLElement): void {
  // Mobile (<640) is the directory by design (Part VI), independent of motion
  // preference. Reduced motion and low power also drop to the Indexed Spine.
  const isSmall = typeof matchMedia === 'function' && matchMedia('(max-width: 639.98px)').matches;
  const indexed = prefersReducedMotion() || prefersLightweight() || isSmall;
  spine.dataset.mode = indexed ? 'indexed' : 'spatial';
  if (indexed) return; // Indexed Spine is pure CSS/HTML; no scroll wiring.

  // Scroll-linked dolly: map scroll progress within the corridor to a depth
  // variable the CSS uses to push the spine forward and part the doors.
  const update = () => {
    const rect = spine.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    // progress 0 (corridor entering) → 1 (walked through)
    const total = rect.height + vh;
    const progress = clamp((vh - rect.top) / total, 0, 1);
    spine.style.setProperty('--depth', progress.toFixed(4));
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      update();
      ticking = false;
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
