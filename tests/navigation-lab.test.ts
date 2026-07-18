/* =============================================================================
   HEADQUARTERS · STUDIO MODE — Navigation Lab pure logic tests (no DOM, no I/O).

   Sprint 002. These lock the lab's foundation: six genuinely distinct navigation
   definitions; verdicts recorded through the existing Studio preference store;
   undecided filtering so a judged system is never re-shown as undecided; the
   Save-for-Later deferral; the ≤3 review window with paging; honest finalist
   selection; and the room-preview targets, which derive from the real rooms.
   ============================================================================= */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  NAV_FAMILIES, NAV_DEMO_ITEMS, PREVIEW_ROOMS, LAB_VERDICTS,
  getNavFamily, isNavFamilyId, isPreviewRoomId,
  familyVerdict, isDecided, undecidedFamilies, decidedFamilies,
  familiesWithVerdict, savedFamilies,
  reviewWindow, defaultFinalists, normalizeFinalists,
  // Sprint 2A
  interactionStatesFor, reviewSummary,
} from '../src/headquarters/studio/navigation-lab.ts';
import {
  emptyPreferences, setPreference, type PreferenceState,
  emptyNotes, setOptionNote, getOptionNotes, hasNotes, NOTE_FIELDS, type NotesState,
} from '../src/headquarters/studio/preferences.ts';
import { ROOMS } from '../src/headquarters/rooms.ts';

/* --- the six definitions -------------------------------------------------- */

test('there are six navigation families with distinct ids and layouts', () => {
  assert.equal(NAV_FAMILIES.length, 6);
  const ids = NAV_FAMILIES.map((f) => f.id);
  assert.equal(new Set(ids).size, 6, 'ids are unique');
  const layouts = NAV_FAMILIES.map((f) => f.layout);
  assert.deepEqual(
    layouts,
    ['rail', 'ribbon', 'dock', 'sidebar', 'compass', 'hybrid'],
    'six genuinely different structural layouts, not recolours',
  );
  // every family carries real editorial substance (not a stub)
  for (const f of NAV_FAMILIES) {
    assert.ok(f.name.length > 0 && f.tagline.length > 0);
    assert.ok(f.structure.length > 20, `${f.id} has a real structure description`);
    assert.ok(f.interaction.length > 20, `${f.id} has a real interaction description`);
  }
  assert.equal(getNavFamily('nav-glass-rail')?.layout, 'rail');
  assert.equal(isNavFamilyId('nav-room-compass'), true);
  assert.equal(isNavFamilyId('nav-nope'), false);
});

test('every demo navigates the real residence (derived from ROOMS)', () => {
  assert.equal(NAV_DEMO_ITEMS.length, ROOMS.length);
  assert.deepEqual(NAV_DEMO_ITEMS.map((i) => i.roomId), ROOMS.map((r) => r.id));
  for (const it of NAV_DEMO_ITEMS) {
    const room = ROOMS.find((r) => r.id === it.roomId)!;
    assert.equal(it.label, room.name);
    assert.equal(it.route, room.route);
    assert.ok(it.short.length > 0);
  }
});

/* --- verdicts + undecided filtering --------------------------------------- */

test('the lab offers Love / Like / Save for Later / Pass (a subset of the vocabulary)', () => {
  assert.deepEqual(LAB_VERDICTS, ['love', 'like', 'save', 'pass']);
});

test('recording a verdict removes a family from the undecided queue', () => {
  let s: PreferenceState = emptyPreferences();
  assert.equal(undecidedFamilies(s).length, 6);      // all undecided at first
  assert.equal(decidedFamilies(s).length, 0);

  s = setPreference(s, 'nav-glass-rail', 'love');
  assert.equal(isDecided(s, 'nav-glass-rail'), true);
  assert.equal(familyVerdict(s, 'nav-glass-rail'), 'love');
  assert.equal(undecidedFamilies(s).length, 5);      // no longer presented as undecided
  assert.equal(decidedFamilies(s).length, 1);
  assert.ok(!undecidedFamilies(s).some((f) => f.id === 'nav-glass-rail'));
});

test('a verdict can be changed, and cleared back to undecided', () => {
  let s: PreferenceState = setPreference(emptyPreferences(), 'nav-top-ribbon', 'like');
  assert.equal(familyVerdict(s, 'nav-top-ribbon'), 'like');
  s = setPreference(s, 'nav-top-ribbon', 'pass');    // deliberate change
  assert.equal(familyVerdict(s, 'nav-top-ribbon'), 'pass');
  assert.equal(undecidedFamilies(s).length, 5);
});

/* --- Save for Later behaviour --------------------------------------------- */

