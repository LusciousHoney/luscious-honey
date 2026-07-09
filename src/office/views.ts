/* =============================================================================
   EDITORIAL OFFICE — views.
   A calm, literary, one-thing-at-a-time workspace. Each mount function renders
   its screen and wires its own events; navigation is hash-based (see main.ts).
   ============================================================================= */

import type { Answer, DocType, Question } from './types';
import { DOC_TYPES, getDocType } from './schema';
import * as core from './core';
import * as store from './store';
import {
  activeDraftEngine, activeFollowupSource, type Followup,
} from './engine';

/* --- tiny helpers -------------------------------------------------------- */

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
const go = (hash: string) => { location.hash = hash; };

function frame(title: string, body: string, crumb = ''): string {
  return `
    <div class="office container">
      <header class="office-top">
        <a class="office-word" href="#/">Editorial Office</a>
        <p class="office-sub meta">${esc(crumb || 'Luscious Honey Collective · private')}</p>
      </header>
      <main class="office-main" aria-label="${esc(title)}">${body}</main>
    </div>`;
}

/* =============================================================================
   HOME
   ============================================================================= */

export function mountHome(root: HTMLElement): void {
  const cards = DOC_TYPES.map((doc) => {
    const responses = store.getResponses(doc.id);
    const { answered, total } = core.overallProgress(doc, responses);
    const drafts = core.liveVersions(store.getDrafts(doc.id)).length;
    const started = answered > 0 || drafts > 0;
    const status = started
      ? `<span class="meta office-card__status">${answered}/${total} answered${drafts ? ` · ${drafts} draft${drafts > 1 ? 's' : ''}` : ''}</span>`
      : `<span class="meta office-card__status">Not begun</span>`;
    return `
      <a class="office-card plate" href="#/write/${doc.id}">
        <h3 class="office-card__name">${esc(doc.name)}</h3>
        <p class="office-card__blurb">${esc(doc.blurb)}</p>
        ${status}
      </a>`;
  }).join('');

  root.innerHTML = frame('Editorial Office', `
    <section class="office-hero">
      <p class="label">The Editorial Office</p>
      <h1 class="office-hero__title">Where the House finds its voice.</h1>
      <p class="office-hero__lede editorial">
        A private room. One question at a time, saved as you go. Nothing here is
        published — this is where the permanent voice of the House is discovered
        before a word is written.
      </p>
    </section>

    <nav class="office-grid" aria-label="Documents">${cards}</nav>

    <section class="office-elsewhere">
      <a class="button button--quiet" href="#/reflect">Ask me something different</a>
      <a class="button button--quiet" href="#/memory">Editorial memory</a>
    </section>
  `);
}

/* =============================================================================
   INTERVIEW — one question at a time
   ============================================================================= */

// Per-visit position; on entry we resume at the first unanswered question.
const positions = new Map<string, number>();

export function mountInterview(root: HTMLElement, docId: string): void {
  const doc = getDocType(docId);
  if (!doc) return void go('#/');
  const questions = core.allQuestions(doc);

  if (!positions.has(docId)) {
    positions.set(docId, core.firstUnansweredIndex(questions, store.getResponses(docId)));
  }
  renderQuestion(root, doc);
}

function stageOf(doc: DocType, index: number): { name: string; stageIdx: number } {
  let seen = 0;
  for (let s = 0; s < doc.stages.length; s++) {
    const n = doc.stages[s].questions.length;
    if (index < seen + n) return { name: doc.stages[s].name, stageIdx: s };
    seen += n;
  }
  const last = doc.stages.length - 1;
  return { name: doc.stages[last].name, stageIdx: last };
}

