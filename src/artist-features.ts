/* =============================================================================
   ARTIST FEATURES — entry for /artist-features (artist-features.html).
   A public editorial intake: an independent artist introduces themselves for an
   interview, a live performance, or both. Not an application — an introduction.

   Submission is server-side: the form POSTs JSON to /api/intake/artist-feature, which
   validates, stores the introduction in D1, and sends a branded acknowledgment.
   No email address is exposed in the client. On error the artist's typed values
   are preserved and they can try again.
   ============================================================================= */

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/reception.css'; // the shared .site-header chrome
import './styles/publishing.css'; // .wing-hero + .back-line intake pattern
import './styles/artist-features.css';
import './styles/responsive.css';

import { currentClockState, applyClock } from './lib/living-clock';

const SUCCESS_MESSAGE =
  'Your introduction has reached the editor’s desk. I’ll take a look at your work and be in touch if the feature feels like the right fit.';

// Maps the API's field-error keys to the control ids on the page.
const FIELD_IDS: Record<string, string> = {
  artistName: 'artist-name',
  email: 'artist-email',
  musicUrl: 'artist-music',
  promoting: 'artist-promoting',
};

function val(id: string): string {
  const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
  return el ? el.value.trim() : '';
}

function chosenInterest(): string {
  const checked = document.querySelector<HTMLInputElement>('input[name="Interested in"]:checked');
  return checked ? checked.value : '';
}

function boot(): void {
  applyClock(currentClockState());

  const form = document.getElementById('intro-form') as HTMLFormElement | null;
  const status = document.getElementById('form-status');
  const errorBox = document.getElementById('form-error');
  const submitBtn = form?.querySelector<HTMLButtonElement>('button[type="submit"]') ?? null;
  if (!form) return;

  function clearBanners(): void {
    if (errorBox) { errorBox.hidden = true; errorBox.textContent = ''; }
    if (status) { status.hidden = true; status.textContent = ''; }
  }

  function showError(message: string, focusId?: string): void {
    if (errorBox) {
      errorBox.textContent = message;
      errorBox.hidden = false;
      errorBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    const target = focusId ? document.getElementById(focusId) : null;
    if (target && typeof (target as HTMLElement).focus === 'function') (target as HTMLElement).focus();
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearBanners();

    // Native validation first — surfaces required-field / type messages inline.
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const payload = {
      artistName: val('artist-name'),
      email: val('artist-email'),
      musicUrl: val('artist-music'),
      social: val('artist-social'),
      interest: chosenInterest(),
      promoting: val('artist-promoting'),
      notes: val('artist-notes'),
      company: val('artist-company'), // honeypot — always empty for real artists
    };

    if (submitBtn) { submitBtn.disabled = true; submitBtn.classList.add('is-disabled'); }

    try {
      const res = await fetch('/api/intake/artist-feature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let data: any = null;
      try { data = await res.json(); } catch { /* tolerate non-JSON */ }

      if (res.ok) {
        // Success — the introduction was received. Clear the fields and show the
        // confirmation in the artist's own voice.
        form.reset();
        if (status) {
          status.textContent = SUCCESS_MESSAGE;
          status.hidden = false;
          status.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
        return;
      }

      // Field-level validation errors (422) → point at the first offending field.
      if (data && data.errors) {
        const firstKey = Object.keys(data.errors)[0];
        showError(
          String(data.errors[firstKey] || data.error || 'Please check your entries and try again.'),
          FIELD_IDS[firstKey],
        );
      } else {
        showError(
          (data && data.error) ||
            'Something went wrong sending your introduction. Your details are still here — please try again.',
        );
      }
    } catch {
      // Network / offline — the values remain in the form for a retry.
      showError('I couldn’t reach the desk just now. Your details are still here — please check your connection and try again.');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.classList.remove('is-disabled'); }
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
