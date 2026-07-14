/* =============================================================================
   EXECUTIVE TEAM HEADQUARTERS — room registry.

   The private, founder-only Headquarters. Following the House pattern (a
   document type is a schema object; see src/office/schema.ts), a DEPARTMENT is
   data — a registry entry — not a bespoke page. New departments are added by
   appending one entry here; the router and the scene read from this list and
   never hard-code a room.

   Milestone 1 is the SHELL: rooms exist, are enterable, and carry honest
   placeholder copy. No data, no business logic, no systems of record are read
   here — the Headquarters owns presentation only. Existing systems (Editorial
   Office, Production Studio, the submissions spine) remain authoritative and are
   wired in later milestones.
   ============================================================================= */

/** The six departments. `executive` is the atrium — the daily starting point. */
export type RoomId =
  | 'executive'
  | 'operations'
  | 'creative'
  | 'production'
  | 'growth'
  | 'business';

/**
 * `atrium`     — the Executive Office; the scene the founder arrives into.
 * `department` — a room the founder enters (seated work state).
 */
export type RoomKind = 'atrium' | 'department';

/**
 * `live`     — a shell room with a work surface reserved for a later milestone.
 * `reserved` — a department with no system of record yet (Growth, Business);
 *              it is enterable but shows an honest "in preparation" state rather
 *              than a fabricated dashboard (House principle P11: never fake
 *              activity; no empty institution).
 */
export type RoomStatus = 'live' | 'reserved';

/**
 * Reserved slot for the future Presence Layer — visual representations of
 * collaborators, creators, and executive-team members within a room. NOT part
 * of Version 1 and intentionally left empty. Its presence on the interface lets
 * the layer be added later by populating `presence` on a room, without
 * redesigning the Headquarters. See docs/headquarters/Architecture.md.
 */
export interface PresenceSlot {
  /* reserved — no fields in V1 */
}

export interface Room {
  id: RoomId;
  /** Display name (institutional). */
  name: string;
  /** One quiet line of what the room is for. */
  blurb: string;
  /** Deep-linkable hash route, e.g. '#/operations'. */
  route: string;
  kind: RoomKind;
  status: RoomStatus;
  /** Reserved for the future Presence Layer (see PresenceSlot). Unused in V1. */
  presence?: PresenceSlot[];
}

/**
 * The Headquarters, as data. Order is the order the departments are presented
 * in the atrium and in the mobile index.
 */
export const ROOMS: Room[] = [
  {
    id: 'executive',
    name: 'Executive Office',
    blurb: 'The atrium. Where the day begins and every thread is in view.',
    route: '#/executive',
    kind: 'atrium',
    status: 'live',
  },
  {
    id: 'operations',
    name: 'Operations Office',
    blurb: 'Keeping the House running — the work that holds everything up.',
    route: '#/operations',
    kind: 'department',
    status: 'live',
  },
  {
    id: 'creative',
    name: 'Creative Director',
    blurb: 'Editorial judgement and the shape of what the House makes.',
    route: '#/creative',
    kind: 'department',
    status: 'live',
  },
  {
    id: 'production',
    name: 'Production Suite',
    blurb: 'Where finished work is recorded, made, and readied.',
    route: '#/production',
    kind: 'department',
    status: 'live',
  },
  {
    id: 'growth',
    name: 'Growth Studio',
    blurb: 'Where the House finds resonance — its conversations with the world.',
    route: '#/growth',
    kind: 'department',
    status: 'live',
  },
  {
    id: 'business',
    name: 'Business Office',
    blurb: 'Where what the House has built is kept safe — protection and permanence.',
    route: '#/business',
    kind: 'department',
    status: 'live',
  },
];

/** The atrium / daily starting point. */
export const HOME_ROOM: RoomId = 'executive';

const BY_ID = new Map<RoomId, Room>(ROOMS.map((r) => [r.id, r]));

/** A room by id, or null if the id is not a known department. */
export function getRoom(id: string | null | undefined): Room | null {
  if (!id) return null;
  return BY_ID.get(id as RoomId) ?? null;
}

/** Whether a string is a known room id (used to validate restored memory). */
export function isRoomId(id: string | null | undefined): id is RoomId {
  return !!id && BY_ID.has(id as RoomId);
}
