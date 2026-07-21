/* =============================================================================
   COLLECTIVE SUBMISSION FORMS — environment-neutral field specification.

   The SINGLE source of truth for the SHAPE of the Collective's creative-intake
   forms, imported by BOTH the Cloudflare Functions (server, authoritative
   validation) and the public submission client (rendering). It holds ONLY data:
   submitter roles, the shared intake fields, and the per-type field lists.

   It contains NO validation, storage, or request logic — the intake endpoint and
   the submission-type registry remain authoritative and re-validate every field.

   This activates the framework already described in functions/_lib/
   submission-types.js: "Adding a future type is a new entry here plus its own
   public form — storage, workflow, correspondence, audit, and auth are all
   inherited unchanged." The registered `artist_feature` pathway keeps its own
   dedicated form and is intentionally NOT redefined here.

   A field spec:
     key         stored key (also the posted key); readable → nice Office labels
     label       human label shown on the form
     kind        'text' | 'email' | 'url' | 'longtext' | 'choice' | 'multi'
     required    server-enforced presence (default false)
     options     choices for 'choice' / 'multi'
     help        one quiet line under the label
     placeholder input placeholder
     max         server-side length clamp (per value)
     showWhenRoleNot  hide on the form while the submitter role equals this id
   ============================================================================= */

// Who is submitting — every submission names this once. It lets the Founder or a
// Collective representative propose an artist who is not submitting personally.
export const SUBMITTER_ROLES = [
  { id: 'self',           label: 'The artist — submitting my own work' },
  { id: 'representative', label: 'A Collective representative proposing an artist' },
  { id: 'recommender',    label: 'Someone recommending an artist' },
];

// The Collective's institutional areas of responsibility — NOT workflow engines.
// A submitter proposes where the House might come in; the House decides.
export const INVOLVEMENT_AREAS = [
  'Creator Relationships',
  'Editorial',
  'Publishing',
  'Production',
  'Growth',
  'Interview or live presentation',
];

// Collected once for every submission type. `artistName` + `email` become the
// submission's name/contact columns; the rest are stored in `fields`.
export const COMMON_FIELDS = [
  { key: 'submitterName', label: 'Your name', kind: 'text', required: true, max: 120,
    help: 'The person filling this out.' },
  { key: 'email', label: 'Your email', kind: 'email', required: true, max: 160,
    help: 'Where the desk can reach you.', placeholder: 'you@example.com' },
  { key: 'artistName', label: 'Artist or creator name', kind: 'text', required: true, max: 160,
    help: 'Whose work this is. If it is your own, your artist or stage name.' },
  { key: 'relationship', label: 'Your relationship to the artist', kind: 'text', max: 160,
    help: 'e.g. manager, publisher, longtime reader. Only if this isn’t your own work.',
    showWhenRoleNot: 'self' },
  { key: 'title', label: 'Title of the work or opportunity', kind: 'text', required: true, max: 200 },
  { key: 'description', label: 'A brief description', kind: 'longtext', required: true, max: 2000,
    help: 'What it is, and why it belongs in the House.' },
  { key: 'links', label: 'Relevant links', kind: 'longtext', max: 1000,
    help: 'One per line — where we can see or hear the work.' },
  { key: 'assets', label: 'Supporting materials', kind: 'longtext', max: 1000,
    help: 'Optional — press kit, images, documents (describe or link).' },
  { key: 'timing', label: 'Timing or important dates', kind: 'text', max: 300,
    help: 'Optional — a release date, an event date, a deadline.' },
  { key: 'involvement', label: 'Proposed Collective involvement', kind: 'multi', options: INVOLVEMENT_AREAS,
    help: 'Where you imagine the Collective coming in. Nothing is promised — the House decides.' },
];

