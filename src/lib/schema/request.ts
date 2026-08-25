import { REQUEST_PRIORITIES, REQUEST_STATUSES } from '@/lib/types';

import { OWNERSHIP_FIELDS, SYSTEM_SECTION, toneMap } from './helpers';
import type { FieldDef, ObjectLayout } from './types';

export const requestStatusTone = toneMap({
  submitted: 'outline',
  under_review: 'secondary',
  planned: 'secondary',
  in_progress: 'secondary',
  completed: 'default',
  declined: 'destructive',
});

export const requestPriorityTone = toneMap({
  low: 'outline',
  medium: 'secondary',
  high: 'default',
});

const FIELDS = {
  request_number: { key: 'request_number', label: 'Request #', type: 'text', required: true } as FieldDef,
  title: { key: 'title', label: 'Title', type: 'text', required: true } as FieldDef,
  description: { key: 'description', label: 'Description', type: 'longtext', required: true } as FieldDef,
  entity_id: {
    key: 'entity_id',
    label: 'Entity',
    type: 'lookup',
    lookup: { resource: 'entities', labelOf: (row: Record<string, unknown>) => String(row.name) },
  } as FieldDef,
  requested_by_person_id: {
    key: 'requested_by_person_id',
    label: 'Requested by',
    type: 'lookup',
    lookup: {
      resource: 'persons',
      labelOf: (row: Record<string, unknown>) => [row.first_name, row.last_name].filter(Boolean).join(' '),
    },
  } as FieldDef,
  status: { key: 'status', label: 'Status', type: 'select', options: REQUEST_STATUSES, required: true, badgeTone: requestStatusTone } as FieldDef,
  priority: { key: 'priority', label: 'Priority', type: 'select', options: REQUEST_PRIORITIES, required: true, badgeTone: requestPriorityTone } as FieldDef,
  category: { key: 'category', label: 'Category', type: 'text' } as FieldDef,
  business_need: { key: 'business_need', label: 'Business need', type: 'longtext' } as FieldDef,
  decision_notes: { key: 'decision_notes', label: 'Decision notes', type: 'longtext' } as FieldDef,
  target_date: { key: 'target_date', label: 'Target date', type: 'date' } as FieldDef,
  completed_at: { key: 'completed_at', label: 'Completed at', type: 'datetime', readOnly: true } as FieldDef,
};

export const REQUEST_FIELDS = FIELDS;

export const REQUEST_LAYOUT: ObjectLayout = {
  sections: [
    { title: 'Request Information', fields: [FIELDS.request_number, FIELDS.title, FIELDS.status, FIELDS.priority, FIELDS.category] },
    { title: 'Description', fields: [FIELDS.description, FIELDS.business_need] },
    { title: 'Involved', fields: [FIELDS.entity_id, FIELDS.requested_by_person_id] },
    { title: 'Decision', fields: [FIELDS.target_date, FIELDS.completed_at, FIELDS.decision_notes] },
    { title: 'Ownership', fields: OWNERSHIP_FIELDS },
    SYSTEM_SECTION,
  ],
};

export const REQUEST_LIST_COLUMNS = [
  FIELDS.request_number,
  FIELDS.title,
  FIELDS.status,
  FIELDS.priority,
  FIELDS.entity_id,
  { key: 'updated_at', label: 'Last Activity', type: 'datetime' } as FieldDef,
];

export const REQUEST_SEARCH_FIELDS = ['request_number', 'title'];
