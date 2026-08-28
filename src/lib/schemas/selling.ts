import { z } from 'zod';

import { day, decimal, sharedCreate, sharedUpdate, ts, uuid } from '@/lib/schemas/common';

/**
 * Validation for the selling model: catalog (Product, Offering, Price),
 * transactions (Deal/Quote/Order lines), and delivery (shipments, service
 * deliveries, subscriptions).
 */

/* -------------------------------------------------------------------------- */
/* Shared vocabulary                                                           */
/* -------------------------------------------------------------------------- */

const offeringType = () => z.enum(['good', 'service', 'subscription', 'bundle']);
const chargeType = () => z.enum(['one_time', 'recurring', 'usage']);
const pricingModel = () => z.enum(['flat', 'per_unit', 'tiered', 'volume', 'graduated']);
const billingPeriod = () => z.enum(['day', 'week', 'month', 'quarter', 'year']);
const fulfillmentPolicy = () => z.enum(['shipping', 'digital_activation', 'scheduled_work', 'none']);
const fulfillmentStatus = () =>
  z.enum(['not_started', 'in_progress', 'partially_fulfilled', 'fulfilled', 'returned', 'canceled']);
const discountType = () => z.enum(['percentage', 'fixed_amount']);
const currency = () => z.string().length(3);
const unitOfMeasure = () => z.string().max(50);

/** The snapshot every transaction line carries, so a catalog change cannot rewrite history. */
const lineSnapshotFields = {
  offering_id: uuid().nullish(),
  price_id: uuid().nullish(),
  name: z.string().max(255),
  description: z.string().nullish(),
  sku: z.string().max(64).nullish(),
  offering_type: offeringType(),
  charge_type: chargeType(),
  pricing_model: pricingModel(),
  fulfillment_policy: fulfillmentPolicy(),
  unit_of_measure: unitOfMeasure(),
  quantity: decimal(),
  unit_amount: decimal().nullish(),
  currency_code: currency(),
  billing_period: billingPeriod().nullish(),
  billing_interval_count: z.number().int().min(1),
  included_quantity: decimal().nullish(),
  term_months: z.number().int().min(0).nullish(),
  discount_type: discountType().nullish(),
  discount_value: decimal().nullish(),
  subtotal_amount: decimal(),
  discount_amount: decimal(),
  tax_amount: decimal(),
  total_amount: decimal(),
  sort_order: z.number().int(),
  notes: z.string().nullish(),
};

/** Defaults applied to a line the caller did not fully price itself. */
const lineSnapshotDefaults = {
  charge_type: lineSnapshotFields.charge_type.default('one_time'),
  pricing_model: lineSnapshotFields.pricing_model.default('flat'),
  fulfillment_policy: lineSnapshotFields.fulfillment_policy.default('none'),
  unit_of_measure: lineSnapshotFields.unit_of_measure.default('each'),
  quantity: lineSnapshotFields.quantity.default('1'),
  currency_code: lineSnapshotFields.currency_code.default('USD'),
  billing_interval_count: lineSnapshotFields.billing_interval_count.default(1),
  subtotal_amount: lineSnapshotFields.subtotal_amount.default('0'),
  discount_amount: lineSnapshotFields.discount_amount.default('0'),
  tax_amount: lineSnapshotFields.tax_amount.default('0'),
  total_amount: lineSnapshotFields.total_amount.default('0'),
  sort_order: lineSnapshotFields.sort_order.default(0),
};

/* -------------------------------------------------------------------------- */
/* Product                                                                     */
/* -------------------------------------------------------------------------- */

const productFields = {
  name: z.string().min(1).max(255),
  description: z.string().nullish(),
  category: z.string().max(100).nullish(),
  status: z.enum(['draft', 'active', 'retired', 'archived']),
  tax_category: z.string().max(100).nullish(),
  notes: z.string().nullish(),
};

export const productCreateSchema = z.object({
  ...sharedCreate,
  ...productFields,
  status: productFields.status.default('draft'),
});

export const productUpdateSchema = z.object({ ...sharedUpdate, ...productFields }).partial();

