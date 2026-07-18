/* =============================================================================
   HEADQUARTERS · STUDIO MODE — the Navigation Lab (Sprint 002).

   The first real selection experience inside Studio Mode. The Founder reviews a
   small, curated set of navigation SYSTEMS, compares them in the context of the
   real Headquarters rooms, and records a verdict — without being shown the same
   undecided option twice.

   This module is DATA + PURE LOGIC only (no DOM). It owns:
     • the six navigation-family definitions (structure/interaction, not colour),
       authored as reusable data — never six hardcoded pages;
     • the shared demo destinations, derived from the real room registry so every
       demo navigates the actual residence;
     • the rooms a design can be tried in (a subset of the real rooms);
     • pure selectors over the Studio preference store: which families are
       undecided / decided / saved, the ≤3 review window with paging, and the
       finalist pair for the honest comparison.

   Rendering lives in main.ts (the residence's view layer); it reads everything
   from here. Verdicts persist through the existing Studio preference store — no
   new store, no new lifecycle.
   ============================================================================= */

import { ROOMS, getRoom, type RoomId } from '../rooms.ts';
import {
  type PreferenceState, type PreferenceValue, getPreference, preferenceLabel,
  type NotesState, getOptionNotes, hasNotes, type OptionNotes,
} from './preferences.ts';

/* --- the navigation families --------------------------------------------- */

/**
 * The structural archetype a family renders as. The renderer switches on this —
 * each is a genuinely different layout and interaction, not a recolour.
 */
export type NavLayout =
  | 'rail'      // vertical floating glass rail
  | 'ribbon'    // horizontal top executive ribbon
  | 'dock'      // centred floating island dock
  | 'sidebar'   // expandable editorial sidebar (collapse/expand)
  | 'compass'   // radial room compass
  | 'hybrid';   // slim rail + a top actions strip

export interface NavFamily {
  /** Stable optionId — the key under which its verdict persists. Namespaced. */
  id: string;
  /** Institutional name. */
  name: string;
  /** One editorial line — the feeling of the system. */
  tagline: string;
  layout: NavLayout;
  /** How it is organised. */
  structure: string;
  /** How the Founder moves through it. */
  interaction: string;
  /** True when the system has a distinct expanded/collapsed state to feel. */
  expandable: boolean;
  /** Designer notes — objective, an industrial designer's reading, not marketing. */
  designer: DesignerNotes;
}

/** An objective account of a design: why it exists, where it is strong, what it
    costs, and where it fits. Descriptive, never persuasive. */
export interface DesignerNotes {
  philosophy: string;
  strengths: string;
  tradeoffs: string;
  idealUse: string;
}

/**
 * Six meaningfully different navigation concepts. Order is the presentation
 * order in the lab. The ids are the preference-store keys (prefixed `nav-`).
 */
