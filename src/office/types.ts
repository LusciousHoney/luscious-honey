/* =============================================================================
   EDITORIAL OFFICE — types.
   The private, founder-only workspace where every permanent document begins.
   These types are the reusable spine: a document type is just data (stages of
   questions), so new document types are added without touching the engine.
   ============================================================================= */

export type InputType = 'choice' | 'multi' | 'open';

export interface Question {
  id: string;
  prompt: string;
  help?: string;
  type: InputType;
  options?: string[];      // choice / multi
  allowOther?: boolean;    // "Other…" expands into a writing area
  placeholder?: string;    // open
  /** Editorial theme this answer feeds (e.g. "Origin story"). Optional and
      additive: used only to also group the packet by theme for drafting. */
  category?: string;
}

export interface Stage {
  id: string;
  name: string;            // literary, not "Section 2"
  questions: Question[];
}

export interface DocType {
  id: string;
  name: string;
  blurb: string;
  stages: Stage[];
}

/* --- Answers ------------------------------------------------------------- */

export type Answer =
  | { type: 'open'; text: string }
  | { type: 'choice'; value: string; other?: string }
  | { type: 'multi'; values: string[]; other?: string };

export type Responses = Record<string, Answer>; // questionId -> answer

/* --- Drafts (the editorial packet) --------------------------------------
   Sprint 1A does NOT generate prose. "Generate First Draft" assembles the
   founder's responses into a structured editorial packet — the exact input a
   real AI engine will consume in a later sprint. Versions are archived, never
   overwritten. */

export interface PacketItem {
  questionId: string;
  prompt: string;
  type: InputType;
  answer: string;          // normalized, human-readable
  answered: boolean;
}

export interface PacketStage {
  name: string;
  items: PacketItem[];
}

export interface DraftPacket {
  docTypeId: string;
  docTypeName: string;
  title: string;
  generatedAt: string;     // ISO
  engine: string;          // which engine produced it (e.g. "local-packet")
  answered: number;
  total: number;
  stages: PacketStage[];     // grouped by interview stage
  themes: PacketStage[];     // grouped by editorial category (for drafting)
}

export interface DraftVersion {
  version: number;
  at: string;              // ISO
  packet: DraftPacket;
  notes: string;           // founder's editable working notes
  archived?: boolean;
  deleted?: boolean;       // soft-delete only
}

/* --- Reflections (Ask Me Something Different) ---------------------------- */

export interface Reflection {
  questionId: string;
  question: string;
  answer: string;
  at: string;
}

/* --- Persisted state ----------------------------------------------------- */

export interface DocState {
  responses: Responses;
  updatedAt: string;
}

export interface OfficeState {
  schemaVersion: 1;
  docs: Record<string, DocState>;
  drafts: Record<string, DraftVersion[]>;
  reflections: Reflection[];
  askedQuestionIds: string[];
}