/* -------------------------------------------------------------------------- */
/* Offering                                                                    */
/* -------------------------------------------------------------------------- */

const offeringFields = {
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  description: z.string().nullish(),
  offering_type: offeringType(),
  unit_of_measure: unitOfMeasure(),
  fulfillment_policy: fulfillmentPolicy(),
  active_from: day().nullish(),
  active_until: day().nullish(),
  /** Uncommon specifications only — anything priced or counted gets a column. */
  attributes: z.record(z.string(), z.unknown()).nullish(),
  notes: z.string().nullish(),
};

export const offeringCreateSchema = z.object({
  ...sharedCreate,
  ...offeringFields,
  product_id: uuid(),
  unit_of_measure: offeringFields.unit_of_measure.default('each'),
  fulfillment_policy: offeringFields.fulfillment_policy.default('none'),
});

export const offeringUpdateSchema = z
  .object({ ...sharedUpdate, ...offeringFields, product_id: uuid() })
  .partial();

/* -------------------------------------------------------------------------- */
/* Price book and price                                                        */
/* -------------------------------------------------------------------------- */

const priceBookFields = {
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  description: z.string().nullish(),
  currency_code: currency().nullish(),
  entity_id: uuid().nullish(),
  region: z.string().max(100).nullish(),
  channel: z.string().max(100).nullish(),
  is_default: z.boolean(),
  active_from: day().nullish(),
  active_until: day().nullish(),
};

export const priceBookCreateSchema = z.object({
  workspace_id: uuid(),
  created_by_user_id: uuid().nullish(),
  updated_by_user_id: uuid().nullish(),
  archived_at: ts().nullish(),
  ...priceBookFields,
  is_default: priceBookFields.is_default.default(false),
});

export const priceBookUpdateSchema = z.object(priceBookFields).partial();

const priceFields = {
  price_book_id: uuid().nullish(),
  name: z.string().max(255).nullish(),
  unit_of_measure: unitOfMeasure().nullish(),
  currency_code: currency(),
  charge_type: chargeType(),
  pricing_model: pricingModel(),
  unit_amount: decimal().nullish(),
  billing_period: billingPeriod().nullish(),
  billing_interval_count: z.number().int().min(1),
  minimum_quantity: decimal().nullish(),
  included_quantity: decimal().nullish(),
  effective_from: day().nullish(),
  effective_until: day().nullish(),
};

export const priceCreateSchema = z.object({
  workspace_id: uuid(),
  created_by_user_id: uuid().nullish(),
  updated_by_user_id: uuid().nullish(),
  offering_id: uuid(),
  ...priceFields,
  currency_code: priceFields.currency_code.default('USD'),
  charge_type: priceFields.charge_type.default('one_time'),
  pricing_model: priceFields.pricing_model.default('flat'),
  billing_interval_count: priceFields.billing_interval_count.default(1),
});

/**
 * A price is never rewritten to change what something costs — that would
 * rewrite history on every transaction that referenced it. Superseding a price
 * means setting `effective_until` here and creating a new row.
 */
export const priceUpdateSchema = z.object(priceFields).partial();

const priceTierFields = {
  up_to: decimal().nullish(),
  unit_amount: decimal().nullish(),
  flat_amount: decimal().nullish(),
};

export const priceTierCreateSchema = z.object({
  workspace_id: uuid(),
  price_id: uuid(),
  ...priceTierFields,
});

export const priceTierUpdateSchema = z.object(priceTierFields).partial();

/* -------------------------------------------------------------------------- */
/* Bundle component                                                            */
/* -------------------------------------------------------------------------- */

const bundleComponentFields = {
  is_required: z.boolean(),
  default_quantity: decimal(),
  minimum_quantity: decimal().nullish(),
  maximum_quantity: decimal().nullish(),
  is_separately_priced: z.boolean(),
  is_visible_to_customer: z.boolean(),
  sort_order: z.number().int(),
};

export const bundleComponentCreateSchema = z.object({
  workspace_id: uuid(),
  parent_offering_id: uuid(),
  child_offering_id: uuid(),
  ...bundleComponentFields,
  is_required: bundleComponentFields.is_required.default(true),
  default_quantity: bundleComponentFields.default_quantity.default('1'),
  is_separately_priced: bundleComponentFields.is_separately_priced.default(false),
  is_visible_to_customer: bundleComponentFields.is_visible_to_customer.default(true),
  sort_order: bundleComponentFields.sort_order.default(0),
});

