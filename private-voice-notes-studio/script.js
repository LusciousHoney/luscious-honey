/* ==========================================================================
   Private Voice Notes Studio — Creator Dashboard
   Sprint 6: the dashboard (left) is the source of truth. Every field
   writes into `state` and the phone preview (right) re-renders from
   that same state — no code editing needed for a normal episode.
   ========================================================================== */

/* --------------------------------------------------------------------
   0. STATE
   Everything Melody can edit lives here. `state.notes` timing
   (startTime/endTime) currently drives the placeholder waveform
   animation; once real per-episode audio exists, the same fields
   slice playback out of `state.conversationAudio` instead — see the
   PLAYBACK ENGINE section.
   -------------------------------------------------------------------- */
let noteIdCounter = 0;
function nextNoteId() {
  noteIdCounter += 1;
  return `note-${noteIdCounter}`;
}

// Per-note audio slot. status: 'none' (no file yet), 'loaded' (decoded,
// duration known), or 'fallback' (file attached but failed to decode —
// placeholder timing is used instead so nothing freezes). `owner` marks
// whether the clip belongs to the Owner (reference, locked for
// contributors) or was added by a Contributor.
function newNoteAudio() {
  return { fileName: null, objectUrl: null, duration: 0, status: 'none', owner: true };
}

// Default avatar path per character — restored on load (uploaded avatar
// files aren't embedded in the JSON, so they fall back to this/initials).
const DEFAULT_AVATARS = { khalil: 'images/khalil.jpg', honey: 'images/luscious-honey.jpg' };

const state = {
  // 'owner' = Master Project, full control (default). 'contributor' =
  // opened an Actor Package: may only add audio for assignedSpeaker's
  // notes, preview, and save a Return Package. See applyRolePermissions.
  role: 'owner',
  assignedSpeaker: null,
  // In Contributor mode, the Owner-set contributor *person* name carried in
  // by the opened Actor Package (null in Owner mode). Used for the welcome
  // banner, button labels, and Return Package names. The permission lane
  // stays in assignedSpeaker (above) — never a typed name.
  assignedContributorName: null,
  project: {
    name: 'Pull Me Under — Private Voice Notes',
    casting: 'Luscious Honey x Khalil',
  },
  // Owner-only session metadata: the *person* receiving/returning the
  // package (free text). This is NOT a memo display name — the names shown
  // on the voice-memo thread are the memo lanes' display names, edited via
  // the Owner/Contributor Memo Display Name fields (state.characters[lane]
  // .name). Persisted in the project JSON and every package.
  contributor: {
    name: '',
  },
  episode: {
    title: 'Episode 1',
    number: 1,
    season: 1,
    internalNotes: '',
    povCaption: 'POV: You opened our private voice notes.',
  },
  characters: {
    khalil: { name: 'Khalil Vaughn', avatarUrl: DEFAULT_AVATARS.khalil, avatarFileName: null, initials: 'K' },
    honey: { name: 'Luscious Honey', avatarUrl: DEFAULT_AVATARS.honey, avatarFileName: null, initials: 'LH' },
  },
  // 'perNote'  = one audio file per voice note (default, recommended)
  // 'combined' = one mastered file sliced by each note's Start/End time
  audioMode: 'perNote',
  conversationAudio: { fileName: null, objectUrl: null },
  notes: [
    { id: nextNoteId(), speaker: 'khalil', label: 'Opening tease', startTime: 0, endTime: 8, placeholderDuration: 8, receipt: 'Played', audio: newNoteAudio() },
    { id: nextNoteId(), speaker: 'honey', label: 'Playful reply', startTime: 8, endTime: 14, placeholderDuration: 6, receipt: 'Played', audio: newNoteAudio() },
    { id: nextNoteId(), speaker: 'khalil', label: 'Follow-up', startTime: 14, endTime: 26, placeholderDuration: 12, receipt: 'Played', audio: newNoteAudio() },
    { id: nextNoteId(), speaker: 'honey', label: 'Cliffhanger', startTime: 26, endTime: 35, placeholderDuration: 9, receipt: 'Delivered', audio: newNoteAudio() },
  ],
  recording: {
    countdownSeconds: 3,
    settleBeforeFirstNote: 1000,
    delayBetweenNotes: 850,
    showEndScreen: true,
    endScreenText: 'Should we post Part 2?',
  },
};

const BARS_PER_NOTE = 26;

/* --------------------------------------------------------------------
   1. HELPERS
   -------------------------------------------------------------------- */
const PLAY_ICON =
  '<svg viewBox="0 0 24 24" width="13" height="13"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
const PAUSE_ICON =
  '<svg viewBox="0 0 24 24" width="13" height="13"><rect x="6" y="5" width="4" height="14" fill="currentColor"/><rect x="14" y="5" width="4" height="14" fill="currentColor"/></svg>';

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function noteDuration(note) {
  return Math.max(0.2, note.endTime - note.startTime);
}

// The duration actually used for playback/preview/export, per audio mode:
//   perNote  -> the note's own decoded file length, else its placeholder
//   combined -> the Start/End Time slice of the mastered file
function effectiveDuration(note) {
  if (state.audioMode === 'perNote') {
    if (note.audio && note.audio.status === 'loaded' && note.audio.duration > 0) {
      return Math.max(0.2, note.audio.duration);
    }
    return Math.max(0.2, note.placeholderDuration || 6);
  }
  return noteDuration(note);
}

// Whether a note will play real audio (vs. placeholder timing) right now.
function noteHasRealAudio(note) {
  if (state.audioMode === 'perNote') {
    return Boolean(note.audio && note.audio.status === 'loaded' && note.audio.objectUrl);
  }
  return hasConversationAudio();
}

// Resolves the shared <audio> source + time offset for a note, or null
// to use placeholder timing. Per-note files play from 0; the combined
// file is seeked to the note's Start Time.
function resolveNoteAudio(note) {
  if (state.audioMode === 'perNote') {
    if (note.audio && note.audio.status === 'loaded' && note.audio.objectUrl) {
      return { url: note.audio.objectUrl, base: 0 };
    }
    return null;
  }
  if (hasConversationAudio()) {
    return { url: state.conversationAudio.objectUrl, base: note.startTime };
  }
  return null;
}

