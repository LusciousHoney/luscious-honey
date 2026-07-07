/* =============================================================================
   THE WINGS — doors along the Dark Spine. Sprint 04 · Part IX route map.
   The corridor is the wayfinding: each door is a real, labelled link with a
   brass numeral. In this first slice ONE wing is open (Publishing). The others
   are part of the building's architecture but are honestly "not yet furnished"
   — never a fake room, never a dead empty route. We do not build future wings
   ahead of real content (Part IX · "no new departments without a requirement").
   ============================================================================= */

export interface Wing {
  numeral: string;   // brass door numeral 00–06
  name: string;      // etched wing name
  href: string | null; // real link when open; null when not yet furnished
  open: boolean;
  blurb: string;     // in-voice one line
}

export const wings: Wing[] = [
  { numeral: '00', name: 'Reception', href: '/', open: true,
    blurb: 'The desk, the Journal, the way in.' },
  { numeral: '01', name: 'Publishing', href: '/publishing', open: true,
    blurb: 'The editorial wing. The work is here.' },
  { numeral: '02', name: 'Productions', href: null, open: false,
    blurb: 'The studio. Dark unless a session is live.' },
  { numeral: '03', name: 'Press', href: null, open: false,
    blurb: 'The House Journal and the Writing Wall.' },
  { numeral: '04', name: 'Salon', href: null, open: false,
    blurb: 'A room of chairs. It rests until an event is real.' },
  { numeral: '05', name: 'Lantern', href: null, open: false,
    blurb: 'One featured work, at the top of the house.' },
  { numeral: '06', name: 'Archive', href: null, open: false,
    blurb: 'Strata and threads. It opens as works ship.' },
];