function renderQuestion(root: HTMLElement, doc: DocType): void {
  const questions = core.allQuestions(doc);
  const responses = store.getResponses(doc.id);
  const idx = Math.min(positions.get(doc.id) ?? 0, questions.length - 1);
  const q = questions[idx];
  const { stageIdx } = stageOf(doc, idx);

  const rail = doc.stages.map((s, i) => {
    const p = core.stageProgress(doc, responses)[i];
    const state = i === stageIdx ? 'current' : p.complete ? 'done' : 'todo';
    return `<li class="stage-rail__item" data-state="${state}">${esc(s.name)}</li>`;
  }).join('');

  const isLast = idx === questions.length - 1;
  const canGen = core.canGenerate(doc, responses);

  root.innerHTML = frame(doc.name, `
    <div class="interview">
      <ol class="stage-rail" aria-label="Stages">${rail}</ol>

      <section class="interview__q plate" aria-live="polite">
        <p class="label interview__stage">${esc(stageOf(doc, idx).name)}</p>
        <h2 class="interview__prompt">${esc(q.prompt)}</h2>
        ${q.help ? `<p class="interview__help editorial">${esc(q.help)}</p>` : ''}
        <div class="interview__input" data-qid="${q.id}">${renderInput(q, responses[q.id])}</div>
        <p class="interview__saved meta" data-saved hidden>Saved</p>
      </section>

      <nav class="interview__nav">
        <button class="button button--quiet" data-back ${idx === 0 ? 'disabled' : ''}>← Back</button>
        <span class="meta interview__count">A quiet room. Leave whenever — it keeps your place.</span>
        ${isLast
          ? `<a class="button ${canGen ? '' : 'is-disabled'}" data-continue href="#/draft/${doc.id}">To the draft →</a>`
          : `<button class="button" data-next>Continue →</button>`}
      </nav>

      <p class="interview__exit"><a class="meta" href="#/">Leave the interview</a></p>
    </div>
  `, `${doc.name} · interview`);

  wireInput(root, doc, q);

  root.querySelector('[data-back]')?.addEventListener('click', () => {
    positions.set(doc.id, Math.max(0, idx - 1));
    renderQuestion(root, doc);
  });
  root.querySelector('[data-next]')?.addEventListener('click', () => {
    positions.set(doc.id, Math.min(questions.length - 1, idx + 1));
    renderQuestion(root, doc);
  });
}

function renderInput(q: Question, a: Answer | undefined): string {
  if (q.type === 'open') {
    const text = a && a.type === 'open' ? a.text : '';
    return `<textarea class="office-textarea" data-open rows="5"
              placeholder="${esc(q.placeholder ?? 'Write freely…')}">${esc(text)}</textarea>`;
  }
  const selected = a && a.type === 'choice' ? a.value : '';
  const multiVals = a && a.type === 'multi' ? a.values : [];
  const otherOpen = a && (a.type === 'choice' || a.type === 'multi') && a.other !== undefined;
  const otherText = a && (a.type === 'choice' || a.type === 'multi') ? a.other ?? '' : '';

  const opts = (q.options ?? []).map((opt) => {
    const on = q.type === 'choice' ? selected === opt : multiVals.includes(opt);
    return `<button type="button" class="chip" data-opt="${esc(opt)}" aria-pressed="${on}">${esc(opt)}</button>`;
  }).join('');

  const other = q.allowOther
    ? `<button type="button" class="chip chip--other" data-other-toggle aria-pressed="${otherOpen}">Other…</button>
       <div class="office-other" data-other-field ${otherOpen ? '' : 'hidden'}>
         <textarea class="office-textarea" data-other rows="2" placeholder="In your own words…">${esc(otherText)}</textarea>
       </div>`
    : '';

  return `<div class="chips" role="group">${opts}${other}</div>`;
}

function flashSaved(root: HTMLElement): void {
  const el = root.querySelector<HTMLElement>('[data-saved]');
  if (!el) return;
  el.hidden = false;
  window.clearTimeout((el as any)._t);
  (el as any)._t = window.setTimeout(() => { el.hidden = true; }, 1200);
}