export const NAV_FAMILIES: NavFamily[] = [
  {
    id: 'nav-glass-rail',
    name: 'Floating Glass Rail',
    tagline: 'A slender pane of light standing at the left, always within reach.',
    layout: 'rail',
    structure: 'A vertical frosted rail floats clear of the left edge; the six rooms stack as a quiet list with the current room lit.',
    interaction: 'Glance down the column and step in. On hover a room warms and lifts a hair, a brass mark drawn at its edge.',
    expandable: false,
    designer: {
      philosophy: 'A persistent vertical index that treats the six rooms as a fixed, scannable set. Placement is constant, so the map never moves.',
      strengths: 'Predictable target positions build muscle memory; the full label set is always visible; it consumes little horizontal space and leaves the room’s width to content.',
      tradeoffs: 'Occupies a permanent vertical strip on every screen; scales poorly beyond roughly eight items; on narrow viewports it competes with content for the left edge.',
      idealUse: 'A small, stable set of top-level destinations on wide screens where constant visibility matters more than reclaiming the margin.',
    },
  },
  {
    id: 'nav-top-ribbon',
    name: 'Top Executive Ribbon',
    tagline: 'A calm masthead across the top — the house name, the rooms, the day’s actions.',
    layout: 'ribbon',
    structure: 'A horizontal ribbon spans the top: the wordmark at the left, the rooms in a single measured row, a small actions cluster at the right.',
    interaction: 'Read left to right like a masthead. The active room carries a soft underline; hovering warms the label and floats the ribbon a touch.',
    expandable: false,
    designer: {
      philosophy: 'The conventional top bar: identity, places, and actions read as a single horizontal line at the top of the field of view.',
      strengths: 'Immediately legible from prior convention; frees both side margins; co-locates brand, navigation, and actions in one predictable band.',
      tradeoffs: 'Horizontal room means labels compete for width and truncate as items grow; on phones the row must wrap or scroll; the actions cluster can crowd the destinations.',
      idealUse: 'A handful of destinations plus a few global actions, where a familiar, content-first layout is valued over spatial novelty.',
    },
  },
  {
    id: 'nav-island-dock',
    name: 'Floating Island Dock',
    tagline: 'A small lit island resting at the foot of the room.',
    layout: 'dock',
    structure: 'A compact, centred pill hovers near the bottom; rooms are icon-and-label tiles gathered close, the current one raised.',
    interaction: 'Reach down to a tile; it swells and brightens on hover. Touch-first and thumb-reachable, out of the room’s sightline.',
    expandable: false,
    designer: {
      philosophy: 'A touch-first cluster placed in the thumb zone, borrowing the mobile-dock pattern; navigation sits out of the upper sightline.',
      strengths: 'Excellent reach on handheld and tablet; compact footprint; the centred group reads as a single object rather than a chrome edge.',
      tradeoffs: 'Icon-led tiles lean on recognition and can be ambiguous without labels; limited item capacity; a bottom-centre position can overlap page content or system gestures.',
      idealUse: 'Touch devices with a small destination set where reachability and a light footprint outweigh a comprehensive, labelled index.',
    },
  },
  {
    id: 'nav-editorial-sidebar',
    name: 'Expandable Editorial Sidebar',
    tagline: 'A reading-room index that opens wide or folds to its spine.',
    layout: 'sidebar',
    structure: 'A generous left column groups the rooms under editorial headings (The House · The Work). It expands to full labels or collapses to a slim spine of initials.',
    interaction: 'A single control expands or collapses the column; entries reveal their grouping on hover, with a warm plate behind the current room.',
    expandable: true,
    designer: {
      philosophy: 'A grouped index that carries hierarchy: destinations sit under named categories, and the column trades width for content on demand.',
      strengths: 'Expresses structure and grouping directly; the collapse state reclaims space while keeping orientation via initials; scales to more items than a flat list.',
      tradeoffs: 'Collapsed, it relies on initials or icons and loses full labels; the extra control adds a step; the wider expanded state is costly on small screens.',
      idealUse: 'A larger or grouped destination set on wide screens, where showing hierarchy and reclaiming space on demand both matter.',
    },
  },
  {
    id: 'nav-room-compass',
    name: 'Room Compass',
    tagline: 'You at the centre, the rooms arranged around you like a plan of the house.',
    layout: 'compass',
    structure: 'A radial navigator: “You are here” sits at the centre with the rooms placed around it, their position a spatial map rather than a list.',
    interaction: 'Move outward toward a room; it illuminates and rises as the pointer nears. Orientation is spatial, not linear.',
    expandable: false,
    designer: {
      philosophy: 'A spatial rather than linear model: position encodes a relationship, so the layout is a small map of the house instead of a sorted list.',
      strengths: 'Memorable and distinctive; fixed angular positions can aid spatial recall; centre-out reach is even in every direction.',
      tradeoffs: 'Radial reading has no natural order and is unconventional; it needs generous space and does not linearise cleanly for narrow or assistive contexts; capacity is limited by the ring’s circumference.',
      idealUse: 'A small, stable set where a spatial identity is deliberate, on generous canvases and paired with a conventional fallback for small or assistive use.',
    },
  },
  {
    id: 'nav-hybrid',
    name: 'Hybrid Rail + Top Actions',
    tagline: 'A quiet rail for places, a light strip for doing — two hands working together.',
    layout: 'hybrid',
    structure: 'A slim left rail holds the rooms while a separate top strip holds the day’s actions (Search · Dictate · Calendar), keeping place and task apart.',
    interaction: 'Choose a room on the rail, an action on the strip. Each region warms independently on hover; neither crowds the other.',
    expandable: false,
    designer: {
      philosophy: 'Separation of concerns: destinations and actions are given distinct regions so wayfinding and doing do not share one crowded surface.',
      strengths: 'Each region stays uncrowded and can scale on its own axis; the division clarifies which controls navigate and which act; familiar rail and bar patterns combine.',
      tradeoffs: 'Two persistent chrome regions consume both a top band and a side strip; the split adds visual complexity; the relationship between the two must be learned.',
      idealUse: 'Denser workspaces with both a real destination set and a recurring set of global actions, on screens wide and tall enough to host both regions.',
    },
  },
];

const BY_ID = new Map(NAV_FAMILIES.map((f) => [f.id, f]));

export function isNavFamilyId(id: string | null | undefined): boolean {
  return !!id && BY_ID.has(id);
}

export function getNavFamily(id: string): NavFamily | undefined {
  return BY_ID.get(id);
}

