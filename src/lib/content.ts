/* =============================================================================
   CONTENT MODEL — Sprint 04 · Part VIII.
   Types mirror the locked data model. Data here is a small, hand-maintained
   fixture set. The House must never fake activity: entries carry real dates,
   and anything not yet real is marked `status: 'fixture'` and surfaced with a
   visible development flag (never shown in production).
   ============================================================================= */

export type PublishState = 'published' | 'scheduled' | 'draft' | 'fixture';

/** Work { id, title, creator, medium, year, body, media, relations[] } */
export interface Media {
  id: string;
  kind: 'image' | 'audio' | 'video';
  /** Poster/fallback always present so layout reserves space before load. */
  poster: string;
  /** Optional heavy source, loaded on intent only. */
  src?: string;
  alt: string;
  aspect: string; // e.g. "3/2"
  caption?: string;
}

export interface Work {
  id: string;
  slug: string;
  title: string;
  creator: string;      // public identity only — never a legal name
  medium: 'interview' | 'essay' | 'letter' | 'audio' | 'film';
  year: number;
  date: string;         // ISO — real publication date
  dek?: string;         // standfirst / editorial summary
  body: BodyBlock[];
  media?: Media;
  relations?: string[]; // ids of related works (Archive threads, later)
  status: PublishState;
  featured?: boolean;
}

export type BodyBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'pull'; text: string }               // pull-quote
  | { type: 'qa'; q: string; a: string }          // interview turn
  | { type: 'note'; text: string };               // margin note

/** JournalEntry { date, body, signed } */
export interface JournalEntry {
  date: string;   // ISO — real, dated, never auto-generated
  week: number;   // house week number
  body: string;
  signed: string; // "L.H." — never a legal name
  status: PublishState;
}

/** Fragment { id, text, active } — Writing Wall WIP, unattributed */
export interface Fragment {
  id: string;
  text: string;
  active: boolean;
  status: PublishState;
}

/* -----------------------------------------------------------------------------
   FIXTURE DATA — clearly temporary. Replace with the CMS-backed source before
   launch. Every item below is marked `status: 'fixture'`.
   No real recording, event, or archive data is fabricated here.
   --------------------------------------------------------------------------- */

export const journal: JournalEntry[] = [
  {
    date: '2026-07-05',
    week: 27,
    body:
      'The corridor is dark on purpose. We keep the lamps low so the work is the ' +
      'only thing that carries its own light. This week the Publishing wing opened ' +
      'its first door — a conversation we have wanted to run for a long time.',
    signed: 'L.H.',
    status: 'fixture',
  },
  {
    date: '2026-06-28',
    week: 26,
    body:
      'A house is not its floorplan; it is who is inside it, mid-sentence. We spent ' +
      'the week deciding what the first held frame should be, and changed our minds twice.',
    signed: 'L.H.',
    status: 'fixture',
  },
];

export const fragments: Fragment[] = [
  { id: 'f1', text: 'She kept the letter, unopened, for nineteen years—', active: true, status: 'fixture' },
  { id: 'f2', text: 'and the tape was still running when nobody was left to hear it.', active: true, status: 'fixture' },
];

export const works: Work[] = [
  {
    id: 'w-open-the-house',
    slug: 'opening-the-house',
    title: 'Opening the House',
    creator: 'Luscious Honey',
    medium: 'interview',
    year: 2026,
    date: '2026-07-05',
    dek:
      'On why an editorial institution should feel like a building you can walk ' +
      'into — and what it owes the people who step inside.',
    featured: true,
    status: 'fixture',
    media: {
      id: 'm-desk',
      kind: 'image',
      poster: '/media/frame-04-editors-desk.poster.svg',
      alt: 'Over-the-shoulder view of a walnut writing desk under a single warm brass lamp, an open dated page beneath the light.',
      aspect: '3/2',
      caption: 'The editor’s desk, just off Reception. Frame 04.',
    },
    body: [
      { type: 'p', text:
        'We are told, often, that publishing is a feed — an endless downward scroll ' +
        'of things that arrive and are gone. The House was built to argue with that. ' +
        'It is a place, and places have thresholds.' },
      { type: 'qa',
        q: 'Why a corridor? Why not a homepage?',
        a: 'Because a homepage asks nothing of you and remembers nothing of you. ' +
           'A corridor makes you walk, and walking is a small act of consent. You ' +
           'pass doors. You choose one. The architecture is the navigation.' },
      { type: 'pull', text: 'Darkness makes the lit rooms matter.' },
      { type: 'qa',
        q: 'The lamps stay low. Isn’t that a risk — asking people to read in the dark?',
        a: 'The rooms are dark; the plates are not. Wherever there is text there is a ' +
           'solid, bright surface under it, at full contrast. The dark is the hallway. ' +
           'The light is the work.' },
      { type: 'h2', text: 'On not faking a pulse' },
      { type: 'p', text:
        'The one rule we will not bend: the House never pretends to be busier than it ' +
        'is. If nothing is recording, the lamp is dark. If no event is booked, the Salon ' +
        'rests. An honest empty room is not a bug to paper over.' },
      { type: 'note', text: 'The Now-Recording lamp is bound to a real session flag and fails to dark.' },
      { type: 'qa',
        q: 'What does the first slice have to prove?',
        a: 'That the metaphor survives contact with real reading. Arrival, the desk, the ' +
           'corridor, one working wing, one real piece on a solid reading plate. If that ' +
           'feels like the House, the rest is extension, not reinvention.' },
    ],
  },
];

export function getWork(slug: string): Work | undefined {
  return works.find((w) => w.slug === slug);
}

/**
 * Format an ISO date-only string ("YYYY-MM-DD") as a house date in LOCAL time.
 * `new Date("2026-07-05")` parses as UTC midnight and can render as the previous
 * day in western timezones — so we build the date from its parts.
 */
export function formatHouseDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

/** Latest real (or fixture) dated Journal entry; if none new, the last stays. */
export function latestJournal(): JournalEntry | undefined {
  return [...journal].sort((a, b) => b.date.localeCompare(a.date))[0];
}

export function activeFragment(): Fragment | undefined {
  return fragments.find((f) => f.active);
}
