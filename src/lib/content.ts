/// <reference types="vite/client" />
/* =============================================================================
   CONTENT SERVICE — the operational content store.
   Loads STRUCTURED CONTENT from /content/*.json at build time (no runtime fetch)
   and exposes governed selectors. This is the seam a future CMS / Cloudflare
   data source replaces: swap the loaders below; the governance rules and the
   whole presentation layer stay unchanged.

   Publishing is manual: an editor edits a JSON file and sets `status` to
   "published". Nothing here generates or auto-promotes content.
   ============================================================================= */

import type { JournalEntry, Fragment, HeldFrame, Work, RecordingFlag, RecordingState } from './content-types';
import * as gov from './governance';

/* --- Structured content, imported eagerly (inlined into the bundle) -------
   To add a Journal entry or a Work: drop a new .json file in the folder.
   To publish it: set its "status" to "published". That is the whole workflow. */

const journalMods = import.meta.glob('../../content/journal/*.json', {
  eager: true, import: 'default',
}) as Record<string, JournalEntry>;

const workMods = import.meta.glob('../../content/works/*.json', {
  eager: true, import: 'default',
}) as Record<string, Work>;

const fragmentMods = import.meta.glob('../../content/writing-wall/*.json', {
  eager: true, import: 'default',
}) as Record<string, Fragment[]>;

const heldFrameMods = import.meta.glob('../../content/held-frame/*.json', {
  eager: true, import: 'default',
}) as Record<string, HeldFrame>;

const recordingMods = import.meta.glob('../../content/now-recording/*.json', {
  eager: true, import: 'default',
}) as Record<string, RecordingFlag>;

const journalEntries: JournalEntry[] = Object.values(journalMods);
const works: Work[] = Object.values(workMods);
const fragments: Fragment[] = Object.values(fragmentMods).flat();
const heldFrames: HeldFrame[] = Object.values(heldFrameMods);
// A missing/absent flag is treated as dark — the studio defaults to rest.
const recordingFlag: RecordingFlag = Object.values(recordingMods)[0] ?? { live: false };

/* --- Governed selectors (bound to the loaded content) --------------------- */

/** Latest published Journal entry for the Front Desk; last published stays. */
export const latestJournal = (): JournalEntry | undefined =>
  gov.selectLatestJournal(journalEntries);

/** Full published Journal, newest first — for the growing archive. */
export const journalArchive = (): JournalEntry[] =>
  gov.selectJournalArchive(journalEntries);

/** The one curated Writing Wall fragment now, or none (the wall rests). */
export const activeFragment = (): Fragment | undefined =>
  gov.selectActiveFragment(fragments, new Date());

/** The single curated Held Frame, or none (it rests). */
export const currentHeldFrame = (): HeldFrame | undefined =>
  gov.selectCurrentHeldFrame(heldFrames);

/** Published editorial works — featured first. */
export const publishedWorks = (): Work[] => gov.selectPublishedWorks(works);

/** A single published work by slug (for the Reader). */
export const getWork = (slug: string): Work | undefined =>
  publishedWorks().find((w) => w.slug === slug);

/** The current Now-Recording state — defaults to dark; never faked. */
export const currentRecording = (): RecordingState =>
  gov.selectRecordingState(recordingFlag, new Date());

export { formatHouseDate, houseTimestamp } from './governance';
export type { Work, JournalEntry, Fragment, HeldFrame, Media, BodyBlock, RecordingState } from './content-types';
