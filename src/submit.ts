/* =============================================================================
   THE SUBMISSIONS DESK — entry for /submit (submit.html).

   One public, config-driven creative-intake surface for The Luscious Honey
   Collective. The submission TYPE determines the questions: the type picker and
   every field are rendered from the shared spec (shared/submission-forms.js), the
   same spec the server validates against. The form POSTs JSON to
   /api/intake/:type — the existing, authoritative pipeline (intake → D1 →
   Editorial Office → Headquarters). No second submission system is introduced.

   The registered Interview / Artist Feature pathway keeps its own dedicated form;
   it is presented here as a card that routes to /artist-features.html.
   ============================================================================= */

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/reception.css'; // shared .site-header chrome
import './styles/publishing.css'; // .wing-hero + .back-line intake pattern
import './styles/artist-features.css'; // .field / .choice / .intro-form surfaces
import './styles/submit.css';
import './styles/responsive.css';

import { currentClockState, applyClock } from './lib/living-clock';
import {
  SUBMITTER_ROLES,
  COMMON_FIELDS,
  SUBMISSION_FORMS,
  type FieldSpec,
  type SubmissionForm,
} from '../shared/submission-forms.js';

/** A picker entry: an inline config-driven form, or a link to a dedicated form. */
interface PickerEntry {
  id: string;
  title: string;
  description: string;
  icon: string;
  /** When present, this pathway routes to its own dedicated page. */
  href?: string;
  form?: SubmissionForm;
}

// The retained Interview / Artist Feature pathway — its own established form.
const ARTIST_FEATURE_ENTRY: PickerEntry = {
  id: 'artist_feature',
  title: 'Interview / Artist Feature',
  description: 'Introduce yourself for a feature or conversation — the original path, unchanged.',
  icon: '🎙️',
  href: '/artist-features.html',
};

// Priority order: Music · Interview/Artist Feature · Book · Podcast · Visual Art · Event · Other.
function buildPicker(): PickerEntry[] {
  const byId = new Map(SUBMISSION_FORMS.map((f) => [f.id, f]));
  const entryFor = (f: SubmissionForm): PickerEntry => ({
    id: f.id, title: f.title, description: f.description, icon: f.icon, form: f,
  });
  const out: PickerEntry[] = [];
  if (byId.has('music')) out.push(entryFor(byId.get('music')!));
  out.push(ARTIST_FEATURE_ENTRY);
  for (const f of SUBMISSION_FORMS) if (f.id !== 'music') out.push(entryFor(f));
  return out;
}

/* --- tiny DOM helper ------------------------------------------------------ */
function h(tag: string, attrs: Record<string, string> = {}, ...kids: (Node | string)[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const kid of kids) el.append(kid);
  return el;
}

function boot(): void {
  applyClock(currentClockState());

  const picker = document.getElementById('type-picker');
  const formHost = document.getElementById('submit-host');
  if (!picker || !formHost) return;

  const entries = buildPicker();

  // Render the type picker as an accessible radio group of cards.
  for (const entry of entries) {
    const input = h('input', {
      class: 'sub-card__input', type: 'radio', name: 'submission-type', value: entry.id, id: `type-${entry.id}`,
    }) as HTMLInputElement;
    const face = h('span', { class: 'sub-card__face' },
      h('span', { class: 'sub-card__icon', 'aria-hidden': 'true' }, entry.icon),
      h('span', { class: 'sub-card__title' }, entry.title),
      h('span', { class: 'sub-card__desc' }, entry.description),
    );
    const label = h('label', { class: 'sub-card' }, input, face);
    input.addEventListener('change', () => selectEntry(entry, formHost));
    picker.append(label);
  }
}

