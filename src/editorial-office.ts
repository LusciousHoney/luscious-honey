/* =============================================================================
   EDITORIAL OFFICE — the canonical editorial workspace.
   Route: /editorial-office/ (private, gated by Cloudflare Access).

   ONE application, ONE shared backend. This is the graduation of the review
   harness into the editorial floor. It presents THREE in-app views over the
   single generic /api/submissions services — no new endpoints, no new routes,
   no parallel systems:

     • Dashboard — an editorial briefing summarising the current workload.
     • Review    — the refined submission queue (all types; type + status filters).
     • Detail    — a full editorial reading experience for one submission.

   Views are switched by URL query params on the SAME route, so refresh and
   browser history work naturally:
     (none)                → Dashboard
     ?view=review          → Review        (optional &type= &status= filters)
     ?submission=<id>      → Detail

   The Office owns PRESENTATION only. Statuses, workflow, notes, correspondence,
   and audit are the shared backend's, rendered — never redefined.
   ============================================================================= */

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/editorial-office.css';

interface Submission {
  id: number;
  type: string;
  status: string;
  name: string;
  email: string;
  fields: Record<string, any>;
  created_at: string;
  /** One-line editorial summary from the type's own renderer (server-provided). */
  summary?: string;
}

interface Message {
  kind: string;
  channel?: string | null;
  delivery_status?: string | null;
  delivery_error?: string | null;
  body: string;
  created_at: string;
}

interface Event {
  from_status?: string | null;
  to_status?: string | null;
  actor: string;
  action: string;
  detail?: string | null;
  created_at: string;
}

interface DetailSubmission extends Submission {
  messages?: Message[];
  events?: Event[];
}

/* --- shared workflow vocabulary (from the backend; never redefined) ------- */
let statuses: string[] = [];
let statusLabels: Record<string, string> = {};
let knownTypes: string[] = [];
/** Institutional type titles from the registry (id → "Book or Literary Work"). */
let typeTitles: Record<string, string> = {};

/* Presentation grouping of the workflow — for status TONE only. The set of
   statuses and their transitions remain the backend's; this only chooses a
   colour family for each so the queue reads at a glance. */
const STATUS_TONE: Record<string, 'neutral' | 'active' | 'attention' | 'go'> = {
  draft: 'neutral',
  sent_for_review: 'active',
  under_review: 'active',
  changes_requested: 'attention',
  not_accepted: 'attention',
  approved: 'go',
  scheduled: 'go',
  published: 'go',
};

/* Review filters live in the URL so a refreshed Review view is preserved. */

/* --- small helpers ------------------------------------------------------- */

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

