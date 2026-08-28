import { SERVICE_DELIVERY_STATUSES } from '@/lib/types';

import { OWNERSHIP_FIELDS, SYSTEM_SECTION, toneMap } from './helpers';
import type { FieldDef, ObjectLayout } from './types';

export const serviceDeliveryStatusTone = toneMap({
  not_started: 'outline',
  scheduled: 'outline',
  in_progress: 'secondary',
  blocked: 'destructive',
  completed: 'secondary',
  accepted: 'default',
  canceled: 'destructive',
});

const FIELDS = {
  delivery_number: { key: 'delivery_number', label: 'Delivery number', type: 'text', required: true } as FieldDef,
  name: { key: 'name', label: 'Engagement', type: 'text', required: true } as FieldDef,
  // The service recipient, which need not be the entity that paid for the work.
  entity_id: {
    key: 'entity_id',
    label: 'Service recipient',
    type: 'lookup',
    required: true,
    lookup: { resource: 'entities', labelOf: (row: Record<string, unknown>) => String(row.name) },
  } as FieldDef,
  contact_person_id: {
    key: 'contact_person_id',
    label: 'Contact',
    type: 'lookup',
    lookup: {
      resource: 'persons',
      labelOf: (row: Record<string, unknown>) => [row.first_name, row.last_name].filter(Boolean).join(' '),
    },
  } as FieldDef,
  order_id: {
    key: 'order_id',
    label: 'Order',
    type: 'lookup',
    lookup: { resource: 'orders', labelOf: (row: Record<string, unknown>) => String(row.order_number) },
  } as FieldDef,
  offering_id: {
    key: 'offering_id',
    label: 'Offering',
    type: 'lookup',
    lookup: { resource: 'offerings', labelOf: (row: Record<string, unknown>) => String(row.name) },
  } as FieldDef,
  status: {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: SERVICE_DELIVERY_STATUSES,
    required: true,
    badgeTone: serviceDeliveryStatusTone,
  } as FieldDef,
  assigned_user_id: { key: 'assigned_user_id', label: 'Assigned to', type: 'user' } as FieldDef,
  assigned_team: { key: 'assigned_team', label: 'Team', type: 'text' } as FieldDef,
  scheduled_start_at: { key: 'scheduled_start_at', label: 'Scheduled start', type: 'datetime' } as FieldDef,
  scheduled_end_at: { key: 'scheduled_end_at', label: 'Scheduled end', type: 'datetime' } as FieldDef,
  actual_start_at: { key: 'actual_start_at', label: 'Actual start', type: 'datetime' } as FieldDef,
  actual_end_at: { key: 'actual_end_at', label: 'Actual end', type: 'datetime' } as FieldDef,
  estimated_hours: { key: 'estimated_hours', label: 'Estimated hours', type: 'number' } as FieldDef,
  hours_consumed: { key: 'hours_consumed', label: 'Hours consumed', type: 'number' } as FieldDef,
  delivery_location: { key: 'delivery_location', label: 'Location', type: 'text' } as FieldDef,
  service_level_agreement: { key: 'service_level_agreement', label: 'SLA', type: 'longtext' } as FieldDef,
  customer_accepted_at: { key: 'customer_accepted_at', label: 'Customer accepted', type: 'datetime' } as FieldDef,
  acceptance_notes: { key: 'acceptance_notes', label: 'Acceptance notes', type: 'longtext' } as FieldDef,
  case_id: {
    key: 'case_id',
    label: 'Related case',
    type: 'lookup',
    lookup: { resource: 'cases', labelOf: (row: Record<string, unknown>) => String(row.subject) },
  } as FieldDef,
  incident_id: {
    key: 'incident_id',
    label: 'Related incident',
    type: 'lookup',
    lookup: { resource: 'incidents', labelOf: (row: Record<string, unknown>) => String(row.title) },
  } as FieldDef,
  notes: { key: 'notes', label: 'Internal notes', type: 'longtext' } as FieldDef,
};

export const SERVICE_DELIVERY_FIELDS = FIELDS;

export const SERVICE_DELIVERY_LAYOUT: ObjectLayout = {
  sections: [
    {
      title: 'Engagement',
      fields: [FIELDS.delivery_number, FIELDS.name, FIELDS.entity_id, FIELDS.contact_person_id, FIELDS.status],
    },
    { title: 'Assignment', fields: [FIELDS.assigned_user_id, FIELDS.assigned_team, FIELDS.delivery_location] },
    {
      title: 'Schedule',
      fields: [
        FIELDS.scheduled_start_at,
        FIELDS.scheduled_end_at,
        FIELDS.actual_start_at,
        FIELDS.actual_end_at,
        FIELDS.estimated_hours,
        FIELDS.hours_consumed,
      ],
    },
    { title: 'Acceptance', fields: [FIELDS.customer_accepted_at, FIELDS.acceptance_notes, FIELDS.service_level_agreement] },
    { title: 'Origin', fields: [FIELDS.order_id, FIELDS.offering_id, FIELDS.case_id, FIELDS.incident_id] },
    { title: 'Ownership', fields: OWNERSHIP_FIELDS },
    { title: 'Additional Information', fields: [FIELDS.notes] },
    SYSTEM_SECTION,
  ],
};

export const SERVICE_DELIVERY_LIST_COLUMNS = [
  FIELDS.delivery_number,
  FIELDS.name,
  FIELDS.entity_id,
  FIELDS.status,
  FIELDS.assigned_user_id,
  FIELDS.scheduled_start_at,
];

export const SERVICE_DELIVERY_SEARCH_FIELDS = ['name', 'delivery_number'];
