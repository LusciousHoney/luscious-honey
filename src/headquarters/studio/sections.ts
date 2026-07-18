/* =============================================================================
   HEADQUARTERS · STUDIO MODE — section vocabulary + the Room-Preview seam.

   Studio Mode is one workspace inside the Headquarters (mounted by the residence
   router at `#/studio`, exactly as the Office of the Chief of Staff is mounted at
   `#/chief-of-staff`). This module owns the SECTION registry and the pure seam
   that ties Studio Mode back to the real Headquarters rooms; it renders nothing
   and touches no DOM, so it is fully unit-tested.

   Every section is a FOUNDATION PLACEHOLDER in this sprint — the frame, not a
   component library. Adding real design options later = populate a section; the
   registry and router need no change.
   ============================================================================= */

import { ROOMS, type RoomId } from '../rooms.ts';

export type StudioSectionId =
  | 'navigation'
  | 'cards'
  | 'controls'
  | 'typography'
  | 'motion'
  | 'layers'
  | 'notifications'
  | 'room-preview'
  | 'favorites'
  | 'standards';

export interface StudioSection {
  id: StudioSectionId;
  /** Short label for the section nav. */
  label: string;
  /** One quiet line naming what the section is for. */
  note: string;
}

/**
 * The Studio Mode sections, in navigation order. The first six are component
 * families; then Notifications (design of the House's quiet signals), Room
 * Preview (options seen over a real room scene), Favorites (approved options),
 * and Standards (the codified rules). All placeholders in this sprint.
 */
export const STUDIO_SECTIONS: StudioSection[] = [
  { id: 'navigation',   label: 'Navigation',   note: 'Wayfinding — menus, corridors, returns, the House Toolbar.' },
  { id: 'cards',        label: 'Cards',        note: 'Panels and plates that hold a single idea.' },
  { id: 'controls',     label: 'Controls',     note: 'Buttons, inputs, toggles — the working surfaces.' },
  { id: 'typography',   label: 'Typography',   note: 'Voice on the page — scale, rhythm, emphasis.' },
  { id: 'motion',       label: 'Motion',       note: 'How the interface arrives, settles, and responds.' },
  { id: 'layers',       label: 'Layers',       note: 'Depth and glass — what floats over what.' },
  { id: 'notifications',label: 'Notifications', note: 'The design of the House’s quiet signals — never a red badge.' },
  { id: 'room-preview', label: 'Room Preview', note: 'See a design option over a real Headquarters room scene.' },
  { id: 'favorites',    label: 'Favorites',    note: 'The shelf of approved options, collected as you go.' },
  { id: 'standards',    label: 'Standards',    note: 'The codified rules the Headquarters consumes.' },
];

/** The section a bare `#/studio` resolves to — the primary landing. */
export const STUDIO_HOME_SECTION: StudioSectionId = 'navigation';

const SECTION_IDS = new Set<StudioSectionId>(STUDIO_SECTIONS.map((s) => s.id));

/** Whether a string names a known section (used to validate the sub-route). */
export function isStudioSection(id: string | null | undefined): id is StudioSectionId {
  return !!id && SECTION_IDS.has(id as StudioSectionId);
}

/** Resolve a raw sub-route segment to a real section — unknown → home. */
export function sectionFromSegment(segment: string | null | undefined): StudioSectionId {
  return isStudioSection(segment) ? (segment as StudioSectionId) : STUDIO_HOME_SECTION;
}

const BY_ID = new Map(STUDIO_SECTIONS.map((s) => [s.id, s]));

/** A section by id, or undefined if unknown. */
export function getStudioSection(id: string): StudioSection | undefined {
  return BY_ID.get(id as StudioSectionId);
}

/* --- workspace copy (the residence idiom: eyebrow · title · lede) ---------- */

export const STUDIO_EYEBROW = 'Experimental · Headquarters';
export const STUDIO_TITLE = 'Studio Mode';
export const STUDIO_LEDE =
  'A private laboratory for exploring, comparing, and approving interface designs — evaluated in the context of the real Headquarters rooms. Headquarters is the product; this is a layer within it. Every section here is a prepared placeholder.';

/* --- the Room-Preview seam: Studio Mode ties back to the real rooms -------
   Requirement: future design options must be previewable directly over the
   existing room scenes. This is that seam. A "preview stage" is a REAL
   Headquarters room, derived from the one room registry (rooms.ts) — never a
   duplicate list — so Studio Mode can never drift from the residence. No option
   is overlaid yet; `DesignOptionOverlay` is the reserved shape a later sprint
   fills in, exactly as rooms.ts reserves its Presence Layer. */

export interface PreviewStage {
  roomId: RoomId;
  /** The room's institutional name. */
  name: string;
  /** The real room's deep-link hash route — where its scene actually lives. */
  route: string;
}

/**
 * The Headquarters rooms, as the stages a design option can be previewed over.
 * Derived from ROOMS so the stage list is always exactly the real residence.
 */
export function previewStages(): PreviewStage[] {
  return ROOMS.map((r) => ({ roomId: r.id, name: r.name, route: r.route }));
}

/**
 * Reserved seam for previewing a design option over a room scene. Intentionally
 * empty in this sprint (foundation only) — a future sprint adds the fields that
 * bind an option to a stage without redesigning Studio Mode or the rooms.
 */
export interface DesignOptionOverlay {
  /* reserved — no fields in V1 */
}
