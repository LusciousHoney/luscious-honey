/* =============================================================================
   ATMOSPHERE — the room-level soundtrack PREFERENCE model (Sprint 10).

   The framework only: "when I enter this room, this is the playlist I prefer."
   The Headquarters remembers a preferred soundtrack per Executive Team room so a
   future integration can honour it. This module is the INTERFACE + PREFERENCE
   MODEL — there is NO streaming, NO auth/OAuth, NO playback, NO queue, and NO
   playlist browser. Preferences are the founder's own and persist client-side in
   localStorage, exactly like the Headquarters Calendar and Dictation. The model
   is shaped so playback can drop in later with no UI redesign: each preference
   already names a provider + a reference a player can resolve.
   ============================================================================= */

import { ROOMS, isRoomId, type RoomId } from './rooms.ts';

/** The future providers the founder may choose. Interface + preference only —
    none is contacted here; these are labels the founder assigns a room to. */
export interface SoundtrackProvider { id: string; label: string; }
export const SOUNDTRACK_PROVIDERS: SoundtrackProvider[] = [
  { id: 'apple',      label: 'Apple Music' },
  { id: 'spotify',    label: 'Spotify' },
  { id: 'soundcloud', label: 'SoundCloud' },
];
const PROVIDER_BY_ID = new Map(SOUNDTRACK_PROVIDERS.map((p) => [p.id, p]));

/** The label for a provider id (or the raw id if somehow unknown). */
export function providerLabel(id: string): string {
  return PROVIDER_BY_ID.get(id)?.label ?? id;
}

/** One room's remembered soundtrack. `title` is what the founder types (a
    playlist or station name); `url` is an optional link they paste. A future
    player resolves (provider, title/url) — this module never plays anything. */
export interface RoomSoundtrack {
  roomId: RoomId;
  provider: string;   // one of SOUNDTRACK_PROVIDERS ids
  title: string;      // the playlist/station name the founder prefers
  url?: string;       // optional link to the playlist
}

/** The rooms that can hold a soundtrack preference — every Executive Team room. */
export function soundtrackRooms(): { id: RoomId; name: string }[] {
  return ROOMS.map((r) => ({ id: r.id, name: r.name }));
}

/** Validate + normalise a preference (or null if the room/provider is unknown
    or the title is empty). No preference is fabricated — the founder sets it. */
export function makePreference(input: { roomId: string; provider: string; title: string; url?: string }): RoomSoundtrack | null {
  if (!isRoomId(input.roomId)) return null;
  if (!PROVIDER_BY_ID.has(input.provider)) return null;
  const title = (input.title || '').trim();
  if (!title) return null;
  const url = (input.url || '').trim() || undefined;
  return { roomId: input.roomId, provider: input.provider, title, url };
}

/** The remembered preference for a room, or null when none is set. */
export function preferenceFor(prefs: RoomSoundtrack[], roomId: RoomId): RoomSoundtrack | null {
  return prefs.find((p) => p.roomId === roomId) ?? null;
}

/** Set (replace) a room's preference, keeping every other room's untouched. */
export function setPreference(prefs: RoomSoundtrack[], pref: RoomSoundtrack): RoomSoundtrack[] {
  return [...prefs.filter((p) => p.roomId !== pref.roomId), pref];
}

/** Forget a room's preference. */
export function clearPreference(prefs: RoomSoundtrack[], roomId: RoomId): RoomSoundtrack[] {
  return prefs.filter((p) => p.roomId !== roomId);
}

/* --- client persistence (localStorage; no backend) ------------------------ */
const STORE = 'lhc.hq.atmosphere.v1';

export function loadPreferences(): RoomSoundtrack[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORE) : null;
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(isPreference) : [];
  } catch { return []; }
}
export function savePreferences(prefs: RoomSoundtrack[]): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORE, JSON.stringify(prefs));
  } catch { /* ignore */ }
}
function isPreference(p: unknown): p is RoomSoundtrack {
  const o = p as RoomSoundtrack;
  return !!o && isRoomId(o.roomId) && typeof o.provider === 'string'
    && PROVIDER_BY_ID.has(o.provider) && typeof o.title === 'string';
}