// First letter of up to the first two words, uppercased — used so
// Characters only needs a Display Name field, never a separate
// initials field.
function deriveInitials(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

// Deterministic pseudo-random bar heights so the waveform looks the
// same on every render instead of jumping around.
function seededHeights(seed, count) {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * 31 + seed.charCodeAt(i)) >>> 0;
  const heights = [];
  for (let i = 0; i < count; i++) {
    n = (n * 1103515245 + 12345) >>> 0;
    const pct = 0.28 + ((n >>> 8) % 100) / 100 * 0.72; // 28%–100%
    heights.push(pct);
  }
  return heights;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* --------------------------------------------------------------------
   2. PHONE PREVIEW RENDER
   Rebuilds the thread header + bubbles from `state`. Safe to call on
   every keystroke — the phone preview has no focusable inputs, so a
   full rebuild never steals focus from whatever the user is typing in
   the dashboard.
   -------------------------------------------------------------------- */
const threadBody = document.getElementById('thread-body');
let noteRuntime = {}; // note.id -> playback runtime, rebuilt alongside the DOM

function buildWaveform(note) {
  const heights = seededHeights(note.id, BARS_PER_NOTE);
  const wrap = document.createElement('div');
  wrap.className = 'waveform-wrap';

  const bars = document.createElement('div');
  bars.className = 'waveform';
  heights.forEach((h) => {
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = `${Math.round(h * 100)}%`;
    bars.appendChild(bar);
  });

  const playhead = document.createElement('div');
  playhead.className = 'playhead';

  wrap.appendChild(bars);
  wrap.appendChild(playhead);
  return { wrap, bars, playhead };
}

function renderBubble(note) {
  const character = state.characters[note.speaker];
  const side = note.speaker === 'khalil' ? 'left' : 'right';

  const row = document.createElement('div');
  row.className = `bubble-row ${side}`;
  if (note.label) row.title = note.label;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.innerHTML = `
    <img src="${character.avatarUrl}" alt="${character.name}" />
    <span class="avatar-fallback">${character.initials}</span>
  `;
  const img = avatar.querySelector('img');
  const fallback = avatar.querySelector('.avatar-fallback');
  const showFallback = () => {
    img.style.display = 'none';
    fallback.style.display = 'flex';
  };
  if (img.complete && img.naturalWidth === 0) {
    showFallback();
  } else {
    img.addEventListener('error', showFallback);
  }

  const col = document.createElement('div');
  col.className = 'bubble-col';

  const name = document.createElement('div');
  name.className = 'sender-name';
  name.textContent = character.name;

  const bubble = document.createElement('div');
  bubble.className = 'voice-bubble';

  const playBtn = document.createElement('button');
  playBtn.className = 'play-btn';
  playBtn.type = 'button';
  playBtn.innerHTML = PLAY_ICON;
  playBtn.setAttribute('aria-label', `Play voice note from ${character.name}`);

  const { wrap: waveWrap, bars, playhead } = buildWaveform(note);

  const duration = document.createElement('span');
  duration.className = 'duration';
  duration.textContent = formatTime(effectiveDuration(note));

  bubble.appendChild(playBtn);
  bubble.appendChild(waveWrap);
  bubble.appendChild(duration);

  const receipt = document.createElement('div');
  receipt.className = 'receipt';
  receipt.textContent = note.receipt;

  col.appendChild(name);
  col.appendChild(bubble);
  col.appendChild(receipt);

  row.appendChild(avatar);
  row.appendChild(col);

  noteRuntime[note.id] = {
    playing: false,
    elapsed: 0,
    startTs: 0,
    rafId: null,
    els: { row, playBtn, bars: bars.children, playhead, duration, receipt },
    onFinish: null,
  };

  playBtn.addEventListener('click', () => togglePlay(note));

  return row;
}

function renderThreadHeader() {
  const khalil = state.characters.khalil;
  const threadAvatar = document.getElementById('thread-avatar');
  const img = threadAvatar.querySelector('img');
  const fallback = threadAvatar.querySelector('.thread-avatar-fallback');
  img.src = khalil.avatarUrl;
  img.alt = khalil.name;
  fallback.textContent = khalil.initials;
  img.style.display = '';
  fallback.style.display = 'none';
  const showFallback = () => {
    img.style.display = 'none';
    fallback.style.display = 'flex';
  };
  if (img.complete && img.naturalWidth === 0) {
    showFallback();
  } else {
    img.addEventListener('error', showFallback, { once: true });
  }

  document.getElementById('thread-name').textContent = khalil.name;
}

function renderPhonePreview() {
  stopAllManualPlayback();
  renderThreadHeader();
  threadBody.innerHTML = '';
  noteRuntime = {};
  state.notes.forEach((note) => {
    threadBody.appendChild(renderBubble(note));
  });
  threadBody.scrollTop = threadBody.scrollHeight;
  refreshExportButton(); // audio readiness may have changed
}

/* --------------------------------------------------------------------
   3. PLAYBACK ENGINE
   One shared <audio> element sliced by each note's startTime/endTime
   when a conversation audio file is present. Falls back to a timed
   placeholder animation (derived from the same startTime/endTime)
   whenever no file has been selected yet, so the thread always
   demonstrates the concept.
   -------------------------------------------------------------------- */
const sharedAudio = new Audio();
let activeNoteId = null;

// Safety net for a file that decodes far enough to start playing but
// then errors out mid-stream — drop the currently active note back to
// the placeholder timer instead of letting the sequence hang.
sharedAudio.addEventListener('error', () => {
  if (!activeNoteId) return;
  const rt = noteRuntime[activeNoteId];
  if (rt && rt.usingRealAudio) {
    rt.usingRealAudio = false;
    rt.startTs = performance.now() - rt.elapsed * 1000;
  }
});

// Authoritative completion signal for real audio: the media element
// knows exactly when a clip ends. Relying only on progress >= 1 (elapsed
// / stored-duration) can miss by a hair when the stored duration and the
// decoded length differ by a float — e.g. a clip restored from a package
// manifest — leaving the note stuck at ~0.999 forever.
sharedAudio.addEventListener('ended', () => {
  if (!activeNoteId) return;
  const note = state.notes.find((n) => n.id === activeNoteId);
  const rt = note && noteRuntime[note.id];
  if (note && rt && rt.playing && rt.usingRealAudio) finishNote(note);
});

function updateButtonUI(note, isPlaying) {
  const rt = noteRuntime[note.id];
  if (!rt) return;
  rt.els.playBtn.innerHTML = isPlaying ? PAUSE_ICON : PLAY_ICON;
  const name = state.characters[note.speaker].name;
  rt.els.playBtn.setAttribute('aria-label', `${isPlaying ? 'Pause' : 'Play'} voice note from ${name}`);
}

function paintProgress(note, progress) {
  const rt = noteRuntime[note.id];
  if (!rt) return;
  const clamped = Math.max(0, Math.min(1, progress));
  const activeCount = Math.round(clamped * rt.els.bars.length);

  for (let i = 0; i < rt.els.bars.length; i++) {
    rt.els.bars[i].classList.toggle('played', i < activeCount);
  }

  rt.els.playhead.style.left = `${clamped * 100}%`;
  rt.els.playhead.classList.toggle('active', rt.playing);

  const duration = effectiveDuration(note);
  const remaining = duration * (1 - clamped);
  rt.els.duration.textContent = rt.playing ? formatTime(remaining) : formatTime(duration);
}

function hasConversationAudio() {
  return Boolean(state.conversationAudio.objectUrl);
}

function tick(note) {
  const rt = noteRuntime[note.id];
  if (!rt || !rt.playing) return;

  const duration = effectiveDuration(note);
  let elapsed;
  // Branch on whether *this* note's playback attempt actually succeeded,
  // not just whether a file was selected — an undecodable/broken file
  // must still fall back to the placeholder timer instead of reading a
  // sharedAudio.currentTime that never advances (which would hang the
  // sequence forever waiting for progress to reach 1). rt.audioBase is 0
  // for a per-note file and the note's Start Time for the combined file.
  if (rt.usingRealAudio) {
    elapsed = sharedAudio.currentTime - rt.audioBase;
  } else {
    elapsed = (performance.now() - rt.startTs) / 1000;
  }
  rt.elapsed = Math.max(0, elapsed);

  const progress = duration > 0 ? rt.elapsed / duration : 1;
  paintProgress(note, progress);

  if (progress >= 1) {
    finishNote(note);
    return;
  }
  rt.rafId = requestAnimationFrame(() => tick(note));
}

function stopNote(note, { reset }) {
  const rt = noteRuntime[note.id];
  if (!rt) return;
  if (rt.rafId) cancelAnimationFrame(rt.rafId);
  rt.rafId = null;
  rt.playing = false;

  if (rt.usingRealAudio) {
    try { sharedAudio.pause(); } catch (e) { /* nothing playing */ }
  }

  if (reset) {
    rt.elapsed = 0;
  }

  updateButtonUI(note, false);
  const dur = effectiveDuration(note);
  paintProgress(note, dur > 0 ? rt.elapsed / dur : 0);
}

function finishNote(note) {
  const rt = noteRuntime[note.id];
  if (!rt) return;
  stopNote(note, { reset: true });
  note.receipt = 'Played';
  rt.els.receipt.textContent = 'Played';
  if (activeNoteId === note.id) activeNoteId = null;

  // Preview/Recording Mode awaits this to know when to move to the next note.
  if (rt.onFinish) {
    const callback = rt.onFinish;
    rt.onFinish = null;
    callback();
  }
}

// Begins playback of a note from its current elapsed position. Used by
// both manual clicks and the sequence engine — callers are responsible
// for stopping whatever note was previously active.
function startNote(note) {
  const rt = noteRuntime[note.id];
  if (!rt) return;
  rt.playing = true;
  activeNoteId = note.id;
  updateButtonUI(note, true);

  const src = resolveNoteAudio(note);
  if (src) {
    rt.usingRealAudio = true;
    rt.audioBase = src.base;
    if (sharedAudio.src !== src.url) {
      sharedAudio.src = src.url;
    }
    sharedAudio.currentTime = src.base + rt.elapsed;
    sharedAudio.play().catch(() => {
      // Playback failed (undecodable file, etc.) — fall back to the
      // placeholder timer for this run so the sequence never hangs.
      rt.usingRealAudio = false;
      rt.startTs = performance.now() - rt.elapsed * 1000;
    });
  } else {
    rt.usingRealAudio = false;
    rt.startTs = performance.now() - rt.elapsed * 1000;
  }

  rt.rafId = requestAnimationFrame(() => tick(note));
}

function togglePlay(note) {
  if (sequenceState.active) return; // manual controls are disabled during Preview/Recording
  const rt = noteRuntime[note.id];
  if (!rt) return;

  if (rt.playing) {
    stopNote(note, { reset: false });
    activeNoteId = null;
    return;
  }

  if (activeNoteId && activeNoteId !== note.id) {
    const activeNote = state.notes.find((n) => n.id === activeNoteId);
    if (activeNote) stopNote(activeNote, { reset: false });
  }

  startNote(note);
}

// Stops whatever is manually playing (not a sequence) — used before any
// structural rebuild of the phone preview so edits never orphan a
// running rAF loop or leave the shared <audio> element mid-note.
function stopAllManualPlayback() {
  if (sequenceState.active) return;
  if (!activeNoteId) return;
  const note = state.notes.find((n) => n.id === activeNoteId);
  if (note) stopNote(note, { reset: false });
  activeNoteId = null;
}

function resetAllNotes() {
  state.notes.forEach((note) => stopNote(note, { reset: true }));
  activeNoteId = null;
  unfocusAllNotes();
  hideEndScreen();
}

/* --------------------------------------------------------------------
   4. SEQUENCE ENGINE (Preview + Recording Mode)
   Both share the same auto-play loop. Recording Mode additionally
   forces the countdown, the settle beat, and hides any POV overlay
   for the duration of the take (POV/Caption is metadata-only per
   Section 1 and is never rendered in the phone preview at all, so
   there is nothing to hide here — kept only as a hook for a future
   take that might want an on-screen line again).
   -------------------------------------------------------------------- */
const sequenceState = { active: false, cancelled: false, isRecording: false };

function playNoteAndWait(note) {
  return new Promise((resolve) => {
    noteRuntime[note.id].onFinish = resolve;
    startNote(note);
  });
}

// Which note currently carries the "current-note" highlight. Mirrors the
// DOM class, but as plain state so the export canvas renderer can read it
// without touching the DOM.
let focusedNoteId = null;

function unfocusAllNotes() {
  state.notes.forEach((note) => {
    const rt = noteRuntime[note.id];
    if (rt) rt.els.row.classList.remove('current-note');
  });
  focusedNoteId = null;
}

function focusNote(note) {
  unfocusAllNotes();
  focusedNoteId = note.id;
  const rt = noteRuntime[note.id];
  if (!rt) return;
  const row = rt.els.row;
  row.classList.add('current-note');

  // Scroll only the internal thread container — never the outer page —
  // so the phone frame stays put for anyone screen-recording it.
  const targetTop = row.offsetTop - threadBody.clientHeight / 2 + row.clientHeight / 2;
  threadBody.scrollTo({ top: targetTop, behavior: 'smooth' });
}

async function runCountdown(seconds) {
  const overlay = document.getElementById('countdown-overlay');
  const number = document.getElementById('countdown-number');
  overlay.classList.remove('hidden');

  for (let i = seconds; i >= 1; i--) {
    if (sequenceState.cancelled) break;
    number.textContent = String(i);
    await wait(1000);
  }

  overlay.classList.add('hidden');
}

function showEndScreen() {
  const endScreen = document.getElementById('end-screen');
  const endScreenText = document.getElementById('end-screen-text');
  endScreenText.textContent = state.recording.endScreenText;
  endScreen.classList.remove('hidden');
}

function hideEndScreen() {
  document.getElementById('end-screen').classList.add('hidden');
}

function setManualControlsEnabled(enabled) {
  state.notes.forEach((note) => {
    const rt = noteRuntime[note.id];
    if (rt) rt.els.playBtn.disabled = !enabled;
  });
}

function setDashboardEnabled(enabled) {
  document.querySelectorAll('.dashboard input, .dashboard select, .dashboard textarea, .dashboard button').forEach((el) => {
    if (el.id === 'stop-btn') return; // Stop must always be usable
    el.disabled = !enabled;
  });
  document.getElementById('stop-btn').disabled = enabled;
}

function updateSequenceButtonsUI() {
  document.getElementById('preview-btn').disabled = sequenceState.active;
  document.getElementById('record-btn').disabled = sequenceState.active;
  refreshExportButton(); // export stays gated by audio readiness + run state
}

// Cancels whichever sequence (Preview or Recording) is currently
// running. If a note is mid-playback, stop it and resolve its pending
// promise so the awaiting loop in runSequence() can see `cancelled`
// and break immediately.
function cancelSequence() {
  if (!sequenceState.active) return;
  sequenceState.cancelled = true;
  if (activeNoteId) {
    const note = state.notes.find((n) => n.id === activeNoteId);
    if (note) {
      const rt = noteRuntime[note.id];
      stopNote(note, { reset: true });
      if (rt && rt.onFinish) {
        const callback = rt.onFinish;
        rt.onFinish = null;
        callback();
      }
    }
  }
}

async function runSequence({ isRecording }) {
  if (sequenceState.active) return;

  resetAllNotes();
  sequenceState.active = true;
  sequenceState.cancelled = false;
  sequenceState.isRecording = isRecording;
  setManualControlsEnabled(false);
  setDashboardEnabled(false);
  updateSequenceButtonsUI();

  if (isRecording) {
    await runCountdown(state.recording.countdownSeconds);
    if (!sequenceState.cancelled && state.recording.settleBeforeFirstNote > 0) {
      await wait(state.recording.settleBeforeFirstNote);
    }
  }

  if (!sequenceState.cancelled) {
    for (const note of state.notes) {
      if (sequenceState.cancelled) break;
      focusNote(note);
      await playNoteAndWait(note);
      if (sequenceState.cancelled) break;
      await wait(state.recording.delayBetweenNotes);
    }
  }

  unfocusAllNotes();

  if (!sequenceState.cancelled && state.recording.showEndScreen) {
    showEndScreen();
  }

  sequenceState.active = false;
  setManualControlsEnabled(true);
  setDashboardEnabled(true);
  rebuildNotesTable(); // restore per-row boundary disabling (first/last move, single-note delete)
  applyRolePermissions(); // setDashboardEnabled(true) re-enabled everything — re-lock for contributors
  updateSequenceButtonsUI();
}

/* --------------------------------------------------------------------
   5. DASHBOARD — Episode Information (Section 1)
   -------------------------------------------------------------------- */
function wireEpisodeSection() {
  const titleInput = document.getElementById('ep-title');
  const numberInput = document.getElementById('ep-number');
  const seasonInput = document.getElementById('ep-season');
  const notesInput = document.getElementById('ep-notes');
  const povInput = document.getElementById('ep-pov');
  const subtitle = document.getElementById('episode-subtitle');

  const syncSubtitle = () => {
    subtitle.textContent = `Creator Dashboard — S${state.episode.season} E${state.episode.number}: ${state.episode.title}`;
  };

  titleInput.value = state.episode.title;
  numberInput.value = state.episode.number;
  seasonInput.value = state.episode.season;
  notesInput.value = state.episode.internalNotes;
  povInput.value = state.episode.povCaption;
  syncSubtitle();

  titleInput.addEventListener('input', () => {
    state.episode.title = titleInput.value;
    syncSubtitle();
  });
  numberInput.addEventListener('input', () => {
    state.episode.number = numberInput.value;
    syncSubtitle();
  });
  seasonInput.addEventListener('input', () => {
    state.episode.season = seasonInput.value;
    syncSubtitle();
  });
  notesInput.addEventListener('input', () => {
    state.episode.internalNotes = notesInput.value;
  });
  povInput.addEventListener('input', () => {
    state.episode.povCaption = povInput.value; // metadata only — never rendered in the phone preview
  });
}

/* --------------------------------------------------------------------
   6. DASHBOARD — Conversation + Timing (Sections 2 & 4)
   -------------------------------------------------------------------- */
function speakerOptionsHtml(selected) {
  return Object.entries(state.characters)
    .map(([key, c]) => `<option value="${key}" ${key === selected ? 'selected' : ''}>${c.name}</option>`)
    .join('');
}

function describeNoteAudioStatus(note) {
  const a = note.audio || newNoteAudio();
  if (a.status === 'loaded') return `✓ Complete — ${a.fileName} (${formatTime(a.duration)})`;
  if (a.status === 'fallback') return `⚠ Fallback timing — couldn't decode ${a.fileName}`;
  const who = memoName(note.speaker);
  if (a.status === 'needed') return `⏳ Waiting for ${who} — re-upload ${a.fileName}`;
  return `⏳ Waiting for ${who}`;
}

// Short role labels for collaboration status ("Waiting for Honey"),
// independent of the editable display names.
const ROLE_LABEL = { khalil: 'Khalil', honey: 'Honey' };

// The two memo lanes are FIXED internal note-speaker keys; only their
// DISPLAY names (state.characters[lane].name) are typed by the Owner via
// the memo-display fields. The contributor side is always the same lane,
// so permissions never depend on a typed name.
//   OWNER_LANE       = the Owner's own side (right bubbles / "self")
//   CONTRIBUTOR_LANE = the packaged, line-locked side (left / thread contact)
const OWNER_LANE = 'honey';
const CONTRIBUTOR_LANE = 'khalil';
// Which Step-1 memo-display input drives each lane's display name.
const MEMO_INPUT_BY_LANE = { [OWNER_LANE]: 'owner-memo-name', [CONTRIBUTOR_LANE]: 'contributor-memo-name' };

// The visible memo name for a lane: the typed display name, falling back to
// the short role label if it was cleared.
function memoName(lane) {
  const c = state.characters[lane];
  return (c && c.name && c.name.trim()) || ROLE_LABEL[lane] || lane;
}

// How to address the contributor in Contributor mode: the Owner-set
// contributor *person* name when present, otherwise their memo display
// name. Used for the welcome banner, button labels, and Return Package names.
function contributorLabel() {
  const name = state.assignedContributorName && state.assignedContributorName.trim();
  return name || memoName(CONTRIBUTOR_LANE) || 'the contributor';
}

// Push a lane's display name into state (initials + preview + note table)
// and keep both editors that show it — the Step-1 memo field and the
// Characters section — in sync. Shared by both input handlers.
function setMemoDisplayName(lane, value) {
  const c = state.characters[lane];
  c.name = value;
  c.initials = deriveInitials(value);
  renderPhonePreview();
  rebuildNotesTable(); // speaker dropdown option labels show display names
  if (characterSyncers[lane]) characterSyncers[lane](); // Characters section input
  syncMemoNameInput(lane); // Step-1 memo field
}

function syncMemoNameInput(lane) {
  const el = document.getElementById(MEMO_INPUT_BY_LANE[lane]);
  if (el) el.value = state.characters[lane].name;
}

// Reads a per-note file's duration off-thread via a throwaway <audio>
// (so it never disturbs the shared playback element), then reports back.
// Keeps the File itself (note.audio.blob) so it can be re-packaged.
function loadNoteAudioFile(note, file, onDone) {
  if (note.audio && note.audio.objectUrl) URL.revokeObjectURL(note.audio.objectUrl);
  // A clip added while in Contributor mode belongs to the contributor;
  // otherwise it's Owner audio. This drives what goes into a Return
  // Package (contributor changes only).
  const owner = state.role !== 'contributor';
  note.audio = { fileName: file.name, objectUrl: URL.createObjectURL(file), blob: file, duration: 0, status: 'none', owner };

  const probe = new Audio();
  const finish = (status, duration) => {
    note.audio.status = status;
    note.audio.duration = duration;
    onDone();
  };
  probe.addEventListener('loadedmetadata', () => {
    if (Number.isFinite(probe.duration) && probe.duration > 0) {
      finish('loaded', probe.duration);
    } else {
      finish('fallback', 0);
    }
  });
  probe.addEventListener('error', () => finish('fallback', 0)); // e.g. M4A on a browser without AAC
  probe.src = note.audio.objectUrl;
}

function buildNoteRow(note, index) {
  const contributor = state.role === 'contributor';
  // A contributor may only touch audio for their own assigned lines.
  const canEditAudio = !contributor || note.speaker === state.assignedSpeaker;

  const row = document.createElement('div');
  row.className = 'note-row';
  if (contributor && !canEditAudio) row.classList.add('note-locked');
  if (contributor && canEditAudio) row.classList.add('note-assigned');

  const header = document.createElement('div');
  header.className = 'note-row-header';

  const title = document.createElement('span');
  title.className = 'note-row-title';
  title.textContent = `Note ${index + 1}`;
  if (contributor) {
    title.textContent += canEditAudio ? ` · Your line (${memoName(note.speaker)})` : ' · locked';
  }

  const actions = document.createElement('div');
  actions.className = 'note-row-actions';

  const upBtn = document.createElement('button');
  upBtn.type = 'button';
  upBtn.textContent = '↑';
  upBtn.setAttribute('aria-label', 'Move note up');
  upBtn.disabled = contributor || index === 0;
  upBtn.addEventListener('click', () => moveNote(note.id, -1));

  const downBtn = document.createElement('button');
  downBtn.type = 'button';
  downBtn.textContent = '↓';
  downBtn.setAttribute('aria-label', 'Move note down');
  downBtn.disabled = contributor || index === state.notes.length - 1;
  downBtn.addEventListener('click', () => moveNote(note.id, 1));

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'note-delete-btn';
  deleteBtn.textContent = '✕';
  deleteBtn.setAttribute('aria-label', 'Delete note');
  deleteBtn.disabled = contributor || state.notes.length <= 1;
  deleteBtn.addEventListener('click', () => deleteNote(note.id));

  actions.appendChild(upBtn);
  actions.appendChild(downBtn);
  actions.appendChild(deleteBtn);
  header.appendChild(title);
  header.appendChild(actions);

  const grid = document.createElement('div');
  grid.className = 'note-row-grid';

  const speakerField = document.createElement('label');
  speakerField.className = 'dash-field';
  speakerField.innerHTML = `<span>Speaker</span>`;
  const speakerSelect = document.createElement('select');
  speakerSelect.innerHTML = speakerOptionsHtml(note.speaker);
  speakerSelect.disabled = contributor; // contributors can't reassign notes
  speakerSelect.addEventListener('change', () => {
    note.speaker = speakerSelect.value;
    renderPhonePreview();
  });
  speakerField.appendChild(speakerSelect);

  const durationField = document.createElement('div');
  durationField.className = 'dash-field';
  const durationLabel = state.audioMode === 'perNote' ? 'Duration (auto)' : 'Duration';
  durationField.innerHTML = `<span>${durationLabel}</span>`;
  const durationBadge = document.createElement('div');
  durationBadge.className = 'note-duration-badge';
  durationBadge.textContent = formatTime(effectiveDuration(note));
  durationField.appendChild(durationBadge);

  const receiptField = document.createElement('label');
  receiptField.className = 'dash-field';
  receiptField.innerHTML = `<span>Receipt</span>`;
  const receiptSelect = document.createElement('select');
  receiptSelect.innerHTML = ['Delivered', 'Played']
    .map((v) => `<option value="${v}" ${v === note.receipt ? 'selected' : ''}>${v}</option>`)
    .join('');
  receiptSelect.disabled = contributor && !canEditAudio; // editable on the contributor's own lines
  receiptSelect.addEventListener('change', () => {
    note.receipt = receiptSelect.value;
    renderPhonePreview();
  });
  receiptField.appendChild(receiptSelect);

  const labelField = document.createElement('label');
  labelField.className = 'dash-field span-2';
  labelField.innerHTML = `<span>Voice Note Label</span>`;
  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.placeholder = 'What is this note about? (internal reference only)';
  labelInput.value = note.label;
  labelInput.disabled = contributor && !canEditAudio;
  labelInput.addEventListener('input', () => {
    note.label = labelInput.value;
    renderPhonePreview();
  });
  labelField.appendChild(labelInput);

  grid.appendChild(speakerField);
  grid.appendChild(durationField);

  if (state.audioMode === 'perNote') {
    // Per-note audio upload + status spanning the full row width.
    const audioField = document.createElement('label');
    audioField.className = 'dash-field span-2';
    const audioLabel = canEditAudio
      ? 'Audio for this note (WAV / MP3 / M4A)'
      : 'Audio for this note (locked — Owner reference)';
    audioField.innerHTML = `<span>${audioLabel}</span>`;
    const audioInput = document.createElement('input');
    audioInput.type = 'file';
    audioInput.accept = 'audio/wav,audio/x-wav,audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/aac,.wav,.mp3,.m4a,.aac';
    audioInput.disabled = !canEditAudio; // contributors: only their own lines
    audioInput.addEventListener('change', () => {
      const file = audioInput.files[0];
      if (!file) return;
      loadNoteAudioFile(note, file, () => {
        durationBadge.textContent = formatTime(effectiveDuration(note));
        statusEl.textContent = describeNoteAudioStatus(note);
        statusEl.setAttribute('data-status', note.audio.status);
        renderPhonePreview();
      });
    });
    audioField.appendChild(audioInput);

    const statusEl = document.createElement('div');
    statusEl.className = 'note-audio-status span-2';
    statusEl.setAttribute('data-status', note.audio ? note.audio.status : 'none');
    statusEl.textContent = describeNoteAudioStatus(note);

    grid.appendChild(receiptField);
    grid.appendChild(audioField);
    grid.appendChild(statusEl);
    grid.appendChild(labelField);
  } else {
    // Combined (advanced) mode: Start/End Time slice fields.
    const startField = document.createElement('label');
    startField.className = 'dash-field';
    startField.innerHTML = `<span>Start Time (s)</span>`;
    const startInput = document.createElement('input');
    startInput.type = 'number';
    startInput.min = '0';
    startInput.step = '0.5';
    startInput.value = note.startTime;
    startInput.disabled = contributor && !canEditAudio;
    startField.appendChild(startInput);

    const endField = document.createElement('label');
    endField.className = 'dash-field';
    endField.innerHTML = `<span>End Time (s)</span>`;
    const endInput = document.createElement('input');
    endInput.type = 'number';
    endInput.min = '0';
    endInput.step = '0.5';
    endInput.value = note.endTime;
    endInput.disabled = contributor && !canEditAudio;
    endField.appendChild(endInput);

    const syncTiming = () => {
      let start = parseFloat(startInput.value);
      let end = parseFloat(endInput.value);
      if (Number.isNaN(start)) start = 0;
      if (Number.isNaN(end) || end <= start) end = start + 0.5;
      note.startTime = start;
      note.endTime = end;
      durationBadge.textContent = formatTime(effectiveDuration(note));
      renderPhonePreview();
    };
    startInput.addEventListener('input', syncTiming);
    endInput.addEventListener('input', syncTiming);

    grid.appendChild(startField);
    grid.appendChild(endField);
    grid.appendChild(receiptField);
    grid.appendChild(labelField);
  }

  row.appendChild(header);
  row.appendChild(grid);
  return row;
}

function rebuildNotesTable() {
  const table = document.getElementById('notes-table');
  table.innerHTML = '';
  const contributor = state.role === 'contributor';
  let shown = 0;
  state.notes.forEach((note, index) => {
    // Contributors see only their own assigned lines here. The full
    // conversation (with Owner audio) still plays in the phone preview
    // for performance context.
    if (contributor && note.speaker !== state.assignedSpeaker) return;
    table.appendChild(buildNoteRow(note, index));
    shown += 1;
  });
  if (contributor && shown === 0) {
    const empty = document.createElement('p');
    empty.className = 'dash-hint';
    empty.textContent = 'No lines are assigned to you yet. Use “+ Add Note” to add your take, or ask the Owner to assign one.';
    table.appendChild(empty);
  }
}

function moveNote(id, direction) {
  if (state.role === 'contributor') return; // structure is Owner-only
  const index = state.notes.findIndex((n) => n.id === id);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= state.notes.length) return;
  const [note] = state.notes.splice(index, 1);
  state.notes.splice(target, 0, note);
  rebuildNotesTable();
  renderPhonePreview();
}

