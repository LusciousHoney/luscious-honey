/* =============================================================================
   THE SCENE ASSET — the Headquarters artwork as a REPLACEABLE asset (Sprint 10).

   The residence's scenery is the emotional focal point, and it is meant to be
   swapped for approved production artwork without touching render code, CSS, or
   markup. A Scene Asset is pure data: where the image derivatives live, which
   formats/widths exist, the portrait (mobile) crop, and the focal point. To
   install new artwork, drop the derivatives into public/headquarters/scene/ and
   point CURRENT_SCENE at them (or add a SceneAsset and select it) — nothing else
   changes. The image itself stays decorative (alt="", aria-hidden): the room
   reads completely without it.
   ============================================================================= */

export type SceneFormat = 'avif' | 'webp' | 'jpg';

export interface SceneAsset {
  /** Stable id (future scene picker / per-room scenes). */
  id: string;
  /** Human label for a future selector. */
  name: string;
  /** Directory the derivatives live in (absolute, from web root). */
  base: string;
  /** Filename stem for the landscape derivatives, e.g. 'exec' → exec-1024.avif. */
  slug: string;
  /** Landscape widths available, ascending, e.g. [1024, 1400]. */
  widths: number[];
  /** Formats available for each width, best-first (avif → webp → jpg). */
  formats: SceneFormat[];
  /** Portrait crop stem for <= `mobileMaxWidth`, e.g. 'exec-mobile'. */
  mobileSlug: string;
  /** The breakpoint (px) below which the portrait crop is served. */
  mobileMaxWidth: number;
  /** object-position for the landscape crop, e.g. '50% 38%' (CSS var value). */
  focal: string;
}

/** The current, TEMPORARY scene. Swapped by editing this one object — the prior
    `exec-*` derivatives remain in public/headquarters/scene/ for an instant
    rollback (set slug/mobileSlug back to 'exec'/'exec-mobile'). */
export const CURRENT_SCENE: SceneAsset = {
  id: 'executive-ocean',
  name: 'Executive Office — Laguna ocean view (interface-free)',
  base: '/headquarters/scene',
  slug: 'ocean',
  widths: [1024, 1400],
  formats: ['avif', 'webp', 'jpg'],
  mobileSlug: 'ocean-mobile',
  mobileMaxWidth: 900,
  focal: '50% 72%',
};

/** The landscape `srcset` for one format, e.g. '…/exec-1024.avif 1024w, …'. */
export function sceneSrcset(a: SceneAsset, format: SceneFormat): string {
  return a.widths.map((w) => `${a.base}/${a.slug}-${w}.${format} ${w}w`).join(', ');
}

/** The largest JPEG — the universal `src` fallback. */
export function sceneFallbackSrc(a: SceneAsset): string {
  return `${a.base}/${a.slug}-${a.widths[a.widths.length - 1]}.jpg`;
}

/**
 * Build the responsive <picture> markup for a Scene Asset. Portrait crop below
 * `mobileMaxWidth`; width-responsive landscape above it. AVIF → WebP → JPEG.
 * Decorative and deferred: never blocks or shifts layout (it fills the fixed
 * `.hq-atmos__art` box). Returns an HTML string (assigned to innerHTML by the
 * caller, exactly as the previous inline markup was).
 */
export function scenePictureHTML(a: SceneAsset): string {
  const mq = `(max-width: ${a.mobileMaxWidth}px)`;
  const mobile = a.formats
    .map((f) => `    <source media="${mq}" ${f === 'jpg' ? '' : `type="image/${f}" `}srcset="${a.base}/${a.mobileSlug}.${f}">`)
    .join('\n');
  const landscape = a.formats
    .filter((f) => f !== 'jpg')
    .map((f) => `    <source type="image/${f}" srcset="${sceneSrcset(a, f)}" sizes="100vw">`)
    .join('\n');
  return `
  <picture>
${mobile}
${landscape}
    <img class="hq-atmos__art-img" alt="" aria-hidden="true" loading="eager" decoding="async"
         src="${sceneFallbackSrc(a)}"
         srcset="${sceneSrcset(a, 'jpg')}" sizes="100vw">
  </picture>`;
}