export const bundleComponentUpdateSchema = z.object(bundleComponentFields).partial();

/* -------------------------------------------------------------------------- */
/* Inventory                                                                   */
/* -------------------------------------------------------------------------- */

const inventoryItemFields = {
  location_code: z.string().min(1).max(100),
  location_name: z.string().max(255).nullish(),
  quantity_on_hand: decimal(),
  quantity_reserved: decimal(),
  reorder_point: decimal().nullish(),
  requires_serial_number: z.boolean(),
  requires_lot_number: z.boolean(),
  lot_number: z.string().max(100).nullish(),
  status: z.enum(['available', 'reserved', 'in_transit', 'quarantine', 'damaged']),
  notes: z.string().nullish(),
};

export const inventoryItemCreateSchema = z.object({
  workspace_id: uuid(),
  offering_id: uuid(),
  ...inventoryItemFields,
  quantity_on_hand: inventoryItemFields.quantity_on_hand.default('0'),
  quantity_reserved: inventoryItemFields.quantity_reserved.default('0'),
  requires_serial_number: inventoryItemFields.requires_serial_number.default(false),
  requires_lot_number: inventoryItemFields.requires_lot_number.default(false),
  status: inventoryItemFields.status.default('available'),
});

export const inventoryItemUpdateSchema = z.object(inventoryItemFields).partial();

/* -------------------------------------------------------------------------- */
/* Service definition                                                          */
/* -------------------------------------------------------------------------- */

const serviceDefinitionFields = {
  scope_type: z.enum(['fixed', 'flexible']),
  scope_summary: z.string().nullish(),
  estimated_hours: decimal().nullish(),
  delivery_location: z.string().max(255).nullish(),
  required_skills: z.string().max(1000).nullish(),
  service_level_agreement: z.string().nullish(),
  scheduling_notes: z.string().nullish(),
  cancellation_policy: z.string().nullish(),
  included_deliverables: z.string().nullish(),
};

export const serviceDefinitionCreateSchema = z.object({
  workspace_id: uuid(),
  offering_id: uuid(),
  ...serviceDefinitionFields,
  scope_type: serviceDefinitionFields.scope_type.default('fixed'),
});

export const serviceDefinitionUpdateSchema = z.object(serviceDefinitionFields).partial();

/* -------------------------------------------------------------------------- */
/* Deal line                                                                   */
/* -------------------------------------------------------------------------- */

const dealLineFields = {
  name: z.string().min(1).max(255),
  quantity: decimal(),
  unit_amount: decimal().nullish(),
  currency_code: currency(),
  discount_type: discountType().nullish(),
  discount_value: decimal().nullish(),
  term_months: z.number().int().min(0).nullish(),
  sort_order: z.number().int(),
  notes: z.string().nullish(),
};

export const dealLineCreateSchema = z.object({
  workspace_id: uuid(),
  created_by_user_id: uuid().nullish(),
  updated_by_user_id: uuid().nullish(),
  deal_id: uuid(),
  offering_id: uuid(),
  ...dealLineFields,
  quantity: dealLineFields.quantity.default('1'),
  currency_code: dealLineFields.currency_code.default('USD'),
  sort_order: dealLineFields.sort_order.default(0),
});

export const dealLineUpdateSchema = z
  .object({ ...dealLineFields, offering_id: uuid() })
  .partial();

/* -------------------------------------------------------------------------- */
/* Quote                                                                       */
/* -------------------------------------------------------------------------- */

