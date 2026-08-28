import { BILLING_STATUSES, FULFILLMENT_STATUSES, ORDER_STATUSES } from '@/lib/types';

import { OWNERSHIP_FIELDS, SYSTEM_SECTION, toneMap } from './helpers';
import type { FieldDef, ObjectLayout } from './types';

export const orderStatusTone = toneMap({
  draft: 'outline',
  open: 'secondary',
  completed: 'default',
  canceled: 'destructive',
});

export const fulfillmentStatusTone = toneMap({
  not_started: 'outline',
  in_progress: 'secondary',
  partially_fulfilled: 'secondary',
  fulfilled: 'default',
  returned: 'destructive',
  canceled: 'destructive',
});

export const billingStatusTone = toneMap({
  not_invoiced: 'outline',
  invoiced: 'secondary',
  partially_paid: 'secondary',
  paid: 'default',
  refunded: 'destructive',
});

const entityLookup = (key: string, label: string, required = false): FieldDef => ({
  key,
  label,
  type: 'lookup',
  required,
  lookup: { resource: 'entities', labelOf: (row: Record<string, unknown>) => String(row.name) },
});

const FIELDS = {
  order_number: { key: 'order_number', label: 'Order number', type: 'text', required: true } as FieldDef,
  entity_id: entityLookup('entity_id', 'Customer', true),
  bill_to_entity_id: entityLookup('bill_to_entity_id', 'Bill to'),
  ship_to_entity_id: entityLookup('ship_to_entity_id', 'Ship to'),
  quote_id: {
    key: 'quote_id',
    label: 'Quote',
    type: 'lookup',
    lookup: { resource: 'quotes', labelOf: (row: Record<string, unknown>) => String(row.quote_number) },
  } as FieldDef,
  // Three statuses, because an order can be paid but not shipped, or shipped
  // but not invoiced, and one field cannot say both.
  status: { key: 'status', label: 'Status', type: 'select', options: ORDER_STATUSES, badgeTone: orderStatusTone } as FieldDef,
  fulfillment_status: {
    key: 'fulfillment_status',
    label: 'Fulfillment',
    type: 'select',
    options: FULFILLMENT_STATUSES,
    badgeTone: fulfillmentStatusTone,
  } as FieldDef,
  billing_status: {
    key: 'billing_status',
    label: 'Billing',
    type: 'select',
    options: BILLING_STATUSES,
    badgeTone: billingStatusTone,
  } as FieldDef,
  currency_code: { key: 'currency_code', label: 'Currency', type: 'text' } as FieldDef,
  subtotal_amount: { key: 'subtotal_amount', label: 'Subtotal', type: 'currency', readOnly: true } as FieldDef,
  discount_amount: { key: 'discount_amount', label: 'Discount', type: 'currency', readOnly: true } as FieldDef,
  tax_amount: { key: 'tax_amount', label: 'Tax', type: 'currency', readOnly: true } as FieldDef,
  total_amount: { key: 'total_amount', label: 'Total', type: 'currency', readOnly: true } as FieldDef,
  ordered_at: { key: 'ordered_at', label: 'Ordered at', type: 'datetime' } as FieldDef,
  payment_terms: { key: 'payment_terms', label: 'Payment terms', type: 'text' } as FieldDef,
  purchase_order_number: { key: 'purchase_order_number', label: 'Customer PO', type: 'text' } as FieldDef,
  ship_to_name: { key: 'ship_to_name', label: 'Deliver to', type: 'text' } as FieldDef,
  ship_to_address_line_1: { key: 'ship_to_address_line_1', label: 'Address line 1', type: 'text' } as FieldDef,
  ship_to_address_line_2: { key: 'ship_to_address_line_2', label: 'Address line 2', type: 'text' } as FieldDef,
  ship_to_city: { key: 'ship_to_city', label: 'City', type: 'text' } as FieldDef,
  ship_to_region: { key: 'ship_to_region', label: 'Region', type: 'text' } as FieldDef,
  ship_to_postal_code: { key: 'ship_to_postal_code', label: 'Postal code', type: 'text' } as FieldDef,
  ship_to_country_code: { key: 'ship_to_country_code', label: 'Country', type: 'text' } as FieldDef,
  cancellation_reason: { key: 'cancellation_reason', label: 'Cancellation reason', type: 'longtext' } as FieldDef,
  notes: { key: 'notes', label: 'Internal notes', type: 'longtext' } as FieldDef,
};

export const ORDER_FIELDS = FIELDS;

export const ORDER_LAYOUT: ObjectLayout = {
  sections: [
    {
      title: 'Order Information',
      fields: [FIELDS.order_number, FIELDS.entity_id, FIELDS.quote_id, FIELDS.ordered_at, FIELDS.purchase_order_number],
    },
    { title: 'Status', fields: [FIELDS.status, FIELDS.fulfillment_status, FIELDS.billing_status] },
    {
      title: 'Amounts',
      fields: [FIELDS.currency_code, FIELDS.subtotal_amount, FIELDS.discount_amount, FIELDS.tax_amount, FIELDS.total_amount],
    },
    { title: 'Parties', fields: [FIELDS.bill_to_entity_id, FIELDS.ship_to_entity_id, FIELDS.payment_terms] },
    {
      title: 'Delivery Address',
      fields: [
        FIELDS.ship_to_name,
        FIELDS.ship_to_address_line_1,
        FIELDS.ship_to_address_line_2,
        FIELDS.ship_to_city,
        FIELDS.ship_to_region,
        FIELDS.ship_to_postal_code,
        FIELDS.ship_to_country_code,
      ],
    },
    { title: 'Ownership', fields: OWNERSHIP_FIELDS },
    { title: 'Additional Information', fields: [FIELDS.cancellation_reason, FIELDS.notes] },
    SYSTEM_SECTION,
  ],
};

export const ORDER_LIST_COLUMNS = [
  FIELDS.order_number,
  FIELDS.entity_id,
  FIELDS.status,
  FIELDS.fulfillment_status,
  FIELDS.billing_status,
  FIELDS.total_amount,
];

export const ORDER_SEARCH_FIELDS = ['order_number', 'purchase_order_number'];
