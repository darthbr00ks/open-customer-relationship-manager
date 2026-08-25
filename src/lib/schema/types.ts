import type { ResourceName } from '@/lib/api/resources';

/**
 * The vocabulary a page layout is built from: sections group
 * fields; a field's type drives how it renders in a record and how it's
 * edited in a form). Everything downstream — record sections, list columns,
 * create/edit forms, filters — reads from these definitions instead of
 * hardcoding markup per object, so adding or moving a field is a one-line
 * change here rather than a change in five components.
 */
export type FieldType =
  | 'text'
  | 'longtext'
  | 'number'
  | 'currency'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'select'
  | 'user'
  | 'lookup'
  | 'url'
  | 'email'
  | 'phone';

export type BadgeTone = 'default' | 'secondary' | 'destructive' | 'outline';

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  /** For `select`: the allowed values, in display order. */
  options?: readonly string[];
  /** For `lookup`: which resource the id points at, and how to render the target row. */
  lookup?: { resource: ResourceName; labelOf: (row: never) => string };
  required?: boolean;
  /** Shown but never editable (timestamps, audit fields). */
  readOnly?: boolean;
  placeholder?: string;
  helpText?: string;
  /** For `select` fields shown as a colored badge instead of plain text. */
  badgeTone?: (value: string) => BadgeTone;
  /** Column width hint for the list view (Tailwind width class). */
  columnWidth?: string;
};

export type Section = { title: string; fields: FieldDef[] };

export type ObjectLayout = { sections: Section[] };
