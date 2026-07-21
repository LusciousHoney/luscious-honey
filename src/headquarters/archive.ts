/* =============================================================================
   CREATIVE DIRECTOR — the Archive (Usability sprint).

   Replaces the bookshelf/spine "Collection" with a premium archival LIBRARY: a
   searchable, filterable, hierarchical index of the House's made works. Pure
   shaping only — no DOM, no I/O. It reads the SAME existing published works
   (GET /api/submissions?status=published) the Collection used; no new data, no
   fabrication. Categories and filters are derived honestly from the works' own
   type and their `interest` field.
   ============================================================================= */

import type { Submission } from './adapters.ts';

export interface ArchiveEntry {
  id: number;
  name: string;
  summary: string;
  kind: string;     // the interest facet (Interview / Live Performance / …) or 'Feature'
}
export interface ArchiveGroup { id: string; label: string; entries: ArchiveEntry[]; total: number; }
export interface ArchiveCategory { id: string; label: string; groups: ArchiveGroup[]; total: number; }
export interface ArchiveTree {
  categories: ArchiveCategory[];
  total: number;       // entries shown after search + filter
  grandTotal: number;  // entries before search + filter (the whole archive)
  query: string;
  filter: string | null;
}

/* The future-ready archive taxonomy (ordered). It scales beyond today's data:
   new submission types slot into a category via `CATEGORY_OF`. Only categories
   that actually hold works are shown — empty future categories are omitted, never
   fabricated. */
export interface ArchiveTaxon { id: string; label: string; }
export const ARCHIVE_TAXONOMY: ArchiveTaxon[] = [
  { id: 'books',      label: 'Books' },
  { id: 'interviews', label: 'Interviews' },
  { id: 'characters', label: 'Characters' },
  { id: 'narration',  label: 'Narration' },
  { id: 'production', label: 'Production' },
  { id: 'marketing',  label: 'Marketing' },
  { id: 'assets',     label: 'Assets' },
  { id: 'research',   label: 'Research' },
  { id: 'universe',   label: 'Universe' },
  { id: 'residents',  label: 'Residents' },
  { id: 'templates',  label: 'Templates' },
];
const TAXON_ORDER = new Map(ARCHIVE_TAXONOMY.map((t, i) => [t.id, i]));
const TAXON_LABEL = new Map(ARCHIVE_TAXONOMY.map((t) => [t.id, t.label]));

/** Map a submission TYPE to an archive category. Artist Features are interviews /
    conversations, so they live under Interviews. The Version 1 creative pathways
    slot into existing taxa; unmapped types fall through to Research. (Extension
    point only — the taxonomy itself is unchanged.) */
const CATEGORY_OF: Record<string, string> = {
  artist_feature: 'interviews',
  music: 'production',
  book: 'books',
  podcast: 'narration',
  visual_art: 'assets',
  event: 'production',
  // other_proposal → Research (default)
};
function categoryOf(type: string): string { return CATEGORY_OF[type] || 'research'; }

function facet(s: Submission): string {
  const f = s.fields as Record<string, unknown> | undefined;
  const interest = f && typeof f.interest === 'string' ? f.interest.trim() : '';
  return interest || 'Feature';
}

/** The facet values actually present in the archive — the honest filter set. */
export function archiveFilters(published: Submission[] | null): string[] {
  const set = new Set<string>();
  for (const s of published || []) set.add(facet(s));
  return [...set].sort();
}

/**
 * Build the archive tree from the published works, narrowed by a free-text query
 * (name + summary) and an optional facet filter. Pure and deterministic.
 */
export function archiveTree(
  published: Submission[] | null,
  query = '',
  filter: string | null = null,
): ArchiveTree {
  const all = Array.isArray(published) ? published : [];
  const q = query.trim().toLowerCase();

  const match = (s: Submission): boolean => {
    if (filter && facet(s) !== filter) return false;
    if (!q) return true;
    const hay = `${s.name} ${s.summary ?? ''} ${facet(s)}`.toLowerCase();
    return hay.includes(q);
  };

  // Group matching works by taxonomy CATEGORY (only populated categories appear).
  const byCat = new Map<string, Submission[]>();
  for (const s of all) if (match(s)) {
    const c = categoryOf(s.type);
    (byCat.get(c) ?? byCat.set(c, []).get(c)!).push(s);
  }

  const categories: ArchiveCategory[] = [...byCat.entries()]
    .sort((a, b) => (TAXON_ORDER.get(a[0]) ?? 99) - (TAXON_ORDER.get(b[0]) ?? 99))
    .map(([cat, items]) => {
      const byFacet = new Map<string, ArchiveEntry[]>();
      for (const s of items) {
        const k = facet(s);
        (byFacet.get(k) ?? byFacet.set(k, []).get(k)!).push({ id: s.id, name: s.name, summary: s.summary ?? '', kind: k });
      }
      const groups: ArchiveGroup[] = [...byFacet.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, entries]) => ({ id: k.toLowerCase().replace(/\W+/g, '-'), label: k, entries, total: entries.length }));
      return { id: cat, label: TAXON_LABEL.get(cat) ?? cat, groups, total: items.length };
    });

  return {
    categories,
    total: categories.reduce((n, c) => n + c.total, 0),
    grandTotal: all.length,
    query,
    filter,
  };
}