const quoteFields = {
  name: z.string().min(1).max(255),
  deal_id: uuid().nullish(),
  bill_to_entity_id: uuid().nullish(),
  ship_to_entity_id: uuid().nullish(),
  primary_contact_person_id: uuid().nullish(),
  billing_contact_person_id: uuid().nullish(),
  status: z.enum(['draft', 'sent', 'accepted', 'declined', 'expired']),
  currency_code: currency(),
  price_book_id: uuid().nullish(),
  subtotal_amount: decimal(),
  discount_amount: decimal(),
  tax_amount: decimal(),
  total_amount: decimal(),
  discount_type: discountType().nullish(),
  discount_value: decimal().nullish(),
  valid_from: day().nullish(),
  valid_until: day().nullish(),
  payment_terms: z.string().max(100).nullish(),
  contract_term_months: z.number().int().min(0).nullish(),
  sent_at: ts().nullish(),
  accepted_at: ts().nullish(),
  declined_at: ts().nullish(),
  decline_reason: z.string().nullish(),
  terms: z.string().nullish(),
  notes: z.string().nullish(),
};

export const quoteCreateSchema = z.object({
  ...sharedCreate,
  ...quoteFields,
  quote_number: z.string().max(50),
  entity_id: uuid(),
  status: quoteFields.status.default('draft'),
  currency_code: quoteFields.currency_code.default('USD'),
  subtotal_amount: quoteFields.subtotal_amount.default('0'),
  discount_amount: quoteFields.discount_amount.default('0'),
  tax_amount: quoteFields.tax_amount.default('0'),
  total_amount: quoteFields.total_amount.default('0'),
});

export const quoteUpdateSchema = z
  .object({ ...sharedUpdate, ...quoteFields, entity_id: uuid() })
  .partial();

export const quoteLineCreateSchema = z.object({
  workspace_id: uuid(),
  quote_id: uuid(),
  deal_line_id: uuid().nullish(),
  parent_quote_line_id: uuid().nullish(),
  is_optional: z.boolean().default(false),
  ...lineSnapshotFields,
  ...lineSnapshotDefaults,
});

export const quoteLineUpdateSchema = z
  .object({ ...lineSnapshotFields, is_optional: z.boolean(), parent_quote_line_id: uuid().nullish() })
  .partial();

/* -------------------------------------------------------------------------- */
/* Order                                                                       */
/* -------------------------------------------------------------------------- */

const orderFields = {
  quote_id: uuid().nullish(),
  deal_id: uuid().nullish(),
  bill_to_entity_id: uuid().nullish(),
  ship_to_entity_id: uuid().nullish(),
  primary_contact_person_id: uuid().nullish(),
  billing_contact_person_id: uuid().nullish(),
  status: z.enum(['draft', 'open', 'completed', 'canceled']),
  fulfillment_status: fulfillmentStatus(),
  billing_status: z.enum(['not_invoiced', 'invoiced', 'partially_paid', 'paid', 'refunded']),
  currency_code: currency(),
  subtotal_amount: decimal(),
  discount_amount: decimal(),
  tax_amount: decimal(),
  total_amount: decimal(),
  ordered_at: ts().nullish(),
  payment_terms: z.string().max(100).nullish(),
  purchase_order_number: z.string().max(100).nullish(),
  ship_to_name: z.string().max(255).nullish(),
  ship_to_address_line_1: z.string().max(255).nullish(),
  ship_to_address_line_2: z.string().max(255).nullish(),
  ship_to_city: z.string().max(100).nullish(),
  ship_to_region: z.string().max(100).nullish(),
  ship_to_postal_code: z.string().max(20).nullish(),
  ship_to_country_code: z.string().length(2).nullish(),
  canceled_at: ts().nullish(),
  cancellation_reason: z.string().nullish(),
  notes: z.string().nullish(),
};

export const orderCreateSchema = z.object({
  ...sharedCreate,
  ...orderFields,
  order_number: z.string().max(50),
  entity_id: uuid(),
  status: orderFields.status.default('draft'),
  fulfillment_status: orderFields.fulfillment_status.default('not_started'),
  billing_status: orderFields.billing_status.default('not_invoiced'),
  currency_code: orderFields.currency_code.default('USD'),
  subtotal_amount: orderFields.subtotal_amount.default('0'),
  discount_amount: orderFields.discount_amount.default('0'),
  tax_amount: orderFields.tax_amount.default('0'),
  total_amount: orderFields.total_amount.default('0'),
});

