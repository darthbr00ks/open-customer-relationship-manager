import { FULFILLMENT_POLICIES, OFFERING_TYPES } from '@/lib/types';

import { OWNERSHIP_FIELDS, SYSTEM_SECTION, toneMap } from './helpers';
import type { FieldDef, ObjectLayout } from './types';

export const offeringTypeTone = toneMap({
  good: 'outline',
  service: 'secondary',
  subscription: 'default',
  bundle: 'secondary',
});

const FIELDS = {
  name: { key: 'name', label: 'Offering name', type: 'text', required: true } as FieldDef,
  sku: { key: 'sku', label: 'SKU', type: 'text', required: true, helpText: 'Unique catalog code.' } as FieldDef,
  product_id: {
    key: 'product_id',
    label: 'Product',
    type: 'lookup',
    required: true,
    lookup: { resource: 'products', labelOf: (row: Record<string, unknown>) => String(row.name) },
  } as FieldDef,
  offering_type: {
    key: 'offering_type',
    label: 'Type',
    type: 'select',
    options: OFFERING_TYPES,
    required: true,
    badgeTone: offeringTypeTone,
    helpText: 'Decides what an order line becomes: a shipment, an engagement, or a subscription.',
  } as FieldDef,
  unit_of_measure: {
    key: 'unit_of_measure',
    label: 'Unit',
    type: 'text',
    placeholder: 'each, hour, user, gigabyte…',
  } as FieldDef,
  fulfillment_policy: {
    key: 'fulfillment_policy',
    label: 'Fulfillment',
    type: 'select',
    options: FULFILLMENT_POLICIES,
  } as FieldDef,
  active_from: { key: 'active_from', label: 'Sellable from', type: 'date' } as FieldDef,
  active_until: { key: 'active_until', label: 'Sellable until', type: 'date' } as FieldDef,
  description: { key: 'description', label: 'Description', type: 'longtext' } as FieldDef,
  notes: { key: 'notes', label: 'Internal notes', type: 'longtext' } as FieldDef,
};

export const OFFERING_FIELDS = FIELDS;

export const OFFERING_LAYOUT: ObjectLayout = {
  sections: [
    {
      title: 'Offering Information',
      fields: [FIELDS.name, FIELDS.sku, FIELDS.product_id, FIELDS.offering_type, FIELDS.unit_of_measure, FIELDS.fulfillment_policy],
    },
    { title: 'Availability', fields: [FIELDS.active_from, FIELDS.active_until] },
    { title: 'Ownership', fields: OWNERSHIP_FIELDS },
    { title: 'Additional Information', fields: [FIELDS.description, FIELDS.notes] },
    SYSTEM_SECTION,
  ],
};

export const OFFERING_LIST_COLUMNS = [
  FIELDS.sku,
  FIELDS.name,
  FIELDS.product_id,
  FIELDS.offering_type,
  FIELDS.unit_of_measure,
];

export const OFFERING_SEARCH_FIELDS = ['name', 'sku'];