// The creative pathways activated in Version 1 (order = form priority). The
// existing Interview / Artist Feature pathway (`artist_feature`) keeps its own
// dedicated form and is presented alongside these by the submission desk.
export const SUBMISSION_FORMS = [
  {
    id: 'music',
    title: 'Music',
    description: 'A single, EP, album, performance, or feature — brought to the House.',
    icon: '🎵',
    category: 'Music',
    lede: 'Tell the House about the music and how you hope it might come in.',
    fields: [
      { key: 'format', label: 'What is it', kind: 'choice', required: true,
        options: ['Single', 'EP', 'Album', 'Live performance', 'Feature'] },
      { key: 'listeningLink', label: 'Where to listen', kind: 'url', required: true, max: 400,
        help: 'Spotify, Apple Music, Bandcamp, SoundCloud — somewhere the desk can hear it.' },
      { key: 'releaseStatus', label: 'Release status', kind: 'choice',
        options: ['Released', 'Upcoming', 'Unreleased'] },
    ],
  },
  {
    id: 'book',
    title: 'Book or Literary Work',
    description: 'A book, manuscript, or literary work for feature, interview, excerpt, or review.',
    icon: '📖',
    category: 'Literature',
    lede: 'Introduce the book and how you imagine the House holding it.',
    fields: [
      { key: 'author', label: 'Author', kind: 'text', required: true, max: 160 },
      { key: 'pubStatus', label: 'Publication status', kind: 'choice',
        options: ['Published', 'Forthcoming', 'Manuscript', 'Self-published'] },
      { key: 'bookLink', label: 'Cover or purchase link', kind: 'url', max: 400 },
    ],
  },
  {
    id: 'podcast',
    title: 'Podcast or Audio Program',
    description: 'A podcast or audio program — a collaboration, feature, or conversation.',
    icon: '🎧',
    category: 'Audio',
    lede: 'Tell the House about the program and the collaboration you have in mind.',
    fields: [
      { key: 'host', label: 'Creator or host', kind: 'text', required: true, max: 160 },
      { key: 'episodeOrSeries', label: 'Episode or series', kind: 'text', max: 200 },
      { key: 'listenLink', label: 'Where to listen', kind: 'url', required: true, max: 400 },
    ],
  },
  {
    id: 'visual_art',
    title: 'Visual Art or Photography',
    description: 'Visual art or photography — a work, a collection, or a portfolio.',
    icon: '🖼️',
    category: 'Visual Art',
    lede: 'Show the House the work and how it might be presented.',
    fields: [
      { key: 'portfolioLink', label: 'Portfolio link', kind: 'url', required: true, max: 400 },
      { key: 'workOrCollection', label: 'Work or collection', kind: 'text', max: 200 },
      { key: 'usageNotes', label: 'Usage and display considerations', kind: 'longtext', max: 1000,
        help: 'Optional — rights, sizing, credit, anything the House should honour.' },
    ],
  },
  {
    id: 'event',
    title: 'Event or Live Experience',
    description: 'An event or live experience the Collective might take part in.',
    icon: '🎟️',
    category: 'Events',
    lede: 'Tell the House about the event and the participation you hope for.',
    fields: [
      { key: 'eventType', label: 'Type of event', kind: 'text', required: true, max: 160,
        help: 'e.g. reading, live show, panel, launch.' },
      { key: 'dateLocation', label: 'Date and location', kind: 'text', required: true, max: 300 },
      { key: 'participants', label: 'Artist or participants', kind: 'text', max: 300 },
    ],
  },
  {
    id: 'other_proposal',
    title: 'Other Creative Proposal',
    description: 'A creative proposal that doesn’t fit the paths above.',
    icon: '✳️',
    category: 'Proposals',
    lede: 'Some of the best things don’t fit a category. Tell the House plainly.',
    fields: [
      { key: 'outcome', label: 'What would a good outcome look like', kind: 'longtext', max: 1000,
        help: 'What should exist, or be true, after this that isn’t now?' },
    ],
  },
];

const FORMS_BY_ID = new Map(SUBMISSION_FORMS.map((f) => [f.id, f]));

/** A form spec by type id, or null. */
export function getSubmissionForm(id) {
  return FORMS_BY_ID.get(id) || null;
}

/** All fields (shared + type-specific) for a type, in form order. */
export function fieldsForForm(id) {
  const form = getSubmissionForm(id);
  if (!form) return [];
  return [...COMMON_FIELDS, ...form.fields];
}

/** The human label for a submitter-role id (falls back to the id). */
export function roleLabel(id) {
  const r = SUBMITTER_ROLES.find((x) => x.id === id);
  return r ? r.label : id;
}
