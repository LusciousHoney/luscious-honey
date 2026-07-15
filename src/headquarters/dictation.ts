/* =============================================================================
   HEADQUARTERS DICTATION — a reusable UI component (architecture only).

   The workflow: tap the microphone → dictate → a transcript appears → choose a
   destination → save. This module is the ARCHITECTURE: destinations and the draft
   shape, plus a pluggable transcription seam. NO speech API is called and no
   backend is touched — the recogniser is a stub the founder types into today, and
   `onSave` is a host-provided handler (e.g. schedule a note, hold a draft), so a
   real Web Speech / server transcription can drop in later with no UI change.
   ============================================================================= */

/** Where a dictated note can be sent. `room` deep-links when the destination is a
    room; service destinations (Daily Briefing, Calendar) are handled by the host. */
export interface DictationDestination { id: string; label: string; hint: string; }
export const DICTATION_DESTINATIONS: DictationDestination[] = [
  { id: 'briefing',   label: 'Daily Briefing', hint: 'A note for the desk' },
  { id: 'archive',    label: 'Archive',        hint: 'File it with the work' },
  { id: 'manuscript', label: 'Manuscript',     hint: 'Into the open page' },
  { id: 'project',    label: 'Project',        hint: 'A new thread of work' },
  { id: 'production', label: 'Production',      hint: 'For the studio' },
  { id: 'operations', label: 'Operations',      hint: 'For the week' },
  { id: 'growth',     label: 'Growth',          hint: 'A conversation to keep' },
  { id: 'business',   label: 'Business',        hint: 'For the archive of record' },
  { id: 'calendar',   label: 'Calendar',        hint: 'Schedule it' },
];
const DEST_IDS = new Set(DICTATION_DESTINATIONS.map((d) => d.id));

/** The captured note, ready for a future integration to route. */
export interface DictationDraft { text: string; destination: string; at: string; }

/** Validate a capture into a draft, or null if there is nothing to save. */
export function makeDraft(text: string, destination: string): DictationDraft | null {
  const t = (text || '').trim();
  if (!t) return null;
  const dest = DEST_IDS.has(destination) ? destination : DICTATION_DESTINATIONS[0].id;
  return { text: t, destination: dest, at: new Date().toISOString() };
}

/**
 * The transcription seam. Today it is a manual stub (the founder types the
 * transcript); `isLive` is false so the UI shows an honest "type your note"
 * affordance rather than pretending to listen. A future speech integration
 * replaces this object without touching the component.
 */
export interface Transcriber { isLive: boolean; }
export const manualTranscriber: Transcriber = { isLive: false };
