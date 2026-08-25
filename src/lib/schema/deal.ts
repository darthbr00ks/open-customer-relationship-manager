import { DEAL_STAGES } from '@/lib/types';

import { OWNERSHIP_FIELDS, SYSTEM_SECTION, toneMap } from './helpers';
import type { FieldDef, ObjectLayout } from './types';

export const dealStageTone = toneMap({
  qualification: 'outline',
  discovery: 'outline',
  proposal: 'secondary',
  negotiation: 'secondary',
  won: 'default',
  lost: 'destructive',
});

const FIELDS = {
  name: { key: 'name', label: 'Deal name', type: 'text', required: true } as FieldDef,
  entity_id: {
    key: 'entity_id',
    label: 'Entity',
    type: 'lookup',
    required: true,
    lookup: { resource: 'entities', labelOf: (row: Record<string, unknown>) => String(row.name) },
  } as FieldDef,
  primary_contact_person_id: {
    key: 'primary_contact_person_id',
    label: 'Primary contact',
    type: 'lookup',
    lookup: {
      resource: 'persons',
      labelOf: (row: Record<string, unknown>) => [row.first_name, row.last_name].filter(Boolean).join(' '),
    },
  } as FieldDef,
  stage: { key: 'stage', label: 'Stage', type: 'select', options: DEAL_STAGES, required: true, badgeTone: dealStageTone } as FieldDef,
  amount: { key: 'amount', label: 'Amount', type: 'currency' } as FieldDef,
  probability: { key: 'probability', label: 'Probability (%)', type: 'number' } as FieldDef,
  expected_close_date: { key: 'expected_close_date', label: 'Expected close', type: 'date' } as FieldDef,
  closed_at: { key: 'closed_at', label: 'Closed at', type: 'datetime', readOnly: true } as FieldDef,
  next_step: { key: 'next_step', label: 'Next step', type: 'longtext' } as FieldDef,
  lost_reason: { key: 'lost_reason', label: 'Lost reason', type: 'longtext' } as FieldDef,
  description: { key: 'description', label: 'Description', type: 'longtext' } as FieldDef,
  notes: { key: 'notes', label: 'Internal notes', type: 'longtext' } as FieldDef,
};

export const DEAL_FIELDS = FIELDS;

export const DEAL_LAYOUT: ObjectLayout = {
  sections: [
    {
      title: 'Deal Information',
      fields: [FIELDS.name, FIELDS.entity_id, FIELDS.primary_contact_person_id, FIELDS.stage, FIELDS.amount, FIELDS.probability],
    },
    {
      title: 'Timeline',
      fields: [FIELDS.expected_close_date, FIELDS.closed_at, FIELDS.next_step, FIELDS.lost_reason],
    },
    { title: 'Ownership', fields: OWNERSHIP_FIELDS },
    { title: 'Additional Information', fields: [FIELDS.description, FIELDS.notes] },
    SYSTEM_SECTION,
  ],
};

export const DEAL_LIST_COLUMNS = [
  FIELDS.name,
  FIELDS.entity_id,
  FIELDS.stage,
  FIELDS.amount,
  FIELDS.expected_close_date,
  { ...OWNERSHIP_FIELDS[0] },
];

export const DEAL_SEARCH_FIELDS = ['name'];
