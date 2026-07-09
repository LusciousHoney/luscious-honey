# Private Voice Notes Studio

A Creator Dashboard + live TikTok-ready phone preview for Luscious
Honey x Khalil voice-note episodes. Plain HTML/CSS/JS, no build step,
no backend, no framework.

**Normal episode creation should never require editing code.** Every
field in the dashboard on the left writes live into the phone preview
on the right — add notes, retime them, swap avatars, rename
characters, tune the recording — all from the UI.

## Run it on your Mac

This is your everyday tool — you launch it locally in your own browser.

**One-time setup:** make sure **Node.js** is installed (you already
have it if you run the main site with `npm run dev`). If not, download
the "LTS" installer from [nodejs.org](https://nodejs.org) and run it —
nothing else to install for the studio.

**Every time you want to use it:**

1. Open the **Terminal** app.
2. Go to the project folder (drag the folder onto the Terminal window
   after typing `cd `, then press Return):
   ```
   cd path/to/pull-me-under-site
   ```
3. Run this single command:
   ```
   npm run studio
   ```

Your browser opens automatically at **http://localhost:8080**. That's
the studio — bookmark it if you like.

**To stop it:** click the Terminal window and press **Control-C** (or
just close the Terminal window).

Notes:
- If port 8080 is busy, it quietly picks the next free one (8081, …) —
  the Terminal prints the exact address to open.
- The launcher has **no dependencies** — it uses only what comes with
  Node, so there's nothing to `npm install` for it.
- Prefer to run it from inside this folder instead? `cd
  private-voice-notes-studio` and run `node serve.mjs` — same result.
- Why a launcher instead of double-clicking `index.html`? The app loads
  its code as browser "modules," which only work over a real
  `http://` address, not a `file://` one. The launcher provides that
  address locally.

## Layout

- **Left: Creator Dashboard** — Project, Episode Information,
  Conversation, Audio, Characters, Recording, and Preview Controls.
- **Right: phone preview** — the actual 9:16 TikTok-ready screen.
  Nothing about its visual design changed from earlier sprints; it now
  just reads live from whatever the dashboard says instead of a
  hardcoded array in `script.js`.

## Collaboration workflow — Episode Packages (recommended)

An **Episode Package** is a single `Episode-NNN.zip` that carries the
whole episode *and* its media, so two people can build one episode
together by passing the file back and forth. No login, no cloud. This
is the primary way to work.

Inside the ZIP:

- `episode.json` — the project (metadata, notes, timing, settings) plus,
  per note: speaker, `uploaded` (true/false), filename, and duration.
  Also records the `packageType` and, for actor/return packages, who
  it's assigned to.
- `README.txt` — the collaboration steps, tailored to the package type.
- `/audio` — the voice-note clips bundled so far.
- `/avatars` — the character avatars (master/contributor packages only).

### Names: memo display names vs. the contributor person (Owner-only)

**Step 1 · Project Metadata** at the top of the **Project** section keeps
three separate free-text fields. They do different jobs:

- **Contributor Name** — the *person* you send the package to (e.g.
  `Khalil Vaughn`). This is only for addressing the package and its
  Return; it **never appears on the voice-memo thread**.
- **Owner Memo Display Name** — the name shown on **your** side of the
  voice-memo thread and export (e.g. `Nia`).
- **Contributor Memo Display Name** — the name shown on the **other**
  side of the thread and export (e.g. `Malik` or `Marcus`).

The two memo display names are what viewers see; type whatever the scene
calls for — they do **not** have to match any internal character. The
right-side phone preview updates the moment you type. (These are the same
display names as the **Characters** section further down — edit them in
either place.)

All three are **Owner-only** and saved in the project JSON and every
package. Permissions never depend on what you type: the contributor is
always locked to the same fixed memo lane, so a contributor can only edit
and return their own side regardless of the display name.

When the contributor opens their package, these values flow through
Contributor mode — the welcome banner ("Welcome, Khalil Vaughn — your
voice memos appear as Marcus"), the **+ Add …'s Take** and **Save …'s
Return Package** buttons, the package filenames and README, and the
Owner's import status.

### Roles: Owner and Contributor

The studio runs in one of two roles, decided by which package you open:

- **Owner (Master Project)** — full control: edit everything, upload or
  replace any audio, add/reorder/delete notes, tune recording, **export
  the video**, send Contributor Packages, and import Return Packages. This
  is the default when you start fresh or open a Master Project.
- **Contributor (Contributor Package)** — a locked upload portal. The
  Conversation list shows **only your assigned lines**; you can upload or
  replace their audio, edit those lines' label/receipt/timing, and use
  **+ Add …'s Take** to add extra takes of your own. You can **play the
  whole conversation in the phone preview** (including the Owner's audio)
  as many times as you need for performance context. When you're done,
  **Save Return Package** and send it back. You cannot export, change the
  episode title or other metadata, touch the Owner's lines or audio, edit
  other contributors' files, or access Owner controls. Reload the studio
  to return to Owner.

There are three package types:

- **Master Project** (`Episode-NNN.zip`) — the Owner's full copy.
- **Contributor Package** (`Episode-NNN-for-<Name>.zip`) — sent to a
  contributor; includes the owner's audio as **reference** so they can
  hear the conversation, but that audio is locked. Named by the
  Contributor when set, otherwise the speaker.
- **Return Package** (`Episode-NNN-return-<Name>.zip`) — contains
  **only** the contributor's new lines; the Owner imports it.

### A typical week

1. **Melody (Owner)** builds the episode, records her own side, sets the
   **Contributor Name** (`Malik Reeves`) and the memo display names
   (**Owner** `Nia`, **Contributor** `Malik`), clicks **Save Master
   Project** (keeps `Episode-005.zip`), then clicks **Package for
   Contributor** → `Episode-005-for-Malik Reeves.zip`, and sends it off.
2. **Malik** runs his own studio (`npm run studio`), clicks **Open Episode
   Package**, and lands in **Contributor mode** — the owner's lines already
   there (locked, reference), his own showing **⏳ Waiting for Malik**. He
   uploads only his lines and clicks **Save Return Package** →
   `Episode-005-return-Malik Reeves.zip`, and sends it back.
3. **Melody** opens her Master Project, clicks **Import Return Package**,
   and Malik's lines merge in. Every note reads **✓ Complete** — she
   exports the video.

Each note shows its status in the Conversation list: **✓ Complete** or
**⏳ Waiting for <display name>**. In Contributor mode, your own lines are
highlighted and everything else is read-only.

> **Export is held until every line has audio.** The Export button
> stays disabled until all notes are complete (in combined mode, until
> the mastered file is loaded). Need a rough cut sooner? Tick **"Export
> with placeholders"** and missing lines simply play silent.

Nothing here can freeze: notes still waiting run on placeholder timing,
so preview and (placeholder) export keep working.

## Advanced — Save / Load / Duplicate JSON (no media)

The **Project** section also keeps the lighter JSON tools for power
users. JSON saves the same project *text* but **no media** — handy for
templates and quick backups.

1. **Save Episode JSON** downloads `private-voice-notes-episode-NNN.json`.
2. **Load Episode JSON** rebuilds the dashboard and preview; any audio
   that was in use shows as **⏳ Waiting …** to re-upload.
3. **Duplicate Episode** clones the current setup as a starting point
   for the next one: it bumps the episode number, appends "Copy" to the
   title, keeps the character names / note structure / recording
   settings, and clears the audio references so you can drop in the new
   week's clips.

Prefer Packages when real audio is involved — they carry the files;
JSON does not.

### What the JSON saves (and what it doesn't)

Saved: project name, cast/pairing, contributor person name, the memo
display names (owner + contributor), episode metadata, audio mode, note
order/lane/label/receipt, per-note durations, Start/End times (combined
mode), recording + end-screen settings, and the **filenames** of any
audio/avatar files that were in use.

**Not saved: the actual audio and avatar files.** Only their filenames
are recorded, as a reminder of what to re-attach. This keeps project
files tiny and text-only.

### After loading: re-upload the media

Because the media itself isn't embedded, a freshly loaded episode shows
each note that expects a clip as **⏳ Waiting for Honey / Khalil** (and
the combined-audio field notes the file to re-attach). Everything still
works on placeholder timing until you re-attach the files — preview,
Recording Mode, and (placeholder) Export won't freeze. Re-upload each
clip to its note (and avatars in Characters) and the statuses flip to
**✓ Complete**. If you want the media to travel *with* the project, use
an **Episode Package** (above) instead of JSON.

## Where your sessions live (and organizing many of them)

**How a session is stored today.** The studio keeps everything in memory
while the tab is open — there is no database, no cloud, no browser storage
(no `localStorage`), and no accounts. A "session" only becomes a file when
you click **Save Master Project**, **Save Episode JSON**, or **Save Return
Package**. Those downloads land in your browser's **Downloads** folder as
`Episode-NNN.zip` / `.json`. Closing the tab without saving discards the
in-memory work. That is deliberate: no-cloud, no-database, no-login.

Because filenames are keyed only by episode number, a Downloads folder
fills up with `Episode-001.zip`, `Episode-001-for-James Okafor.zip`,
`Episode-001-return-James Okafor.zip`, `Episode-002.zip` … and they're
easy to mix up across weeks and contributors.

**Smallest recommended improvement (no database, no cloud): one folder
per episode, on disk.** Keep a plain folder tree wherever you already keep
your files (Finder, Dropbox, an external drive — your choice):

```
Pull Me Under — Voice Notes/
├── Episode-001/
│   ├── Episode-001.zip                     ← master (source of truth)
│   ├── Episode-001-for-James Okafor.zip    ← sent out
│   └── Episode-001-return-James Okafor.zip ← came back
└── Episode-002/
    └── Episode-002.zip
```

Drop each downloaded package into its episode folder and keep the newest
**master** as the source of truth. That's it — no tooling to build, it
works with the files the studio already produces, and it stays fully
offline. The new **Contributor Name** now travels *inside* each package
and shows in its filename, so even loose files are self-describing.

If organizing ever needs to be automatic, the next-smallest step (still
no database) would be to have **Save Master Project** offer a subfolder
name via the browser's File System Access API (`showSaveFilePicker`) —
but that's a future enhancement, not needed today.

## Section 1 — Episode Information

Title, Episode Number, Season, Internal Notes, and POV / Caption.
**This is metadata only.** None of it is ever rendered inside the
phone preview — POV lines and captions get tracked here for your own
reference when planning a post, not baked into the recording.

## Recommended workflow (per-note audio)

This is the everyday way to build an episode:

1. **Khalil's actor records his voice notes separately** — one clip per
   line, in whatever app they like.
2. **Honey records hers separately** — same, one clip per line.
3. **Each clip can already include its own effects/ambience** — reverb,
   room tone, music bed, whatever. No mastering into one file needed.
4. **Upload each clip to its matching note** in the Conversation
   section (each note row has its own audio field). Duration is read
   from the file automatically.
5. **Preview** to check the flow.
6. **Export** to get the finished 1080×1920 video with every note's
   audio stitched in order.

Revising one line later just means re-uploading that single note's
clip — nothing else has to change.

## Section 3 — Audio mode

A toggle at the top of the **Audio** section picks how audio is
supplied:

- **Upload audio for each voice note** *(default, recommended)* — the
  per-note workflow above. Each Conversation row gets its own audio
  upload field accepting **WAV, MP3, or M4A** (M4A depends on browser
  support; if it can't decode, that note falls back to placeholder
  timing). A per-note status line shows one of:
  - **No audio** — placeholder timing will be used
  - **Audio loaded** — decoded, with the file name and length
  - **Fallback timing** — a file was attached but couldn't be decoded,
    so placeholder timing is used instead
- **Advanced: single mastered file** — the older combined-audio
  workflow, kept for episodes that are already mixed down to one file.
  Upload one WAV/MP3 and each note plays its **Start Time / End Time**
  slice of it.

Switching modes keeps whatever you've already uploaded, so you can
move between them freely.

## Section 2 — Conversation

Each note is one row: Speaker, Duration, Receipt (`Delivered`/`Played`),
and a Voice Note Label (an internal reminder of what the note says —
not shown in the phone preview, but set as a hover tooltip on the
bubble for your own reference). The remaining fields depend on the
audio mode:

- **Per-note mode:** an **audio upload field + status** for that note.
  Duration is read automatically from the uploaded file (or a
  placeholder length until one is added).
- **Combined mode:** **Start Time / End Time** (seconds) that slice the
  note out of the mastered file; Duration is computed from them.

- **+ Add Note** appends a new note, alternating speaker automatically.
- **↑ / ↓** reorders a note; the phone preview always plays top to
  bottom in this order. A note's audio travels with it when reordered.
- **✕** deletes a note (there must always be at least one).

There's no note limit — add as many as an episode needs. Notes without
real audio (or with a file that failed to decode) use placeholder
timing so the preview and export never freeze.

## Section 5 — Characters

Display Name and Avatar for Khalil and for Honey. Renaming updates the
header and every bubble immediately; initials (used when an avatar is
missing) are derived automatically from the name, so there's no
separate initials field to keep in sync. Avatar accepts any local image
file — no need to place it in `images/` first.

## Section 6 — Recording

Countdown (seconds), Delay Before First Note (ms — the "settle" beat
after the countdown clears and before note 1 starts), Gap Between
Notes (ms), and the End Screen on/off toggle with its text.

## Section 7 — Preview Controls

- **Preview** — auto-plays every note top to bottom immediately, no
  countdown, no settle beat. Use this to sanity-check an episode
  before setting up a real recording.
- **Stop** — cancels whichever is running (Preview or Recording Mode)
  and resets playback state. Always available while something is
  running; disabled otherwise.
- **Start Recording Mode** — the real TikTok take: countdown → settle
  beat → every note auto-plays in order with the active bubble
  highlighted → optional end screen. The dashboard locks itself while
  this runs (use Stop to get it back) so an in-flight take can't be
  edited out from under itself.

## Section 8 — Export Video (no screen recording needed)

**Export Video** produces a finished video file right in the browser —
no screen recording, no server, no upload. It's the recommended way to
get a shareable clip.

How it works: the phone preview is redrawn into an offscreen
**1080×1920** canvas, that canvas is recorded with the browser's built-in
`MediaRecorder`, and the conversation audio is mixed straight into the
recording through the Web Audio API. When it finishes you get a
**Download** button.

- The status line walks through **Preparing → Recording → Finalizing →
  Download ready** so you always know where it's at.
- The file is named from the episode number, e.g.
  `private-voice-notes-episode-001.webm`.
- It captures the same take Recording Mode plays — countdown, settle
  beat, each note, and the optional end screen — with the phone frame
  held perfectly still.
- Export uses whichever audio mode is active — per-note clips stitched
  in order, or the mastered file sliced by timestamps. Notes on
  placeholder timing (no file, or a file that failed to decode) simply
  contribute silence for their duration, and never freeze the export.
  With no audio at all you still get a valid (silent) video.

### Format note — WebM today, MP4 later

Export produces **WebM** (VP9/Opus). That's the format browsers can
reliably record without any external tools, and it uploads to TikTok
fine. **MP4 export is a planned future enhancement** — browser-side MP4
recording isn't dependably supported yet, so doing it properly will
likely mean either a converting step or a small server-side transcode,
which is out of scope for this no-backend MVP. If you specifically need
an MP4 today, screen-recording the preview (below) still works.

## Screen recording for TikTok (alternative to Export)

Prefer **Export Video** above. Manual screen recording still works if
you want it — e.g. to capture an MP4 directly:

- Only the phone preview on the right is meant to be captured — the
  entire dashboard is deliberately outside that frame, and nothing
  from it (buttons, fields) ever renders inside `#phone-frame`.
- The frame is a 9:16 box sized to mirror a 1080x1920 export; crop
  your recording area to its edges before hitting record.
- Recording Mode never scrolls the browser page itself — only the
  message thread scrolls inside the frame — so the frame's position on
  screen stays fixed for the whole take.
- Suggested flow: line up your screen recorder's crop on the phone
  frame, click **Start Recording Mode**, then start your recording
  during the countdown so it's part of the clip.

## Interactive / web mode

Click any bubble's play button directly to hear it manually — this
still works exactly as before outside of Preview/Recording Mode, and
is the version that could eventually live on LHC/Penthouse as a
clickable web feature. Manual playback is disabled only while a
Preview or Recording sequence is actively running, and re-enables
automatically the moment it ends or is stopped.
