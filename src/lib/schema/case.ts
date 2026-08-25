import { CASE_PRIORITIES, CASE_SOURCES, CASE_STATUSES } from '@/lib/types';

import { OWNERSHIP_FIELDS, SYSTEM_SECTION, toneMap } from './helpers';
import type { FieldDef, ObjectLayout } from './types';

export const caseStatusTone = toneMap({
  new: 'outline',
  open: 'secondary',
  pending: 'secondary',
  resolved: 'default',
  closed: 'default',
});

export const casePriorityTone = toneMap({
  low: 'outline',
  medium: 'secondary',
  high: 'default',
  urgent: 'destructive',
});

const FIELDS = {
  case_number: { key: 'case_number', label: 'Case #', type: 'text', required: true } as FieldDef,
  subject: { key: 'subject', label: 'Subject', type: 'text', required: true } as FieldDef,
  description: { key: 'description', label: 'Description', type: 'longtext', required: true } as FieldDef,
  entity_id: {
    key: 'entity_id',
    label: 'Entity',
    type: 'lookup',
    lookup: { resource: 'entities', labelOf: (row: Record<string, unknown>) => String(row.name) },
  } as FieldDef,
  reported_by_person_id: {
    key: 'reported_by_person_id',
    label: 'Reported by',
    type: 'lookup',
    lookup: {
      resource: 'persons',
      labelOf: (row: Record<string, unknown>) => [row.first_name, row.last_name].filter(Boolean).join(' '),
    },
  } as FieldDef,
  status: { key: 'status', label: 'Status', type: 'select', options: CASE_STATUSES, required: true, badgeTone: caseStatusTone } as FieldDef,
  priority: { key: 'priority', label: 'Priority', type: 'select', options: CASE_PRIORITIES, required: true, badgeTone: casePriorityTone } as FieldDef,
  category: { key: 'category', label: 'Category', type: 'text' } as FieldDef,
  source: { key: 'source', label: 'Source', type: 'select', options: CASE_SOURCES } as FieldDef,
  due_at: { key: 'due_at', label: 'Due', type: 'datetime' } as FieldDef,
  resolved_at: { key: 'resolved_at', label: 'Resolved at', type: 'datetime', readOnly: true } as FieldDef,
  resolution: { key: 'resolution', label: 'Resolution', type: 'longtext' } as FieldDef,
};

export const CASE_FIELDS = FIELDS;

export const CASE_LAYOUT: ObjectLayout = {
  sections: [
    {
      title: 'Case Information',
      fields: [FIELDS.case_number, FIELDS.subject, FIELDS.status, FIELDS.priority, FIELDS.category, FIELDS.source],
    },
    { title: 'Description', fields: [FIELDS.description] },
    { title: 'Involved', fields: [FIELDS.entity_id, FIELDS.reported_by_person_id] },
    { title: 'Resolution', fields: [FIELDS.due_at, FIELDS.resolved_at, FIELDS.resolution] },
    { title: 'Ownership', fields: OWNERSHIP_FIELDS },
    SYSTEM_SECTION,
  ],
};

export const CASE_LIST_COLUMNS = [
  FIELDS.case_number,
  FIELDS.subject,
  FIELDS.status,
  FIELDS.priority,
  FIELDS.entity_id,
  { key: 'updated_at', label: 'Last Activity', type: 'datetime' } as FieldDef,
];

export const CASE_SEARCH_FIELDS = ['case_number', 'subject'];