function fmtDateTime(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return esc(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Days since a timestamp, for the "recently submitted" briefing. */
function daysAgo(iso: string): number | null {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

function relDay(iso: string): string {
  const n = daysAgo(iso);
  if (n == null) return fmtDate(iso);
  if (n <= 0) return 'Today';
  if (n === 1) return 'Yesterday';
  if (n < 7) return `${n} days ago`;
  return fmtDate(iso);
}

function typeLabel(id: string): string {
  // Prefer the institutional title from the registry so a reviewer never infers
  // the creative type from a de-slugged id.
  if (typeTitles[id]) return typeTitles[id];
  return id
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bUrl\b/g, 'URL');
}

/** Two-letter editorial monogram from a name — the identity treatment when
    there is no artist imagery (there is no image field in the schema). */
function initials(name: string): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}

/** A one-line editorial summary. Prefer the server's type-aware summary (each
    submission type renders its own); fall back to a local read for older rows. */
function summaryOf(s: Submission): string {
  if (s.summary && s.summary.trim()) return s.summary.trim();
  const f = s.fields || {};
  const lead = String(f.promoting || f.description || '').replace(/\s+/g, ' ').trim();
  const short = lead.length > 96 ? lead.slice(0, 95) + '…' : lead;
  return [f.interest || f.submittedBy, short].filter(Boolean).join(' · ');
}

function isHttpUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  try { const u = new URL(url); return u.protocol === 'http:' || u.protocol === 'https:'; }
  catch { return false; }
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function safeLink(url: string | null | undefined, label: string): string {
  if (!url) return '<span class="eo-muted">—</span>';
  if (!isHttpUrl(url)) return `<span class="eo-muted">${esc(url)}</span>`;
  return `<a class="eo-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(label)} ↗</a>`;
}

function statusChip(status: string): string {
  const tone = STATUS_TONE[status] ?? 'neutral';
  return `<span class="ochip" data-tone="${tone}">${esc(statusLabels[status] || typeLabel(status))}</span>`;
}

/* --- API ----------------------------------------------------------------- */

async function apiList(params: URLSearchParams): Promise<{ ok: boolean; data: any; error?: string }> {
  const qs = params.toString();
  try {
    const res = await fetch('/api/submissions' + (qs ? `?${qs}` : ''), { headers: { Accept: 'application/json' } });
    const data = await res.json();
    if (!res.ok || !data.ok) return { ok: false, data, error: (data && data.error) || 'Unable to load submissions.' };
    return { ok: true, data };
  } catch {
    return { ok: false, data: null, error: 'Couldn’t reach the desk. Check your connection and reload.' };
  }
}

async function apiOne(id: string | number): Promise<{ ok: boolean; submission?: DetailSubmission; error?: string }> {
  try {
    const res = await fetch(`/api/submissions?id=${encodeURIComponent(String(id))}`, { headers: { Accept: 'application/json' } });
    const data = await res.json();
    if (!res.ok || !data.ok) return { ok: false, error: (data && data.error) || 'Couldn’t load this submission.' };
    return { ok: true, submission: data.submission };
  } catch {
    return { ok: false, error: 'Couldn’t reach the desk. Check your connection and reload.' };
  }
}

async function apiPost(payload: object): Promise<any> {
  const res = await fetch('/api/submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error((data && data.error) || 'Request failed');
  return data;
}

/** Absorb workflow vocabulary + remembered types from any list response. */
function absorbMeta(data: any, subs: Submission[]): void {
  statuses = data.statuses || statuses;
  statusLabels = data.statusLabels || statusLabels;
  // Institutional type titles from the registry, so the type reads clearly.
  if (Array.isArray(data.types)) {
    for (const t of data.types) if (t && t.id && t.title) typeTitles[t.id] = t.title;
  }
  for (const s of subs) if (s.type && !knownTypes.includes(s.type)) knownTypes.push(s.type);
}

/* --- navigation (query params on the same route) ------------------------- */

interface Nav { view?: 'dashboard' | 'review'; submission?: string | number; type?: string; status?: string }

function currentParams(): URLSearchParams {
  return new URLSearchParams(location.search);
}

function href(nav: Nav): string {
  const sp = new URLSearchParams();
  if (nav.submission != null && nav.submission !== '') sp.set('submission', String(nav.submission));
  else {
    if (nav.view && nav.view !== 'dashboard') sp.set('view', nav.view);
    if (nav.type) sp.set('type', nav.type);
    if (nav.status) sp.set('status', nav.status);
  }
  const qs = sp.toString();
  return location.pathname + (qs ? `?${qs}` : '');
}

function go(nav: Nav): void {
  history.pushState(null, '', href(nav));
  render();
}

/* --- view: DASHBOARD ----------------------------------------------------- */

function navBar(active: 'dashboard' | 'review'): string {
  return `
    <nav class="eo-nav" aria-label="Editorial Office views">
      <a class="eo-nav__link${active === 'dashboard' ? ' is-active' : ''}" href="${href({ view: 'dashboard' })}"
         data-nav="dashboard"${active === 'dashboard' ? ' aria-current="page"' : ''}>Dashboard</a>
      <a class="eo-nav__link${active === 'review' ? ' is-active' : ''}" href="${href({ view: 'review' })}"
         data-nav="review"${active === 'review' ? ' aria-current="page"' : ''}>Submission Review</a>
    </nav>`;
}

function briefingItem(s: Submission): string {
  const summary = summaryOf(s);
  return `
    <li>
      <a class="eo-item" href="${href({ submission: s.id })}" data-open="${s.id}">
        <span class="eo-item__monogram" aria-hidden="true">${esc(initials(s.name))}</span>
        <span class="eo-item__body">
          <span class="eo-item__name">${esc(s.name)}</span>
          ${summary ? `<span class="eo-item__summary">${esc(summary)}</span>` : ''}
          <span class="eo-item__meta">${esc(typeLabel(s.type))} · ${esc(relDay(s.created_at))}</span>
        </span>
        ${statusChip(s.status)}
      </a>
    </li>`;
}

function briefingSection(
  title: string,
  note: string,
  subs: Submission[],
  viewAll: Nav | null,
): string {
  const body = subs.length
    ? `<ul class="eo-section__list">${subs.map(briefingItem).join('')}</ul>`
    : `<p class="eo-section__empty">Nothing here right now.</p>`;
  const all = viewAll && subs.length
    ? `<a class="eo-section__all" href="${href(viewAll)}" data-nav="review"${viewAll.type ? ` data-type="${esc(viewAll.type)}"` : ''}${viewAll.status ? ` data-status="${esc(viewAll.status)}"` : ''}>Open in Review →</a>`
    : '';
  return `
    <section class="eo-section">
      <header class="eo-section__head">
        <h2 class="eo-section__title">${esc(title)} <span class="eo-section__count">${subs.length}</span></h2>
        <p class="eo-section__note">${esc(note)}</p>
      </header>
      ${body}
      ${all}
    </section>`;
}

function byNewest(a: Submission, b: Submission): number {
  return (b.created_at || '').localeCompare(a.created_at || '');
}

async function renderDashboard(root: HTMLElement): Promise<void> {
  root.innerHTML = `${navBar('dashboard')}<div class="eo-state eo-state--loading" role="status"><p class="eo-state__lede">Preparing the briefing…</p></div>`;

  const { ok, data, error } = await apiList(new URLSearchParams());
  if (!ok) { root.innerHTML = `${navBar('dashboard')}<div class="eo-state eo-state--error" role="alert"><p class="eo-state__title">The desk is unreachable</p><p class="eo-state__lede">${esc(error)}</p></div>`; return; }

  const subs: Submission[] = data.submissions || [];
  absorbMeta(data, subs);

  // Each submission has ONE primary operational bucket. Requires Attention is
  // the editor's queue (new + in-review only) — changes_requested belongs to
  // Awaiting Creator and must not inflate the editor's workload here. Recently
  // Submitted is time-based and may overlap; it is informational, not a queue.
  const attention = subs.filter((s) => s.status === 'sent_for_review' || s.status === 'under_review').sort(byNewest);
  const recent = [...subs].sort(byNewest).slice(0, 5);
  const awaiting = subs.filter((s) => s.status === 'changes_requested').sort(byNewest);
  const scheduled = subs.filter((s) => s.status === 'scheduled').sort(byNewest);

  const total = subs.length;
  const openCount = subs.filter((s) => s.status !== 'published' && s.status !== 'not_accepted').length;

  root.innerHTML = `
    ${navBar('dashboard')}
    <div class="eo-dash">
      <header class="eo-dash__head">
        <p class="eo-eyebrow label">The editorial floor</p>
        <h1 class="eo-title">Daily Briefing</h1>
        <p class="eo-dash__lede">${openCount} submission${openCount === 1 ? '' : 's'} in motion of ${total} on record. Here is what the desk is holding today.</p>
      </header>
      <div class="eo-briefing">
        ${briefingSection('Requires Attention', 'New and in-review — awaiting an editorial decision.', attention.slice(0, 5), { view: 'review' })}
        ${briefingSection('Awaiting Creator', 'Changes requested — the desk is waiting on a reply.', awaiting.slice(0, 5), { view: 'review', status: 'changes_requested' })}
        ${briefingSection('Scheduled Publications', 'Approved and set to publish.', scheduled.slice(0, 5), { view: 'review', status: 'scheduled' })}
        ${briefingSection('Recently Submitted', 'The newest arrivals — informational, may overlap.', recent, { view: 'review' })}
      </div>
    </div>`;
}

/* --- view: REVIEW -------------------------------------------------------- */

function filterChips(group: 'type' | 'status', active: string, activeType: string, activeStatus: string): string {
  const chip = (value: string, label: string): string => {
    const isActive = value === active;
    const nav: Nav = { view: 'review', type: activeType, status: activeStatus };
    if (group === 'type') nav.type = value; else nav.status = value;
    return `<a class="eo-filter${isActive ? ' is-active' : ''}" href="${href(nav)}" data-filter-group="${group}" data-filter-value="${esc(value)}"${isActive ? ' aria-current="true"' : ''}>${esc(label)}</a>`;
  };
  if (group === 'type') {
    return [chip('', 'All types'), ...knownTypes.map((t) => chip(t, typeLabel(t)))].join('');
  }
  return [chip('', 'All statuses'), ...statuses.map((s) => chip(s, statusLabels[s] || typeLabel(s)))].join('');
}

/** The elegant status control — a disclosure menu replacing the raw dropdown.
    Any status → any status, exactly as the free select did; behaviour preserved. */
function statusControl(sub: Submission): string {
  const options = statuses
    .map((s) => `<button class="ostatus__opt" type="button" data-status-set="${esc(s)}" data-id="${sub.id}"${s === sub.status ? ' aria-current="true"' : ''}><span class="ochip" data-tone="${STATUS_TONE[s] ?? 'neutral'}">${esc(statusLabels[s] || typeLabel(s))}</span></button>`)
    .join('');
  return `
    <details class="ostatus" data-id="${sub.id}">
      <summary class="ostatus__current" aria-label="Change status for ${esc(sub.name)} (currently ${esc(statusLabels[sub.status] || sub.status)})">
        ${statusChip(sub.status)}
        <span class="ostatus__caret" aria-hidden="true">▾</span>
      </summary>
      <div class="ostatus__menu" role="menu">
        <p class="ostatus__menulabel">Move to…</p>
        ${options}
      </div>
    </details>`;
}

function reviewCard(sub: Submission): string {
  const summary = summaryOf(sub);
  return `
    <article class="eo-card" data-id="${sub.id}">
      <div class="eo-card__lead">
        <span class="eo-card__monogram" aria-hidden="true">${esc(initials(sub.name))}</span>
      </div>
      <div class="eo-card__main">
        <header class="eo-card__head">
          <div>
            <h2 class="eo-card__name"><a class="eo-card__open" href="${href({ submission: sub.id })}" data-open="${sub.id}">${esc(sub.name)}</a></h2>
            <p class="eo-card__meta">${esc(typeLabel(sub.type))} · ${esc(fmtDate(sub.created_at))}</p>
          </div>
          ${statusControl(sub)}
        </header>
        ${summary ? `<p class="eo-card__summary">${esc(summary)}</p>` : ''}
        <div class="eo-card__foot">
          <a class="eo-card__review" href="${href({ submission: sub.id })}" data-open="${sub.id}">Open full review →</a>
        </div>
      </div>
    </article>`;
}

async function renderReview(root: HTMLElement, activeType: string, activeStatus: string): Promise<void> {
  root.innerHTML = `${navBar('review')}<div class="eo-review"><div class="eo-state eo-state--loading" role="status"><p class="eo-state__lede">Loading the queue…</p></div></div>`;

  const params = new URLSearchParams();
  if (activeType) params.set('type', activeType);
  if (activeStatus) params.set('status', activeStatus);

  const { ok, data, error } = await apiList(params);
  if (!ok) { root.innerHTML = `${navBar('review')}<div class="eo-review"><div class="eo-state eo-state--error" role="alert"><p class="eo-state__title">The desk is unreachable</p><p class="eo-state__lede">${esc(error)}</p></div></div>`; return; }

  const subs: Submission[] = data.submissions || [];
  absorbMeta(data, subs);

  const list = subs.length
    ? `<div class="eo-list">${subs.map(reviewCard).join('')}</div>`
    : `<div class="eo-state eo-state--empty"><p class="eo-state__title">A clear desk</p><p class="eo-state__lede">No submissions match this view.</p></div>`;

  root.innerHTML = `
    ${navBar('review')}
    <div class="eo-review">
      <header class="eo-review__head">
        <p class="eo-eyebrow label">The editorial floor</p>
        <h1 class="eo-title">Submission Review</h1>
        <p class="eo-review__lede">One queue for every submission type. ${subs.length} shown.</p>
      </header>
      <div class="eo-filters" role="group" aria-label="Filter by submission type">
        <span class="eo-filters__label label">Type</span>
        ${filterChips('type', activeType, activeType, activeStatus)}
      </div>
      <div class="eo-filters" role="group" aria-label="Filter by status">
        <span class="eo-filters__label label">Status</span>
        ${filterChips('status', activeStatus, activeType, activeStatus)}
      </div>
      ${list}
    </div>`;
}

/* --- view: DETAIL -------------------------------------------------------- */

/**
 * Editorial Status — the submission's place in the editorial workflow, derived
 * ONLY from its status (no invented readiness criteria). The positive path is
 * Draft → Sent for Review → Under Review → Approved → Scheduled → Published.
 * `changes_requested` is a BRANCH that returns to review; `not_accepted` is a
 * TERMINAL outcome that makes no positive-path claim.
 */
function editorialStatus(status: string): string {
  const line: Record<string, string> = {
    draft: 'A draft — not yet submitted for review.',
    sent_for_review: 'Newly submitted. Awaiting a first read.',
    under_review: 'Under editorial review.',
    changes_requested: 'Changes requested — returned to the creator; will re-enter review.',
    approved: 'Approved. Ready to be scheduled.',
    scheduled: 'Scheduled for publication.',
    published: 'Published.',
    not_accepted: 'Not accepted — a closed outcome.',
  };
  const main = ['draft', 'sent_for_review', 'under_review', 'approved', 'scheduled', 'published'];
  const reachedBy: Record<string, number> = {
    draft: 0, sent_for_review: 1, under_review: 2, approved: 3, scheduled: 4, published: 5,
  };
  const isBranch = status === 'changes_requested';
  const isTerminal = status === 'not_accepted';
  // How far along the positive path we can HONESTLY show as reached. A branch has
  // been through review (reached Under Review); a terminal makes no path claim.
  const reached = status in reachedBy ? reachedBy[status] : (isBranch ? 2 : -1);

  const nodes: string[] = main.map((s, i) => {
    const done = reached >= 0 && i <= reached ? ' is-done' : '';
    const current = s === status ? ' is-current' : '';
    return `<li class="eo-flow__step${done}${current}"><span class="eo-flow__dot" aria-hidden="true"></span>${esc(statusLabels[s] || typeLabel(s))}</li>`;
  });
  // The changes-requested branch loops back to review — shown after Under Review.
  if (isBranch) {
    nodes.splice(3, 0, `<li class="eo-flow__step eo-flow__step--branch is-current"><span class="eo-flow__dot" aria-hidden="true"></span>${esc(statusLabels['changes_requested'] || 'Changes Requested')}<span class="eo-flow__aside">↺ returns to review</span></li>`);
  }
  // The not-accepted terminal outcome closes the path.
  const terminal = isTerminal
    ? `<li class="eo-flow__step eo-flow__step--terminal is-current"><span class="eo-flow__dot" aria-hidden="true"></span>${esc(statusLabels['not_accepted'] || 'Not Accepted')}</li>`
    : '';

  return `
    <section class="eo-flow" aria-label="Editorial status">
      <h2 class="eo-subhead">Editorial Status</h2>
      <p class="eo-flow__line">${esc(line[status] || (statusLabels[status] || typeLabel(status)))}</p>
      <ol class="eo-flow__path">${nodes.join('')}${terminal}</ol>
    </section>`;
}

function responsesList(sub: DetailSubmission): string {
  const rows: string[] = [];
  rows.push(`<div class="eo-field"><dt>Email</dt><dd><a class="eo-link" href="mailto:${esc(sub.email)}">${esc(sub.email)}</a></dd></div>`);
  for (const [key, value] of Object.entries(sub.fields || {})) {
    if (value == null || value === '') continue;
    const label = typeLabel(key);
    let rendered: string;
    if (Array.isArray(value)) {
      // Multi-select fields (e.g. proposed Collective involvement).
      if (!value.length) continue;
      rendered = value.map((v) => `<span class="eo-tag">${esc(v)}</span>`).join(' ');
    } else if (key === 'musicUrl' || (typeof value === 'string' && /music|listen|track|song/i.test(key) && isHttpUrl(value))) {
      rendered = isHttpUrl(value)
        ? `<span class="eo-listen"><span class="eo-listen__label">Listening reference</span> ${safeLink(value, `Listen · ${hostOf(value)}`)}</span>`
        : esc(value);
    } else if (isHttpUrl(value)) {
      rendered = safeLink(value, `Open · ${hostOf(value)}`);
    } else if (typeof value === 'string' && value.includes('\n')) {
      // Multi-line entries (e.g. links, one per line) keep their line breaks.
      rendered = esc(value).replace(/\n/g, '<br>');
    } else {
      rendered = esc(value);
    }
    rows.push(`<div class="eo-field"><dt>${esc(label)}</dt><dd>${rendered}</dd></div>`);
  }
  return `<dl class="eo-responses">${rows.join('')}</dl>`;
}

function threadBlocks(sub: DetailSubmission): string {
  const messages = (sub.messages || []).map((m) => {
    const meta = [m.kind.replace(/_/g, ' '), m.channel || 'internal', m.delivery_status ? `delivery: ${m.delivery_status}` : '']
      .filter(Boolean).join(' · ');
    return `<li class="eo-msg"><p class="eo-msg__meta">${esc(meta)} · ${esc(fmtDateTime(m.created_at))}</p><p class="eo-msg__body">${esc(m.body)}</p>${m.delivery_error ? `<p class="eo-msg__err">${esc(m.delivery_error)}</p>` : ''}</li>`;
  }).join('');
  const events = (sub.events || []).map((e) => {
    const change = e.from_status || e.to_status ? ` (${esc(statusLabels[e.from_status || ''] || e.from_status || '—')} → ${esc(statusLabels[e.to_status || ''] || e.to_status || '—')})` : '';
    return `<li class="eo-event"><span class="eo-event__when">${esc(fmtDateTime(e.created_at))}</span><span class="eo-event__what">${esc(e.actor)} · ${esc(e.action)}${change}${e.detail ? ` · ${esc(e.detail)}` : ''}</span></li>`;
  }).join('');
  return `
    <div class="eo-thread">
      <section class="eo-thread__col">
        <h3 class="eo-subhead">Correspondence</h3>
        <ul class="eo-msgs">${messages || '<li class="eo-muted">No correspondence yet.</li>'}</ul>
      </section>
      <section class="eo-thread__col">
        <h3 class="eo-subhead">Audit history</h3>
        <ul class="eo-events">${events || '<li class="eo-muted">No events yet.</li>'}</ul>
      </section>
    </div>`;
}

async function renderDetail(root: HTMLElement, id: string): Promise<void> {
  root.innerHTML = `
    <div class="eo-detail">
      <a class="eo-back" href="${href({ view: 'review' })}" data-nav="review">← Back to Review</a>
      <div class="eo-state eo-state--loading" role="status"><p class="eo-state__lede">Opening the submission…</p></div>
    </div>`;

  const { ok, submission, error } = await apiOne(id);
  if (!ok || !submission) {
    root.innerHTML = `
      <div class="eo-detail">
        <a class="eo-back" href="${href({ view: 'review' })}" data-nav="review">← Back to Review</a>
        <div class="eo-state eo-state--error" role="alert"><p class="eo-state__title">Couldn’t open this submission</p><p class="eo-state__lede">${esc(error || 'It may have moved.')}</p></div>
      </div>`;
    return;
  }

  const sub = submission;
  root.innerHTML = `
    <div class="eo-detail">
      <a class="eo-back" href="${href({ view: 'review' })}" data-nav="review">← Back to Review</a>

      <header class="eo-detail__header">
        <span class="eo-crest" aria-hidden="true">${esc(initials(sub.name))}</span>
        <div class="eo-detail__ident">
          <p class="eo-eyebrow label">${esc(typeLabel(sub.type))}</p>
          <h1 class="eo-title eo-detail__name">${esc(sub.name)}</h1>
          <p class="eo-detail__meta">Submitted ${esc(fmtDate(sub.created_at))} · <a class="eo-link" href="mailto:${esc(sub.email)}">${esc(sub.email)}</a></p>
        </div>
        <div class="eo-detail__status">${statusControl(sub)}</div>
      </header>

      ${editorialStatus(sub.status)}

      <div class="eo-detail__grid">
        <div class="eo-detail__col">
          <section class="eo-panel">
            <h2 class="eo-subhead">Creator responses</h2>
            ${responsesList(sub)}
          </section>
          ${threadBlocks(sub)}
        </div>

        <aside class="eo-detail__aside">
          <section class="eo-panel eo-notes">
            <h2 class="eo-subhead">Internal note <span class="eo-notes__hint">— private, editor only</span></h2>
            <div class="eo-notes__row">
              <input id="eo-note" class="eo-notes__input" type="text" data-id="${sub.id}"
                placeholder="e.g. Great fit for October · invite to LIVE first" />
              <button class="eo-notes__save" type="button" data-note-save="${sub.id}">Save note</button>
            </div>
            <span class="eo-notes__saved" data-note-status aria-live="polite"></span>
            <p class="eo-notes__aside">Notes are recorded in the audit history below.</p>
          </section>
        </aside>
      </div>
    </div>`;
}

/* --- mutations ----------------------------------------------------------- */

async function changeStatus(id: number, status: string): Promise<void> {
  try {
    await apiPost({ id, status });
  } catch {
    /* leave the view; a re-render will show the true current state */
  }
  render(); // refetch + repaint the active view with the new truth
}

async function saveNote(id: number, note: string, input: HTMLInputElement, statusEl: HTMLElement | null): Promise<void> {
  if (!note.trim()) { if (statusEl) statusEl.textContent = 'Write a note first'; return; }
  input.disabled = true;
  if (statusEl) statusEl.textContent = 'Saving…';
  try {
    await apiPost({ id, note });
    input.value = '';
    if (statusEl) statusEl.textContent = 'Saved to the audit history';
    // Re-render the detail so the new note appears in the audit history.
    render();
  } catch {
    if (statusEl) statusEl.textContent = 'Not saved — try again';
    input.disabled = false;
  }
}

/* --- router + boot ------------------------------------------------------- */

function render(): void {
  const root = document.getElementById('office-app');
  if (!root) return;
  const p = currentParams();
  const submission = p.get('submission');
  document.documentElement.setAttribute('data-office-view', submission ? 'detail' : (p.get('view') || 'dashboard'));

  if (submission) { void renderDetail(root, submission); return; }
  const view = p.get('view') === 'review' ? 'review' : 'dashboard';
  if (view === 'review') void renderReview(root, p.get('type') || '', p.get('status') || '');
  else void renderDashboard(root);

  window.scrollTo({ top: 0 });
}

function boot(): void {
  const root = document.getElementById('office-app');
  if (!root) return;

  // Intercept in-app links so navigation stays a single-page query-param switch.
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-nav], a[data-open], a[data-filter-group]');
    if (!a || a.target === '_blank') return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // let new-tab work
    e.preventDefault();
    if (a.dataset.open) { go({ submission: a.dataset.open }); return; }
    if (a.dataset.filterGroup) {
      const p = currentParams();
      const nav: Nav = { view: 'review', type: p.get('type') || '', status: p.get('status') || '' };
      if (a.dataset.filterGroup === 'type') nav.type = a.dataset.filterValue || '';
      else nav.status = a.dataset.filterValue || '';
      go(nav);
      return;
    }
    const view = a.dataset.nav === 'review' ? 'review' : 'dashboard';
    const nav: Nav = { view };
    if (view === 'review') { nav.type = a.dataset.type || ''; nav.status = a.dataset.status || ''; }
    go(nav);
  });

  // Status control (elegant menu) — preserves the free any→any transition.
  root.addEventListener('click', (e) => {
    const opt = (e.target as HTMLElement).closest<HTMLButtonElement>('.ostatus__opt');
    if (opt) {
      const id = Number(opt.dataset.id);
      const status = opt.dataset.statusSet || '';
      const menu = opt.closest<HTMLDetailsElement>('details.ostatus');
      if (menu) menu.open = false;
      if (id && status) void changeStatus(id, status);
      return;
    }
    const noteBtn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-note-save]');
    if (noteBtn) {
      const id = Number(noteBtn.dataset.noteSave);
      const input = document.getElementById('eo-note') as HTMLInputElement | null;
      const statusEl = root.querySelector<HTMLElement>('[data-note-status]');
      if (id && input) void saveNote(id, input.value, input, statusEl);
    }
  });

  // Save the note on Enter for a calmer editorial flow.
  root.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (e.key === 'Enter' && t.id === 'eo-note') {
      e.preventDefault();
      const input = t as HTMLInputElement;
      const id = Number(input.dataset.id);
      const statusEl = root.querySelector<HTMLElement>('[data-note-status]');
      if (id) void saveNote(id, input.value, input, statusEl);
    }
  });

  window.addEventListener('popstate', render);
  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