function deleteNote(id) {
  if (state.role === 'contributor') return;
  if (state.notes.length <= 1) return;
  state.notes = state.notes.filter((n) => n.id !== id);
  rebuildNotesTable();
  renderPhonePreview();
}

function addNote() {
  const contributor = state.role === 'contributor';
  const last = state.notes[state.notes.length - 1];
  const lastSpeaker = last ? last.speaker : 'honey';
  // A contributor's added takes are always their own assigned line.
  const nextSpeaker = contributor ? state.assignedSpeaker : (lastSpeaker === 'khalil' ? 'honey' : 'khalil');
  const start = last ? last.endTime : 0;
  state.notes.push({
    id: nextNoteId(),
    speaker: nextSpeaker,
    label: '',
    startTime: start,
    endTime: start + 6,
    placeholderDuration: 6,
    receipt: 'Delivered',
    audio: newNoteAudio(),
  });
  rebuildNotesTable();
  renderPhonePreview();
}

function wireConversationSection() {
  rebuildNotesTable();
  document.getElementById('add-note-btn').addEventListener('click', addNote);
}

/* --------------------------------------------------------------------
   7. DASHBOARD — Audio (Section 3)
   -------------------------------------------------------------------- */
function applyAudioMode() {
  const perNote = state.audioMode === 'perNote';
  document.getElementById('combined-audio-block').classList.toggle('hidden', perNote);
  document.getElementById('per-note-audio-hint').classList.toggle('hidden', !perNote);
  document.getElementById('conversation-hint').textContent = perNote
    ? 'Upload an audio clip for each note below. Duration is read from the file automatically. Add, reorder, or delete notes freely.'
    : 'Set each note\'s Start/End Time to slice it out of the mastered file. Duration is computed from those times.';

  document.querySelectorAll('.audio-mode-option').forEach((btn) => {
    const on = btn.getAttribute('data-mode') === state.audioMode;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.classList.toggle('active', on);
  });

  rebuildNotesTable(); // note rows differ by mode (per-note upload vs. Start/End)
  renderPhonePreview(); // durations differ by mode
}

