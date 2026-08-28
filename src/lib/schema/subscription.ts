import { BILLING_PERIODS, SUBSCRIPTION_STATUSES } from '@/lib/types';

import { OWNERSHIP_FIELDS, SYSTEM_SECTION, toneMap } from './helpers';
import type { FieldDef, ObjectLayout } from './types';

export const subscriptionStatusTone = toneMap({
  trial: 'outline',
  active: 'default',
  paused: 'secondary',
  past_due: 'destructive',
  canceled: 'destructive',
  expired: 'destructive',
});

const FIELDS = {
  subscription_number: { key: 'subscription_number', label: 'Subscription number', type: 'text', required: true } as FieldDef,
  name: { key: 'name', label: 'Subscription', type: 'text', required: true } as FieldDef,
  entity_id: {
    key: 'entity_id',
    label: 'Customer',
    type: 'lookup',
    required: true,
    lookup: { resource: 'entities', labelOf: (row: Record<string, unknown>) => String(row.name) },
  } as FieldDef,
  offering_id: {
    key: 'offering_id',
    label: 'Offering',
    type: 'lookup',
    lookup: { resource: 'offerings', labelOf: (row: Record<string, unknown>) => String(row.name) },
  } as FieldDef,
  order_id: {
    key: 'order_id',
    label: 'Original order',
    type: 'lookup',
    lookup: { resource: 'orders', labelOf: (row: Record<string, unknown>) => String(row.order_number) },
  } as FieldDef,
  status: {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: SUBSCRIPTION_STATUSES,
    required: true,
    badgeTone: subscriptionStatusTone,
  } as FieldDef,
  quantity: { key: 'quantity', label: 'Quantity', type: 'number' } as FieldDef,
  unit_of_measure: { key: 'unit_of_measure', label: 'Unit', type: 'text' } as FieldDef,
  unit_amount: { key: 'unit_amount', label: 'Unit price', type: 'currency' } as FieldDef,
  currency_code: { key: 'currency_code', label: 'Currency', type: 'text' } as FieldDef,
  billing_period: { key: 'billing_period', label: 'Billing period', type: 'select', options: BILLING_PERIODS } as FieldDef,
  billing_interval_count: {
    key: 'billing_interval_count',
    label: 'Every',
    type: 'number',
    helpText: 'Number of billing periods between invoices — 3 with "month" bills quarterly.',
  } as FieldDef,
  start_date: { key: 'start_date', label: 'Start date', type: 'date', required: true } as FieldDef,
  end_date: { key: 'end_date', label: 'End date', type: 'date' } as FieldDef,
  current_period_start: { key: 'current_period_start', label: 'Period start', type: 'date' } as FieldDef,
  current_period_end: { key: 'current_period_end', label: 'Period end', type: 'date' } as FieldDef,
  // How long the customer is committed is a different question from how often
  // they are billed: a one-year commitment can be invoiced monthly.
  commitment_end_date: { key: 'commitment_end_date', label: 'Commitment ends', type: 'date' } as FieldDef,
  trial_end_date: { key: 'trial_end_date', label: 'Trial ends', type: 'date' } as FieldDef,
  auto_renew: { key: 'auto_renew', label: 'Auto-renew', type: 'boolean' } as FieldDef,
  paused_at: { key: 'paused_at', label: 'Paused at', type: 'datetime', readOnly: true } as FieldDef,
  resumes_on: { key: 'resumes_on', label: 'Resumes on', type: 'date' } as FieldDef,
  canceled_at: { key: 'canceled_at', label: 'Cancellation requested', type: 'datetime', readOnly: true } as FieldDef,
  cancellation_effective_date: { key: 'cancellation_effective_date', label: 'Service ends', type: 'date' } as FieldDef,
  cancellation_reason: { key: 'cancellation_reason', label: 'Cancellation reason', type: 'longtext' } as FieldDef,
  notes: { key: 'notes', label: 'Internal notes', type: 'longtext' } as FieldDef,
};

export const SUBSCRIPTION_FIELDS = FIELDS;

export const SUBSCRIPTION_LAYOUT: ObjectLayout = {
  sections: [
    {
      title: 'Subscription Information',
      fields: [FIELDS.subscription_number, FIELDS.name, FIELDS.entity_id, FIELDS.offering_id, FIELDS.order_id, FIELDS.status],
    },
    {
      title: 'Billing',
      fields: [
        FIELDS.quantity,
        FIELDS.unit_of_measure,
        FIELDS.unit_amount,
        FIELDS.currency_code,
        FIELDS.billing_period,
        FIELDS.billing_interval_count,
      ],
    },
    {
      title: 'Term',
      fields: [
        FIELDS.start_date,
        FIELDS.current_period_start,
        FIELDS.current_period_end,
        FIELDS.commitment_end_date,
        FIELDS.trial_end_date,
        FIELDS.auto_renew,
        FIELDS.end_date,
      ],
    },
    {
      title: 'Pause and Cancellation',
      fields: [
        FIELDS.paused_at,
        FIELDS.resumes_on,
        FIELDS.canceled_at,
        FIELDS.cancellation_effective_date,
        FIELDS.cancellation_reason,
      ],
    },
    { title: 'Ownership', fields: OWNERSHIP_FIELDS },
    { title: 'Additional Information', fields: [FIELDS.notes] },
    SYSTEM_SECTION,
  ],
};

export const SUBSCRIPTION_LIST_COLUMNS = [
  FIELDS.subscription_number,
  FIELDS.name,
  FIELDS.entity_id,
  FIELDS.status,
  FIELDS.quantity,
  FIELDS.current_period_end,
];

export const SUBSCRIPTION_SEARCH_FIELDS = ['name', 'subscription_number'];