function selectEntry(entry: PickerEntry, host: HTMLElement): void {
  host.innerHTML = '';

  // A dedicated pathway (Interview / Artist Feature) — route to its own form.
  if (entry.href) {
    const panel = h('div', { class: 'intro-form plate brass-edge sub-routeout' },
      h('p', { class: 'sub-routeout__lede editorial' },
        `The ${entry.title} pathway has its own dedicated form, kept exactly as it is.`),
      h('a', { class: 'button', href: entry.href }, `Continue to the ${entry.title} form →`),
    );
    host.append(panel);
    host.scrollIntoView({ block: 'start', behavior: 'smooth' });
    return;
  }

  const form = entry.form!;
  host.append(buildForm(entry, form));
  host.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

function buildForm(entry: PickerEntry, form: SubmissionForm): HTMLElement {
  const el = h('form', {
    class: 'intro-form plate brass-edge sub-form', id: 'submit-form', novalidate: 'novalidate',
  }) as HTMLFormElement;

  el.append(h('p', { class: 'intro-form__lede editorial' }, form.lede));
  el.append(h('p', { class: 'intro-form__error editorial', id: 'form-error', role: 'alert', hidden: 'hidden' }));

  // Who is submitting — the shared role choice, first.
  el.append(buildRoleField());

  // Shared fields, then the type-specific fields.
  const allFields = [...COMMON_FIELDS, ...form.fields];
  for (const f of allFields) el.append(buildFieldControl(f));

  // Honeypot — hidden from people and assistive tech.
  const hp = h('div', {
    class: 'hp-field', 'aria-hidden': 'true',
    style: 'position:absolute!important;left:-9999px!important;top:auto;width:1px;height:1px;overflow:hidden;',
  },
    h('label', { for: 'sub-company' }, 'Company'),
    h('input', { id: 'sub-company', name: 'Company', type: 'text', tabindex: '-1', autocomplete: 'off' }),
  );
  el.append(hp);

  el.append(h('p', { class: 'intro-form__closing editorial' }, 'Every submission is read by a person.'));

  const foot = h('div', { class: 'intro-form__foot' },
    h('button', { class: 'button', type: 'submit' }, 'Send to the Collective'),
    h('p', { class: 'intro-form__reassure meta' }, 'Nothing is decided by an automated system. The House decides — nothing is promised.'),
  );
  el.append(foot);
  el.append(h('p', { class: 'intro-form__status editorial', id: 'form-status', role: 'status', 'aria-live': 'polite', hidden: 'hidden' }));

  el.addEventListener('change', () => applyRoleVisibility(el));
  el.addEventListener('submit', (ev) => onSubmit(ev, entry, allFields, el));
  applyRoleVisibility(el);
  return el;
}

function buildRoleField(): HTMLElement {
  const fieldset = h('fieldset', { class: 'field field--choice' });
  fieldset.append(h('legend', { class: 'field__label label' }, 'You are'));
  const row = h('div', { class: 'choice-row' });
  SUBMITTER_ROLES.forEach((r, i) => {
    const input = h('input', {
      class: 'choice__input', type: 'radio', name: 'submitterRole', value: r.id, ...(i === 0 ? { required: 'required' } : {}),
    }) as HTMLInputElement;
    row.append(h('label', { class: 'choice' }, input, h('span', { class: 'choice__face' }, r.label)));
  });
  fieldset.append(row);
  return fieldset;
}

function ctrlId(key: string): string { return `f-${key}`; }

function buildFieldControl(f: FieldSpec): HTMLElement {
  const wrap = h('div', { class: 'field' });
  if (f.showWhenRoleNot) wrap.setAttribute('data-show-when-role-not', f.showWhenRoleNot);

  if (f.kind === 'choice' || f.kind === 'multi') {
    const fieldset = h('fieldset', { class: 'field field--choice' });
    if (f.showWhenRoleNot) fieldset.setAttribute('data-show-when-role-not', f.showWhenRoleNot);
    const legend = h('legend', { class: 'field__label label' }, f.label);
    if (!f.required) legend.append(h('span', { class: 'field__optional' }, 'Optional'));
    fieldset.append(legend);
    if (f.help) fieldset.append(h('p', { class: 'field__help' }, f.help));
    const row = h('div', { class: 'choice-row' });
    (f.options || []).forEach((opt, i) => {
      const input = h('input', {
        class: 'choice__input',
        type: f.kind === 'multi' ? 'checkbox' : 'radio',
        name: f.key, value: opt,
        ...(f.kind === 'choice' && f.required && i === 0 ? { required: 'required' } : {}),
      }) as HTMLInputElement;
      input.setAttribute('data-key', f.key);
      input.setAttribute('data-kind', f.kind);
      row.append(h('label', { class: 'choice' }, input, h('span', { class: 'choice__face' }, opt)));
    });
    fieldset.append(row);
    return fieldset;
  }

  const label = h('label', { class: 'field__label label', for: ctrlId(f.key) }, f.label);
  if (!f.required) label.append(h('span', { class: 'field__optional' }, 'Optional'));
  wrap.append(label);
  if (f.help) wrap.append(h('p', { class: 'field__help', id: `${ctrlId(f.key)}-help` }, f.help));

  let control: HTMLInputElement | HTMLTextAreaElement;
  if (f.kind === 'longtext') {
    control = h('textarea', { class: 'field__input office-textarea', rows: '4' }) as HTMLTextAreaElement;
  } else {
    const type = f.kind === 'email' ? 'email' : f.kind === 'url' ? 'url' : 'text';
    control = h('input', {
      class: 'field__input', type,
      ...(f.kind === 'email' ? { inputmode: 'email', autocomplete: 'email' } : {}),
      ...(f.kind === 'url' ? { inputmode: 'url', placeholder: f.placeholder || 'https://' } : {}),
    }) as HTMLInputElement;
  }
  control.id = ctrlId(f.key);
  if (f.placeholder && f.kind !== 'url') control.setAttribute('placeholder', f.placeholder);
  if (f.required) control.setAttribute('required', 'required');
  if (f.max) control.setAttribute('maxlength', String(f.max));
  if (f.help) control.setAttribute('aria-describedby', `${ctrlId(f.key)}-help`);
  control.setAttribute('data-key', f.key);
  control.setAttribute('data-kind', f.kind);
  wrap.append(control);
  return wrap;
}

/** Hide role-conditional fields (e.g. relationship) when they don't apply. */
function applyRoleVisibility(form: HTMLFormElement): void {
  const role = (form.querySelector('input[name="submitterRole"]:checked') as HTMLInputElement | null)?.value || '';
  form.querySelectorAll<HTMLElement>('[data-show-when-role-not]').forEach((node) => {
    node.hidden = role === node.getAttribute('data-show-when-role-not');
  });
}

function readValues(allFields: FieldSpec[], form: HTMLFormElement): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const role = (form.querySelector('input[name="submitterRole"]:checked') as HTMLInputElement | null)?.value || '';
  out.submitterRole = role;
  for (const f of allFields) {
    if (f.kind === 'multi') {
      out[f.key] = Array.from(form.querySelectorAll<HTMLInputElement>(`input[data-key="${f.key}"]:checked`)).map((i) => i.value);
    } else if (f.kind === 'choice') {
      out[f.key] = (form.querySelector(`input[data-key="${f.key}"]:checked`) as HTMLInputElement | null)?.value || '';
    } else {
      const c = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-key="${f.key}"]`);
      out[f.key] = c ? c.value.trim() : '';
    }
  }
  const hp = form.querySelector('#sub-company') as HTMLInputElement | null;
  out.company = hp ? hp.value : '';
  return out;
}

async function onSubmit(ev: Event, entry: PickerEntry, allFields: FieldSpec[], form: HTMLFormElement): Promise<void> {
  ev.preventDefault();
  const errorBox = form.querySelector('#form-error') as HTMLElement | null;
  const status = form.querySelector('#form-status') as HTMLElement | null;
  const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
  if (errorBox) { errorBox.hidden = true; errorBox.textContent = ''; }
  if (status) { status.hidden = true; status.textContent = ''; }

  if (!form.checkValidity()) { form.reportValidity(); return; }

  const payload = readValues(allFields, form);
  const typePath = entry.id.replace(/_/g, '-');

  if (submitBtn) { submitBtn.disabled = true; submitBtn.classList.add('is-disabled'); }
  try {
    const res = await fetch(`/api/intake/${typePath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    let data: any = null;
    try { data = await res.json(); } catch { /* tolerate non-JSON */ }

    if (res.ok) {
      form.reset();
      applyRoleVisibility(form);
      if (status) {
        status.textContent = 'Thank you — your submission has reached the desk. If it feels like the right fit for the House, you’ll hear from me.';
        status.hidden = false;
        status.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      return;
    }

    const firstKey = data && data.errors ? Object.keys(data.errors)[0] : '';
    const message = (data && data.errors && data.errors[firstKey])
      || (data && data.error)
      || 'Something went wrong sending your submission. Your details are still here — please try again.';
    showError(errorBox, String(message), firstKey);
  } catch {
    showError(errorBox, 'I couldn’t reach the desk just now. Your details are still here — please check your connection and try again.');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.classList.remove('is-disabled'); }
  }
}

function showError(box: HTMLElement | null, message: string, focusKey?: string): void {
  if (box) {
    box.textContent = message;
    box.hidden = false;
    box.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  if (focusKey) {
    const target = document.getElementById(ctrlId(focusKey))
      || document.querySelector(`input[data-key="${focusKey}"]`)
      || document.querySelector(`input[name="${focusKey}"]`);
    if (target && typeof (target as HTMLElement).focus === 'function') (target as HTMLElement).focus();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
