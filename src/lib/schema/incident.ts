import { INCIDENT_SEVERITIES, INCIDENT_STATUSES } from '@/lib/types';

import { OWNERSHIP_FIELDS, SYSTEM_SECTION, toneMap } from './helpers';
import type { FieldDef, ObjectLayout } from './types';

export const incidentStatusTone = toneMap({
  investigating: 'destructive',
  identified: 'secondary',
  monitoring: 'secondary',
  resolved: 'default',
  closed: 'outline',
});

export const incidentSeverityTone = toneMap({
  low: 'outline',
  medium: 'secondary',
  high: 'default',
  critical: 'destructive',
});

const FIELDS = {
  incident_number: { key: 'incident_number', label: 'Incident #', type: 'text', required: true } as FieldDef,
  title: { key: 'title', label: 'Title', type: 'text', required: true } as FieldDef,
  description: { key: 'description', label: 'Description', type: 'longtext', required: true } as FieldDef,
  status: { key: 'status', label: 'Status', type: 'select', options: INCIDENT_STATUSES, required: true, badgeTone: incidentStatusTone } as FieldDef,
  severity: { key: 'severity', label: 'Severity', type: 'select', options: INCIDENT_SEVERITIES, required: true, badgeTone: incidentSeverityTone } as FieldDef,
  started_at: { key: 'started_at', label: 'Started', type: 'datetime' } as FieldDef,
  identified_at: { key: 'identified_at', label: 'Identified', type: 'datetime' } as FieldDef,
  resolved_at: { key: 'resolved_at', label: 'Resolved', type: 'datetime' } as FieldDef,
  closed_at: { key: 'closed_at', label: 'Closed', type: 'datetime', readOnly: true } as FieldDef,
  root_cause: { key: 'root_cause', label: 'Root cause', type: 'longtext' } as FieldDef,
  resolution: { key: 'resolution', label: 'Resolution', type: 'longtext' } as FieldDef,
  internal_notes: { key: 'internal_notes', label: 'Internal notes', type: 'longtext' } as FieldDef,
  public_update: { key: 'public_update', label: 'Public status update', type: 'longtext' } as FieldDef,
};

export const INCIDENT_FIELDS = FIELDS;

export const INCIDENT_LAYOUT: ObjectLayout = {
  sections: [
    { title: 'Incident Information', fields: [FIELDS.incident_number, FIELDS.title, FIELDS.status, FIELDS.severity] },
    { title: 'Description', fields: [FIELDS.description] },
    { title: 'Timeline', fields: [FIELDS.started_at, FIELDS.identified_at, FIELDS.resolved_at, FIELDS.closed_at] },
    { title: 'Resolution', fields: [FIELDS.root_cause, FIELDS.resolution] },
    { title: 'Communication', fields: [FIELDS.internal_notes, FIELDS.public_update] },
    { title: 'Ownership', fields: OWNERSHIP_FIELDS },
    SYSTEM_SECTION,
  ],
};

export const INCIDENT_LIST_COLUMNS = [
  FIELDS.incident_number,
  FIELDS.title,
  FIELDS.status,
  FIELDS.severity,
  { key: 'updated_at', label: 'Last Activity', type: 'datetime' } as FieldDef,
];

export const INCIDENT_SEARCH_FIELDS = ['incident_number', 'title'];
