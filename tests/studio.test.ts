/* =============================================================================
   HEADQUARTERS · STUDIO MODE — pure architecture tests (no DOM, no I/O).

   Studio Mode is an experimental design layer INSIDE the Headquarters (not a
   standalone application). These lock its foundation: the preference model is a
   closed vocabulary of four verdicts with immutable, idempotent transitions;
   Favorites is a pure projection over those verdicts; the ten sections exist
   with Notifications among them; the Room-Preview seam derives from the real
   room registry so Studio Mode can never drift from the residence; and the
   Standards registry is in place and honestly empty. No design-option data is
   asserted — none exists yet by design.
   ============================================================================= */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PREFERENCES, isPreferenceValue, preferenceLabel,
  emptyPreferences, getPreference, setPreference, togglePreference, clearPreference,
  preferenceTally,
  type PreferenceState,
} from '../src/headquarters/studio/preferences.ts';
import {
  FAVORITE_VERDICT, favoriteIds, isFavorite, favoriteCount,
} from '../src/headquarters/studio/favorites.ts';
import {
  STUDIO_SECTIONS, STUDIO_HOME_SECTION, isStudioSection, sectionFromSegment,
  getStudioSection, previewStages, STUDIO_TITLE,
} from '../src/headquarters/studio/sections.ts';
import { STANDARDS, standardsIn, standardsCount } from '../src/headquarters/studio/standards.ts';
import { ROOMS } from '../src/headquarters/rooms.ts';

/* --- the preference model ------------------------------------------------- */

test('PREFERENCES is the closed four-verdict vocabulary', () => {
  assert.deepEqual(PREFERENCES.map((p) => p.value), ['love', 'like', 'pass', 'favorite']);
  for (const p of PREFERENCES) {
    assert.equal(isPreferenceValue(p.value), true);
    assert.equal(preferenceLabel(p.value), p.label);
  }
  assert.equal(isPreferenceValue('brilliant'), false);
  assert.equal(isPreferenceValue(null), false);
});

test('setPreference records a single verdict; getPreference reads it', () => {
  const s0 = emptyPreferences();
  assert.equal(getPreference(s0, 'button-primary'), null);
  const s1 = setPreference(s0, 'button-primary', 'love');
  assert.equal(getPreference(s1, 'button-primary'), 'love');
  const s2 = setPreference(s1, 'button-primary', 'pass');
  assert.equal(getPreference(s2, 'button-primary'), 'pass');
});

test('preference transitions are immutable and idempotent', () => {
  const s0 = emptyPreferences();
  const s1 = setPreference(s0, 'card', 'like');
  assert.notEqual(s1, s0);
  assert.equal(getPreference(s0, 'card'), null);
  const s2 = setPreference(s1, 'card', 'like');
  assert.equal(s2, s1);
  const bad = setPreference(s1, 'card', 'nope' as never);
  assert.equal(bad, s1);
  const noId = setPreference(s1, '', 'love');
  assert.equal(noId, s1);
});

test('togglePreference sets, then clears on repeat', () => {
  const s0 = emptyPreferences();
  const s1 = togglePreference(s0, 'toggle', 'favorite');
  assert.equal(getPreference(s1, 'toggle'), 'favorite');
  const s2 = togglePreference(s1, 'toggle', 'favorite');
  assert.equal(getPreference(s2, 'toggle'), null);
  const s3 = togglePreference(s1, 'toggle', 'pass');
  assert.equal(getPreference(s3, 'toggle'), 'pass');
});

test('clearPreference removes a verdict and is idempotent', () => {
  const s1 = setPreference(emptyPreferences(), 'x', 'love');
  const s2 = clearPreference(s1, 'x');
  assert.equal(getPreference(s2, 'x'), null);
  assert.equal(clearPreference(s2, 'x'), s2);
});

test('preferenceTally counts each verdict', () => {
  let s: PreferenceState = emptyPreferences();
  s = setPreference(s, 'a', 'love');
  s = setPreference(s, 'b', 'love');
  s = setPreference(s, 'c', 'favorite');
  s = setPreference(s, 'd', 'pass');
  assert.deepEqual(preferenceTally(s), { love: 2, like: 0, pass: 1, favorite: 1 });
});

/* --- favorites as a pure projection --------------------------------------- */

test('Favorites derives only from the favorite verdict', () => {
  assert.equal(FAVORITE_VERDICT, 'favorite');
  let s: PreferenceState = emptyPreferences();
  assert.deepEqual(favoriteIds(s), []);
  assert.equal(favoriteCount(s), 0);

  s = setPreference(s, 'hero', 'love');
  s = setPreference(s, 'chip', 'favorite');
  s = setPreference(s, 'tab', 'favorite');
  assert.deepEqual(favoriteIds(s), ['chip', 'tab']);
  assert.equal(isFavorite(s, 'chip'), true);
  assert.equal(isFavorite(s, 'hero'), false);
  assert.equal(favoriteCount(s), 2);

  s = setPreference(s, 'chip', 'like');
  assert.deepEqual(favoriteIds(s), ['tab']);
});

/* --- sections ------------------------------------------------------------- */

test('Studio Mode has the ten required sections, including Notifications', () => {
  assert.deepEqual(
    STUDIO_SECTIONS.map((s) => s.label),
    ['Navigation', 'Cards', 'Controls', 'Typography', 'Motion', 'Layers',
     'Notifications', 'Room Preview', 'Favorites', 'Standards'],
  );
  assert.equal(STUDIO_SECTIONS.length, 10);
  assert.equal(STUDIO_TITLE, 'Studio Mode');
});

test('section sub-routes resolve, unknown falls back to home', () => {
  assert.equal(isStudioSection('cards'), true);
  assert.equal(isStudioSection('room-preview'), true);
  assert.equal(isStudioSection('nope'), false);
  assert.equal(sectionFromSegment('favorites'), 'favorites');
  assert.equal(sectionFromSegment(''), STUDIO_HOME_SECTION);       // bare #/studio → home
  assert.equal(sectionFromSegment('garbage'), STUDIO_HOME_SECTION); // unknown → home
  assert.equal(getStudioSection('standards')?.label, 'Standards');
});

/* --- the Room-Preview seam ties back to the real rooms -------------------- */

test('preview stages are exactly the real Headquarters rooms', () => {
  const stages = previewStages();
  assert.equal(stages.length, ROOMS.length);
  assert.deepEqual(stages.map((s) => s.roomId), ROOMS.map((r) => r.id));
  // each stage points at the room's real deep-link route — no fabricated stage
  for (const s of stages) {
    const room = ROOMS.find((r) => r.id === s.roomId)!;
    assert.equal(s.route, room.route);
    assert.equal(s.name, room.name);
  }
});

/* --- the Standards registry is in place and honestly empty ---------------- */

test('the Standards registry starts empty', () => {
  assert.equal(STANDARDS.length, 0);
  assert.equal(standardsCount(), 0);
  assert.deepEqual(standardsIn('navigation'), []);
});