test('Save for Later is a distinct deferred verdict, collected on its own shelf', () => {
  let s: PreferenceState = emptyPreferences();
  s = setPreference(s, 'nav-island-dock', 'save');
  s = setPreference(s, 'nav-room-compass', 'save');
  s = setPreference(s, 'nav-hybrid', 'love');
  const saved = savedFamilies(s);
  assert.deepEqual(saved.map((f) => f.id), ['nav-island-dock', 'nav-room-compass']);
  assert.equal(familiesWithVerdict(s, 'save').length, 2);
  // saved items are decided (not re-shown as undecided) but not loved/liked/passed
  assert.ok(!undecidedFamilies(s).some((f) => f.id === 'nav-island-dock'));
  assert.equal(familiesWithVerdict(s, 'love').length, 1);
});

/* --- the ≤3 review window ------------------------------------------------- */

test('the review window shows at most three at a time and pages honestly', () => {
  const all = NAV_FAMILIES;               // six undecided
  const p0 = reviewWindow(all, 0, 3);
  assert.equal(p0.families.length, 3);
  assert.equal(p0.pageCount, 2);
  assert.equal(p0.hasPrev, false);
  assert.equal(p0.hasNext, true);
  assert.equal(p0.total, 6);

  const p1 = reviewWindow(all, 1, 3);
  assert.equal(p1.families.length, 3);
  assert.equal(p1.hasNext, false);
  assert.equal(p1.hasPrev, true);
  // the two pages together cover all six exactly once
  assert.deepEqual(
    [...p0.families, ...p1.families].map((f) => f.id).sort(),
    all.map((f) => f.id).sort(),
  );

  // out-of-range pages clamp; the size is capped at 3 even if a caller asks for more
  assert.equal(reviewWindow(all, 99, 3).page, 1);
  assert.equal(reviewWindow(all, 0, 10).families.length, 3);
  // an empty queue is one honest empty page
  const empty = reviewWindow([], 0, 3);
  assert.equal(empty.families.length, 0);
  assert.equal(empty.pageCount, 1);
  assert.equal(empty.hasNext, false);
});

/* --- finalist comparison -------------------------------------------------- */

test('finalist selection yields two distinct families, preferring loved then liked', () => {
  let s: PreferenceState = emptyPreferences();
  const [d0a, d0b] = defaultFinalists(s);
  assert.notEqual(d0a, d0b);              // always two distinct
  assert.ok(isNavFamilyId(d0a) && isNavFamilyId(d0b));

  s = setPreference(s, 'nav-hybrid', 'love');
  s = setPreference(s, 'nav-editorial-sidebar', 'like');
  const [a, b] = defaultFinalists(s);
  assert.equal(a, 'nav-hybrid');          // loved ranks first
  assert.equal(b, 'nav-editorial-sidebar'); // liked second
});

test('normalizeFinalists repairs junk to two distinct known ids', () => {
  const [a, b] = normalizeFinalists('nav-glass-rail', 'nav-glass-rail'); // same twice
  assert.equal(a, 'nav-glass-rail');
  assert.notEqual(b, a);
  const [c, d] = normalizeFinalists('garbage', null);
  assert.ok(isNavFamilyId(c) && isNavFamilyId(d) && c !== d);
});

/* --- room-preview targets derive from the real rooms ---------------------- */

test('Try-in-Room offers Executive, Operations and Creative — real rooms', () => {
  assert.deepEqual(PREVIEW_ROOMS.map((r) => r.roomId), ['executive', 'operations', 'creative']);
  for (const r of PREVIEW_ROOMS) {
    const room = ROOMS.find((x) => x.id === r.roomId)!;
    assert.equal(r.name, room.name);
    assert.equal(r.route, room.route);
  }
  // only the Executive Office has a photographed scene today; the rest use the shell
  assert.equal(PREVIEW_ROOMS.find((r) => r.roomId === 'executive')!.hasScene, true);
  assert.equal(PREVIEW_ROOMS.find((r) => r.roomId === 'operations')!.hasScene, false);
  assert.equal(PREVIEW_ROOMS.find((r) => r.roomId === 'creative')!.hasScene, false);
  assert.equal(isPreviewRoomId('operations'), true);
  assert.equal(isPreviewRoomId('growth'), false);   // real room, but not offered for preview
});

/* =============================================================================
   SPRINT 2A — Founder evaluation session
   ============================================================================= */

test('every family carries objective designer notes (all four dimensions)', () => {
  for (const f of NAV_FAMILIES) {
    const d = f.designer;
    for (const key of ['philosophy', 'strengths', 'tradeoffs', 'idealUse'] as const) {
      assert.ok(d[key] && d[key].length > 20, `${f.id}.${key} is a real objective note`);
    }
    // objective, not marketing — no superlatives/hype in the copy
    const blob = `${d.philosophy} ${d.strengths} ${d.tradeoffs} ${d.idealUse}`.toLowerCase();
    for (const hype of ['best', 'amazing', 'perfect', 'stunning', 'revolutionary', 'the winner']) {
      assert.ok(!blob.includes(hype), `${f.id} designer notes avoid marketing word "${hype}"`);
    }
  }
});

