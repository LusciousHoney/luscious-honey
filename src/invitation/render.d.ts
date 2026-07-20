/** Render approved invitation Markdown to an HTML string (see render.js). */
export function renderProposal(markdown: string): string;
/** Split the approved Markdown into ordered sections at each top-level heading. */
export function splitSections(markdown: string): { title: string; html: string }[];
/** Group the sections into a few unhurried movements (array of HTML strings). */
export function renderMovements(markdown: string): string[];
