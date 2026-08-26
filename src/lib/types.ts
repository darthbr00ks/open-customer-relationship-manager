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
  parent_type: 'entity' | 'person' | 'deal' | 'case' | 'incident' | 'request';
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