export const orderUpdateSchema = z
  .object({ ...sharedUpdate, ...orderFields, entity_id: uuid() })
  .partial();

const orderLineExtraFields = {
  quote_line_id: uuid().nullish(),
  parent_order_line_id: uuid().nullish(),
  fulfillment_status: fulfillmentStatus(),
  quantity_fulfilled: decimal(),
  service_recipient_entity_id: uuid().nullish(),
  end_user_person_id: uuid().nullish(),
};

export const orderLineCreateSchema = z.object({
  workspace_id: uuid(),
  order_id: uuid(),
  ...lineSnapshotFields,
  ...lineSnapshotDefaults,
  ...orderLineExtraFields,
  fulfillment_status: orderLineExtraFields.fulfillment_status.default('not_started'),
  quantity_fulfilled: orderLineExtraFields.quantity_fulfilled.default('0'),
});

export const orderLineUpdateSchema = z
  .object({ ...lineSnapshotFields, ...orderLineExtraFields })
  .partial();

/* -------------------------------------------------------------------------- */
/* Shipment                                                                    */
/* -------------------------------------------------------------------------- */

const shipmentFields = {
  status: z.enum(['pending', 'packed', 'shipped', 'in_transit', 'delivered', 'returned', 'canceled']),
  carrier: z.string().max(100).nullish(),
  service_level: z.string().max(100).nullish(),
  tracking_number: z.string().max(100).nullish(),
  tracking_url: z.string().max(2048).nullish(),
  ship_from_location_code: z.string().max(100).nullish(),
  ship_to_name: z.string().max(255).nullish(),
  ship_to_address_line_1: z.string().max(255).nullish(),
  ship_to_address_line_2: z.string().max(255).nullish(),
  ship_to_city: z.string().max(100).nullish(),
  ship_to_region: z.string().max(100).nullish(),
  ship_to_postal_code: z.string().max(20).nullish(),
  ship_to_country_code: z.string().length(2).nullish(),
  shipped_at: ts().nullish(),
  delivered_at: ts().nullish(),
  canceled_at: ts().nullish(),
  is_return: z.boolean(),
  return_reason: z.string().nullish(),
  replacement_for_shipment_id: uuid().nullish(),
  notes: z.string().nullish(),
};

export const shipmentCreateSchema = z.object({
  workspace_id: uuid(),
  created_by_user_id: uuid().nullish(),
  updated_by_user_id: uuid().nullish(),
  order_id: uuid(),
  shipment_number: z.string().max(50),
  ...shipmentFields,
  status: shipmentFields.status.default('pending'),
  is_return: shipmentFields.is_return.default(false),
});

export const shipmentUpdateSchema = z.object(shipmentFields).partial();

const shipmentLineFields = {
  quantity: decimal(),
  backordered_quantity: decimal(),
  serial_numbers: z.string().max(1000).nullish(),
  lot_number: z.string().max(100).nullish(),
  notes: z.string().nullish(),
};

export const shipmentLineCreateSchema = z.object({
  workspace_id: uuid(),
  shipment_id: uuid(),
  order_line_id: uuid(),
  ...shipmentLineFields,
  quantity: shipmentLineFields.quantity.default('0'),
  backordered_quantity: shipmentLineFields.backordered_quantity.default('0'),
});

export const shipmentLineUpdateSchema = z.object(shipmentLineFields).partial();

/* -------------------------------------------------------------------------- */
/* Subscription                                                                */
/* -------------------------------------------------------------------------- */

const subscriptionStatus = () => z.enum(['trial', 'active', 'paused', 'past_due', 'canceled', 'expired']);

const subscriptionFields = {
  name: z.string().min(1).max(255),
  bill_to_entity_id: uuid().nullish(),
  order_id: uuid().nullish(),
  order_line_id: uuid().nullish(),
  offering_id: uuid().nullish(),
  status: subscriptionStatus(),
  end_date: day().nullish(),
  current_period_start: day().nullish(),
  current_period_end: day().nullish(),
  commitment_end_date: day().nullish(),
  billing_period: billingPeriod(),
  billing_interval_count: z.number().int().min(1),
  quantity: decimal(),
  unit_of_measure: unitOfMeasure(),
  unit_amount: decimal().nullish(),
  currency_code: currency(),
  auto_renew: z.boolean(),
  trial_end_date: day().nullish(),
  paused_at: ts().nullish(),
  resumes_on: day().nullish(),
  canceled_at: ts().nullish(),
  cancellation_effective_date: day().nullish(),
  cancellation_reason: z.string().nullish(),
  notes: z.string().nullish(),
};