function wireAudioSection() {
  document.querySelectorAll('.audio-mode-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (sequenceState.active || exporting) return; // don't switch mid-run
      const mode = btn.getAttribute('data-mode');
      if (mode === state.audioMode) return;
      state.audioMode = mode;
      applyAudioMode();
    });
  });

  const input = document.getElementById('conversation-audio-input');
  const status = document.getElementById('conversation-audio-status');
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    if (state.conversationAudio.objectUrl) {
      URL.revokeObjectURL(state.conversationAudio.objectUrl);
    }
    state.conversationAudio.fileName = file.name;
    state.conversationAudio.objectUrl = URL.createObjectURL(file);
    state.conversationAudio.blob = file;
    sharedAudio.src = state.conversationAudio.objectUrl;
    status.textContent = `Using "${file.name}" — notes play from their Start/End Time slice of this file.`;
    refreshExportButton();
  });

  applyAudioMode();
}

/* --------------------------------------------------------------------
   8. DASHBOARD — Characters (Section 5)
   -------------------------------------------------------------------- */
function wireCharacterEditor(key) {
  const character = state.characters[key];
  const nameInput = document.getElementById(`${key}-name`);
  const avatarInput = document.getElementById(`${key}-avatar-input`);
  const thumb = document.getElementById(`${key}-avatar-thumb`);
  const thumbImg = thumb.querySelector('img');
  const thumbFallback = thumb.querySelector('.avatar-thumb-fallback');

  const syncThumb = () => {
    thumbImg.src = character.avatarUrl;
    thumbImg.style.display = '';
    thumbFallback.style.display = 'none';
    thumbFallback.textContent = character.initials;
  };
  const showThumbFallback = () => {
    thumbImg.style.display = 'none';
    thumbFallback.style.display = 'flex';
  };
  thumbImg.addEventListener('error', showThumbFallback);

  nameInput.value = character.name;
  syncThumb();
  if (thumbImg.complete && thumbImg.naturalWidth === 0) showThumbFallback();

  nameInput.addEventListener('input', () => {
    character.name = nameInput.value;
    character.initials = deriveInitials(character.name);
    thumbFallback.textContent = character.initials;
    renderPhonePreview();
    rebuildNotesTable(); // speaker dropdown option labels show display names
    syncMemoNameInput(key); // keep the Step-1 memo-display field in sync
  });

  avatarInput.addEventListener('change', () => {
    const file = avatarInput.files[0];
    if (!file) return;
    if (character.avatarUrl && character.avatarUrl.startsWith('blob:')) {
      URL.revokeObjectURL(character.avatarUrl);
    }
    character.avatarUrl = URL.createObjectURL(file);
    character.avatarFileName = file.name;
    character.avatarBlob = file;
    syncThumb();
    renderPhonePreview();
  });

  // Registered so a project load can push restored name/avatar back into
  // this editor's inputs and thumbnail.
  characterSyncers[key] = () => {
    nameInput.value = character.name;
    syncThumb();
    if (thumbImg.complete && thumbImg.naturalWidth === 0) showThumbFallback();
    syncMemoNameInput(key); // keep the Step-1 memo-display field in sync on load/open
  };
}

// key -> function that re-syncs that character editor's inputs from state.
const characterSyncers = {};

function wireCharactersSection() {
  wireCharacterEditor('khalil');
  wireCharacterEditor('honey');
}

/* --------------------------------------------------------------------
   9. DASHBOARD — Recording (Section 6)
   -------------------------------------------------------------------- */
function wireRecordingSection() {
  const countdown = document.getElementById('rec-countdown');
  const settle = document.getElementById('rec-settle');
  const gap = document.getElementById('rec-gap');
  const endToggle = document.getElementById('rec-endscreen-toggle');
  const endText = document.getElementById('rec-endscreen-text');

  countdown.value = state.recording.countdownSeconds;
  settle.value = state.recording.settleBeforeFirstNote;
  gap.value = state.recording.delayBetweenNotes;
  endToggle.checked = state.recording.showEndScreen;
  endText.value = state.recording.endScreenText;

  countdown.addEventListener('input', () => {
    const v = parseInt(countdown.value, 10);
    state.recording.countdownSeconds = Number.isNaN(v) ? 0 : Math.max(0, v);
  });
  settle.addEventListener('input', () => {
    const v = parseInt(settle.value, 10);
    state.recording.settleBeforeFirstNote = Number.isNaN(v) ? 0 : Math.max(0, v);
  });
  gap.addEventListener('input', () => {
    const v = parseInt(gap.value, 10);
    state.recording.delayBetweenNotes = Number.isNaN(v) ? 0 : Math.max(0, v);
  });
  endToggle.addEventListener('change', () => {
    state.recording.showEndScreen = endToggle.checked;
  });
  endText.addEventListener('input', () => {
    state.recording.endScreenText = endText.value;
  });
}

/* --------------------------------------------------------------------
   10. DASHBOARD — Preview Controls (Section 7)
   -------------------------------------------------------------------- */
function wireControlButtons() {
  document.getElementById('preview-btn').addEventListener('click', () => runSequence({ isRecording: false }));
  document.getElementById('record-btn').addEventListener('click', () => runSequence({ isRecording: true }));
  document.getElementById('stop-btn').addEventListener('click', cancelSequence);
}

/* ====================================================================
   11. EXPORT (Section 8) — browser-native video, no backend.

   The phone preview is redrawn into an offscreen 1080x1920 canvas each
   frame (in a design space of the 380px-wide DOM frame scaled up), the
   canvas is captured with canvas.captureStream(), the conversation
   audio is mixed in through a WebAudio graph, and MediaRecorder writes
   a downloadable .webm. Nothing here touches Recording Mode or manual
   playback — export just runs the same recording sequence while
   capturing it. MP4 is a documented future enhancement (MediaRecorder
   MP4 support is not reliable across browsers today; WebM is the
   dependable baseline).
   ==================================================================== */

// Small integration/observability surface (also handy for testing):
// reflects the outcome of the most recent export.
const pvnsExport = { status: 'idle' };
window.pvnsExport = pvnsExport;

const clampNum = (v, a, b) => Math.max(a, Math.min(b, v));

const EXPORT_W = 1080;
const EXPORT_H = 1920;

// Layout metrics in the DOM frame's design space (380px wide, 9:16).
const EXP = {
  W: 380,
  H: (380 * 16) / 9,
  headerH: 104,
  pad: 14,
  bodyTopPad: 18,
  bodyBottomPad: 26,
  rowH: 78,
  rowGap: 14,
  avatar: 30,
  avatarGap: 8,
  bubbleW: 212,
  bubbleH: 50,
};
const EXPORT_SCALE = EXPORT_W / EXP.W;

const COLORS = {
  gold: '#d4b06a',
  goldSoft: '#e8cf9c',
  goldDim: 'rgba(212,176,106,0.55)',
  ivory: '#f5f0e6',
  charcoal: '#0a0a09',
  charcoal2: '#141210',
  bubbleKhalil: '#1c1916',
  bubbleHoney: '#2a2013',
  dimText: 'rgba(245,240,230,0.45)',
  dimText2: 'rgba(245,240,230,0.55)',
  barIdle: 'rgba(245,240,230,0.22)',
};

let exportCanvas = null;
const exportScroll = { current: 0 };
const avatarImageCache = new Map();

function getExportCanvas() {
  if (!exportCanvas) {
    exportCanvas = document.createElement('canvas');
    exportCanvas.width = EXPORT_W;
    exportCanvas.height = EXPORT_H;
  }
  return exportCanvas;
}

function loadImage(url) {
  return new Promise((resolve) => {
    if (avatarImageCache.has(url)) {
      resolve(avatarImageCache.get(url));
      return;
    }
    const img = new Image();
    img.onload = () => { avatarImageCache.set(url, img); resolve(img); };
    img.onerror = () => { avatarImageCache.set(url, null); resolve(null); };
    img.src = url;
  });
}

async function preloadAvatars() {
  await Promise.all(Object.values(state.characters).map((c) => loadImage(c.avatarUrl)));
}