function wireInput(root: HTMLElement, doc: DocType, q: Question): void {
  const save = (answer: Answer) => { store.setAnswer(doc.id, q.id, answer); flashSaved(root); };

  if (q.type === 'open') {
    const ta = root.querySelector<HTMLTextAreaElement>('[data-open]');
    let t: number;
    ta?.addEventListener('input', () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => save({ type: 'open', text: ta.value }), 350);
    });
    return;
  }

  const current = (): Answer => {
    const a = store.getResponses(doc.id)[q.id];
    if (q.type === 'choice') return a && a.type === 'choice' ? { ...a } : { type: 'choice', value: '' };
    return a && a.type === 'multi' ? { values: [...a.values], other: a.other, type: 'multi' } : { type: 'multi', values: [] };
  };

  root.querySelectorAll<HTMLButtonElement>('[data-opt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const opt = btn.dataset.opt!;
      if (q.type === 'choice') {
        save({ type: 'choice', value: opt }); // choosing an option clears "Other"
      } else {
        const a = current();
        if (a.type !== 'multi') return;
        const set = new Set(a.values);
        set.has(opt) ? set.delete(opt) : set.add(opt);
        save({ type: 'multi', values: [...set], other: a.other });
      }
      renderQuestion(root, doc);
    });
  });

  root.querySelector('[data-other-toggle]')?.addEventListener('click', () => {
    const a = current();
    const open = (a as any).other !== undefined;
    if (q.type === 'choice') {
      save(open ? { type: 'choice', value: '' } : { type: 'choice', value: '', other: '' });
    } else if (a.type === 'multi') {
      save(open ? { type: 'multi', values: a.values } : { type: 'multi', values: a.values, other: '' });
    }
    renderQuestion(root, doc);
  });

  const otherTa = root.querySelector<HTMLTextAreaElement>('[data-other]');
  let ot: number;
  otherTa?.addEventListener('input', () => {
    window.clearTimeout(ot);
    ot = window.setTimeout(() => {
      const a = current();
      if (q.type === 'choice') save({ type: 'choice', value: '', other: otherTa.value });
      else if (a.type === 'multi') save({ type: 'multi', values: a.values, other: otherTa.value });
    }, 350);
  });
}

/* =============================================================================
   DRAFT WORKSPACE — "Generate First Draft" (structured packet, no AI)
   ============================================================================= */

