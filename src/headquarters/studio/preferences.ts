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

/** The verdicts a design option may carry. Exactly one at a time, or none.
    `save` ("Save for Later") was added for the Navigation Lab (Sprint 002): a
    deferred verdict distinct from `favorite` (approved) — it sets an option
    aside to revisit without deciding for or against it. */
export type PreferenceValue = 'love' | 'like' | 'pass' | 'favorite' | 'save';

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
  { value: 'love',     label: 'Love',           glyph: '♥', note: 'A defining choice — this is the direction.' },
  { value: 'like',     label: 'Like',           glyph: '✓', note: 'Worth keeping in the running.' },
  { value: 'save',     label: 'Save for Later', glyph: '⧗', note: 'Set aside to revisit — not yet decided.' },
  { value: 'pass',     label: 'Pass',           glyph: '×', note: 'Not this one — set it aside.' },
  { value: 'favorite', label: 'Favorite',       glyph: '★', note: 'Approved — collect it into Favorites.' },
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
  const tally: Record<PreferenceValue, number> = { love: 0, like: 0, save: 0, pass: 0, favorite: 0 };
  for (const v of Object.values(state)) {
    if (isPreferenceValue(v)) tally[v] += 1;
  }
  return tally;
}

/* --- written evaluation notes (Sprint 2A) ---------------------------------
   Alongside a single verdict, an option may carry the Founder's written
   evaluation: what they like, what they'd change, and free notes. Same opaque
   `optionId` key, same store, same fail-safe seam — an additive layer on the
   preference architecture, not a second store. Text only; pure and immutable. */

export interface OptionNotes {
  /** What the Founder likes about the option. */
  like: string;
  /** What the Founder would change. */
  change: string;
  /** Free-form notes. */
  notes: string;
}

/** The named text fields, in display order — the single source for callers/UI. */
export const NOTE_FIELDS: { key: keyof OptionNotes; label: string }[] = [
  { key: 'like',   label: 'What I Like' },
  { key: 'change', label: 'What I’d Change' },
  { key: 'notes',  label: 'Notes' },
];

export type NotesState = Readonly<Record<string, OptionNotes>>;

export function emptyNotes(): NotesState {
  return {};
}

function blankNotes(): OptionNotes {
  return { like: '', change: '', notes: '' };
}

/** The notes on one option — always a full record (blank fields if unwritten). */
export function getOptionNotes(state: NotesState, optionId: string): OptionNotes {
  const n = state[optionId];
  return n ? { ...blankNotes(), ...n } : blankNotes();
}

/** Whether an option carries any non-empty written note. */
export function hasNotes(state: NotesState, optionId: string): boolean {
  const n = state[optionId];
  return !!n && (n.like.trim() !== '' || n.change.trim() !== '' || n.notes.trim() !== '');
}

/**
 * Set one text field for an option. Returns a new state object; never mutates.
 * A field cleared to empty (and no other content) drops the option's record so
 * an empty evaluation leaves no trace.
 */
export function setOptionNote(
  state: NotesState,
  optionId: string,
  field: keyof OptionNotes,
  value: string,
): NotesState {
  if (!optionId) return state;
  const current = getOptionNotes(state, optionId);
  const nextRecord: OptionNotes = { ...current, [field]: value };
  const next: Record<string, OptionNotes> = { ...state };
  if (nextRecord.like.trim() === '' && nextRecord.change.trim() === '' && nextRecord.notes.trim() === '') {
    delete next[optionId];
  } else {
    next[optionId] = nextRecord;
  }
  return next;
}

/* --- localStorage seam ----------------------------------------------------
   The one place that touches a browser. Fails safe: unavailable, blocked, or
   corrupt storage yields an empty slate rather than an error, and only known
   verdicts / well-formed notes survive a round-trip. Namespaced under the
   Headquarters (`lhc.hq.studio.v1`). Verdicts and notes live in ONE record;
   every save is read-modify-write, so persisting one never clobbers the other.
   Swap for a real backend later without changing any pure caller above. */

const KEY = 'lhc.hq.studio.v1';
const SCHEMA_VERSION = 1;

interface StoredStudio {
  schemaVersion: number;
  verdicts: Record<string, PreferenceValue>;
  notes: Record<string, OptionNotes>;
}

function coerceString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Read + validate the whole studio record. Never throws. */
function readStore(): { verdicts: Record<string, PreferenceValue>; notes: Record<string, OptionNotes> } {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { verdicts: {}, notes: {} };
    const parsed = JSON.parse(raw) as Partial<StoredStudio>;
    const verdicts: Record<string, PreferenceValue> = {};
    if (parsed?.verdicts && typeof parsed.verdicts === 'object') {
      for (const [id, v] of Object.entries(parsed.verdicts)) {
        if (id && isPreferenceValue(v)) verdicts[id] = v;
      }
    }
    const notes: Record<string, OptionNotes> = {};
    if (parsed?.notes && typeof parsed.notes === 'object') {
      for (const [id, n] of Object.entries(parsed.notes as Record<string, unknown>)) {
        if (!id || !n || typeof n !== 'object') continue;
        const rec = n as Record<string, unknown>;
        const clean: OptionNotes = {
          like: coerceString(rec.like), change: coerceString(rec.change), notes: coerceString(rec.notes),
        };
        if (clean.like || clean.change || clean.notes) notes[id] = clean;
      }
    }
    return { verdicts, notes };
  } catch {
    return { verdicts: {}, notes: {} };
  }
}

function writeStore(record: { verdicts: Record<string, PreferenceValue>; notes: Record<string, OptionNotes> }): void {
  try {
    const payload: StoredStudio = { schemaVersion: SCHEMA_VERSION, verdicts: record.verdicts, notes: record.notes };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* storage unavailable / full — this session simply won't persist */
  }
}

/** Read persisted verdicts, discarding anything unknown or malformed. */
export function loadPreferences(): PreferenceState {
  return readStore().verdicts;
}

/** Persist verdicts, preserving any stored notes. Silently no-ops if unavailable. */
export function savePreferences(state: PreferenceState): void {
  const store = readStore();
  writeStore({ verdicts: { ...state }, notes: store.notes });
}

/** Read persisted evaluation notes, discarding anything malformed. */
export function loadNotes(): NotesState {
  return readStore().notes;
}

/** Persist notes, preserving any stored verdicts. Silently no-ops if unavailable. */
export function saveNotes(state: NotesState): void {
  const store = readStore();
  writeStore({ verdicts: store.verdicts, notes: { ...state } });
}