export const subscriptionCreateSchema = z.object({
  ...sharedCreate,
  ...subscriptionFields,
  subscription_number: z.string().max(50),
  entity_id: uuid(),
  start_date: day(),
  status: subscriptionFields.status.default('active'),
  billing_period: subscriptionFields.billing_period.default('month'),
  billing_interval_count: subscriptionFields.billing_interval_count.default(1),
  quantity: subscriptionFields.quantity.default('1'),
  unit_of_measure: subscriptionFields.unit_of_measure.default('each'),
  currency_code: subscriptionFields.currency_code.default('USD'),
  auto_renew: subscriptionFields.auto_renew.default(true),
});

export const subscriptionUpdateSchema = z
  .object({ ...sharedUpdate, ...subscriptionFields, entity_id: uuid(), start_date: day() })
  .partial();

/**
 * Amendments are history. They are written by `POST /subscriptions/{id}/amend`,
 * which applies the change to the subscription in the same transaction, and are
 * not editable afterwards.
 */
export const subscriptionAmendmentCreateSchema = z.object({
  workspace_id: uuid(),
  created_by_user_id: uuid().nullish(),
  subscription_id: uuid(),
  amendment_type: z.enum([
    'quantity_change',
    'plan_change',
    'price_change',
    'billing_frequency_change',
    'renewal',
    'pause',
    'resume',
    'cancel',
  ]),
  effective_date: day(),
  applied_at: ts().nullish(),
  previous_quantity: decimal().nullish(),
  new_quantity: decimal().nullish(),
  previous_unit_amount: decimal().nullish(),
  new_unit_amount: decimal().nullish(),
  previous_offering_id: uuid().nullish(),
  new_offering_id: uuid().nullish(),
  previous_billing_period: billingPeriod().nullish(),
  new_billing_period: billingPeriod().nullish(),
  previous_billing_interval_count: z.number().int().min(1).nullish(),
  new_billing_interval_count: z.number().int().min(1).nullish(),
  previous_status: subscriptionStatus().nullish(),
  new_status: subscriptionStatus().nullish(),
  previous_commitment_end_date: day().nullish(),
  new_commitment_end_date: day().nullish(),
  proration_amount: decimal().nullish(),
  currency_code: currency().nullish(),
  reason: z.string().nullish(),
});

export const subscriptionAmendmentUpdateSchema = z.object({}).strict();

/** The body `POST /api/v1/subscriptions/{id}/amend` takes. */
export const amendSubscriptionSchema = z
  .object({
    amendment_type: z.enum([
      'quantity_change',
      'plan_change',
      'price_change',
      'billing_frequency_change',
      'renewal',
      'pause',
      'resume',
      'cancel',
    ]),
    effective_date: day().optional(),
    quantity: decimal().optional(),
    unit_amount: decimal().optional(),
    offering_id: uuid().optional(),
    billing_period: billingPeriod().optional(),
    billing_interval_count: z.number().int().min(1).optional(),
    commitment_end_date: day().optional(),
    /** For `cancel`: end now, or serve out the current period. */
    at_period_end: z.boolean().default(false),
    resumes_on: day().optional(),
    reason: z.string().optional(),
    created_by_user_id: uuid().nullish(),
  })
  .strict();

/* -------------------------------------------------------------------------- */
/* Entitlement and usage                                                       */
/* -------------------------------------------------------------------------- */

const entitlementFields = {
  order_line_id: uuid().nullish(),
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  unit_of_measure: unitOfMeasure(),
  included_quantity: decimal().nullish(),
  used_quantity: decimal(),
  is_unlimited: z.boolean(),
  overage_unit_amount: decimal().nullish(),
  currency_code: currency().nullish(),
  effective_from: day().nullish(),
  effective_until: day().nullish(),
  notes: z.string().nullish(),
};