/* --- the shared demo destinations (the real residence) -------------------- */

export interface NavDemoItem {
  roomId: RoomId;
  /** The room's institutional name — what a demo nav shows. */
  label: string;
  /** A one-word/compact form for tight layouts (dock, compass, collapsed spine). */
  short: string;
  /** The room's real deep-link route (demos are honest, though inert in the lab). */
  route: string;
}

const SHORT: Record<RoomId, string> = {
  executive: 'Office',
  operations: 'Ops',
  creative: 'Creative',
  production: 'Studio',
  growth: 'Growth',
  business: 'Business',
};

/** Every demo navigates the SAME real rooms — derived from ROOMS, never invented. */
export const NAV_DEMO_ITEMS: NavDemoItem[] = ROOMS.map((r) => ({
  roomId: r.id,
  label: r.name,
  short: SHORT[r.id] ?? r.name,
  route: r.route,
}));

/* --- the rooms a design can be tried in ----------------------------------- */

export interface PreviewRoom {
  roomId: RoomId;
  name: string;
  route: string;
  /** True only where a real photographic scene exists (Executive Office today);
      elsewhere the preview uses the room's atmospheric shell. */
  hasScene: boolean;
}

const SCENE_ROOMS = new Set<RoomId>(['executive']); // only the atrium is photographed today

/** The rooms Try-in-Room offers — at least Executive, Operations, Creative. */
export const PREVIEW_ROOMS: PreviewRoom[] = (['executive', 'operations', 'creative'] as RoomId[])
  .map((id) => {
    const room = getRoom(id)!;
    return { roomId: id, name: room.name, route: room.route, hasScene: SCENE_ROOMS.has(id) };
  });

export function isPreviewRoomId(id: string | null | undefined): id is RoomId {
  return !!id && PREVIEW_ROOMS.some((r) => r.roomId === id);
}

/* --- the lab's verdict palette -------------------------------------------- */

/** The verdicts the Navigation Lab offers, in button order. A subset of the
    Studio vocabulary — the lab defers `favorite` (approved) to a later stage. */
export const LAB_VERDICTS: PreferenceValue[] = ['love', 'like', 'save', 'pass'];

export function labVerdictLabel(v: PreferenceValue): string {
  return preferenceLabel(v);
}

/* --- pure selectors over the preference store ----------------------------- */

/** The verdict on a family, or null if the Founder has not decided it. */
export function familyVerdict(state: PreferenceState, id: string): PreferenceValue | null {
  return getPreference(state, id);
}

/** Decided === carries any verdict. Undecided === none. */
export function isDecided(state: PreferenceState, id: string): boolean {
  return getPreference(state, id) !== null;
}

/** Families the Founder has not yet decided — the review queue, in order. */
export function undecidedFamilies(state: PreferenceState): NavFamily[] {
  return NAV_FAMILIES.filter((f) => !isDecided(state, f.id));
}

/** Families the Founder has decided (any verdict), in order. */
export function decidedFamilies(state: PreferenceState): NavFamily[] {
  return NAV_FAMILIES.filter((f) => isDecided(state, f.id));
}

/** Families carrying a specific verdict, in order. */
export function familiesWithVerdict(state: PreferenceState, v: PreferenceValue): NavFamily[] {
  return NAV_FAMILIES.filter((f) => getPreference(state, f.id) === v);
}

/** Families saved for later — the deferred shelf. */
export function savedFamilies(state: PreferenceState): NavFamily[] {
  return familiesWithVerdict(state, 'save');
}

/* --- the ≤3 review window (pure pager) ------------------------------------ */

export interface ReviewWindow {
  /** The families shown on this page — never more than `size`. */
  families: NavFamily[];
  /** Zero-based page index, clamped into range. */
  page: number;
  /** Total pages across the given list (≥1, so an empty list is one empty page). */
  pageCount: number;
  hasPrev: boolean;
  hasNext: boolean;
  /** Total families in the list being paged. */
  total: number;
}

/**
 * A window of at most `size` families for the comparison set. `page` is clamped
 * so callers can advance/retreat freely without going out of range. Pure.
 */
export function reviewWindow(list: NavFamily[], page: number, size = 3): ReviewWindow {
  const capped = Math.max(1, Math.min(3, Math.floor(size))); // never show more than 3 at once
  const pageCount = Math.max(1, Math.ceil(list.length / capped));
  const clamped = Math.max(0, Math.min(page, pageCount - 1));
  const start = clamped * capped;
  return {
    families: list.slice(start, start + capped),
    page: clamped,
    pageCount,
    hasPrev: clamped > 0,
    hasNext: clamped < pageCount - 1,
    total: list.length,
  };
}

