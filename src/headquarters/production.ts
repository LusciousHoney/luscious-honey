/* =============================================================================
   PRODUCTION SUITE — "a glass studio for momentum without noise" (Milestone 6).

   The residence's most open, light-filled room: where cleared creative work is
   produced, shaped, reviewed, and FINISHED — narration, audio, video, post,
   visual review. Distinct from the Creative Director library (where the writing
   and the body of work live): this is the room of FINISHING and delivery. Its
   promise (canon §IV.4) is "capable, and in motion" — momentum without noise.

   The room is built around ONE architectural object — the Narration Desk — which
   is environmental (rendered furniture, drawn in CSS/SVG in main.ts): a floating
   oak desk with quietly-alive displays, headphones, a tablet stand, and the warm
   brass recording lamp that stays quiet and ready and NEVER simulates recording.

   This module holds ONLY the pure shaping of EXISTING data into the studio's
   sprint, plus the room's honest in-residence copy. It reads no data and performs
   no I/O — main.ts fetches the finishing tail of the spine and passes it here.

   The sprint reads the finishing stages of the existing workflow, relabelled in
   the voice of a publishing house rather than project software:
     • In Production      ← scheduled  (on the stand, being finished)
     • Preparing          ← approved   (cleared, being readied)
     • Recently Finished  ← published  (shipped)

   No new endpoint, table, workflow, or submission system; no capture or editing
   happens here. The Editorial Office remains the operational review workspace.
   ============================================================================= */

import type { Submission } from './adapters.ts';

/** One lane of the studio sprint, mapped to an existing workflow status. */
export interface ProductionLane {
  id: string;
  label: string;
  status: string;
  /** One quiet line for an empty lane — honest, never a fabricated queue. */
  empty: string;
}

// The finishing tail, in the founder's order (the active work leads). Presentation
// only — the workflow, statuses, and API are unchanged.
export const PRODUCTION_LANES: ProductionLane[] = [
  { id: 'in_production',     label: 'In Production',     status: 'scheduled',
    empty: 'Nothing on the stand just now.' },
  { id: 'preparing',         label: 'Preparing',         status: 'approved',
    empty: 'Nothing being readied yet.' },
  { id: 'recently_finished', label: 'Recently Finished', status: 'published',
    empty: 'Nothing shipped lately.' },
];

// A studio sprint is curated, not a backlog — a few named pieces per lane.
const PER_LANE = 4;

export interface SprintItem { name: string; type: string; }
export interface SprintLane {
  id: string;
  label: string;
  items: SprintItem[];
  /** How many pieces are actually in this lane (may exceed what is shown). */
  total: number;
  empty: string;
}
export interface ProductionSprint {
  lanes: SprintLane[];
  /** Total pieces across the finishing tail — 0 means the studio is honestly quiet. */
  total: number;
}

/**
 * Shape the finishing tail of the spine into the studio sprint. Pure: no I/O, no
 * clock, no DOM. `byStatus` is keyed by workflow status (the existing submissions
 * lists); each lane reads its own status, curates the newest few, and keeps an
 * honest total. Tolerant of missing/failed lists so lanes degrade independently.
 */
export function productionSprint(
  byStatus: Record<string, Submission[] | null | undefined>,
): ProductionSprint {
  const lanes: SprintLane[] = PRODUCTION_LANES.map((def) => {
    const list = byStatus ? byStatus[def.status] : null;
    const arr = Array.isArray(list) ? list : [];
    return {
      id: def.id,
      label: def.label,
      items: arr.slice(0, PER_LANE).map((s) => ({ name: s.name, type: s.type })),
      total: arr.length,
      empty: def.empty,
    };
  });
  const total = lanes.reduce((sum, l) => sum + l.total, 0);
  return { lanes, total };
}

/* --- Honest in-residence copy ------------------------------------------------ */

/** The recording position — now a real, working entrance. The Narration Desk
    opens the Collective's private Voice Notes Studio (its own established surface
    under Production); Headquarters links to it, and never rebuilds or embeds it. */
export const RECORDING_NOTE =
  'The recording position is ready — the lamp quiet and warm. The Voice Notes Studio, the House’s private recording room, opens from here.';

/** The Production entrance to the existing Voice Notes Studio. Data only — the
    residence renders it. The Studio is a separate private surface served under
    /production-studio; this is a link into it, preserving the institutional
    hierarchy (The Luscious Honey Collective → Production → Voice Notes Studio).
    Access protection is unchanged: both surfaces sit behind Cloudflare Access. */
export interface StudioEntrance {
  href: string;
  label: string;
  /** Institutional breadcrumb, outermost first. */
  breadcrumb: string[];
  blurb: string;
}
export const VOICE_NOTES_STUDIO: StudioEntrance = {
  href: '/production-studio/voice-notes/',
  label: 'Enter the Voice Notes Studio',
  breadcrumb: ['The Luscious Honey Collective', 'Production', 'Voice Notes Studio'],
  blurb:
    'Build an episode: private artist collaboration, per-note audio, and finished video export — in the Collective’s own recording room.',
};

/** The glass review room — environmental only; it merely suggests review happens
    there, in the light. No dashboard, no controls. */
export const REVIEW_NOTE = 'Finished work is reviewed here, in the light.';