export function mountDraft(root: HTMLElement, docId: string): void {
  const doc = getDocType(docId);
  if (!doc) return void go('#/');
  render();

  function render(): void {
    const responses = store.getResponses(doc!.id);
    const canGen = core.canGenerate(doc!, responses);
    const versions = core.liveVersions(store.getDrafts(doc!.id));
    const latest = versions[0];

    root.innerHTML = frame(`${doc!.name} — draft`, `
      <div class="draft">
        <section class="office-hero">
          <p class="label">Generate First Draft</p>
          <h1 class="office-hero__title">${esc(doc!.name)}</h1>
          <p class="office-hero__lede editorial">
            This assembles your answers into a structured editorial packet — the
            exact material an editor (or, in a later sprint, an AI engine) will draft
            from. It writes nothing itself. Each generation is saved as a new version;
            older versions are archived, never overwritten.
          </p>
          <div class="draft__actions">
            <button class="button ${canGen ? '' : 'is-disabled'}" data-generate ${canGen ? '' : 'disabled'}>
              Generate first draft
            </button>
            <a class="button button--quiet" href="#/write/${doc!.id}">Back to the interview</a>
            <a class="button button--quiet" href="#/memory">Version history</a>
          </div>
          ${canGen ? '' : `<p class="meta draft__hint">Answer a few more questions to enable generation.</p>`}
        </section>

        ${latest ? renderVersion(latest) : `<p class="empty-state">No draft yet. Generate one when you're ready.</p>`}
      </div>
    `, `${doc!.name} · draft`);

    root.querySelector('[data-generate]')?.addEventListener('click', () => {
      if (!canGen) return;
      const packet = activeDraftEngine.generate(doc!, store.getResponses(doc!.id));
      store.saveDraftVersion(doc!.id, packet);
      render();
    });
    wireVersion(root, doc!.id, latest?.version);
  }
}

function renderVersion(v: import('./types').DraftVersion): string {
  const p = v.packet;
  const stages = p.stages.map((s) => `
    <div class="packet__stage">
      <p class="label">${esc(s.name)}</p>
      ${s.items.map((it) => `
        <div class="packet__item ${it.answered ? '' : 'is-empty'}">
          <p class="packet__q">${esc(it.prompt)}</p>
          <p class="packet__a">${it.answered ? esc(it.answer) : '<span class="meta">(unanswered)</span>'}</p>
        </div>`).join('')}
    </div>`).join('');

  return `
    <article class="plate draft__version">
      <p class="metaline">
        <span class="label">Version ${v.version}</span>
        <span class="meta">${new Date(v.at).toLocaleString()}</span>
        <span class="meta">${p.answered}/${p.total} answered · ${esc(p.engine)}</span>
      </p>
      <div class="packet">${stages}</div>

      <label class="draft__notes-label label" for="draft-notes">Your working notes</label>
      <textarea id="draft-notes" class="office-textarea" data-notes rows="4"
        placeholder="Notes to your editor / future self…">${esc(v.notes)}</textarea>

      <div class="draft__actions">
        <button class="button" data-copy>Copy packet (Markdown)</button>
        <button class="button button--quiet" data-download-md>Download .md</button>
        <button class="button button--quiet" data-download-json>Download .json</button>
      </div>
    </article>`;
}

function wireVersion(root: HTMLElement, docId: string, version?: number): void {
  if (version === undefined) return;
  const list = store.getDrafts(docId);
  const v = list.find((d) => d.version === version);
  if (!v) return;

  const notes = root.querySelector<HTMLTextAreaElement>('[data-notes]');
  let t: number;
  notes?.addEventListener('input', () => {
    window.clearTimeout(t);
    t = window.setTimeout(() => store.updateDraftNotes(docId, version, notes.value), 350);
  });

  const md = core.packetToMarkdown(v.packet);
  root.querySelector('[data-copy]')?.addEventListener('click', async (e) => {
    try { await navigator.clipboard.writeText(md); (e.target as HTMLElement).textContent = 'Copied ✓'; }
    catch { (e.target as HTMLElement).textContent = 'Copy failed'; }
  });
  root.querySelector('[data-download-md]')?.addEventListener('click', () =>
    download(`${docId}-v${version}.md`, md, 'text/markdown'));
  root.querySelector('[data-download-json]')?.addEventListener('click', () =>
    download(`${docId}-v${version}.json`, JSON.stringify(v.packet, null, 2), 'application/json'));
}

function download(name: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

/* =============================================================================
   EDITORIAL MEMORY — responses, version history, archive, soft-delete
   ============================================================================= */

export function mountMemory(root: HTMLElement): void {
  render();

  function render(): void {
    const docs = DOC_TYPES.map((doc) => {
      const list = store.getDrafts(doc.id);
      const responses = store.getResponses(doc.id);
      const { answered, total } = core.overallProgress(doc, responses);
      if (answered === 0 && list.length === 0) return '';
      const rows = (label: string, items: import('./types').DraftVersion[], kind: string) =>
        items.length ? `
          <p class="label memory__group">${label}</p>
          ${items.map((v) => `
            <div class="memory__version">
              <span class="meta">v${v.version} · ${new Date(v.at).toLocaleDateString()} · ${v.packet.answered}/${v.packet.total}</span>
              <span class="memory__acts" data-doc="${doc.id}" data-v="${v.version}">${versionActions(kind)}</span>
            </div>`).join('')}` : '';
      return `
        <article class="plate memory__doc">
          <p class="metaline"><span class="label">${esc(doc.name)}</span>
            <span class="meta">${answered}/${total} answered · ${core.liveVersions(list).length} draft(s)</span></p>
          <div class="memory__acts-top">
            <a class="meta" href="#/write/${doc.id}">Open interview →</a>
            <a class="meta" href="#/draft/${doc.id}">Draft workspace →</a>
          </div>
          ${rows('Drafts', core.liveVersions(list), 'live')}
          ${rows('Archived', core.archivedVersions(list), 'archived')}
          ${rows('Deleted (recoverable)', core.deletedVersions(list), 'deleted')}
        </article>`;
    }).join('');

    const reflections = store.getReflections();
    const reflHtml = reflections.length ? `
      <article class="plate memory__doc">
        <p class="label">Reflections</p>
        ${reflections.map((r) => `
          <div class="memory__refl">
            <p class="packet__q">${esc(r.question)}</p>
            <p class="packet__a">${esc(r.answer)}</p>
            <span class="meta">${new Date(r.at).toLocaleDateString()}</span>
          </div>`).join('')}
      </article>` : '';

    root.innerHTML = frame('Editorial memory', `
      <section class="office-hero">
        <p class="label">Editorial memory</p>
        <h1 class="office-hero__title">Nothing is lost.</h1>
        <p class="office-hero__lede editorial">
          Every answer and every generated version is kept here, in this browser.
          Drafts are archived rather than overwritten; deleting only hides — a
          version is truly discarded only when you purge it.
        </p>
      </section>
      ${docs || `<p class="empty-state">The office is new. Begin a document to fill this room.</p>`}
      ${reflHtml}
    `, 'Editorial memory');

    root.querySelectorAll<HTMLElement>('.memory__acts button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const wrap = btn.closest<HTMLElement>('.memory__acts')!;
        const d = wrap.dataset.doc!, ver = Number(wrap.dataset.v);
        const act = btn.dataset.act!;
        if (act === 'archive') store.archiveDraft(d, ver, true);
        else if (act === 'unarchive') store.archiveDraft(d, ver, false);
        else if (act === 'delete') store.softDeleteDraft(d, ver, true);
        else if (act === 'restore') store.softDeleteDraft(d, ver, false);
        else if (act === 'purge') {
          if (!confirm('Permanently discard this deleted version? This cannot be undone.')) return;
          store.purgeDeletedDrafts(d);
        }
        render();
      });
    });
  }
}

function versionActions(kind: string): string {
  if (kind === 'live') return `
    <button class="link-btn" data-act="archive">Archive</button>
    <button class="link-btn" data-act="delete">Delete</button>`;
  if (kind === 'archived') return `
    <button class="link-btn" data-act="unarchive">Unarchive</button>
    <button class="link-btn" data-act="delete">Delete</button>`;
  return `
    <button class="link-btn" data-act="restore">Restore</button>
    <button class="link-btn link-btn--danger" data-act="purge">Purge permanently</button>`;
}

/* =============================================================================
   ASK ME SOMETHING DIFFERENT — curated follow-ups (no AI)
   ============================================================================= */

export function mountReflect(root: HTMLElement): void {
  let current: Followup | null = activeFollowupSource.next(store.getAskedIds());
  render();

  function render(): void {
    root.innerHTML = frame('Ask me something different', `
      <div class="reflect">
        <section class="office-hero">
          <p class="label">Ask me something different</p>
          <h1 class="office-hero__title">A question from the editor.</h1>
          <p class="office-hero__lede editorial">
            Not the scripted interview — one question at a time, chosen to help you
            think past where you stopped. Your answers are kept in Editorial memory.
          </p>
        </section>

        ${current ? `
          <section class="plate reflect__card">
            <h2 class="interview__prompt">${esc(current.prompt)}</h2>
            <textarea class="office-textarea" data-answer rows="5" placeholder="Think out loud…"></textarea>
            <div class="draft__actions">
              <button class="button" data-save>Save &amp; ask another</button>
              <button class="button button--quiet" data-skip>Ask another</button>
            </div>
            <p class="interview__saved meta" data-saved hidden>Saved to memory</p>
          </section>` : `<p class="empty-state">No more questions right now.</p>`}

        <p class="interview__exit"><a class="meta" href="#/">Back to the Office</a></p>
      </div>
    `, 'Ask me something different');

    const ta = root.querySelector<HTMLTextAreaElement>('[data-answer]');
    const advance = () => {
      if (current) store.markAsked(current.id);
      current = activeFollowupSource.next(store.getAskedIds());
      render();
    };
    root.querySelector('[data-save]')?.addEventListener('click', () => {
      if (current && ta && ta.value.trim()) store.saveReflection(current.id, current.prompt, ta.value.trim());
      advance();
    });
    root.querySelector('[data-skip]')?.addEventListener('click', advance);
  }
}