/* --- finalist selection for the honest comparison ------------------------- */

/**
 * A sensible default pair of finalists to compare: prefer the loved, then the
 * liked, then simply the first two families. Always returns two distinct ids
 * when at least two families exist. Pure — the Founder can override in the UI.
 */
export function defaultFinalists(state: PreferenceState): [string, string] {
  const ranked = [
    ...familiesWithVerdict(state, 'love'),
    ...familiesWithVerdict(state, 'like'),
    ...NAV_FAMILIES.filter((f) => getPreference(state, f.id) !== 'love' && getPreference(state, f.id) !== 'like'),
  ];
  const seen = new Set<string>();
  const ordered = ranked.filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)));
  return [ordered[0]?.id ?? NAV_FAMILIES[0].id, ordered[1]?.id ?? NAV_FAMILIES[1].id];
}

/** Validate/repair a finalist pair to two distinct known family ids. Pure. */
export function normalizeFinalists(
  a: string | null | undefined,
  b: string | null | undefined,
): [string, string] {
  const first = isNavFamilyId(a ?? '') ? (a as string) : NAV_FAMILIES[0].id;
  let second = isNavFamilyId(b ?? '') ? (b as string) : NAV_FAMILIES[1].id;
  if (second === first) second = NAV_FAMILIES.find((f) => f.id !== first)!.id;
  return [first, second];
}

/* --- interaction focus: the states a system is evaluated by ---------------
   Sprint 2A is about how a navigation FEELS, so each system exposes its
   interaction states to be hovered and felt, not just seen. */

export type InteractionStateId = 'rest' | 'hover' | 'active' | 'selected' | 'focus' | 'expanded';

export interface InteractionState {
  id: InteractionStateId;
  label: string;
  /** What the state is and when it appears — descriptive, one line. */
  note: string;
}

const ALL_STATES: InteractionState[] = [
  { id: 'rest',     label: 'Rest',     note: 'The resting appearance, before any interaction.' },
  { id: 'hover',    label: 'Hover',    note: 'A soft warmth and lift as the pointer arrives.' },
  { id: 'active',   label: 'Active',   note: 'The pressed moment — the element settles as it is chosen.' },
  { id: 'selected', label: 'Selected', note: 'The current room, held lit while you are inside it.' },
  { id: 'focus',    label: 'Focus',    note: 'The keyboard ring — a brass outline for tab navigation.' },
  { id: 'expanded', label: 'Expanded', note: 'The opened state, when the system can widen or fold.' },
];

/** The interaction states a family exposes — `expanded` only when it applies. */
export function interactionStatesFor(family: NavFamily): InteractionState[] {
  return ALL_STATES.filter((s) => s.id !== 'expanded' || family.expandable);
}

/* --- the Founder Review Summary (pure) ------------------------------------
   Loved · Liked · Saved · Passed, plus anything still unreviewed, each carrying
   its written notes. Descriptive only — it never ranks or recommends a winner. */

export interface SummaryEntry {
  family: NavFamily;
  verdict: PreferenceValue | null;
  notes: OptionNotes;
  hasWritten: boolean;
}

export interface ReviewSummaryData {
  loved: SummaryEntry[];
  liked: SummaryEntry[];
  saved: SummaryEntry[];
  passed: SummaryEntry[];
  unreviewed: SummaryEntry[];
  /** Every entry carrying a written note, in family order (for the notes panel). */
  withNotes: SummaryEntry[];
  counts: { loved: number; liked: number; saved: number; passed: number; unreviewed: number };
}

/**
 * Build the review summary from the persisted verdicts and notes. Pure: it
 * reports what the Founder recorded and never orders the systems by merit.
 */
export function reviewSummary(verdicts: PreferenceState, notes: NotesState): ReviewSummaryData {
  const entries: SummaryEntry[] = NAV_FAMILIES.map((family) => ({
    family,
    verdict: getPreference(verdicts, family.id),
    notes: getOptionNotes(notes, family.id),
    hasWritten: hasNotes(notes, family.id),
  }));
  const byVerdict = (v: PreferenceValue): SummaryEntry[] => entries.filter((e) => e.verdict === v);
  const loved = byVerdict('love');
  const liked = byVerdict('like');
  const saved = byVerdict('save');
  const passed = byVerdict('pass');
  const unreviewed = entries.filter((e) => e.verdict === null);
  return {
    loved, liked, saved, passed, unreviewed,
    withNotes: entries.filter((e) => e.hasWritten),
    counts: {
      loved: loved.length, liked: liked.length, saved: saved.length,
      passed: passed.length, unreviewed: unreviewed.length,
    },
  };
}
