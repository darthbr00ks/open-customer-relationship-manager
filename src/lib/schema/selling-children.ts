import {
  AMENDMENT_TYPES,
  BILLING_PERIODS,
  CHARGE_TYPES,
  DISCOUNT_TYPES,
  INVENTORY_STATUSES,
  MILESTONE_STATUSES,
  PRICING_MODELS,
  SERVICE_SCOPES,
  SHIPMENT_STATUSES,
} from '@/lib/types';

import { toneMap } from './helpers';
import type { FieldDef } from './types';

/**
 * Field definitions for the records that hang off a catalog or transaction
 * record — prices, tiers, stock, bundle components, lines, milestones.
 *
 * These are not top-level objects: nobody browses a list of price tiers, they
 * edit one on the price it belongs to. So they get field lists rather than a
 * full `ObjectConfig`, and `ChildFormDialog` renders them with the same
 * `FieldInput` every other form uses.
 */

export const shipmentStatusTone = toneMap({
  pending: 'outline',
  packed: 'outline',
  shipped: 'secondary',
  in_transit: 'secondary',
  delivered: 'default',
  returned: 'destructive',
  canceled: 'destructive',
});

export const milestoneStatusTone = toneMap({
  pending: 'outline',
  in_progress: 'secondary',
  completed: 'secondary',
  accepted: 'default',
  canceled: 'destructive',
});

const offeringLookup = (key: string, label: string, required = false): FieldDef => ({
  key,
  label,
  type: 'lookup',
  required,
  lookup: {
    resource: 'offerings',
    labelOf: (row: Record<string, unknown>) => `${row.sku} · ${row.name}`,
  },
});

/** One charge on an offering. Several of these can be valid at once. */
export const PRICE_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Charge name', type: 'text', placeholder: 'Setup fee, Monthly, Overage…' },
  { key: 'charge_type', label: 'Charge type', type: 'select', options: CHARGE_TYPES, required: true },
  { key: 'unit_of_measure', label: 'Charge unit', type: 'text', helpText: "Only when it differs from the offering's unit — a per-seat plan metering API calls." },
  { key: 'pricing_model', label: 'Pricing model', type: 'select', options: PRICING_MODELS, required: true },
  { key: 'unit_amount', label: 'Amount', type: 'currency', helpText: 'Per unit, or the whole charge when the model is flat.' },
  { key: 'currency_code', label: 'Currency', type: 'text', required: true },
  { key: 'billing_period', label: 'Billing period', type: 'select', options: BILLING_PERIODS },
  { key: 'billing_interval_count', label: 'Every', type: 'number', helpText: '3 with "month" bills quarterly.' },
  { key: 'minimum_quantity', label: 'Minimum quantity', type: 'number' },
  { key: 'included_quantity', label: 'Included quantity', type: 'number', helpText: 'Covered by the base amount before this charge starts.' },
  // Superseding a price means closing this window and adding a new row, so a
  // transaction priced last year still resolves to last year's number.
  { key: 'effective_from', label: 'Effective from', type: 'date' },
  { key: 'effective_until', label: 'Effective until', type: 'date' },
];

/** One band of a tiered, volume, or graduated price. */
export const PRICE_TIER_FIELDS: FieldDef[] = [
  { key: 'up_to', label: 'Up to', type: 'number', helpText: 'Leave empty for the final "and above" band.' },
  { key: 'unit_amount', label: 'Per unit', type: 'currency' },
  { key: 'flat_amount', label: 'Band fee', type: 'currency', helpText: 'Charged once for reaching this band.' },
];

export const INVENTORY_ITEM_FIELDS: FieldDef[] = [
  { key: 'location_code', label: 'Location', type: 'text', required: true, placeholder: 'WH-1' },
  { key: 'location_name', label: 'Location name', type: 'text' },
  { key: 'quantity_on_hand', label: 'On hand', type: 'number' },
  { key: 'quantity_reserved', label: 'Reserved', type: 'number', helpText: 'Held for orders that have not shipped.' },
  { key: 'reorder_point', label: 'Reorder point', type: 'number' },
  { key: 'status', label: 'Status', type: 'select', options: INVENTORY_STATUSES },
  { key: 'lot_number', label: 'Lot number', type: 'text' },
  { key: 'requires_serial_number', label: 'Serial numbers required', type: 'boolean' },
  { key: 'requires_lot_number', label: 'Lot numbers required', type: 'boolean' },
  { key: 'notes', label: 'Notes', type: 'longtext' },
];

