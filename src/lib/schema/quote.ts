import { QUOTE_STATUSES } from '@/lib/types';

import { OWNERSHIP_FIELDS, SYSTEM_SECTION, toneMap } from './helpers';
import type { FieldDef, ObjectLayout } from './types';

export const quoteStatusTone = toneMap({
  draft: 'outline',
  sent: 'secondary',
  accepted: 'default',
  declined: 'destructive',
  expired: 'destructive',
});

const entityLookup = (key: string, label: string, required = false): FieldDef => ({
  key,
  label,
  type: 'lookup',
  required,
  lookup: { resource: 'entities', labelOf: (row: Record<string, unknown>) => String(row.name) },
});

const personLookup = (key: string, label: string): FieldDef => ({
  key,
  label,
  type: 'lookup',
  lookup: {
    resource: 'persons',
    labelOf: (row: Record<string, unknown>) => [row.first_name, row.last_name].filter(Boolean).join(' '),
  },
});

const FIELDS = {
  quote_number: { key: 'quote_number', label: 'Quote number', type: 'text', required: true } as FieldDef,
  name: { key: 'name', label: 'Quote name', type: 'text', required: true } as FieldDef,
  // The party that buys, the party that pays, and the party that takes delivery
  // are three roles that often belong to three different organizations.
  entity_id: entityLookup('entity_id', 'Customer', true),
  bill_to_entity_id: entityLookup('bill_to_entity_id', 'Bill to'),
  ship_to_entity_id: entityLookup('ship_to_entity_id', 'Ship to'),
  primary_contact_person_id: personLookup('primary_contact_person_id', 'Primary contact'),
  billing_contact_person_id: personLookup('billing_contact_person_id', 'Billing contact'),
  deal_id: {
    key: 'deal_id',
    label: 'Deal',
    type: 'lookup',
    lookup: { resource: 'deals', labelOf: (row: Record<string, unknown>) => String(row.name) },
  } as FieldDef,
  status: {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: QUOTE_STATUSES,
    required: true,
    badgeTone: quoteStatusTone,
  } as FieldDef,
  currency_code: { key: 'currency_code', label: 'Currency', type: 'text' } as FieldDef,
  subtotal_amount: { key: 'subtotal_amount', label: 'Subtotal', type: 'currency', readOnly: true } as FieldDef,
  discount_amount: { key: 'discount_amount', label: 'Discount', type: 'currency', readOnly: true } as FieldDef,
  tax_amount: { key: 'tax_amount', label: 'Tax', type: 'currency', readOnly: true } as FieldDef,
  total_amount: { key: 'total_amount', label: 'Total', type: 'currency', readOnly: true } as FieldDef,
  valid_from: { key: 'valid_from', label: 'Valid from', type: 'date' } as FieldDef,
  valid_until: { key: 'valid_until', label: 'Valid until', type: 'date' } as FieldDef,
  payment_terms: { key: 'payment_terms', label: 'Payment terms', type: 'text', placeholder: 'Net 30' } as FieldDef,
  contract_term_months: { key: 'contract_term_months', label: 'Contract term (months)', type: 'number' } as FieldDef,
  sent_at: { key: 'sent_at', label: 'Sent at', type: 'datetime' } as FieldDef,
  accepted_at: { key: 'accepted_at', label: 'Accepted at', type: 'datetime', readOnly: true } as FieldDef,
  declined_at: { key: 'declined_at', label: 'Declined at', type: 'datetime', readOnly: true } as FieldDef,
  decline_reason: { key: 'decline_reason', label: 'Decline reason', type: 'longtext' } as FieldDef,
  terms: { key: 'terms', label: 'Terms', type: 'longtext' } as FieldDef,
  notes: { key: 'notes', label: 'Internal notes', type: 'longtext' } as FieldDef,
};

export const QUOTE_FIELDS = FIELDS;

export const QUOTE_LAYOUT: ObjectLayout = {
  sections: [
    {
      title: 'Quote Information',
      fields: [FIELDS.quote_number, FIELDS.name, FIELDS.entity_id, FIELDS.deal_id, FIELDS.status, FIELDS.currency_code],
    },
    {
      title: 'Parties',
      fields: [
        FIELDS.bill_to_entity_id,
        FIELDS.ship_to_entity_id,
        FIELDS.primary_contact_person_id,
        FIELDS.billing_contact_person_id,
      ],
    },
    {
      title: 'Amounts',
      fields: [FIELDS.subtotal_amount, FIELDS.discount_amount, FIELDS.tax_amount, FIELDS.total_amount],
    },
    {
      title: 'Terms',
      fields: [
        FIELDS.valid_from,
        FIELDS.valid_until,
        FIELDS.payment_terms,
        FIELDS.contract_term_months,
        FIELDS.sent_at,
        FIELDS.accepted_at,
        FIELDS.declined_at,
        FIELDS.decline_reason,
      ],
    },
    { title: 'Ownership', fields: OWNERSHIP_FIELDS },
    { title: 'Additional Information', fields: [FIELDS.terms, FIELDS.notes] },
    SYSTEM_SECTION,
  ],
};

export const QUOTE_LIST_COLUMNS = [
  FIELDS.quote_number,
  FIELDS.name,
  FIELDS.entity_id,
  FIELDS.status,
  FIELDS.total_amount,
  FIELDS.valid_until,
];

export const QUOTE_SEARCH_FIELDS = ['name', 'quote_number'];
