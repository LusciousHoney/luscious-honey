/* =============================================================================
   EDITORIAL OFFICE — pure logic core.
   Progress, resume position, draft versioning, archive/soft-delete, and packet
   assembly. No DOM, no localStorage — so every rule here is unit-testable.
   ============================================================================= */

import type {
  DocType, Question, Answer, Responses, DraftVersion, DraftPacket, PacketStage,
} from './types';

/* --- Questions & answers ------------------------------------------------- */

export function allQuestions(doc: DocType): Question[] {
  return doc.stages.flatMap((s) => s.questions);
}

export function isAnswered(a: Answer | undefined): boolean {
  if (!a) return false;
  if (a.type === 'open') return a.text.trim().length > 0;
  if (a.type === 'choice') return a.value.trim().length > 0 || Boolean(a.other?.trim());
  return a.values.length > 0 || Boolean(a.other?.trim());
}

/** Where to resume: the first unanswered question, or the end if all answered. */
export function firstUnansweredIndex(questions: Question[], responses: Responses): number {
  const i = questions.findIndex((q) => !isAnswered(responses[q.id]));
  return i === -1 ? Math.max(0, questions.length - 1) : i;
}

export interface StageProgress { id: string; name: string; answered: number; total: number; complete: boolean; }

export function stageProgress(doc: DocType, responses: Responses): StageProgress[] {
  return doc.stages.map((s) => {
    const total = s.questions.length;
    const answered = s.questions.filter((q) => isAnswered(responses[q.id])).length;
    return { id: s.id, name: s.name, answered, total, complete: total > 0 && answered === total };
  });
}

export function overallProgress(doc: DocType, responses: Responses): { answered: number; total: number } {
  const qs = allQuestions(doc);
  return { answered: qs.filter((q) => isAnswered(responses[q.id])).length, total: qs.length };
}

/** Enough substance to assemble a first packet (a few real answers). */
export function canGenerate(doc: DocType, responses: Responses): boolean {
  return overallProgress(doc, responses).answered >= Math.min(3, allQuestions(doc).length);
}

/* --- Normalising answers to readable text -------------------------------- */

export function answerToText(a: Answer | undefined): string {
  if (!a) return '';
  if (a.type === 'open') return a.text.trim();
  if (a.type === 'choice') {
    const parts = [a.value.trim(), a.other?.trim() ? `Other: ${a.other.trim()}` : ''].filter(Boolean);
    return parts.join(' · ');
  }
  const parts = [...a.values];
  if (a.other?.trim()) parts.push(`Other: ${a.other.trim()}`);
  return parts.join(', ');
}

/* --- The editorial packet (the future AI input) -------------------------- */

function packetItem(q: DocType['stages'][number]['questions'][number], responses: Responses) {
  const a = responses[q.id];
  return { questionId: q.id, prompt: q.prompt, type: q.type, answer: answerToText(a), answered: isAnswered(a) };
}

export function buildPacket(doc: DocType, responses: Responses, engine: string, at: string): DraftPacket {
  const stages: PacketStage[] = doc.stages.map((s) => ({
    name: s.name,
    items: s.questions.map((q) => packetItem(q, responses)),
  }));

  // Also group by editorial category, in order of first appearance. Questions
  // without a category (other document types) simply produce no themes.
  const order: string[] = [];
  const byCategory = new Map<string, PacketStage['items']>();
  for (const q of allQuestions(doc)) {
    if (!q.category) continue;
    if (!byCategory.has(q.category)) { byCategory.set(q.category, []); order.push(q.category); }
    byCategory.get(q.category)!.push(packetItem(q, responses));
  }
  const themes: PacketStage[] = order.map((name) => ({ name, items: byCategory.get(name)! }));

  const { answered, total } = overallProgress(doc, responses);
  return {
    docTypeId: doc.id, docTypeName: doc.name,
    title: `${doc.name} — editorial packet`,
    generatedAt: at, engine, answered, total, stages, themes,
  };
}

/** Render a packet as portable Markdown for hand-off / export. */
export function packetToMarkdown(p: DraftPacket): string {
  const lines: string[] = [];
  lines.push(`# ${p.title}`, '');
  lines.push(`*${p.docTypeName} · assembled ${p.generatedAt} · ${p.answered}/${p.total} answered · engine: ${p.engine}*`, '');
  lines.push('> Draft packet — the founder’s own responses, structured for an editor (human or AI). Not published; not AI-written.', '');
  for (const stage of p.stages) {
    lines.push(`## ${stage.name}`, '');
    for (const item of stage.items) {
      lines.push(`**${item.prompt}**`, '');
      lines.push(item.answered ? item.answer : '_(unanswered)_', '');
    }
  }
  const themes = p.themes ?? [];
  if (themes.length) {
    lines.push('---', '', '# Organized by theme', '');
    for (const t of themes) {
      lines.push(`## ${t.name}`, '');
      for (const item of t.items) {
        lines.push(`- **${item.prompt}** ${item.answered ? `— ${item.answer}` : '_(unanswered)_'}`);
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

/* --- Draft version history (archive, never overwrite) -------------------- */

export function nextVersionNumber(list: DraftVersion[]): number {
  return list.reduce((m, d) => Math.max(m, d.version), 0) + 1;
}

export function addVersion(list: DraftVersion[], v: DraftVersion): DraftVersion[] {
  return [...list, v];
}

export function setArchived(list: DraftVersion[], version: number, archived: boolean): DraftVersion[] {
  return list.map((d) => (d.version === version ? { ...d, archived } : d));
}

/** Soft-delete only — the record stays until an explicit permanent purge. */
export function setDeleted(list: DraftVersion[], version: number, deleted: boolean): DraftVersion[] {
  return list.map((d) => (d.version === version ? { ...d, deleted } : d));
}

/** Explicit, deliberate removal — the only path that truly discards a version. */
export function purgeDeleted(list: DraftVersion[]): DraftVersion[] {
  return list.filter((d) => !d.deleted);
}

export function liveVersions(list: DraftVersion[]): DraftVersion[] {
  return list.filter((d) => !d.deleted && !d.archived).sort((a, b) => b.version - a.version);
}

export function archivedVersions(list: DraftVersion[]): DraftVersion[] {
  return list.filter((d) => !d.deleted && d.archived).sort((a, b) => b.version - a.version);
}

export function deletedVersions(list: DraftVersion[]): DraftVersion[] {
  return list.filter((d) => d.deleted).sort((a, b) => b.version - a.version);
}