export const BUNDLE_COMPONENT_FIELDS: FieldDef[] = [
  offeringLookup('child_offering_id', 'Component', true),
  { key: 'default_quantity', label: 'Quantity per bundle', type: 'number' },
  { key: 'is_required', label: 'Required', type: 'boolean' },
  { key: 'is_separately_priced', label: 'Priced separately', type: 'boolean', helpText: 'Off means the bundle price covers it.' },
  { key: 'is_visible_to_customer', label: 'Shown to customer', type: 'boolean' },
  { key: 'minimum_quantity', label: 'Minimum quantity', type: 'number' },
  { key: 'maximum_quantity', label: 'Maximum quantity', type: 'number' },
  { key: 'sort_order', label: 'Order', type: 'number' },
];

export const SERVICE_DEFINITION_FIELDS: FieldDef[] = [
  { key: 'scope_type', label: 'Scope', type: 'select', options: SERVICE_SCOPES },
  { key: 'estimated_hours', label: 'Estimated hours', type: 'number' },
  { key: 'delivery_location', label: 'Delivery location', type: 'text' },
  { key: 'required_skills', label: 'Required skills', type: 'text' },
  { key: 'scope_summary', label: 'Scope summary', type: 'longtext' },
  { key: 'service_level_agreement', label: 'Service level agreement', type: 'longtext' },
  { key: 'included_deliverables', label: 'Included deliverables', type: 'longtext' },
  { key: 'scheduling_notes', label: 'Scheduling notes', type: 'longtext' },
  { key: 'cancellation_policy', label: 'Cancellation policy', type: 'longtext' },
];

/** What a salesperson is considering on a deal — priced from the live catalog. */
export const DEAL_LINE_FIELDS: FieldDef[] = [
  offeringLookup('offering_id', 'Offering', true),
  { key: 'name', label: 'Label', type: 'text', required: true },
  { key: 'quantity', label: 'Quantity', type: 'number', required: true },
  { key: 'unit_amount', label: 'Negotiated unit price', type: 'currency', helpText: 'Leave empty to use the catalog price.' },
  { key: 'term_months', label: 'Term (months)', type: 'number' },
  { key: 'discount_type', label: 'Discount type', type: 'select', options: DISCOUNT_TYPES },
  { key: 'discount_value', label: 'Discount value', type: 'number' },
  { key: 'currency_code', label: 'Currency', type: 'text' },
  { key: 'sort_order', label: 'Order', type: 'number' },
  { key: 'notes', label: 'Notes', type: 'longtext' },
];

export const SHIPMENT_FIELDS: FieldDef[] = [
  { key: 'shipment_number', label: 'Shipment number', type: 'text', required: true },
  { key: 'status', label: 'Status', type: 'select', options: SHIPMENT_STATUSES },
  { key: 'carrier', label: 'Carrier', type: 'text' },
  { key: 'service_level', label: 'Service level', type: 'text' },
  { key: 'tracking_number', label: 'Tracking number', type: 'text' },
  { key: 'tracking_url', label: 'Tracking URL', type: 'url' },
  { key: 'ship_from_location_code', label: 'Ship from', type: 'text', helpText: 'Inventory location the stock leaves.' },
  { key: 'ship_to_name', label: 'Deliver to', type: 'text' },
  { key: 'ship_to_address_line_1', label: 'Address line 1', type: 'text' },
  { key: 'ship_to_address_line_2', label: 'Address line 2', type: 'text' },
  { key: 'ship_to_city', label: 'City', type: 'text' },
  { key: 'ship_to_region', label: 'Region', type: 'text' },
  { key: 'ship_to_postal_code', label: 'Postal code', type: 'text' },
  { key: 'ship_to_country_code', label: 'Country', type: 'text' },
  { key: 'is_return', label: 'Return', type: 'boolean' },
  { key: 'return_reason', label: 'Return reason', type: 'longtext' },
  { key: 'notes', label: 'Notes', type: 'longtext' },
];

