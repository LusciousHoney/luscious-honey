/* =============================================================================
   SPRINT 10 — Hospitality + Scene Asset + Atmosphere. Pure tests (no DOM, no I/O).

   Locks the sprint's model: exactly four calm hospitality cards (restraint); the
   scene is a replaceable asset that builds correct responsive markup; and the
   room-soundtrack preference model validates, persists per room, and never
   fabricates a preference. No streaming/auth/playback is present.
   ============================================================================= */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { HOSPITALITY, SUSPENDED_CARDS, LOWER_CARDS, FOUNDER_IDENTITY } from '../src/headquarters/hospitality.ts';
import { CURRENT_SCENE, scenePictureHTML, sceneSrcset, sceneFallbackSrc } from '../src/headquarters/scene.ts';
import {
  SOUNDTRACK_PROVIDERS, soundtrackRooms, providerLabel,
  makePreference, preferenceFor, setPreference, clearPreference,
  type RoomSoundtrack,
} from '../src/headquarters/atmosphere.ts';
import { ROOMS } from '../src/headquarters/rooms.ts';

/* --- hospitality: the approved composition (2 suspended + 5 lower) -------- */
test('two suspended cards: Today’s Intention, Thought of the Day', () => {
  assert.deepEqual(SUSPENDED_CARDS.map((c) => c.kind), ['intention', 'thought']);
  assert.ok(SUSPENDED_CARDS.every((c) => c.placement === 'suspended'));
});

test('five lower cards, in the approved order', () => {
  assert.deepEqual(LOWER_CARDS.map((c) => c.kind),
    ['briefing', 'priorities', 'from-house', 'mindful', 'atmosphere']);
  assert.deepEqual(LOWER_CARDS.map((c) => c.eyebrow),
    ['Today’s Briefing', 'Priorities', 'From the House', 'Mindful Moment', 'Atmosphere']);
  assert.ok(LOWER_CARDS.every((c) => c.placement === 'lower'));
});

test('seven cards total; suspended + lower partition the set', () => {
  assert.equal(HOSPITALITY.length, 7);
  assert.equal(SUSPENDED_CARDS.length + LOWER_CARDS.length, HOSPITALITY.length);
});

test('resting cards carry a body; the live briefing card is filled at render, not fabricated', () => {
  for (const c of HOSPITALITY) {
    if (c.live) { assert.equal(c.body, ''); }   // Today’s Briefing: filled from the real Daily Briefing
    else { assert.ok(c.eyebrow.length > 0 && c.body.length > 0); }
  }
  const briefing = LOWER_CARDS.find((c) => c.kind === 'briefing')!;
  assert.equal(briefing.live, true);
});

test('every lower card carries an action button; suspended cards do not', () => {
  for (const c of LOWER_CARDS) {
    assert.ok(c.action, `lower card ${c.kind} should have an action button`);
    assert.ok(c.actionLabel && c.actionLabel.length > 0);
  }
  for (const c of SUSPENDED_CARDS) assert.equal(c.action, undefined);
  // Atmosphere opens the Soundscape control; the rest are honest navigation.
  assert.equal(LOWER_CARDS.find((c) => c.kind === 'atmosphere')!.action, 'atmosphere');
});

test('the Founder identity is display-only name + role', () => {
  assert.equal(FOUNDER_IDENTITY.name, 'Luscious Honey');
  assert.equal(FOUNDER_IDENTITY.role, 'Founder');
});

/* --- scene asset: replaceable + correct markup (asset-agnostic) ---------- */
test('scene builds responsive srcset from the asset (avif/webp/jpg, all widths)', () => {
  const a = CURRENT_SCENE;
  assert.equal(sceneSrcset(a, 'avif'),
    a.widths.map((w) => `${a.base}/${a.slug}-${w}.avif ${w}w`).join(', '));
  assert.equal(sceneFallbackSrc(a), `${a.base}/${a.slug}-${a.widths[a.widths.length - 1]}.jpg`);
});

test('scene picture is decorative, eager (above-the-fold), and carries mobile + landscape sources', () => {
  const a = CURRENT_SCENE;
  const html = scenePictureHTML(a);
  assert.match(html, /alt=""/);
  assert.match(html, /aria-hidden="true"/);
  // the scene is the primary above-the-fold background, so it loads eagerly
  assert.match(html, /loading="eager"/);
  assert.match(html, /decoding="async"/);
  // portrait crop below the mobile breakpoint, landscape above
  assert.ok(html.includes(`media="(max-width: ${a.mobileMaxWidth}px)"`));
  assert.ok(html.includes(`${a.base}/${a.mobileSlug}.avif`));
  assert.ok(html.includes(`${a.base}/${a.slug}-${a.widths[0]}.avif ${a.widths[0]}w`));
  // jpeg fallback present as the universal src
  assert.ok(html.includes(`src="${sceneFallbackSrc(a)}"`));
});

/* --- atmosphere: providers + preference model ---------------------------- */
test('the three future providers are present, no streaming/auth implied', () => {
  assert.deepEqual(SOUNDTRACK_PROVIDERS.map((p) => p.id), ['apple', 'spotify', 'soundcloud']);
  assert.deepEqual(SOUNDTRACK_PROVIDERS.map((p) => p.label), ['Apple Music', 'Spotify', 'SoundCloud']);
  assert.equal(providerLabel('spotify'), 'Spotify');
  assert.equal(providerLabel('unknown'), 'unknown');
});

test('every Executive Team room can hold a soundtrack preference', () => {
  assert.deepEqual(soundtrackRooms().map((r) => r.id), ROOMS.map((r) => r.id));
});

test('makePreference validates room, provider, and a non-empty title', () => {
  assert.equal(makePreference({ roomId: 'nope', provider: 'apple', title: 'x' }), null);
  assert.equal(makePreference({ roomId: 'executive', provider: 'bogus', title: 'x' }), null);
  assert.equal(makePreference({ roomId: 'executive', provider: 'apple', title: '   ' }), null);
  const ok = makePreference({ roomId: 'creative', provider: 'spotify', title: '  Focus Deep  ', url: ' https://x ' });
  assert.ok(ok);
  assert.equal(ok!.title, 'Focus Deep');    // trimmed
  assert.equal(ok!.url, 'https://x');        // trimmed
  assert.equal(ok!.provider, 'spotify');
});

test('an empty url normalises away', () => {
  const p = makePreference({ roomId: 'growth', provider: 'apple', title: 'Sunrise', url: '   ' });
  assert.ok(p);
  assert.equal(p!.url, undefined);
});

test('setPreference is per-room (replaces its own, keeps others); clear forgets one', () => {
  const a = makePreference({ roomId: 'creative', provider: 'spotify', title: 'Deep' })!;
  const b = makePreference({ roomId: 'growth', provider: 'apple', title: 'Sunrise' })!;
  const a2 = makePreference({ roomId: 'creative', provider: 'soundcloud', title: 'Rework' })!;
  let prefs: RoomSoundtrack[] = setPreference([], a);
  prefs = setPreference(prefs, b);
  prefs = setPreference(prefs, a2); // replaces creative, keeps growth
  assert.equal(prefs.length, 2);
  assert.equal(preferenceFor(prefs, 'creative')!.title, 'Rework');
  assert.equal(preferenceFor(prefs, 'growth')!.title, 'Sunrise');
  prefs = clearPreference(prefs, 'creative');
  assert.equal(preferenceFor(prefs, 'creative'), null);
  assert.equal(prefs.length, 1);
});

test('preferenceFor returns null when a room has no soundtrack', () => {
  assert.equal(preferenceFor([], 'business'), null);
});
