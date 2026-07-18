/* =============================================================================
   HEADQUARTERS · STUDIO MODE — Favorites (derived, never a second source of truth).

   Favorites is the shelf of APPROVED design options. It owns no state of its own:
   an option is a favorite exactly when its verdict in the Preference Model is
   `favorite`. This is a pure PROJECTION over the preference state — so nothing
   can ever drift out of sync with an option's verdict, and there is no favourite
   to "remove" except by changing the verdict.

   No design-option data exists yet; this returns an empty shelf until a future
   sprint populates Studio Mode. The architecture is complete regardless.
   ============================================================================= */

import { type PreferenceState, getPreference } from './preferences.ts';

/** The verdict that qualifies an option for the Favorites shelf. */
export const FAVORITE_VERDICT = 'favorite' as const;

/**
 * The optionIds currently approved into Favorites, derived from the preference
 * state. Order is stable (insertion order of the underlying map), so the shelf
 * doesn't reshuffle on unrelated edits.
 */
export function favoriteIds(state: PreferenceState): string[] {
  return Object.keys(state).filter((id) => getPreference(state, id) === FAVORITE_VERDICT);
}

/** Whether a specific design option is on the Favorites shelf. */
export function isFavorite(state: PreferenceState, optionId: string): boolean {
  return getPreference(state, optionId) === FAVORITE_VERDICT;
}

/** How many options are approved — the count the Favorites section reads. */
export function favoriteCount(state: PreferenceState): number {
  return favoriteIds(state).length;
}
