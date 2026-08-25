import { AFFILIATION_STATUSES, RELATIONSHIP_TYPES } from '@/lib/types';

import { toneMap } from './helpers';
import type { FieldDef } from './types';

export const affiliationStatusTone = toneMap({ current: 'default', former: 'outline' });

/**
 * Fields on the Entity↔Person junction — the "role a person plays at an
 * entity." The UI never shows the junction as its own object (per spec §9);
 * these fields surface as extra columns on the People related list and as
 * the body of the "Add person" form.
 */
export const ENTITY_PERSON_FIELDS = {
  relationship_type: {
    key: 'relationship_type',
    label: 'Relationship',
    type: 'select',
    options: RELATIONSHIP_TYPES,
    required: true,
  } as FieldDef,
  job_title: { key: 'job_title', label: 'Title', type: 'text' } as FieldDef,
  department: { key: 'department', label: 'Department', type: 'text' } as FieldDef,
  is_primary_contact: { key: 'is_primary_contact', label: 'Primary contact', type: 'boolean' } as FieldDef,
  status: {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: AFFILIATION_STATUSES,
    required: true,
    badgeTone: affiliationStatusTone,
  } as FieldDef,
  started_on: { key: 'started_on', label: 'Started', type: 'date' } as FieldDef,
  ended_on: { key: 'ended_on', label: 'Ended', type: 'date' } as FieldDef,
  notes: { key: 'notes', label: 'Notes', type: 'longtext' } as FieldDef,
};
