/* =============================================================================
   EDITORIAL OFFICE — Submission Review.
   Route: /editorial-office/ (private, gated by Cloudflare Access).

   The canonical editorial operations surface. This section is Submission Review:
   ONE queue for every submission type (Artist Features is the first, type =
   'artist_feature'). It consumes the shared /api/submissions services — list,
   status change, internal notes, correspondence + audit thread — and adds a type
   filter so any one workflow can be isolated within the single queue. No parallel
   dashboard, queue, messaging, or approval system: everything is the shared
   generic backend.
   ============================================================================= */

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/publishing.css';
import './styles/editorial-office.css';
import './styles/responsive.css';

interface Submission {
  id: number;
  type: string;
  status: string;
  name: string;
  email: string;
  fields: Record<string, any>;
  created_at: string;
}

let statuses: string[] = [];
let statusLabels: Record<string, string> = {};
let knownTypes: string[] = [];
let activeStatus = ''; // '' = all statuses
let activeType = '';   // '' = all types

function esc(s: unknown): string {
  const d = document.createElement('div');
  d.textContent = String(s == null ? '' : s);
  return d.innerHTML;
}

function fmtDate(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return esc(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function typeLabel(id: string): string {
  return id
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2') // split camelCase (musicUrl → music Url)
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bUrl\b/g, 'URL');
}

function safeLink(url: string | null | undefined, label: string): string {
  if (!url) return '<span class="subs__muted">—</span>';
  let ok = false;
  try { const u = new URL(url); ok = u.protocol === 'http:' || u.protocol === 'https:'; } catch { ok = false; }
  if (!ok) return `<span class="subs__muted">${esc(url)}</span>`;
  return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(label)} ↗</a>`;
}

// Render the type-specific fields generically (works for any future type).
function fieldRows(f: Record<string, any>): string {
  const rows: string[] = [];
  for (const [key, value] of Object.entries(f || {})) {
    if (value == null || value === '') continue;
    const label = typeLabel(key);
    const looksUrl = typeof value === 'string' && /^https?:\/\//i.test(value);
    const rendered = looksUrl ? safeLink(value, 'Open') : esc(value);
    rows.push(`<div><dt>${esc(label)}</dt><dd>${rendered}</dd></div>`);
  }
  return rows.join('');
}

function statusOptions(current: string): string {
  return statuses
    .map((s) => `<option value="${s}"${s === current ? ' selected' : ''}>${esc(statusLabels[s] || s)}</option>`)
    .join('');
}

function card(sub: Submission): string {
  return `
    <article class="subs__card plate brass-edge" data-id="${sub.id}">
      <header class="subs__head">
        <div>
          <h2 class="subs__name">${esc(sub.name)}</h2>
          <p class="subs__meta meta">${esc(typeLabel(sub.type))} · ${fmtDate(sub.created_at)}</p>
        </div>
        <div class="subs__statuswrap">
          <span class="subs__badge">${esc(statusLabels[sub.status] || sub.status)}</span>
          <label>
            <span class="visually-hidden">Status for ${esc(sub.name)}</span>
            <select class="subs__status" data-id="${sub.id}">${statusOptions(sub.status)}</select>
          </label>
        </div>
      </header>

      <dl class="subs__fields">
        <div><dt>Email</dt><dd><a href="mailto:${esc(sub.email)}">${esc(sub.email)}</a></dd></div>
        ${fieldRows(sub.fields)}
      </dl>

      <div class="subs__note">
        <label class="subs__notelabel" for="note-${sub.id}">Add internal note <span class="subs__notehint">— private, editor only</span></label>
        <div class="subs__noterow">
          <input id="note-${sub.id}" class="subs__noteinput" data-id="${sub.id}" type="text"
            placeholder="e.g. Great fit for October · Invite to LIVE first" />
          <button class="button button--quiet subs__notebtn" data-id="${sub.id}" type="button">Save note</button>
        </div>
        <span class="subs__notesaved" data-id="${sub.id}" aria-live="polite"></span>
      </div>

      <div class="subs__thread" id="thread-${sub.id}" data-loaded="0">
        <button class="link-open subs__reveal" data-id="${sub.id}" type="button">Show correspondence &amp; history</button>
        <div class="subs__threadbody" hidden></div>
      </div>
    </article>`;
}

function renderTypeFilters(): void {
  const el = document.getElementById('subs-typefilters');
  if (!el) return;
  const chip = (value: string, label: string) =>
    `<button class="subs__filter${value === activeType ? ' is-active' : ''}" data-typefilter="${value}" type="button" aria-pressed="${value === activeType}">${label}</button>`;
  el.innerHTML = [chip('', 'All types'), ...knownTypes.map((t) => chip(t, typeLabel(t)))].join('');
}

function renderStatusFilters(): void {
  const el = document.getElementById('subs-filters');
  if (!el) return;
  const chip = (value: string, label: string) =>
    `<button class="subs__filter${value === activeStatus ? ' is-active' : ''}" data-filter="${value}" type="button" aria-pressed="${value === activeStatus}">${label}</button>`;
  el.innerHTML = [chip('', 'All statuses'), ...statuses.map((s) => chip(s, statusLabels[s] || s))].join('');
}

async function load(): Promise<void> {
  const list = document.getElementById('subs-list');
  if (!list) return;
  list.innerHTML = `<p class="empty-state">Loading…</p>`;

  const params = new URLSearchParams();
  if (activeType) params.set('type', activeType);
  if (activeStatus) params.set('status', activeStatus);
  const qs = params.toString();

  let data: any = null;
  try {
    const res = await fetch('/api/submissions' + (qs ? `?${qs}` : ''), {
      headers: { Accept: 'application/json' },
    });
    data = await res.json();
    if (!res.ok || !data.ok) {
      list.innerHTML = `<p class="error-state">${esc((data && data.error) || 'Unable to load submissions.')}</p>`;
      return;
    }
  } catch {
    list.innerHTML = `<p class="error-state">Couldn’t reach the desk. Check your connection and reload.</p>`;
    return;
  }

  statuses = data.statuses || statuses;
  statusLabels = data.statusLabels || statusLabels;

  const subs: Submission[] = data.submissions || [];
  // Remember every type we've seen so the type filter persists across filtering.
  for (const s of subs) if (s.type && !knownTypes.includes(s.type)) knownTypes.push(s.type);

  renderTypeFilters();
  renderStatusFilters();

  list.innerHTML = subs.length ? subs.map(card).join('') : `<p class="empty-state">No submissions here yet.</p>`;
}

async function post(payload: object): Promise<any> {
  const res = await fetch('/api/submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error((data && data.error) || 'Request failed');
  return data;
}

async function changeStatus(id: number, status: string, sel: HTMLSelectElement): Promise<void> {
  sel.disabled = true;
  try { await post({ id, status }); await load(); }
  catch { sel.disabled = false; await load(); }
}

async function saveNote(id: number, note: string, input: HTMLInputElement): Promise<void> {
  const saved = document.querySelector<HTMLElement>(`.subs__notesaved[data-id="${id}"]`);
  if (!note.trim()) { if (saved) saved.textContent = 'Write a note first'; return; }
  input.disabled = true;
  if (saved) saved.textContent = 'Saving…';
  try {
    await post({ id, note });
    input.value = '';
    if (saved) { saved.textContent = 'Saved'; setTimeout(() => { if (saved.textContent === 'Saved') saved.textContent = ''; }, 2000); }
    const thread = document.getElementById(`thread-${id}`);
    if (thread && thread.dataset.loaded === '1') await loadThread(id, thread);
  } catch {
    if (saved) saved.textContent = 'Not saved — try again';
  } finally {
    input.disabled = false;
  }
}

async function loadThread(id: number, thread: HTMLElement): Promise<void> {
  const bodyEl = thread.querySelector<HTMLElement>('.subs__threadbody');
  if (!bodyEl) return;
  bodyEl.innerHTML = `<p class="meta">Loading…</p>`;
  let data: any;
  try {
    const res = await fetch(`/api/submissions?id=${id}`, { headers: { Accept: 'application/json' } });
    data = await res.json();
    if (!res.ok || !data.ok) throw new Error();
  } catch {
    bodyEl.innerHTML = `<p class="error-state">Couldn’t load the thread.</p>`;
    return;
  }
  const s = data.submission;
  const messages = (s.messages || []).map((m: any) => {
    const meta = [m.kind.replace(/_/g, ' '), m.channel || 'internal', m.delivery_status ? `delivery: ${m.delivery_status}` : '']
      .filter(Boolean).join(' · ');
    return `<li class="subs__msg"><p class="meta">${esc(meta)} · ${fmtDate(m.created_at)}</p><p>${esc(m.body)}</p>${m.delivery_error ? `<p class="meta subs__err">${esc(m.delivery_error)}</p>` : ''}</li>`;
  }).join('');
  const events = (s.events || []).map((e: any) => {
    const change = e.from_status || e.to_status ? ` (${esc(e.from_status || '—')} → ${esc(e.to_status || '—')})` : '';
    return `<li class="meta">${fmtDate(e.created_at)} · ${esc(e.actor)} · ${esc(e.action)}${change}${e.detail ? ` · ${esc(e.detail)}` : ''}</li>`;
  }).join('');
  bodyEl.innerHTML = `
    <h3 class="subs__subhead">Correspondence</h3>
    <ul class="subs__msgs">${messages || '<li class="meta">No messages.</li>'}</ul>
    <h3 class="subs__subhead">History</h3>
    <ul class="subs__events">${events || '<li class="meta">No events.</li>'}</ul>`;
  thread.dataset.loaded = '1';
}

function boot(): void {
  load();

  document.getElementById('subs-typefilters')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.subs__filter');
    if (!btn) return;
    activeType = btn.dataset.typefilter || '';
    renderTypeFilters();
    load();
  });

  document.getElementById('subs-filters')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.subs__filter');
    if (!btn) return;
    activeStatus = btn.dataset.filter || '';
    renderStatusFilters();
    load();
  });

  const listEl = document.getElementById('subs-list');
  listEl?.addEventListener('change', (e) => {
    const sel = (e.target as HTMLElement).closest<HTMLSelectElement>('.subs__status');
    if (sel) { const id = Number(sel.dataset.id); if (id) changeStatus(id, sel.value, sel); }
  });
  listEl?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const noteBtn = target.closest<HTMLButtonElement>('.subs__notebtn');
    if (noteBtn) {
      const id = Number(noteBtn.dataset.id);
      const input = document.getElementById(`note-${id}`) as HTMLInputElement | null;
      if (id && input) saveNote(id, input.value, input);
      return;
    }
    const reveal = target.closest<HTMLButtonElement>('.subs__reveal');
    if (reveal) {
      const id = Number(reveal.dataset.id);
      const thread = document.getElementById(`thread-${id}`);
      const bodyEl = thread?.querySelector<HTMLElement>('.subs__threadbody');
      if (thread && bodyEl) {
        const showing = !bodyEl.hidden;
        bodyEl.hidden = showing;
        reveal.textContent = showing ? 'Show correspondence & history' : 'Hide correspondence & history';
        if (!showing && thread.dataset.loaded !== '1') loadThread(id, thread);
      }
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
