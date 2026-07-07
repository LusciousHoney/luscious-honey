/* =============================================================================
   MOTION helpers — reduced motion is a first-class path, not an afterthought.
   Sprint 04 · Part V: every meaningful sequence has a reduced-motion equivalent.
   ============================================================================= */

/** Live check — respects the OS setting and updates if the user changes it. */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Very rough low-power hint: little device memory or a slow connection means we
 * drop to the Indexed Spine and posters (Part V "Low-performance devices").
 */
export function prefersLightweight(): boolean {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  if (nav.connection?.saveData) return true;
  if (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) return true;
  const et = nav.connection?.effectiveType;
  if (et && /(^|\s)(slow-2g|2g)$/.test(et)) return true;
  return false;
}

/** Resolve after `ms`, but honour reduced motion by resolving immediately. */
export function settle(ms: number): Promise<void> {
  if (prefersReducedMotion()) return Promise.resolve();
  return new Promise((r) => setTimeout(r, ms));
}
