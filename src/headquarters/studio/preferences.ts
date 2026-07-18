/* =============================================================================
   HEADQUARTERS · STUDIO MODE — the Preference Model.

   Studio Mode is an EXPERIMENTAL capability inside the Headquarters (reached from
   the House Toolbar, gated by the same Cloudflare Access as the residence). It is
   where the Founder evaluates interface designs in the context of the real
   Headquarters rooms — Headquarters remains the product; this is a layer within
   it, never a separate application.

   This module is the reusable preference architecture Studio Mode is built
   around: every design option the Studio will ever show can receive exactly ONE
   verdict from the Founder —

       Love · Like · Pass · Favorite

   No design-option data exists yet, and none is needed. This module owns the
   VOCABULARY and the pure state transitions only. It is deliberately generic:
   a future sprint calls `setPreference(state, optionId, value)` — nothing here
   changes.

   BOUNDARY (invariant): pure preference state, presentation-only. A verdict is a
   POINTER keyed by an opaque `optionId` string — never a copy of a design. The
   localStorage seam (`loadPreferences` / `savePreferences`) is the single place
   that touches a browser, and it stores only the Founder's verdicts — never any
   Headquarters system of record. A real backend can replace it later without
   touching any pure caller above.
   ============================================================================= */

/** The four verdicts a design option may carry. Exactly one at a time, or none. */
export type PreferenceValue = 'love' | 'like' | 'pass' | 'favorite';

export interface PreferenceOption {
  value: PreferenceValue;
  /** Signage label (Archivo caps in the UI). */
  label: string;
  /** A single glyph used as the control's face — colour is token-driven, not here. */
  glyph: string;
  /** One honest line describing what the verdict means. */
  note: string;
}

/**
 * The verdict vocabulary, in presentation order. Studio Mode never invents a
 * fifth verdict; new meaning is added here or nowhere.
 */
export const PREFERENCES: PreferenceOption[] = [
  { value: 'love',     label: 'Love',     glyph: '♥', note: 'A defining choice — this is the direction.' },
  { value: 'like',     label: 'Like',     glyph: '✓', note: 'Worth keeping in the running.' },
  { value: 'pass',     label: 'Pass',     glyph: '×', note: 'Not this one — set it aside.' },
  { value: 'favorite', label: 'Favorite', glyph: '★', note: 'Approved — collect it into Favorites.' },
];

const BY_VALUE = new Map(PREFERENCES.map((p) => [p.value, p]));

/** True only for the four known verdicts — guards restored/foreign data. */
export function isPreferenceValue(v: unknown): v is PreferenceValue {
  return typeof v === 'string' && BY_VALUE.has(v as PreferenceValue);
}

/** Signage label for a verdict (falls back to the raw value defensively). */
export function preferenceLabel(v: PreferenceValue): string {
  return BY_VALUE.get(v)?.label ?? v;
}

/**
 * The Studio's preference state: an opaque map from `optionId` to its single
 * verdict. Absent key === no verdict. Treated as immutable — every operation
 * returns a fresh object so callers can diff and re-render predictably.
 */
export type PreferenceState = Readonly<Record<string, PreferenceValue>>;

/** An empty slate — no design option has a verdict yet. */
export function emptyPreferences(): PreferenceState {
  return {};
}

/** The verdict on one design option, or null if none has been set. */
export function getPreference(state: PreferenceState, optionId: string): PreferenceValue | null {
  const v = state[optionId];
  return isPreferenceValue(v) ? v : null;
}

/**
 * Record a verdict. Setting the same verdict again is idempotent (returns the
 * same state). Returns a new state object; never mutates the input.
 */
export function setPreference(
  state: PreferenceState,
  optionId: string,
  value: PreferenceValue,
): PreferenceState {
  if (!optionId || !isPreferenceValue(value)) return state;
  if (state[optionId] === value) return state;
  return { ...state, [optionId]: value };
}

/**
 * Toggle a verdict: choosing an option's current verdict again clears it, so a
 * single control can both set and unset. Returns a new state object.
 */
export function togglePreference(
  state: PreferenceState,
  optionId: string,
  value: PreferenceValue,
): PreferenceState {
  if (state[optionId] === value) return clearPreference(state, optionId);
  return setPreference(state, optionId, value);
}

/** Remove any verdict on a design option. Idempotent when none is set. */
export function clearPreference(state: PreferenceState, optionId: string): PreferenceState {
  if (!(optionId in state)) return state;
  const next: Record<string, PreferenceValue> = { ...state };
  delete next[optionId];
  return next;
}

/** How many options carry each verdict — a foundation for future summaries. */
export function preferenceTally(state: PreferenceState): Record<PreferenceValue, number> {
  const tally: Record<PreferenceValue, number> = { love: 0, like: 0, pass: 0, favorite: 0 };
  for (const v of Object.values(state)) {
    if (isPreferenceValue(v)) tally[v] += 1;
  }
  return tally;
}

/* --- localStorage seam ----------------------------------------------------
   The one place that touches a browser. Fails safe: unavailable, blocked, or
   corrupt storage yields an empty slate rather than an error, and only the four
   known verdicts survive a round-trip. Namespaced under the Headquarters
   (`lhc.hq.studio.v1`), alongside the residence's other local pointers. Swap for
   a real backend later without changing any pure caller above. */

const KEY = 'lhc.hq.studio.v1';
const SCHEMA_VERSION = 1;

interface StoredPreferences {
  schemaVersion: number;
  verdicts: Record<string, PreferenceValue>;
}

/** Read persisted verdicts, discarding anything unknown or malformed. */
export function loadPreferences(): PreferenceState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyPreferences();
    const parsed = JSON.parse(raw) as Partial<StoredPreferences>;
    const verdicts = parsed?.verdicts;
    if (!verdicts || typeof verdicts !== 'object') return emptyPreferences();
    const clean: Record<string, PreferenceValue> = {};
    for (const [id, v] of Object.entries(verdicts)) {
      if (id && isPreferenceValue(v)) clean[id] = v;
    }
    return clean;
  } catch {
    return emptyPreferences();
  }
}

/** Persist the current verdicts. Silently no-ops if storage is unavailable. */
export function savePreferences(state: PreferenceState): void {
  try {
    const payload: StoredPreferences = { schemaVersion: SCHEMA_VERSION, verdicts: { ...state } };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* storage unavailable / full — verdicts simply won't persist this session */
  }
}