function getAvatarImage(url) {
  const img = avatarImageCache.get(url);
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

async function ensureExportFonts() {
  if (!document.fonts || !document.fonts.load) return;
  try {
    await Promise.all([
      document.fonts.load('600 80px Cinzel'),
      document.fonts.load('600 22px Cinzel'),
      document.fonts.load('500 11px Inter'),
      document.fonts.load('400 11px Inter'),
      document.fonts.ready,
    ]);
  } catch (e) {
    /* fall back to whatever is available */
  }
}

/* ---- canvas drawing ---- */

function drawAvatarCircle(ctx, cx, cy, r, character) {
  const img = getAvatarImage(character.avatarUrl);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (img) {
    // cover-fit the image into the 2r x 2r box
    const box = r * 2;
    const scale = Math.max(box / img.naturalWidth, box / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  } else {
    ctx.fillStyle = COLORS.charcoal2;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = COLORS.goldSoft;
    ctx.font = `600 ${Math.round(r * 0.8)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(character.initials, cx, cy + 1);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(212,176,106,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function setTracking(ctx, px) {
  if ('letterSpacing' in ctx) {
    try { ctx.letterSpacing = `${px}px`; } catch (e) { /* unsupported */ }
  }
}

function drawExportHeader(ctx) {
  const khalil = state.characters.khalil;
  drawAvatarCircle(ctx, 41, 67, 21, khalil);

  const tx = 74;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  ctx.font = '600 10px Inter, sans-serif';
  ctx.fillStyle = COLORS.goldDim;
  setTracking(ctx, 1.6);
  ctx.fillText('PRIVATE THREAD', tx, 52);
  setTracking(ctx, 0);

  ctx.font = '600 22px Cinzel, serif';
  ctx.fillStyle = COLORS.ivory;
  ctx.fillText(khalil.name, tx, 80);

  ctx.font = '400 12px Inter, sans-serif';
  ctx.fillStyle = 'rgba(212,176,106,0.78)';
  ctx.fillText('Voice Notes', tx, 97);

  ctx.strokeStyle = 'rgba(212,176,106,0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, EXP.headerH);
  ctx.lineTo(EXP.W, EXP.headerH);
  ctx.stroke();
}

function drawBubbleBlock(ctx, note, blockScreenY) {
  const character = state.characters[note.speaker];
  const isLeft = note.speaker === 'khalil';
  const isActive = activeNoteId === note.id;
  const rt = noteRuntime[note.id];
  const duration = effectiveDuration(note);
  const progress = isActive && rt ? clampNum(rt.elapsed / duration, 0, 1) : 0;

  const senderBaseline = blockScreenY + 10;
  const bubbleTop = blockScreenY + 16;
  const bubbleBottom = bubbleTop + EXP.bubbleH;
  const receiptBaseline = bubbleBottom + 12;

  const bubbleX = isLeft
    ? EXP.pad + EXP.avatar + EXP.avatarGap
    : EXP.W - EXP.pad - EXP.avatar - EXP.avatarGap - EXP.bubbleW;
  const avatarCx = isLeft ? EXP.pad + EXP.avatar / 2 : EXP.W - EXP.pad - EXP.avatar / 2;
  const avatarCy = bubbleBottom - EXP.avatar / 2;

  // sender name
  ctx.font = '400 10px Inter, sans-serif';
  ctx.fillStyle = COLORS.dimText;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = isLeft ? 'left' : 'right';
  ctx.fillText(character.name, isLeft ? bubbleX + 4 : bubbleX + EXP.bubbleW - 4, senderBaseline);

  drawAvatarCircle(ctx, avatarCx, avatarCy, EXP.avatar / 2, character);

  // bubble body with a subtle chat "tail" corner
  const r = 16;
  const tail = 6;
  const corners = isLeft ? [r, r, r, tail] : [r, r, tail, r];
  ctx.beginPath();
  ctx.roundRect(bubbleX, bubbleTop, EXP.bubbleW, EXP.bubbleH, corners);
  ctx.fillStyle = isLeft ? COLORS.bubbleKhalil : COLORS.bubbleHoney;
  ctx.fill();

  if (focusedNoteId === note.id) {
    ctx.save();
    ctx.shadowColor = 'rgba(212,176,106,0.35)';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.strokeStyle = isLeft ? 'rgba(212,176,106,0.12)' : 'rgba(212,176,106,0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // play / pause button
  const pr = 15;
  const pcx = bubbleX + 12 + pr;
  const pcy = bubbleTop + EXP.bubbleH / 2;
  ctx.beginPath();
  ctx.arc(pcx, pcy, pr, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.gold;
  ctx.fill();
  ctx.fillStyle = COLORS.charcoal;
  if (isActive) {
    ctx.fillRect(pcx - 4, pcy - 5, 3, 10);
    ctx.fillRect(pcx + 1, pcy - 5, 3, 10);
  } else {
    ctx.beginPath();
    ctx.moveTo(pcx - 4, pcy - 5.5);
    ctx.lineTo(pcx - 4, pcy + 5.5);
    ctx.lineTo(pcx + 6, pcy);
    ctx.closePath();
    ctx.fill();
  }

  // waveform
  const waveLeft = bubbleX + 12 + pr * 2 + 10;
  const durRight = bubbleX + EXP.bubbleW - 12;
  const waveRight = durRight - 34;
  const heights = seededHeights(note.id, BARS_PER_NOTE);
  const barGap = 2;
  const barW = (waveRight - waveLeft - (BARS_PER_NOTE - 1) * barGap) / BARS_PER_NOTE;
  const playedCount = Math.round(progress * BARS_PER_NOTE);
  for (let i = 0; i < BARS_PER_NOTE; i++) {
    const h = heights[i] * 22;
    const x = waveLeft + i * (barW + barGap);
    ctx.fillStyle = i < playedCount ? COLORS.gold : COLORS.barIdle;
    ctx.fillRect(x, pcy - h / 2, Math.max(1.4, barW), h);
  }

  // duration (remaining while playing, total otherwise)
  const shown = isActive ? duration * (1 - progress) : duration;
  ctx.font = '400 11px Inter, sans-serif';
  ctx.fillStyle = COLORS.dimText2;
  ctx.textAlign = 'right';
  ctx.fillText(formatTime(shown), durRight, pcy + 4);

  // receipt
  ctx.font = 'italic 400 10px Inter, sans-serif';
  ctx.fillStyle = 'rgba(212,176,106,0.55)';
  ctx.textAlign = isLeft ? 'left' : 'right';
  ctx.fillText(note.receipt, isLeft ? bubbleX + 4 : bubbleX + EXP.bubbleW - 4, receiptBaseline);
}

function updateExportScroll() {
  const viewportH = EXP.H - EXP.headerH;
  const n = state.notes.length;
  const contentH = EXP.bodyTopPad + n * EXP.rowH + (n - 1) * EXP.rowGap + EXP.bodyBottomPad;
  const maxScroll = Math.max(0, contentH - viewportH);

  let target = 0;
  if (focusedNoteId) {
    const idx = state.notes.findIndex((x) => x.id === focusedNoteId);
    if (idx >= 0) {
      const blockTop = EXP.bodyTopPad + idx * (EXP.rowH + EXP.rowGap);
      const center = blockTop + EXP.rowH / 2;
      target = clampNum(center - viewportH / 2, 0, maxScroll);
    }
  }
  exportScroll.current += (target - exportScroll.current) * 0.18;
  if (Math.abs(target - exportScroll.current) < 0.4) exportScroll.current = target;
}

function drawOverlays(ctx) {
  const countdown = document.getElementById('countdown-overlay');
  if (!countdown.classList.contains('hidden')) {
    ctx.fillStyle = 'rgba(5,5,5,0.55)';
    ctx.fillRect(0, 0, EXP.W, EXP.H);
    ctx.fillStyle = COLORS.goldSoft;
    ctx.font = '600 80px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(document.getElementById('countdown-number').textContent, EXP.W / 2, EXP.H / 2);
  }

  const endScreen = document.getElementById('end-screen');
  if (!endScreen.classList.contains('hidden')) {
    ctx.fillStyle = 'rgba(5,5,5,0.85)';
    ctx.fillRect(0, 0, EXP.W, EXP.H);
    ctx.fillStyle = COLORS.goldSoft;
    ctx.font = '600 26px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = state.recording.endScreenText || '';
    // simple word-wrap within the frame
    const maxW = EXP.W - 70;
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';
    words.forEach((w) => {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    const lineH = 34;
    const startY = EXP.H / 2 - ((lines.length - 1) * lineH) / 2;
    lines.forEach((ln, i) => ctx.fillText(ln, EXP.W / 2, startY + i * lineH));
  }
}

function drawPreviewFrame(ctx) {
  ctx.setTransform(EXPORT_SCALE, 0, 0, EXPORT_SCALE, 0, 0);
  ctx.clearRect(0, 0, EXP.W, EXP.H);

  const bg = ctx.createRadialGradient(EXP.W / 2, 0, 0, EXP.W / 2, 0, EXP.W * 1.2);
  bg.addColorStop(0, COLORS.charcoal2);
  bg.addColorStop(1, COLORS.charcoal);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, EXP.W, EXP.H);

  drawExportHeader(ctx);

  const viewportH = EXP.H - EXP.headerH;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, EXP.headerH, EXP.W, viewportH);
  ctx.clip();
  updateExportScroll();
  state.notes.forEach((note, idx) => {
    const blockTopContent = EXP.bodyTopPad + idx * (EXP.rowH + EXP.rowGap);
    const y = EXP.headerH + blockTopContent - exportScroll.current;
    if (y + EXP.rowH < EXP.headerH || y > EXP.headerH + viewportH) return;
    drawBubbleBlock(ctx, note, y);
  });
  ctx.restore();

  drawOverlays(ctx);
}

/* ---- audio graph (mixes conversation audio into the recording) ---- */

let exportAudioCtx = null;
let exportMediaSource = null;
let exportAudioDest = null;

function ensureExportAudioGraph() {
  if (exportAudioCtx) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  exportAudioCtx = new Ctx();
  // Routing sharedAudio through WebAudio is permanent for the element's
  // lifetime, so keep it connected to the speakers too — otherwise
  // manual preview audio would go silent after the first export.
  exportMediaSource = exportAudioCtx.createMediaElementSource(sharedAudio);
  exportMediaSource.connect(exportAudioCtx.destination);
}

function tapAudioForExport() {
  ensureExportAudioGraph();
  if (exportAudioCtx.state === 'suspended') exportAudioCtx.resume();
  exportAudioDest = exportAudioCtx.createMediaStreamDestination();
  exportMediaSource.connect(exportAudioDest);
  return exportAudioDest;
}

function untapAudioForExport() {
  if (exportAudioDest) {
    try { exportMediaSource.disconnect(exportAudioDest); } catch (e) { /* already gone */ }
    exportAudioDest = null;
  }
}

/* ---- recorder plumbing ---- */

function pickExportMimeType() {
  const prefs = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  if (!window.MediaRecorder) return '';
  for (const t of prefs) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

function exportFilename() {
  const n = parseInt(state.episode.number, 10);
  const num = Number.isNaN(n) ? '000' : String(Math.max(0, n)).padStart(3, '0');
  return `private-voice-notes-episode-${num}.webm`;
}

function setExportStatus(phase, text) {
  const wrap = document.getElementById('export-status');
  wrap.classList.remove('hidden');
  wrap.setAttribute('data-phase', phase);
  document.getElementById('export-status-text').textContent = text;
  pvnsExport.status = phase;
}

let exporting = false;

async function exportVideo() {
  if (exporting || sequenceState.active) return;
  if (state.role !== 'owner') return; // export is Owner-only
  exporting = true;

  const exportBtn = document.getElementById('export-btn');
  const downloadLink = document.getElementById('export-download');
  downloadLink.classList.add('hidden');
  exportBtn.disabled = true;

  setExportStatus('preparing', 'Preparing…');

  let recorder = null;
  try {
    await ensureExportFonts();
    await preloadAvatars();

    const canvas = getExportCanvas();
    const ctx = canvas.getContext('2d');
    exportScroll.current = 0;
    drawPreviewFrame(ctx); // paint an initial frame so the stream starts non-blank

    const fps = 30;
    const videoStream = canvas.captureStream(fps);

    // Tap audio if anything will actually play a real file — the combined
    // master (combined mode) or any note with a decoded file (per-note
    // mode). Per-note playback swaps sharedAudio.src per note as the
    // sequence advances, and the tap follows the element, so every note's
    // clip lands in the recording in order.
    const willHaveAudio = state.audioMode === 'combined'
      ? hasConversationAudio()
      : state.notes.some((n) => noteHasRealAudio(n));
    let audioTracks = [];
    if (willHaveAudio) {
      const dest = tapAudioForExport();
      audioTracks = dest.stream.getAudioTracks();
    }

    const combined = new MediaStream([...videoStream.getVideoTracks(), ...audioTracks]);
    const mimeType = pickExportMimeType();
    recorder = new MediaRecorder(combined, mimeType ? { mimeType } : undefined);

    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise((resolve) => { recorder.onstop = resolve; });

    let drawing = true;
    const drawLoop = () => {
      if (!drawing) return;
      drawPreviewFrame(ctx);
      requestAnimationFrame(drawLoop);
    };
    requestAnimationFrame(drawLoop);

    setExportStatus('recording', 'Recording…');
    recorder.start();

    // Capture the exact same take Recording Mode produces.
    await runSequence({ isRecording: true });

    const cancelled = sequenceState.cancelled;
    // Hold on the end screen briefly so it lands in the video.
    if (!cancelled && state.recording.showEndScreen) {
      await wait(1500);
    }

    setExportStatus('finalizing', 'Finalizing…');
    setDashboardEnabled(false); // runSequence re-enabled everything; keep locked through finalize
    drawing = false;
    recorder.stop();
    await stopped;
    untapAudioForExport();

    if (cancelled) {
      setExportStatus('idle', 'Export cancelled.');
      pvnsExport.status = 'cancelled';
      return;
    }

    const blob = new Blob(chunks, { type: (mimeType || 'video/webm').split(';')[0] });
    if (pvnsExport.blobUrl) URL.revokeObjectURL(pvnsExport.blobUrl);
    const url = URL.createObjectURL(blob);
    const filename = exportFilename();

    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.textContent = `Download ${filename}`;
    downloadLink.classList.remove('hidden');

    const sizeMb = (blob.size / (1024 * 1024)).toFixed(1);
    setExportStatus('ready', `Download ready — ${filename} (${sizeMb} MB)`);

    Object.assign(pvnsExport, {
      status: 'ready',
      filename,
      mimeType: mimeType || 'video/webm',
      sizeBytes: blob.size,
      hadAudio: audioTracks.length > 0,
      blobUrl: url,
    });
  } catch (err) {
    setExportStatus('error', `Export failed: ${err && err.message ? err.message : err}`);
    pvnsExport.status = 'error';
    pvnsExport.error = String(err);
    untapAudioForExport();
  } finally {
    exporting = false;
    // The end screen was held on-screen so it lands in the video; now
    // that capture is done, clear it so the live preview is immediately
    // usable again (unlike a live Recording Mode take, which leaves its
    // final frame up on purpose).
    hideEndScreen();
    unfocusAllNotes();
    setDashboardEnabled(true);
    rebuildNotesTable();
    applyRolePermissions();
    updateSequenceButtonsUI();
    refreshExportButton(); // re-apply the audio-readiness gate
  }
}

function wireExport() {
  document.getElementById('export-btn').addEventListener('click', exportVideo);
}

/* ====================================================================
   12. PROJECT — Save / Load / Duplicate as JSON (Section 0)

   The whole episode (metadata, characters, notes, timing, audio mode,
   recording settings) round-trips through a plain JSON file. Actual
   audio and avatar *files* are never embedded — only their filenames —
   so a loaded project shows what to re-upload and keeps working on
   placeholder timing until you do. Nothing here can freeze playback:
   notes with no restorable file simply fall back to placeholder timing.
   ==================================================================== */

const PROJECT_FORMAT_VERSION = 1;

function numOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function setProjectStatus(phase, text) {
  const wrap = document.getElementById('project-status');
  wrap.classList.remove('hidden');
  wrap.setAttribute('data-phase', phase);
  document.getElementById('project-status-text').textContent = text;
}

function serializeEpisode() {
  return {
    formatVersion: PROJECT_FORMAT_VERSION,
    savedAt: new Date().toISOString(),
    project: { name: state.project.name, casting: state.project.casting },
    contributor: { name: state.contributor.name },
    episode: { ...state.episode },
    // Informational: the header contact is the Khalil character's name.
    threadContact: state.characters.khalil.name,
    characters: {
      khalil: { name: state.characters.khalil.name, avatarFileName: state.characters.khalil.avatarFileName },
      honey: { name: state.characters.honey.name, avatarFileName: state.characters.honey.avatarFileName },
    },
    audioMode: state.audioMode,
    combinedAudio: { fileName: state.conversationAudio.fileName },
    recording: { ...state.recording },
    notes: state.notes.map((n) => ({
      speaker: n.speaker,
      label: n.label,
      receipt: n.receipt,
      startTime: n.startTime,
      endTime: n.endTime,
      duration: Number(effectiveDuration(n).toFixed(3)),
      audio: { fileName: n.audio ? n.audio.fileName : null },
    })),
  };
}

function projectFilename(ext) {
  const n = parseInt(state.episode.number, 10);
  const num = Number.isNaN(n) ? '000' : String(Math.max(0, n)).padStart(3, '0');
  return `private-voice-notes-episode-${num}.${ext}`;
}

function saveEpisodeJson() {
  const blob = new Blob([JSON.stringify(serializeEpisode(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = projectFilename('json');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setProjectStatus('saved', `Episode saved — ${projectFilename('json')}`);
}

function revokeAllObjectUrls() {
  if (state.conversationAudio.objectUrl) URL.revokeObjectURL(state.conversationAudio.objectUrl);
  state.notes.forEach((n) => { if (n.audio && n.audio.objectUrl) URL.revokeObjectURL(n.audio.objectUrl); });
  Object.values(state.characters).forEach((c) => {
    if (c.avatarUrl && c.avatarUrl.startsWith('blob:')) URL.revokeObjectURL(c.avatarUrl);
  });
}

// Rebuilds the entire project from a parsed JSON object. `clearedAudio`
// true (Duplicate) drops all file references to 'none'; false (Load)
// marks previously-attached files as 'needed' so they show as
// re-upload prompts.
function applyLoadedData(data, { clearedAudio }) {
  revokeAllObjectUrls();
  if (activeNoteId) { const an = state.notes.find((n) => n.id === activeNoteId); if (an) stopNote(an, { reset: true }); }
  activeNoteId = null;

  state.project = {
    name: (data.project && data.project.name) || '',
    casting: (data.project && data.project.casting) || '',
  };
  const con = data.contributor || {};
  state.contributor = {
    name: con.name != null ? String(con.name) : '',
  };
  const ep = data.episode || {};
  state.episode = {
    title: ep.title != null ? ep.title : '',
    number: ep.number != null ? ep.number : 1,
    season: ep.season != null ? ep.season : 1,
    internalNotes: ep.internalNotes != null ? ep.internalNotes : '',
    povCaption: ep.povCaption != null ? ep.povCaption : '',
  };

  // Mutate the existing character objects in place — the character
  // editors captured these references when wired, so replacing the
  // objects would leave restored names/avatars invisible to the UI.
  const applyChar = (key, src, defName) => {
    const c = state.characters[key];
    if (c.avatarUrl && c.avatarUrl.startsWith('blob:')) URL.revokeObjectURL(c.avatarUrl);
    c.name = src.name || defName;
    c.initials = deriveInitials(c.name);
    c.avatarUrl = DEFAULT_AVATARS[key];
    c.avatarFileName = clearedAudio ? null : (src.avatarFileName || null);
    c.avatarBlob = null;
  };
  applyChar('khalil', (data.characters && data.characters.khalil) || {}, 'Khalil Vaughn');
  applyChar('honey', (data.characters && data.characters.honey) || {}, 'Luscious Honey');

  state.audioMode = data.audioMode === 'combined' ? 'combined' : 'perNote';
  state.conversationAudio = {
    fileName: clearedAudio ? null : ((data.combinedAudio && data.combinedAudio.fileName) || null),
    objectUrl: null,
  };

  const rec = data.recording || {};
  state.recording = {
    countdownSeconds: numOr(rec.countdownSeconds, 3),
    settleBeforeFirstNote: numOr(rec.settleBeforeFirstNote, 1000),
    delayBetweenNotes: numOr(rec.delayBetweenNotes, 850),
    showEndScreen: rec.showEndScreen != null ? Boolean(rec.showEndScreen) : true,
    endScreenText: rec.endScreenText != null ? rec.endScreenText : 'Should we post Part 2?',
  };

  const rawNotes = Array.isArray(data.notes) && data.notes.length ? data.notes : [{}];
  state.notes = rawNotes.map((n) => {
    const start = numOr(n.startTime, 0);
    const dur = Math.max(0.2, numOr(n.duration, numOr(n.endTime, start + 6) - start) || 6);
    const fileName = clearedAudio ? null : (n.audio && n.audio.fileName) || null;
    return {
      id: nextNoteId(),
      speaker: n.speaker === 'honey' ? 'honey' : 'khalil',
      label: n.label || '',
      receipt: n.receipt === 'Played' ? 'Played' : 'Delivered',
      startTime: start,
      endTime: numOr(n.endTime, start + dur),
      placeholderDuration: dur,
      audio: { fileName, objectUrl: null, duration: 0, status: fileName ? 'needed' : 'none', owner: !(n.audio && n.audio.owner === false) },
    };
  });

  syncDashboardFromState();
}

// Pushes the whole `state` back into every dashboard control, then
// rebuilds the notes table and phone preview (via applyAudioMode).
function syncDashboardFromState() {
  document.getElementById('project-name').value = state.project.name;
  document.getElementById('project-casting').value = state.project.casting;

  const contributorNameInput = document.getElementById('contributor-name');
  if (contributorNameInput) contributorNameInput.value = state.contributor.name;
  // The Owner/Contributor Memo Display Name fields mirror the lane display
  // names; characterSyncers (called just below) refreshes them on load.

  document.getElementById('ep-title').value = state.episode.title;
  document.getElementById('ep-number').value = state.episode.number;
  document.getElementById('ep-season').value = state.episode.season;
  document.getElementById('ep-notes').value = state.episode.internalNotes;
  document.getElementById('ep-pov').value = state.episode.povCaption;
  document.getElementById('episode-subtitle').textContent =
    `Creator Dashboard — S${state.episode.season} E${state.episode.number}: ${state.episode.title}`;

  Object.values(characterSyncers).forEach((fn) => fn());

  document.getElementById('rec-countdown').value = state.recording.countdownSeconds;
  document.getElementById('rec-settle').value = state.recording.settleBeforeFirstNote;
  document.getElementById('rec-gap').value = state.recording.delayBetweenNotes;
  document.getElementById('rec-endscreen-toggle').checked = state.recording.showEndScreen;
  document.getElementById('rec-endscreen-text').value = state.recording.endScreenText;

  const cstatus = document.getElementById('conversation-audio-status');
  cstatus.textContent = state.conversationAudio.fileName
    ? `File needed — re-upload "${state.conversationAudio.fileName}".`
    : 'No file selected — placeholder timing will be used for every note.';

  applyAudioMode(); // rebuilds notes table + preview for the loaded audio mode
  applyRolePermissions(); // owner vs contributor locks
}

function anyAudioReferenced() {
  if (state.conversationAudio.fileName) return true;
  return state.notes.some((n) => n.audio && n.audio.status === 'needed');
}

function loadEpisodeJsonFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try {
      data = JSON.parse(reader.result);
    } catch (e) {
      setProjectStatus('error', "Couldn't read that file — is it a valid episode JSON?");
      return;
    }
    if (!data || typeof data !== 'object' || !data.episode) {
      setProjectStatus('error', "That JSON doesn't look like an episode file.");
      return;
    }
    applyLoadedData(data, { clearedAudio: false });
    if (anyAudioReferenced()) {
      setProjectStatus('needed', 'Episode loaded — audio files need to be re-uploaded.');
    } else {
      setProjectStatus('loaded', 'Episode loaded.');
    }
  };
  reader.onerror = () => setProjectStatus('error', "Couldn't read that file.");
  reader.readAsText(file);
}

function duplicateEpisode() {
  const data = serializeEpisode();
  const n = parseInt(data.episode.number, 10);
  if (!Number.isNaN(n)) data.episode.number = n + 1;
  data.episode.title = `${data.episode.title || 'Episode'} Copy`;
  applyLoadedData(data, { clearedAudio: true });
  setProjectStatus('created', 'Duplicate created — audio references cleared, ready for new files.');
}

function wireProjectSection() {
  const nameInput = document.getElementById('project-name');
  const castInput = document.getElementById('project-casting');
  nameInput.value = state.project.name;
  castInput.value = state.project.casting;
  nameInput.addEventListener('input', () => { state.project.name = nameInput.value; });
  castInput.addEventListener('input', () => { state.project.casting = castInput.value; });

  document.getElementById('save-json-btn').addEventListener('click', saveEpisodeJson);

  const loadInput = document.getElementById('load-json-input');
  document.getElementById('load-json-btn').addEventListener('click', () => {
    if (sequenceState.active || exporting) return;
    loadInput.click();
  });
  loadInput.addEventListener('change', () => {
    const file = loadInput.files[0];
    if (file) loadEpisodeJsonFile(file);
    loadInput.value = ''; // allow re-loading the same file later
  });

  document.getElementById('duplicate-btn').addEventListener('click', () => {
    if (sequenceState.active || exporting) return;
    duplicateEpisode();
  });
}

/* ====================================================================
   13. EPISODE PACKAGES — ZIP collaboration (Section 0, primary flow)

   Two creators pass a single Episode-NNN.zip back and forth. The ZIP
   bundles episode.json (the same project manifest, plus per-note
   uploaded/filename/duration), a README.txt, and the actual audio and
   avatar files under /audio and /avatars. No login, no cloud.

   ZIP is written/read here in plain JS using the "stored" (no
   compression) method — audio/images are already compressed, so this
   stays dependency-free while producing a standard .zip that also opens
   in Finder.
   ==================================================================== */

/* ---- CRC32 (needed for a valid ZIP) ---- */
const CRC32_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC32_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const utf8 = new TextEncoder();

/* ---- minimal ZIP writer (all entries stored, method 0) ---- */
function zipCreate(files) {
  // files: [{ name: string, data: Uint8Array }]
  const chunks = [];
  const central = [];
  let offset = 0;

  const pushU16 = (arr, v) => { arr.push(v & 0xff, (v >>> 8) & 0xff); };
  const pushU32 = (arr, v) => { arr.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff); };

  for (const f of files) {
    const nameBytes = utf8.encode(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;

    const local = [];
    pushU32(local, 0x04034b50); // local file header sig
    pushU16(local, 20); // version needed
    pushU16(local, 0x0800); // flags: UTF-8 filename
    pushU16(local, 0); // method: stored
    pushU16(local, 0); // mod time
    pushU16(local, 0x21); // mod date (1980-01-01)
    pushU32(local, crc);
    pushU32(local, size); // compressed size
    pushU32(local, size); // uncompressed size
    pushU16(local, nameBytes.length);
    pushU16(local, 0); // extra len
    const localHeader = new Uint8Array(local);
    chunks.push(localHeader, nameBytes, f.data);

    const cd = [];
    pushU32(cd, 0x02014b50); // central dir header sig
    pushU16(cd, 20); // version made by
    pushU16(cd, 20); // version needed
    pushU16(cd, 0x0800); // flags
    pushU16(cd, 0); // method
    pushU16(cd, 0); // mod time
    pushU16(cd, 0x21); // mod date
    pushU32(cd, crc);
    pushU32(cd, size);
    pushU32(cd, size);
    pushU16(cd, nameBytes.length);
    pushU16(cd, 0); // extra
    pushU16(cd, 0); // comment
    pushU16(cd, 0); // disk start
    pushU16(cd, 0); // internal attrs
    pushU32(cd, 0); // external attrs
    pushU32(cd, offset); // local header offset
    central.push(new Uint8Array(cd), nameBytes);

    offset += localHeader.length + nameBytes.length + f.data.length;
  }

  const centralStart = offset;
  let centralSize = 0;
  central.forEach((c) => { chunks.push(c); centralSize += c.length; });

  const eocd = [];
  pushU32(eocd, 0x06054b50); // EOCD sig
  pushU16(eocd, 0); // disk
  pushU16(eocd, 0); // disk with CD
  pushU16(eocd, files.length); // entries this disk
  pushU16(eocd, files.length); // total entries
  pushU32(eocd, centralSize);
  pushU32(eocd, centralStart);
  pushU16(eocd, 0); // comment len
  chunks.push(new Uint8Array(eocd));

  return new Blob(chunks, { type: 'application/zip' });
}

/* ---- minimal ZIP reader ---- */
async function zipRead(arrayBuffer) {
  const buf = new Uint8Array(arrayBuffer);
  const dv = new DataView(arrayBuffer);
  // locate End Of Central Directory (scan back for signature)
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65536; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a ZIP file');
  const count = dv.getUint16(eocd + 10, true);
  let ptr = dv.getUint32(eocd + 16, true); // central dir offset

  const out = new Map();
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(ptr, true) !== 0x02014b50) break;
    const method = dv.getUint16(ptr + 10, true);
    const compSize = dv.getUint32(ptr + 20, true);
    const nameLen = dv.getUint16(ptr + 28, true);
    const extraLen = dv.getUint16(ptr + 30, true);
    const commentLen = dv.getUint16(ptr + 32, true);
    const localOff = dv.getUint32(ptr + 42, true);
    const name = new TextDecoder().decode(buf.subarray(ptr + 46, ptr + 46 + nameLen));

    // jump to local header to find the real data start
    const lNameLen = dv.getUint16(localOff + 26, true);
    const lExtraLen = dv.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);

    let data;
    if (method === 0) {
      data = raw.slice();
    } else if (method === 8 && typeof DecompressionStream !== 'undefined') {
      const ds = new DecompressionStream('deflate-raw');
      const ab = await new Response(new Blob([raw]).stream().pipeThrough(ds)).arrayBuffer();
      data = new Uint8Array(ab);
    } else {
      throw new Error(`Unsupported ZIP compression (method ${method})`);
    }
    out.set(name, data);
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/* ---- packaging ---- */
function safeName(name) {
  return String(name || 'file').replace(/[\\/:*?"<>|]+/g, '_').replace(/^\.+/, '');
}

// Restored blobs must carry a MIME type or <audio>/<img> can stall on
// them (a typeless audio blob may never start, which would hang export).
function mimeForName(name) {
  const ext = (String(name).split('.').pop() || '').toLowerCase();
  return {
    wav: 'audio/wav', mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
  }[ext] || 'application/octet-stream';
}

function episodeNumPadded() {
  const n = parseInt(state.episode.number, 10);
  return Number.isNaN(n) ? '000' : String(Math.max(0, n)).padStart(3, '0');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// Manifest = the Sprint 10 JSON plus package fields. `opts` controls the
// package type and what audio is bundled:
//   packageType   'master' | 'actor' | 'return'
//   assignedTo    the contributor's speaker (actor/return)
//   includeAudio  (note,i) => bool — which notes' clips to bundle
//   includeCombined / includeAvatars — bundle the master file / avatars
function serializeEpisodeForPackage(opts) {
  const {
    packageType = 'master',
    assignedTo = null,
    includeAudio = () => true,
    includeCombined = true,
    includeAvatars = true,
  } = opts || {};

  const base = serializeEpisode();
  base.packageVersion = 2;
  base.packageType = packageType;
  base.assignedTo = assignedTo;

  base.notes = base.notes.map((noteJson, i) => {
    const note = state.notes[i];
    const loaded = Boolean(note.audio && note.audio.status === 'loaded' && note.audio.blob);
    const include = loaded && includeAudio(note, i);
    const packagedAs = include ? `audio/note-${i + 1}-${safeName(note.audio.fileName)}` : null;
    return {
      ...noteJson,
      audio: {
        fileName: noteJson.audio.fileName,
        uploaded: include,
        owner: Boolean(note.audio && note.audio.owner),
        duration: noteJson.duration,
        packagedAs,
      },
    };
  });

  const combinedInclude = includeCombined && Boolean(state.conversationAudio.blob && state.conversationAudio.fileName);
  base.combinedAudio = {
    fileName: state.conversationAudio.fileName,
    uploaded: combinedInclude,
    packagedAs: combinedInclude ? `audio/combined-${safeName(state.conversationAudio.fileName)}` : null,
  };

  ['khalil', 'honey'].forEach((key) => {
    const c = state.characters[key];
    const has = includeAvatars && Boolean(c.avatarBlob && c.avatarFileName);
    base.characters[key].avatarPackagedAs = has ? `avatars/${key}-${safeName(c.avatarFileName)}` : null;
  });

  return base;
}

function packageReadmeText(manifest) {
  const type = manifest.packageType || 'master';
  // Memo display name for a lane, read from the packaged character names.
  const manifestName = (lane) =>
    (manifest.characters && manifest.characters[lane] && manifest.characters[lane].name && manifest.characters[lane].name.trim())
    || ROLE_LABEL[lane] || lane;
  const memo = manifestName(manifest.assignedTo || CONTRIBUTOR_LANE);
  const contributorName = manifest.contributor && manifest.contributor.name && manifest.contributor.name.trim();
  // "Khalil Vaughn (as Malik)" when a person name is set, else the memo name.
  const who = contributorName ? `${contributorName} (as ${memo})` : memo;
  const lines = [
    'PRIVATE VOICE NOTES — EPISODE PACKAGE',
    '=====================================',
    '',
    `Project: ${manifest.project.name || '(untitled)'}`,
    `Cast:    ${manifest.project.casting || ''}`,
    `Episode: S${manifest.episode.season} E${manifest.episode.number} — ${manifest.episode.title}`,
    `Type:    ${type.toUpperCase()}${type === 'actor' || type === 'return' ? ` (for ${who})` : ''}`,
    '',
  ];

  if (type === 'actor') {
    lines.push(
      `YOU ARE A CONTRIBUTOR (${who})`,
      '-----------------------------',
      '1. Open the Private Voice Notes Studio (npm run studio).',
      '2. Click "Open Episode Package" and choose this .zip.',
      `3. You will be in Contributor mode. You can ONLY add audio for`,
      `   ${who}'s lines. Everything else is locked (Owner reference).`,
      '4. Upload each of your missing lines to its note. Preview the',
      '   conversation to check the flow.',
      '5. Click "Save Return Package" — it contains ONLY your new audio.',
      '6. Send that Return Package .zip back to the Owner.',
      '',
      'You cannot export; the Owner assembles and exports the final video.',
    );
  } else if (type === 'return') {
    lines.push(
      'RETURN PACKAGE (Contributor -> Owner)',
      '-------------------------------------',
      'This contains only the contributor\'s newly recorded lines.',
      'Owner: open the Master Project, then use "Import Return Package"',
      'to merge these lines in. Only the Owner can export.',
    );
  } else {
    lines.push(
      'MASTER PROJECT (Owner)',
      '----------------------',
      'The full episode with all audio and avatars. Open it with',
      '"Open Episode Package" to keep working as the Owner.',
    );
  }

  lines.push('', 'FILES', '-----', 'episode.json  — project + per-note status', '/audio        — voice-note clips', '/avatars      — character avatars', '', 'NOTE STATUS', '-----------');
  manifest.notes.forEach((n, i) => {
    const role = manifestName(n.speaker);
    const mark = n.audio.uploaded ? '[x] audio included' : '[ ] no audio';
    lines.push(`  Note ${i + 1} (${role}): ${mark}${n.audio.fileName ? ' — ' + n.audio.fileName : ''}`);
  });
  lines.push('');
  return lines.join('\n');
}

async function buildPackageBlob(opts) {
  const manifest = serializeEpisodeForPackage(opts);
  const files = [];
  files.push({ name: 'episode.json', data: utf8.encode(JSON.stringify(manifest, null, 2)) });
  files.push({ name: 'README.txt', data: utf8.encode(packageReadmeText(manifest)) });

  for (let i = 0; i < state.notes.length; i++) {
    const packagedAs = manifest.notes[i].audio.packagedAs;
    if (packagedAs && state.notes[i].audio.blob) {
      files.push({ name: packagedAs, data: new Uint8Array(await state.notes[i].audio.blob.arrayBuffer()) });
    }
  }
  if (manifest.combinedAudio.packagedAs && state.conversationAudio.blob) {
    files.push({ name: manifest.combinedAudio.packagedAs, data: new Uint8Array(await state.conversationAudio.blob.arrayBuffer()) });
  }
  for (const key of ['khalil', 'honey']) {
    const p = manifest.characters[key].avatarPackagedAs;
    const c = state.characters[key];
    if (p && c.avatarBlob) files.push({ name: p, data: new Uint8Array(await c.avatarBlob.arrayBuffer()) });
  }

  return { blob: zipCreate(files), manifest };
}

/* ---- Owner package actions ---- */
async function saveMasterProject() {
  if (state.role !== 'owner' || sequenceState.active || exporting) return;
  setProjectStatus('saved', 'Building master project…');
  try {
    const { blob } = await buildPackageBlob({ packageType: 'master' });
    const name = `Episode-${episodeNumPadded()}.zip`;
    downloadBlob(blob, name);
    setProjectStatus('saved', `Master project saved — ${name} (${(blob.size / 1048576).toFixed(1)} MB).`);
  } catch (err) {
    setProjectStatus('error', `Couldn't build master project: ${err.message}`);
  }
}

async function packageForActor() {
  if (state.role !== 'owner' || sequenceState.active || exporting) return;
  // The contributor side is always the same fixed lane — permissions never
  // depend on a typed name. Their memo display name is just a label.
  const target = CONTRIBUTOR_LANE;
  const memo = memoName(CONTRIBUTOR_LANE);
  // Address the package by the contributor *person* name when set, falling
  // back to their memo display name.
  const named = state.contributor.name && state.contributor.name.trim();
  const label = named || memo;
  const forWhom = named ? `${named} (as ${memo})` : memo;
  setProjectStatus('saved', `Building package for ${forWhom}…`);
  try {
    // The package carries the full conversation (Owner audio is reference
    // so the contributor can preview), assigned to `target`.
    const { blob } = await buildPackageBlob({ packageType: 'actor', assignedTo: target });
    const name = `Episode-${episodeNumPadded()}-for-${safeName(label)}.zip`;
    downloadBlob(blob, name);
    setProjectStatus('saved', `Package for ${forWhom} saved — ${name}. Send it to their studio.`);
  } catch (err) {
    setProjectStatus('error', `Couldn't build the package: ${err.message}`);
  }
}

/* ---- Contributor package action ---- */
async function saveReturnPackage() {
  if (state.role !== 'contributor' || sequenceState.active) return;
  const target = state.assignedSpeaker;
  const mine = (note) => note.speaker === target && note.audio && note.audio.status === 'loaded' && note.audio.owner === false;
  const count = state.notes.filter(mine).length;
  if (count === 0) {
    setProjectStatus('needed', 'Add at least one of your lines before saving a Return Package.');
    return;
  }
  const label = contributorLabel();
  setProjectStatus('saved', 'Building return package…');
  try {
    const { blob } = await buildPackageBlob({
      packageType: 'return',
      assignedTo: target,
      includeAudio: mine, // only the contributor's own new clips
      includeCombined: false,
      includeAvatars: false,
    });
    const name = `Episode-${episodeNumPadded()}-return-${safeName(label)}.zip`;
    downloadBlob(blob, name);
    setProjectStatus('saved', `${label}'s return package saved — ${name} (${count} line(s)). Send it back to the Owner.`);
  } catch (err) {
    setProjectStatus('error', `Couldn't build return package: ${err.message}`);
  }
}

// Restores audio/avatars from a master/actor package. Restored clips are
// Owner reference audio (owner: true).
function restorePackagedFiles(manifest, entries) {
  const notes = Array.isArray(manifest.notes) ? manifest.notes : [];
  notes.forEach((n, i) => {
    const note = state.notes[i];
    if (!note) return;
    const path = n.audio && n.audio.packagedAs;
    if (path && entries.has(path)) {
      const fileName = (n.audio && n.audio.fileName) || note.audio.fileName;
      const blob = new Blob([entries.get(path)], { type: mimeForName(fileName) });
      if (note.audio.objectUrl) URL.revokeObjectURL(note.audio.objectUrl);
      note.audio = {
        fileName,
        objectUrl: URL.createObjectURL(blob),
        blob,
        duration: numOr(n.audio && n.audio.duration, numOr(n.duration, 0)),
        status: 'loaded',
        owner: true,
      };
    }
  });

  const combined = manifest.combinedAudio || {};
  if (combined.packagedAs && entries.has(combined.packagedAs)) {
    const blob = new Blob([entries.get(combined.packagedAs)], { type: mimeForName(combined.fileName) });
    if (state.conversationAudio.objectUrl) URL.revokeObjectURL(state.conversationAudio.objectUrl);
    state.conversationAudio = { fileName: combined.fileName, objectUrl: URL.createObjectURL(blob), blob };
    sharedAudio.src = state.conversationAudio.objectUrl;
  }

  ['khalil', 'honey'].forEach((key) => {
    const info = (manifest.characters && manifest.characters[key]) || {};
    if (info.avatarPackagedAs && entries.has(info.avatarPackagedAs)) {
      const blob = new Blob([entries.get(info.avatarPackagedAs)], { type: mimeForName(info.avatarFileName) });
      const c = state.characters[key];
      if (c.avatarUrl && c.avatarUrl.startsWith('blob:')) URL.revokeObjectURL(c.avatarUrl);
      c.avatarUrl = URL.createObjectURL(blob);
      c.avatarBlob = blob;
      c.avatarFileName = info.avatarFileName || c.avatarFileName;
    }
  });
}

async function openEpisodePackage(file) {
  setProjectStatus('loaded', 'Opening package…');
  let entries;
  try {
    entries = await zipRead(await file.arrayBuffer());
  } catch (err) {
    setProjectStatus('error', `Couldn't read that ZIP: ${err.message}`);
    return;
  }
  const jsonEntry = entries.get('episode.json');
  if (!jsonEntry) {
    setProjectStatus('error', 'That ZIP has no episode.json — is it an episode package?');
    return;
  }
  let manifest;
  try {
    manifest = JSON.parse(new TextDecoder().decode(jsonEntry));
  } catch (err) {
    setProjectStatus('error', 'The package\'s episode.json is corrupted.');
    return;
  }

  const type = manifest.packageType || 'master'; // legacy packages = master
  if (type === 'return') {
    setProjectStatus('error', 'This is a Return Package — the Owner merges it with "Import Return Package", not Open.');
    return;
  }

  // The package type sets the role: an Actor Package locks the studio to
  // Contributor mode locks to the fixed contributor lane. The permission
  // lane comes from the package's assignedTo (or the fixed lane), never a
  // typed name.
  state.role = type === 'actor' ? 'contributor' : 'owner';
  state.assignedSpeaker = type === 'actor' ? (manifest.assignedTo || CONTRIBUTOR_LANE) : null;
  state.assignedContributorName = type === 'actor'
    ? ((manifest.contributor && manifest.contributor.name) || null)
    : null;

  applyLoadedData(manifest, { clearedAudio: false });
  restorePackagedFiles(manifest, entries);
  syncDashboardFromState();

  if (state.role === 'contributor') {
    const who = contributorLabel();
    const todo = state.notes.filter((n) => n.speaker === state.assignedSpeaker && !(n.audio && n.audio.status === 'loaded')).length;
    setProjectStatus('needed', `Package opened — Contributor mode (${who}). Add your ${todo} line(s), then Save Return Package.`);
  } else {
    const waiting = state.notes.filter((n) => !(n.audio && n.audio.status === 'loaded'));
    if (waiting.length === 0) setProjectStatus('loaded', 'Master project opened — every line is in. Ready to export.');
    else {
      const roles = [...new Set(waiting.map((n) => memoName(n.speaker)))];
      setProjectStatus('needed', `Master project opened — waiting on ${waiting.length} line(s): ${roles.join(', ')}.`);
    }
  }
}

// Owner merges a Return Package: pulls in the contributor's clips by note
// position, leaving all other notes and metadata untouched.
async function importReturnPackage(file) {
  if (state.role !== 'owner') return;
  setProjectStatus('loaded', 'Importing return package…');
  let entries;
  try {
    entries = await zipRead(await file.arrayBuffer());
  } catch (err) {
    setProjectStatus('error', `Couldn't read that ZIP: ${err.message}`);
    return;
  }
  const jsonEntry = entries.get('episode.json');
  if (!jsonEntry) {
    setProjectStatus('error', 'That ZIP has no episode.json.');
    return;
  }
  let manifest;
  try {
    manifest = JSON.parse(new TextDecoder().decode(jsonEntry));
  } catch (err) {
    setProjectStatus('error', 'The return package\'s episode.json is corrupted.');
    return;
  }
  if (manifest.packageType !== 'return') {
    setProjectStatus('error', 'That isn\'t a Return Package. Use "Open Episode Package" for master/actor files.');
    return;
  }

  const target = manifest.assignedTo || CONTRIBUTOR_LANE;
  const contributorName = manifest.contributor && manifest.contributor.name && manifest.contributor.name.trim();
  const returnMemo = (manifest.characters && manifest.characters[target] && manifest.characters[target].name && manifest.characters[target].name.trim())
    || ROLE_LABEL[target] || target;
  const who = contributorName || returnMemo;

  // Build the merged audio slot for a return note (or null if it carries
  // no clip). Merged clips become Owner-managed (owner: true).
  const audioFromReturn = (n) => {
    const path = n.audio && n.audio.packagedAs;
    if (!path || !entries.has(path)) return null;
    const fileName = (n.audio && n.audio.fileName) || null;
    const blob = new Blob([entries.get(path)], { type: mimeForName(fileName) });
    return { fileName, objectUrl: URL.createObjectURL(blob), blob, duration: numOr(n.audio && n.audio.duration, numOr(n.duration, 0)), status: 'loaded', owner: true };
  };

  let merged = 0;
  let added = 0;
  (manifest.notes || []).forEach((n, i) => {
    // Only the contributor's own lines come back — never touch Owner notes.
    if (n.speaker !== target) return;

    const existing = state.notes[i];
    const alignsWithExisting = existing && existing.speaker === target;
    if (i < state.notes.length && alignsWithExisting) {
      // Edit to an existing assigned line: apply their audio + label/receipt.
      const slot = audioFromReturn(n);
      if (slot) {
        if (existing.audio && existing.audio.objectUrl) URL.revokeObjectURL(existing.audio.objectUrl);
        existing.audio = slot;
        merged++;
      }
      if (typeof n.label === 'string') existing.label = n.label;
      if (n.receipt === 'Played' || n.receipt === 'Delivered') existing.receipt = n.receipt;
    } else {
      // A take the contributor added — append it to the master.
      const start = numOr(n.startTime, 0);
      const dur = Math.max(0.2, numOr(n.duration, numOr(n.endTime, start + 6) - start) || 6);
      const slot = audioFromReturn(n);
      state.notes.push({
        id: nextNoteId(),
        speaker: target,
        label: n.label || '',
        receipt: n.receipt === 'Played' ? 'Played' : 'Delivered',
        startTime: start,
        endTime: numOr(n.endTime, start + dur),
        placeholderDuration: dur,
        audio: slot || newNoteAudio(),
      });
      added++;
      if (slot) merged++;
    }
  });

  syncDashboardFromState();
  if (merged > 0 || added > 0) {
    const parts = [];
    if (merged > 0) parts.push(`${merged} clip(s) merged`);
    if (added > 0) parts.push(`${added} new take(s) added`);
    setProjectStatus('loaded', `${who}'s return package imported — ${parts.join(', ')}.`);
  } else {
    setProjectStatus('needed', `No lines from ${who} found in that return package.`);
  }
}

/* ---- role permissions ---- */
function applyRolePermissions() {
  const contributor = state.role === 'contributor';
  const dash = document.getElementById('dashboard');
  if (dash) dash.setAttribute('data-role', state.role);

  const banner = document.getElementById('role-banner');
  if (banner) {
    if (contributor) {
      const who = contributorLabel();
      const memo = memoName(state.assignedSpeaker);
      banner.textContent = `Welcome, ${who} — your voice memos appear as "${memo}". Add your lines, preview, then Save Return Package. Reload the studio to start over as Owner.`;
    } else {
      banner.textContent = 'Owner — Master Project. Full control.';
    }
  }

  // Metadata / recording / character controls are Owner-only. (Add Note
  // is NOT locked: a contributor may add their own assigned takes.)
  const lockIds = [
    'project-name', 'project-casting', 'ep-title', 'ep-number', 'ep-season', 'ep-notes', 'ep-pov',
    'khalil-name', 'honey-name', 'khalil-avatar-input', 'honey-avatar-input',
    'rec-countdown', 'rec-settle', 'rec-gap', 'rec-endscreen-toggle', 'rec-endscreen-text',
  ];
  lockIds.forEach((id) => { const el = document.getElementById(id); if (el) el.disabled = contributor; });
  document.querySelectorAll('.audio-mode-option').forEach((b) => { b.disabled = contributor; });

  const addBtn = document.getElementById('add-note-btn');
  if (addBtn) addBtn.textContent = contributor ? `+ Add ${contributorLabel()}'s Take` : '+ Add Note';

  const returnBtn = document.getElementById('return-btn');
  if (returnBtn && contributor) returnBtn.textContent = `Save ${contributorLabel()}'s Return Package`;

  refreshExportButton();
}

/* ---- export gate (Section 8) — plus Owner-only ---- */
function allRequiredAudioReady() {
  if (state.audioMode === 'combined') return hasConversationAudio();
  return state.notes.every((n) => n.audio && n.audio.status === 'loaded');
}

function refreshExportButton() {
  const btn = document.getElementById('export-btn');
  if (!btn) return;
  const placeholders = document.getElementById('export-placeholders-toggle');
  const allowPlaceholders = placeholders ? placeholders.checked : false;
  const ready = allRequiredAudioReady();
  const ownerOnly = state.role === 'owner';
  const gateOk = ownerOnly && (ready || allowPlaceholders);
  btn.disabled = sequenceState.active || exporting || !gateOk;

  const hint = document.getElementById('export-gate-hint');
  if (hint) {
    if (!ownerOnly) hint.textContent = 'Only the Owner can export. Save a Return Package instead.';
    else if (ready) hint.textContent = 'All lines have audio — ready to export.';
    else if (allowPlaceholders) hint.textContent = 'Exporting with placeholders — missing lines will be silent.';
    else hint.textContent = 'Add audio for every line to enable export (or tick "Export with placeholders").';
  }
}

function wirePackageSection() {
  document.getElementById('save-master-btn').addEventListener('click', saveMasterProject);
  document.getElementById('package-btn').addEventListener('click', packageForActor);
  document.getElementById('return-btn').addEventListener('click', saveReturnPackage);

  // Owner-only: the contributor *person* name (who receives/returns the
  // package) — separate from the memo display names.
  const contributorNameInput = document.getElementById('contributor-name');
  if (contributorNameInput) {
    contributorNameInput.value = state.contributor.name;
    contributorNameInput.addEventListener('input', () => { state.contributor.name = contributorNameInput.value; });
  }

  // Owner-only: the two memo display names that appear on the voice-memo
  // thread and export. They edit the same lane display names as the
  // Characters section, and update the phone preview immediately.
  const ownerMemoInput = document.getElementById('owner-memo-name');
  if (ownerMemoInput) {
    ownerMemoInput.value = state.characters[OWNER_LANE].name;
    ownerMemoInput.addEventListener('input', () => setMemoDisplayName(OWNER_LANE, ownerMemoInput.value));
  }
  const contributorMemoInput = document.getElementById('contributor-memo-name');
  if (contributorMemoInput) {
    contributorMemoInput.value = state.characters[CONTRIBUTOR_LANE].name;
    contributorMemoInput.addEventListener('input', () => setMemoDisplayName(CONTRIBUTOR_LANE, contributorMemoInput.value));
  }

  const openInput = document.getElementById('open-package-input');
  document.getElementById('open-package-btn').addEventListener('click', () => {
    if (sequenceState.active || exporting) return;
    openInput.click();
  });
  openInput.addEventListener('change', () => {
    const file = openInput.files[0];
    if (file) openEpisodePackage(file);
    openInput.value = '';
  });

  const importInput = document.getElementById('import-return-input');
  document.getElementById('import-return-btn').addEventListener('click', () => {
    if (state.role !== 'owner' || sequenceState.active || exporting) return;
    importInput.click();
  });
  importInput.addEventListener('change', () => {
    const file = importInput.files[0];
    if (file) importReturnPackage(file);
    importInput.value = '';
  });

  const placeholders = document.getElementById('export-placeholders-toggle');
  if (placeholders) placeholders.addEventListener('change', refreshExportButton);
}

/* --------------------------------------------------------------------
   INIT
   -------------------------------------------------------------------- */
renderPhonePreview();
wireProjectSection();
wirePackageSection();
wireEpisodeSection();
wireConversationSection();
wireAudioSection();
wireCharactersSection();
wireRecordingSection();
wireControlButtons();
wireExport();
applyRolePermissions();
refreshExportButton();
