/**
 * Proposal renderer — a small, deterministic Markdown-to-HTML pass for exactly
 * the constructs the approved invitation uses: headings (#, ##, ###), thematic
 * breaks (---), paragraphs, and inline emphasis (***bold-italic***, **bold**,
 * *italic*). It renders the approved copy faithfully and in order; it neither
 * rearranges nor rewrites. All text is HTML-escaped before emphasis is applied,
 * so the trusted governed content cannot inject markup.
 *
 * Consecutive non-blank lines within a block are joined with <br> (this preserves
 * the two-line Founder signature exactly); blank lines separate paragraphs.
 */

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function inline(text) {
  return escapeHtml(text)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

/** Render approved Markdown to an HTML string. */
export function renderProposal(markdown) {
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let para = [];

  const flush = () => {
    if (para.length) {
      out.push(`<p>${para.map(inline).join('<br>')}</p>`);
      para = [];
    }
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (line.trim() === '') { flush(); continue; }
    if (/^---+$/.test(line.trim())) { flush(); out.push('<hr>'); continue; }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }
    para.push(line);
  }
  flush();
  return out.join('\n');
}

/** Split the approved Markdown into ordered sections at each top-level `## `
    heading. The block before the first `## ` is the masthead (index 0). Returns
    [{ title, html }] — copy is never rewritten, only partitioned for pacing. */
export function splitSections(markdown) {
  const src = String(markdown).replace(/\r\n/g, '\n');
  const parts = src.split(/\n(?=## )/);
  return parts.map((chunk) => {
    const m = /^##\s+(.+)$/m.exec(chunk);
    return { title: m ? m[1].trim() : '', html: renderProposal(chunk.replace(/^---\s*$|\n---\s*$/gm, '').trim()) };
  });
}

/** Group the sections into a small number of unhurried "movements" so the letter
    is read a few paced screens at a time rather than one long scroll. Grouping is
    by position and degrades gracefully if the section count changes. */
export function renderMovements(markdown) {
  const s = splitSections(markdown);
  const groups = [[0, 1], [2], [3, 4], [5, 6, 7], [8, 9]];
  const movements = [];
  for (const g of groups) {
    const html = g.map((i) => s[i] && s[i].html).filter(Boolean).join('\n<hr class="inv-soft">\n');
    if (html) movements.push(html);
  }
  // Fallback: if the expected structure isn't present, one movement per section.
  if (movements.length <= 1 && s.length > 1) return s.map((x) => x.html);
  return movements;
}
