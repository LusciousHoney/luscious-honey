/* Types for the environment-neutral submission-form spec (shared/submission-forms.js),
   so the TypeScript submission client imports it fully typed without `allowJs`. */

export type FieldKind = 'text' | 'email' | 'url' | 'longtext' | 'choice' | 'multi';

export interface FieldSpec {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  options?: string[];
  help?: string;
  placeholder?: string;
  max?: number;
  /** Hide this field on the form while the submitter role equals this id. */
  showWhenRoleNot?: string;
}

export interface SubmitterRole { id: string; label: string; }

export interface SubmissionForm {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  lede: string;
  fields: FieldSpec[];
}

export const SUBMITTER_ROLES: SubmitterRole[];
export const INVOLVEMENT_AREAS: string[];
export const COMMON_FIELDS: FieldSpec[];
export const SUBMISSION_FORMS: SubmissionForm[];

export function getSubmissionForm(id: string): SubmissionForm | null;
export function fieldsForForm(id: string): FieldSpec[];
export function roleLabel(id: string): string;