test('interaction states expose expanded only where a system expands', () => {
  const sidebar = getNavFamily('nav-editorial-sidebar')!;
  const rail = getNavFamily('nav-glass-rail')!;
  assert.equal(sidebar.expandable, true);
  assert.equal(rail.expandable, false);
  const sidebarStates = interactionStatesFor(sidebar).map((s) => s.id);
  const railStates = interactionStatesFor(rail).map((s) => s.id);
  for (const s of ['rest', 'hover', 'active', 'selected', 'focus']) {
    assert.ok(railStates.includes(s as never), `rail exposes ${s}`);
  }
  assert.ok(sidebarStates.includes('expanded'), 'the sidebar exposes an expanded state');
  assert.ok(!railStates.includes('expanded'), 'the rail has no expanded state');
});

/* --- written notes persist through the preference architecture ------------ */

test('written notes are set, read, and cleared as a pure immutable layer', () => {
  assert.deepEqual(NOTE_FIELDS.map((f) => f.key), ['like', 'change', 'notes']);
  let s: NotesState = emptyNotes();
  assert.equal(hasNotes(s, 'nav-glass-rail'), false);
  assert.deepEqual(getOptionNotes(s, 'nav-glass-rail'), { like: '', change: '', notes: '' });

  const s1 = setOptionNote(s, 'nav-glass-rail', 'like', 'Always in reach');
  assert.notEqual(s1, s);                       // immutable
  assert.equal(hasNotes(s, 'nav-glass-rail'), false);  // input untouched
  assert.equal(getOptionNotes(s1, 'nav-glass-rail').like, 'Always in reach');
  assert.equal(hasNotes(s1, 'nav-glass-rail'), true);

  const s2 = setOptionNote(s1, 'nav-glass-rail', 'change', 'Reclaim the margin on phones');
  assert.equal(getOptionNotes(s2, 'nav-glass-rail').change, 'Reclaim the margin on phones');
  assert.equal(getOptionNotes(s2, 'nav-glass-rail').like, 'Always in reach'); // other field preserved

  // clearing every field removes the record entirely (no empty trace)
  const s3 = setOptionNote(setOptionNote(s2, 'nav-glass-rail', 'like', ''), 'nav-glass-rail', 'change', '');
  assert.equal(hasNotes(s3, 'nav-glass-rail'), false);
});

/* --- the review summary describes, never ranks ---------------------------- */

test('reviewSummary groups verdicts, carries notes, and recommends no winner', () => {
  let verdicts: PreferenceState = emptyPreferences();
  verdicts = setPreference(verdicts, 'nav-glass-rail', 'love');
  verdicts = setPreference(verdicts, 'nav-top-ribbon', 'like');
  verdicts = setPreference(verdicts, 'nav-island-dock', 'save');
  verdicts = setPreference(verdicts, 'nav-room-compass', 'pass');
  // nav-editorial-sidebar and nav-hybrid left unreviewed

  let notes: NotesState = emptyNotes();
  notes = setOptionNote(notes, 'nav-glass-rail', 'like', 'Predictable and calm');

  const s = reviewSummary(verdicts, notes);
  assert.deepEqual(s.loved.map((e) => e.family.id), ['nav-glass-rail']);
  assert.deepEqual(s.liked.map((e) => e.family.id), ['nav-top-ribbon']);
  assert.deepEqual(s.saved.map((e) => e.family.id), ['nav-island-dock']);
  assert.deepEqual(s.passed.map((e) => e.family.id), ['nav-room-compass']);
  assert.deepEqual(s.unreviewed.map((e) => e.family.id).sort(),
    ['nav-editorial-sidebar', 'nav-hybrid']);
  assert.deepEqual(s.counts, { loved: 1, liked: 1, saved: 1, passed: 1, unreviewed: 2 });

  // every family appears exactly once across the groups
  const total = s.loved.length + s.liked.length + s.saved.length + s.passed.length + s.unreviewed.length;
  assert.equal(total, NAV_FAMILIES.length);

  // written notes surface, verbatim, on the loved entry
  assert.deepEqual(s.withNotes.map((e) => e.family.id), ['nav-glass-rail']);
  assert.equal(s.withNotes[0].notes.like, 'Predictable and calm');

  // the summary object exposes no ranking / winner field
  assert.ok(!('winner' in s) && !('recommended' in s) && !('ranking' in s));
});
