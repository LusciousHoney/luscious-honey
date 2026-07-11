/* =============================================================================
   PRODUCTION STUDIO — entry for /production-studio (production-studio.html).
   A private hub for the House's making tools. Each tool is one destination
   card; today the Studio holds the Voice Notes Studio. Additive by design —
   new tools are new cards, never a redesign.

   Access: /production-studio* is gated by Cloudflare Access (the pattern the
   Pull Me Under /office uses); see docs/DEPLOY.md. This page is noindex and
   carries no secrets itself.
   ============================================================================= */

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/publishing.css';
import './styles/responsive.css';

import { currentClockState, applyClock } from './lib/living-clock';

applyClock(currentClockState());
