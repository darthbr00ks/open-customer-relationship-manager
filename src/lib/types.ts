/** Shape of the JSON the REST API returns. Field names match the database columns. */

export type SharedFields = {
  id: string;
  workspace_id: string;
  owner_user_id: string | null;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type Entity = SharedFields & {
  name: string;
  legal_name: string | null;
  entity_type: string;
  relationship_stage: string;
  description: string | null;
  website_url: string | null;
  primary_domain: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country_code: string | null;
  notes: string | null;
};

export type Person = SharedFields & {
  first_name: string;
  last_name: string | null;
  preferred_name: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  linkedin_url: string | null;
  description: string | null;
  notes: string | null;
};

export type EntityPerson = {
  id: string;
  workspace_id: string;
  entity_id: string;
  person_id: string;
  relationship_type: string;
  job_title: string | null;
  department: string | null;
  is_primary_contact: boolean;
  status: string;
  started_on: string | null;
  ended_on: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Deal = SharedFields & {
  name: string;
  entity_id: string;
  primary_contact_person_id: string | null;
  description: string | null;
  stage: string;
  amount: string | null;
  currency_code: string;
  probability: number | null;
  expected_close_date: string | null;
  closed_at: string | null;
  next_step: string | null;
  lost_reason: string | null;
  notes: string | null;
};

export type SupportCase = SharedFields & {
  case_number: string;
  subject: string;
  description: string;
  entity_id: string | null;
  reported_by_person_id: string | null;
  status: string;
  priority: string;
  category: string | null;
  source: string | null;
  due_at: string | null;
  resolved_at: string | null;
  resolution: string | null;
};

export type Incident = SharedFields & {
  incident_number: string;
  title: string;
  description: string;
  status: string;
  severity: string;
  started_at: string | null;
  identified_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  root_cause: string | null;
  resolution: string | null;
  internal_notes: string | null;
  public_update: string | null;
};

export type IncidentCase = {
  id: string;
  workspace_id: string;
  incident_id: string;
  case_id: string;
  entity_id: string;
  impact_level: string | null;
  impact_description: string | null;
  linked_at: string;
  unlinked_at: string | null;
  created_by_user_id: string | null;
};

export type FeatureRequest = SharedFields & {
  request_number: string;
  title: string;
  description: string;
  entity_id: string | null;
  requested_by_person_id: string | null;
  status: string;
  priority: string;
  category: string | null;
  business_need: string | null;
  decision_notes: string | null;
  target_date: string | null;
  completed_at: string | null;
};

export type Note = {
  id: string;
  workspace_id: string;
  parent_type:
    | 'entity'
    | 'person'
    | 'deal'
    | 'case'
    | 'incident'
    | 'request'
    | 'chat_channel'
    | 'chat_conversation'
    | 'product'
    | 'offering'
    | 'quote'
    | 'order'
    | 'subscription'
    | 'service_delivery';
  parent_id: string;
  kind: 'note' | 'system';
  body: string;
  created_at: string;
  created_by_user_id: string | null;
};

export type ChatChannel = SharedFields & {
  name: string;
  key: string;
  description: string | null;
  intake_mode: 'deal' | 'case' | 'none';
  auth_mode: 'none' | 'optional' | 'required';
  is_enabled: boolean;
  greeting: string | null;
  offline_message: string | null;
  collect_name: boolean;
  collect_email: boolean;
  auto_create_entity: boolean;
  default_assignee_user_id: string | null;
  deal_stage: string;
  deal_currency_code: string;
  case_priority: string;
  case_category: string | null;
  allowed_origins: string | null;
  session_ttl_hours: number;
};

export type ChatContact = {
  id: string;
  workspace_id: string;
  channel_id: string;
  person_id: string | null;
  entity_id: string | null;
  email: string | null;
  display_name: string | null;
  verified_at: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ChatConversation = {
  id: string;
  workspace_id: string;
  channel_id: string;
  contact_id: string;
  subject: string;
  status: 'open' | 'pending' | 'closed';
  assigned_user_id: string | null;
  entity_id: string | null;
  person_id: string | null;
  deal_id: string | null;
  case_id: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  last_contact_message_at: string | null;
  last_agent_message_at: string | null;
  agent_read_at: string | null;
  contact_read_at: string | null;
  closed_at: string | null;
};

export type ChatMessage = {
  id: string;
  workspace_id: string;
  conversation_id: string;
  author_type: 'contact' | 'user' | 'system';
  author_user_id: string | null;
  author_contact_id: string | null;
  author_name: string | null;
  body: string;
  is_internal: boolean;
  created_at: string;
};

export type PipelineReport = {
  workspace_id: string;
  generated_at: string;
  total_open_value: string;
  by_stage: { stage: string; count: number; value: string }[];
};

/* -------------------------------------------------------------------------- */
/* Enum option lists — drive both <Select> options and filter/badge rendering  */
/* -------------------------------------------------------------------------- */

export const ENTITY_TYPES = [
  'company',
  'nonprofit',
  'government',
  'education',
  'association',
  'household',
  'other',
] as const;

export const RELATIONSHIP_STAGES = [
  'prospect',
  'customer',
  'partner',
  'former_customer',
  'inactive',
] as const;

export const RELATIONSHIP_TYPES = [
  'employee',
  'owner',
  'advisor',
  'board_member',
  'volunteer',
  'contractor',
  'customer_contact',
  'other',
] as const;

export const AFFILIATION_STATUSES = ['current', 'former'] as const;

export const DEAL_STAGES = [
  'qualification',
  'discovery',
  'proposal',
  'negotiation',
  'won',
  'lost',
] as const;

export const CASE_STATUSES = ['new', 'open', 'pending', 'resolved', 'closed'] as const;
export const CASE_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export const CASE_SOURCES = ['email', 'phone', 'web', 'internal', 'integration', 'other'] as const;

export const INCIDENT_STATUSES = [
  'investigating',
  'identified',
  'monitoring',
  'resolved',
  'closed',
] as const;
export const INCIDENT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export const IMPACT_LEVELS = ['minor', 'moderate', 'major', 'critical'] as const;

export const REQUEST_STATUSES = [
  'submitted',
  'under_review',
  'planned',
  'in_progress',
  'completed',
  'declined',
] as const;
export const REQUEST_PRIORITIES = ['low', 'medium', 'high'] as const;

/** What a chat channel opens in the CRM when a conversation starts. */
export const CHAT_INTAKE_MODES = ['deal', 'case', 'none'] as const;
/** Whether a visitor must prove an email address before they can chat. */
export const CHAT_AUTH_MODES = ['none', 'optional', 'required'] as const;
export const CHAT_CONVERSATION_STATUSES = ['open', 'pending', 'closed'] as const;
export const CHAT_AUTHOR_TYPES = ['contact', 'user', 'system'] as const;

/* -------------------------------------------------------------------------- */
/* Selling                                                                     */
/* -------------------------------------------------------------------------- */

export type Product = SharedFields & {
  name: string;
  description: string | null;
  category: string | null;
  status: string;
  tax_category: string | null;
  notes: string | null;
};

export type Offering = SharedFields & {
  product_id: string;
  sku: string;
  name: string;
  description: string | null;
  offering_type: string;
  unit_of_measure: string;
  fulfillment_policy: string;
  active_from: string | null;
  active_until: string | null;
  attributes: Record<string, unknown> | null;
  notes: string | null;
};

export type PriceBook = {
  id: string;
  workspace_id: string;
  code: string;
  name: string;
  description: string | null;
  currency_code: string | null;
  entity_id: string | null;
  region: string | null;
  channel: string | null;
  is_default: boolean;
  active_from: string | null;
  active_until: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type Price = {
  id: string;
  workspace_id: string;
  offering_id: string;
  price_book_id: string | null;
  name: string | null;
  unit_of_measure: string | null;
  currency_code: string;
  charge_type: string;
  pricing_model: string;
  unit_amount: string | null;
  billing_period: string | null;
  billing_interval_count: number;
  minimum_quantity: string | null;
  included_quantity: string | null;
  effective_from: string | null;
  effective_until: string | null;
  created_at: string;
  updated_at: string;
};

export type PriceTier = {
  id: string;
  workspace_id: string;
  price_id: string;
  up_to: string | null;
  unit_amount: string | null;
  flat_amount: string | null;
  created_at: string;
  updated_at: string;
};

export type BundleComponent = {
  id: string;
  workspace_id: string;
  parent_offering_id: string;
  child_offering_id: string;
  is_required: boolean;
  default_quantity: string;
  minimum_quantity: string | null;
  maximum_quantity: string | null;
  is_separately_priced: boolean;
  is_visible_to_customer: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type InventoryItem = {
  id: string;
  workspace_id: string;
  offering_id: string;
  location_code: string;
  location_name: string | null;
  quantity_on_hand: string;
  quantity_reserved: string;
  reorder_point: string | null;
  requires_serial_number: boolean;
  requires_lot_number: boolean;
  lot_number: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ServiceDefinition = {
  id: string;
  workspace_id: string;
  offering_id: string;
  scope_type: string;
  scope_summary: string | null;
  estimated_hours: string | null;
  delivery_location: string | null;
  required_skills: string | null;
  service_level_agreement: string | null;
  scheduling_notes: string | null;
  cancellation_policy: string | null;
  included_deliverables: string | null;
  created_at: string;
  updated_at: string;
};

export type DealLine = {
  id: string;
  workspace_id: string;
  deal_id: string;
  offering_id: string;
  name: string;
  quantity: string;
  unit_amount: string | null;
  currency_code: string;
  discount_type: string | null;
  discount_value: string | null;
  term_months: number | null;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** The fields a Quote Line and an Order Line both snapshot from the catalog. */
export type TransactionLine = {
  id: string;
  workspace_id: string;
  offering_id: string | null;
  price_id: string | null;
  name: string;
  description: string | null;
  sku: string | null;
  offering_type: string;
  charge_type: string;
  pricing_model: string;
  fulfillment_policy: string;
  unit_of_measure: string;
  quantity: string;
  unit_amount: string | null;
  currency_code: string;
  billing_period: string | null;
  billing_interval_count: number;
  included_quantity: string | null;
  term_months: number | null;
  discount_type: string | null;
  discount_value: string | null;
  subtotal_amount: string;
  discount_amount: string;
  tax_amount: string;
  total_amount: string;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Quote = SharedFields & {
  quote_number: string;
  name: string;
  deal_id: string | null;
  entity_id: string;
  bill_to_entity_id: string | null;
  ship_to_entity_id: string | null;
  primary_contact_person_id: string | null;
  billing_contact_person_id: string | null;
  status: string;
  currency_code: string;
  price_book_id: string | null;
  subtotal_amount: string;
  discount_amount: string;
  tax_amount: string;
  total_amount: string;
  discount_type: string | null;
  discount_value: string | null;
  valid_from: string | null;
  valid_until: string | null;
  payment_terms: string | null;
  contract_term_months: number | null;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  terms: string | null;
  notes: string | null;
};

export type QuoteLine = TransactionLine & {
  quote_id: string;
  deal_line_id: string | null;
  parent_quote_line_id: string | null;
  is_optional: boolean;
};

export type Order = SharedFields & {
  order_number: string;
  quote_id: string | null;
  deal_id: string | null;
  entity_id: string;
  bill_to_entity_id: string | null;
  ship_to_entity_id: string | null;
  primary_contact_person_id: string | null;
  billing_contact_person_id: string | null;
  status: string;
  fulfillment_status: string;
  billing_status: string;
  currency_code: string;
  subtotal_amount: string;
  discount_amount: string;
  tax_amount: string;
  total_amount: string;
  ordered_at: string | null;
  payment_terms: string | null;
  purchase_order_number: string | null;
  ship_to_name: string | null;
  ship_to_address_line_1: string | null;
  ship_to_address_line_2: string | null;
  ship_to_city: string | null;
  ship_to_region: string | null;
  ship_to_postal_code: string | null;
  ship_to_country_code: string | null;
  canceled_at: string | null;
  cancellation_reason: string | null;
  notes: string | null;
};

export type OrderLine = TransactionLine & {
  order_id: string;
  quote_line_id: string | null;
  parent_order_line_id: string | null;
  fulfillment_status: string;
  quantity_fulfilled: string;
  service_recipient_entity_id: string | null;
  end_user_person_id: string | null;
};

export type Shipment = {
  id: string;
  workspace_id: string;
  order_id: string;
  shipment_number: string;
  status: string;
  carrier: string | null;
  service_level: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  ship_from_location_code: string | null;
  ship_to_name: string | null;
  ship_to_address_line_1: string | null;
  ship_to_address_line_2: string | null;
  ship_to_city: string | null;
  ship_to_region: string | null;
  ship_to_postal_code: string | null;
  ship_to_country_code: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  canceled_at: string | null;
  is_return: boolean;
  return_reason: string | null;
  replacement_for_shipment_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ShipmentLine = {
  id: string;
  workspace_id: string;
  shipment_id: string;
  order_line_id: string;
  quantity: string;
  backordered_quantity: string;
  serial_numbers: string | null;
  lot_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Subscription = SharedFields & {
  subscription_number: string;
  name: string;
  entity_id: string;
  bill_to_entity_id: string | null;
  order_id: string | null;
  order_line_id: string | null;
  offering_id: string | null;
  status: string;
  start_date: string;
  end_date: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  commitment_end_date: string | null;
  billing_period: string;
  billing_interval_count: number;
  quantity: string;
  unit_of_measure: string;
  unit_amount: string | null;
  currency_code: string;
  auto_renew: boolean;
  trial_end_date: string | null;
  paused_at: string | null;
  resumes_on: string | null;
  canceled_at: string | null;
  cancellation_effective_date: string | null;
  cancellation_reason: string | null;
  notes: string | null;
};

export type SubscriptionAmendment = {
  id: string;
  workspace_id: string;
  subscription_id: string;
  amendment_type: string;
  effective_date: string;
  applied_at: string | null;
  previous_quantity: string | null;
  new_quantity: string | null;
  previous_unit_amount: string | null;
  new_unit_amount: string | null;
  previous_offering_id: string | null;
  new_offering_id: string | null;
  previous_billing_period: string | null;
  new_billing_period: string | null;
  previous_billing_interval_count: number | null;
  new_billing_interval_count: number | null;
  previous_status: string | null;
  new_status: string | null;
  previous_commitment_end_date: string | null;
  new_commitment_end_date: string | null;
  proration_amount: string | null;
  currency_code: string | null;
  reason: string | null;
  created_at: string;
  created_by_user_id: string | null;
};

export type Entitlement = {
  id: string;
  workspace_id: string;
  subscription_id: string;
  entity_id: string;
  order_line_id: string | null;
  code: string;
  name: string;
  unit_of_measure: string;
  included_quantity: string | null;
  used_quantity: string;
  is_unlimited: boolean;
  overage_unit_amount: string | null;
  currency_code: string | null;
  effective_from: string | null;
  effective_until: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type UsageRecord = {
  id: string;
  workspace_id: string;
  entity_id: string;
  subscription_id: string | null;
  entitlement_id: string | null;
  order_line_id: string | null;
  metric_code: string;
  quantity: string;
  unit_of_measure: string;
  occurred_at: string;
  period_start: string | null;
  period_end: string | null;
  source: string | null;
  external_reference: string | null;
  notes: string | null;
  created_at: string;
  created_by_user_id: string | null;
};

export type ServiceDelivery = SharedFields & {
  delivery_number: string;
  name: string;
  order_id: string | null;
  order_line_id: string | null;
  offering_id: string | null;
  entity_id: string;
  contact_person_id: string | null;
  assigned_user_id: string | null;
  assigned_team: string | null;
  status: string;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
  estimated_hours: string | null;
  hours_consumed: string;
  delivery_location: string | null;
  service_level_agreement: string | null;
  customer_accepted_at: string | null;
  customer_accepted_by_person_id: string | null;
  acceptance_notes: string | null;
  case_id: string | null;
  incident_id: string | null;
  notes: string | null;
};

export type ServiceMilestone = {
  id: string;
  workspace_id: string;
  service_delivery_id: string;
  name: string;
  sequence: number;
  status: string;
  billing_percent: string | null;
  billing_amount: string | null;
  currency_code: string | null;
  due_on: string | null;
  completed_at: string | null;
  accepted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** One charge resolved from the catalog by `GET /api/v1/offerings/{id}/price`. */
export type ResolvedCharge = {
  price_id: string | null;
  name: string | null;
  unit_of_measure: string | null;
  charge_type: string;
  pricing_model: string;
  currency_code: string;
  billing_period: string | null;
  billing_interval_count: number;
  included_quantity: string | null;
  unit_amount: string | null;
  billable_quantity: string;
  amount: string;
};

/* Selling enum option lists ------------------------------------------------- */

export const PRODUCT_STATUSES = ['draft', 'active', 'retired', 'archived'] as const;
export const OFFERING_TYPES = ['good', 'service', 'subscription', 'bundle'] as const;
export const FULFILLMENT_POLICIES = ['shipping', 'digital_activation', 'scheduled_work', 'none'] as const;
export const CHARGE_TYPES = ['one_time', 'recurring', 'usage'] as const;
export const PRICING_MODELS = ['flat', 'per_unit', 'tiered', 'volume', 'graduated'] as const;
export const BILLING_PERIODS = ['day', 'week', 'month', 'quarter', 'year'] as const;
export const INVENTORY_STATUSES = ['available', 'reserved', 'in_transit', 'quarantine', 'damaged'] as const;
export const SERVICE_SCOPES = ['fixed', 'flexible'] as const;
export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'declined', 'expired'] as const;
export const ORDER_STATUSES = ['draft', 'open', 'completed', 'canceled'] as const;
export const FULFILLMENT_STATUSES = [
  'not_started',
  'in_progress',
  'partially_fulfilled',
  'fulfilled',
  'returned',
  'canceled',
] as const;
export const BILLING_STATUSES = ['not_invoiced', 'invoiced', 'partially_paid', 'paid', 'refunded'] as const;
export const SHIPMENT_STATUSES = [
  'pending',
  'packed',
  'shipped',
  'in_transit',
  'delivered',
  'returned',
  'canceled',
] as const;
export const SUBSCRIPTION_STATUSES = ['trial', 'active', 'paused', 'past_due', 'canceled', 'expired'] as const;
export const AMENDMENT_TYPES = [
  'quantity_change',
  'plan_change',
  'price_change',
  'billing_frequency_change',
  'renewal',
  'pause',
  'resume',
  'cancel',
] as const;
export const SERVICE_DELIVERY_STATUSES = [
  'not_started',
  'scheduled',
  'in_progress',
  'blocked',
  'completed',
  'accepted',
  'canceled',
] as const;
export const MILESTONE_STATUSES = ['pending', 'in_progress', 'completed', 'accepted', 'canceled'] as const;
export const DISCOUNT_TYPES = ['percentage', 'fixed_amount'] as const;

/** Common units, offered as suggestions — any string is allowed. */
export const UNITS_OF_MEASURE = [
  'each',
  'hour',
  'day',
  'month',
  'user',
  'seat',
  'license',
  'device',
  'gigabyte',
  'engagement',
  'call',
] as const;
