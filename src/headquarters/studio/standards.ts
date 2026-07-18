/* =============================================================================
   HEADQUARTERS · STUDIO MODE — the Standards registry (architecture only).

   Standards is where an approved design decision becomes a codified rule the
   Headquarters consumes. This module is the pure REGISTRY seam: a typed shape for
   a standard and an append-only registry that starts EMPTY. No standards are
   defined yet (foundation only) — a future sprint appends entries as the Founder
   ratifies them, and the Headquarters reads them from here.

   Mirrors the House pattern (a registry is data, validated and derived — see
   executive-register.ts): the registry can only grow, entries are validated on
   read, and an empty registry is honest, not broken.
   ============================================================================= */

/** The domains a standard can govern. Extend as real standards are ratified. */
export type StandardCategory =
  | 'navigation'
  | 'cards'
  | 'controls'
  | 'typography'
  | 'motion'
  | 'layers'
  | 'notifications';

export interface DesignStandard {
  /** Stable slug. */
  id: string;
  category: StandardCategory;
  /** Short signage title. */
  title: string;
  /** The rule itself, in one plain sentence. */
  rule: string;
}

/**
 * The ratified standards. EMPTY in this sprint by design — Studio Mode ships the
 * registry, not its contents. A future sprint appends entries here.
 */
export const STANDARDS: DesignStandard[] = [];

/** Every standard in a category, in registry order. */
export function standardsIn(category: StandardCategory): DesignStandard[] {
  return STANDARDS.filter((s) => s.category === category);
}

/** How many standards are on record — the count the Standards section reads. */
export function standardsCount(): number {
  return STANDARDS.length;
}