export const SHIPMENT_LINE_FIELDS: FieldDef[] = [
  { key: 'quantity', label: 'Quantity', type: 'number', required: true },
  { key: 'backordered_quantity', label: 'Backordered', type: 'number' },
  { key: 'serial_numbers', label: 'Serial numbers', type: 'text', helpText: 'Comma-separated.' },
  { key: 'lot_number', label: 'Lot number', type: 'text' },
  { key: 'notes', label: 'Notes', type: 'longtext' },
];

export const SERVICE_MILESTONE_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Milestone', type: 'text', required: true },
  { key: 'sequence', label: 'Sequence', type: 'number' },
  { key: 'status', label: 'Status', type: 'select', options: MILESTONE_STATUSES },
  { key: 'billing_percent', label: 'Billing %', type: 'number', helpText: '30 at kickoff, 40 at delivery, 30 at completion.' },
  { key: 'billing_amount', label: 'Billing amount', type: 'currency' },
  { key: 'due_on', label: 'Due on', type: 'date' },
  { key: 'completed_at', label: 'Completed at', type: 'datetime' },
  { key: 'accepted_at', label: 'Accepted at', type: 'datetime' },
  { key: 'notes', label: 'Notes', type: 'longtext' },
];

export const ENTITLEMENT_FIELDS: FieldDef[] = [
  { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'seats, storage_gb…' },
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'unit_of_measure', label: 'Unit', type: 'text' },
  { key: 'included_quantity', label: 'Included', type: 'number' },
  { key: 'is_unlimited', label: 'Unlimited', type: 'boolean' },
  { key: 'overage_unit_amount', label: 'Overage per unit', type: 'currency' },
  { key: 'currency_code', label: 'Currency', type: 'text' },
  { key: 'effective_from', label: 'Effective from', type: 'date' },
  { key: 'effective_until', label: 'Effective until', type: 'date' },
  { key: 'notes', label: 'Notes', type: 'longtext' },
];

export const USAGE_RECORD_FIELDS: FieldDef[] = [
  { key: 'metric_code', label: 'Metric', type: 'text', required: true },
  { key: 'quantity', label: 'Quantity', type: 'number', required: true },
  { key: 'unit_of_measure', label: 'Unit', type: 'text' },
  { key: 'occurred_at', label: 'Occurred at', type: 'datetime' },
  { key: 'source', label: 'Source', type: 'text' },
  { key: 'external_reference', label: 'External reference', type: 'text' },
  { key: 'notes', label: 'Notes', type: 'longtext' },
];

/** The body `POST /api/v1/subscriptions/{id}/amend` takes, as form fields. */
export const AMENDMENT_FIELDS: FieldDef[] = [
  { key: 'amendment_type', label: 'Change', type: 'select', options: AMENDMENT_TYPES, required: true },
  { key: 'effective_date', label: 'Effective date', type: 'date' },
  { key: 'quantity', label: 'New quantity', type: 'number', helpText: 'For a quantity change.' },
  { key: 'unit_amount', label: 'New unit price', type: 'currency', helpText: 'For a price or plan change.' },
  offeringLookup('offering_id', 'New offering'),
  { key: 'billing_period', label: 'New billing period', type: 'select', options: BILLING_PERIODS },
  { key: 'billing_interval_count', label: 'Every', type: 'number' },
  { key: 'commitment_end_date', label: 'Commitment ends', type: 'date' },
  { key: 'at_period_end', label: 'At period end', type: 'boolean', helpText: 'Cancel after the period the customer already paid for.' },
  { key: 'resumes_on', label: 'Resumes on', type: 'date' },
  { key: 'reason', label: 'Reason', type: 'longtext' },
];