export const entitlementCreateSchema = z.object({
  workspace_id: uuid(),
  subscription_id: uuid(),
  entity_id: uuid(),
  ...entitlementFields,
  unit_of_measure: entitlementFields.unit_of_measure.default('each'),
  used_quantity: entitlementFields.used_quantity.default('0'),
  is_unlimited: entitlementFields.is_unlimited.default(false),
});

export const entitlementUpdateSchema = z.object(entitlementFields).partial();

/**
 * Usage is recorded through `POST /api/v1/usage-records`, which also rolls the
 * quantity up onto the entitlement it consumes.
 */
export const usageRecordCreateSchema = z.object({
  workspace_id: uuid(),
  created_by_user_id: uuid().nullish(),
  entity_id: uuid(),
  subscription_id: uuid().nullish(),
  entitlement_id: uuid().nullish(),
  order_line_id: uuid().nullish(),
  metric_code: z.string().min(1).max(64),
  quantity: decimal(),
  unit_of_measure: unitOfMeasure().default('each'),
  occurred_at: ts().optional(),
  period_start: ts().nullish(),
  period_end: ts().nullish(),
  source: z.string().max(100).nullish(),
  external_reference: z.string().max(255).nullish(),
  notes: z.string().nullish(),
});

/** A usage event is a record of what happened, so only its annotations change. */
export const usageRecordUpdateSchema = z
  .object({ source: z.string().max(100).nullish(), notes: z.string().nullish() })
  .partial();

/* -------------------------------------------------------------------------- */
/* Service delivery                                                            */
/* -------------------------------------------------------------------------- */

const serviceDeliveryFields = {
  name: z.string().min(1).max(255),
  order_id: uuid().nullish(),
  order_line_id: uuid().nullish(),
  offering_id: uuid().nullish(),
  contact_person_id: uuid().nullish(),
  assigned_user_id: uuid().nullish(),
  assigned_team: z.string().max(100).nullish(),
  status: z.enum(['not_started', 'scheduled', 'in_progress', 'blocked', 'completed', 'accepted', 'canceled']),
  scheduled_start_at: ts().nullish(),
  scheduled_end_at: ts().nullish(),
  actual_start_at: ts().nullish(),
  actual_end_at: ts().nullish(),
  estimated_hours: decimal().nullish(),
  hours_consumed: decimal(),
  delivery_location: z.string().max(255).nullish(),
  service_level_agreement: z.string().nullish(),
  customer_accepted_at: ts().nullish(),
  customer_accepted_by_person_id: uuid().nullish(),
  acceptance_notes: z.string().nullish(),
  case_id: uuid().nullish(),
  incident_id: uuid().nullish(),
  notes: z.string().nullish(),
};

export const serviceDeliveryCreateSchema = z.object({
  ...sharedCreate,
  ...serviceDeliveryFields,
  delivery_number: z.string().max(50),
  entity_id: uuid(),
  status: serviceDeliveryFields.status.default('not_started'),
  hours_consumed: serviceDeliveryFields.hours_consumed.default('0'),
});

export const serviceDeliveryUpdateSchema = z
  .object({ ...sharedUpdate, ...serviceDeliveryFields, entity_id: uuid() })
  .partial();

const serviceMilestoneFields = {
  name: z.string().min(1).max(255),
  sequence: z.number().int(),
  status: z.enum(['pending', 'in_progress', 'completed', 'accepted', 'canceled']),
  billing_percent: decimal().nullish(),
  billing_amount: decimal().nullish(),
  currency_code: currency().nullish(),
  due_on: day().nullish(),
  completed_at: ts().nullish(),
  accepted_at: ts().nullish(),
  notes: z.string().nullish(),
};

export const serviceMilestoneCreateSchema = z.object({
  workspace_id: uuid(),
  service_delivery_id: uuid(),
  ...serviceMilestoneFields,
  sequence: serviceMilestoneFields.sequence.default(0),
  status: serviceMilestoneFields.status.default('pending'),
});

export const serviceMilestoneUpdateSchema = z.object(serviceMilestoneFields).partial();
