/* =============================================================================
   EDITORIAL OFFICE — entry + hash router.
   A private, founder-only workspace. Dev-only for Sprint 1A (this page is not
   part of the production build; see docs/Editorial-Office.md).
   ============================================================================= */

import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/components.css';
import '../styles/office.css';

import { mountHome, mountInterview, mountDraft, mountMemory, mountReflect } from './views';

function router(): void {
  const root = document.getElementById('office-app');
  if (!root) return;

  const raw = location.hash.replace(/^#\/?/, '');
  const [seg, id] = raw.split('/');

  switch (seg) {
    case '': mountHome(root); break;
    case 'write': id ? mountInterview(root, id) : mountHome(root); break;
    case 'draft': id ? mountDraft(root, id) : mountHome(root); break;
    case 'memory': mountMemory(root); break;
    case 'reflect': mountReflect(root); break;
    default: mountHome(root);
  }
  window.scrollTo({ top: 0 });
}

window.addEventListener('hashchange', router);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', router);
} else {
  router();
}
