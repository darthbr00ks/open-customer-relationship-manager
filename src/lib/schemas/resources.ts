import { z } from 'zod';

import { MAX_MESSAGE_LENGTH, MAX_SESSION_TTL_HOURS, MIN_SESSION_TTL_HOURS } from '@/lib/chat/config';
import { channelKeySchema } from '@/lib/chat/keys';
import { day, sharedCreate, sharedUpdate, ts, uuid } from '@/lib/schemas/common';

/* -------------------------------------------------------------------------- */
/* Entity                                                                      */
/* -------------------------------------------------------------------------- */

const entityFields = {
  name: z.string().max(255),
  legal_name: z.string().max(255).nullish(),
  entity_type: z.enum([
    'company',
    'nonprofit',
    'government',
    'education',
    'association',
    'household',
    'other',
  ]),
  relationship_stage: z.enum([
    'prospect',
    'customer',
    'partner',
    'former_customer',
    'inactive',
  ]),
  description: z.string().nullish(),
  website_url: z.string().max(2048).nullish(),
  primary_domain: z.string().max(255).nullish(),
  primary_email: z.string().max(320).nullish(),
  primary_phone: z.string().max(50).nullish(),
  address_line_1: z.string().max(255).nullish(),
  address_line_2: z.string().max(255).nullish(),
  city: z.string().max(100).nullish(),
  region: z.string().max(100).nullish(),
  postal_code: z.string().max(20).nullish(),
  country_code: z.string().length(2).nullish(),
  notes: z.string().nullish(),
};

export const entityCreateSchema = z.object({
  ...sharedCreate,
  ...entityFields,
  relationship_stage: entityFields.relationship_stage.default('prospect'),
});

export const entityUpdateSchema = z
  .object({ ...sharedUpdate, ...entityFields })
  .partial();

/* -------------------------------------------------------------------------- */
/* Person                                                                      */
/* -------------------------------------------------------------------------- */

const personFields = {
  first_name: z.string().max(100),
  last_name: z.string().max(100).nullish(),
  preferred_name: z.string().max(100).nullish(),
  primary_email: z.string().max(320).nullish(),
  primary_phone: z.string().max(50).nullish(),
  linkedin_url: z.string().max(2048).nullish(),
  description: z.string().nullish(),
  notes: z.string().nullish(),
};

export const personCreateSchema = z.object({ ...sharedCreate, ...personFields });
export const personUpdateSchema = z.object({ ...sharedUpdate, ...personFields }).partial();

/* -------------------------------------------------------------------------- */
/* EntityPerson                                                                */
/* -------------------------------------------------------------------------- */

const entityPersonFields = {
  relationship_type: z.enum([
    'employee',
    'owner',
    'advisor',
    'board_member',
    'volunteer',
    'contractor',
    'customer_contact',
    'other',
  ]),
  job_title: z.string().max(255).nullish(),
  department: z.string().max(255).nullish(),
  is_primary_contact: z.boolean(),
  status: z.enum(['current', 'former']),
  started_on: day().nullish(),
  ended_on: day().nullish(),
  notes: z.string().nullish(),
};

export const entityPersonCreateSchema = z.object({
  workspace_id: uuid(),
  entity_id: uuid(),
  person_id: uuid(),
  ...entityPersonFields,
  is_primary_contact: entityPersonFields.is_primary_contact.default(false),
  status: entityPersonFields.status.default('current'),
});

export const entityPersonUpdateSchema = z.object(entityPersonFields).partial();

/* -------------------------------------------------------------------------- */
/* Deal                                                                        */
/* -------------------------------------------------------------------------- */

const dealFields = {
  name: z.string().max(255),
  primary_contact_person_id: uuid().nullish(),
  description: z.string().nullish(),
  stage: z.enum(['qualification', 'discovery', 'proposal', 'negotiation', 'won', 'lost']),
  amount: z.union([z.string(), z.number()]).transform(String).nullish(),
  currency_code: z.string().length(3),
  probability: z.number().int().min(0).max(100).nullish(),
  expected_close_date: day().nullish(),
  closed_at: ts().nullish(),
  next_step: z.string().nullish(),
  lost_reason: z.string().nullish(),
  notes: z.string().nullish(),
};

export const dealCreateSchema = z.object({
  ...sharedCreate,
  ...dealFields,
  entity_id: uuid(),
  stage: dealFields.stage.default('qualification'),
  currency_code: dealFields.currency_code.default('USD'),
});

export const dealUpdateSchema = z.object({ ...sharedUpdate, ...dealFields }).partial();

/* -------------------------------------------------------------------------- */
/* Case                                                                        */
/* -------------------------------------------------------------------------- */

const caseFields = {
  subject: z.string().max(500),
  description: z.string(),
  entity_id: uuid().nullish(),
  reported_by_person_id: uuid().nullish(),
  status: z.enum(['new', 'open', 'pending', 'resolved', 'closed']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  category: z.string().max(100).nullish(),
  source: z.enum(['email', 'phone', 'web', 'internal', 'integration', 'other']).nullish(),
  due_at: ts().nullish(),
  resolved_at: ts().nullish(),
  resolution: z.string().nullish(),
};

export const caseCreateSchema = z.object({
  ...sharedCreate,
  ...caseFields,
  case_number: z.string().max(50),
  status: caseFields.status.default('new'),
  priority: caseFields.priority.default('medium'),
});

export const caseUpdateSchema = z.object({ ...sharedUpdate, ...caseFields }).partial();

/* -------------------------------------------------------------------------- */
/* Incident                                                                    */
/* -------------------------------------------------------------------------- */

const incidentFields = {
  title: z.string().max(500),
  description: z.string(),
  status: z.enum(['investigating', 'identified', 'monitoring', 'resolved', 'closed']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  started_at: ts().nullish(),
  identified_at: ts().nullish(),
  resolved_at: ts().nullish(),
  closed_at: ts().nullish(),
  root_cause: z.string().nullish(),
  resolution: z.string().nullish(),
  internal_notes: z.string().nullish(),
  public_update: z.string().nullish(),
};

export const incidentCreateSchema = z.object({
  ...sharedCreate,
  ...incidentFields,
  incident_number: z.string().max(50),
  status: incidentFields.status.default('investigating'),
});

export const incidentUpdateSchema = z.object({ ...sharedUpdate, ...incidentFields }).partial();

/* -------------------------------------------------------------------------- */
/* IncidentCase                                                                */
/* -------------------------------------------------------------------------- */

export const incidentCaseCreateSchema = z.object({
  workspace_id: uuid(),
  incident_id: uuid(),
  case_id: uuid(),
  entity_id: uuid(),
  impact_level: z.enum(['minor', 'moderate', 'major', 'critical']).nullish(),
  impact_description: z.string().nullish(),
  created_by_user_id: uuid().nullish(),
});

export const incidentCaseUpdateSchema = z
  .object({
    impact_level: z.enum(['minor', 'moderate', 'major', 'critical']).nullish(),
    impact_description: z.string().nullish(),
    unlinked_at: ts().nullish(),
  })
  .partial();

/* -------------------------------------------------------------------------- */
/* Request                                                                     */
/* -------------------------------------------------------------------------- */

const requestFields = {
  title: z.string().max(500),
  description: z.string(),
  entity_id: uuid().nullish(),
  requested_by_person_id: uuid().nullish(),
  status: z.enum([
    'submitted',
    'under_review',
    'planned',
    'in_progress',
    'completed',
    'declined',
  ]),
  priority: z.enum(['low', 'medium', 'high']),
  category: z.string().max(100).nullish(),
  business_need: z.string().nullish(),
  decision_notes: z.string().nullish(),
  target_date: day().nullish(),
  completed_at: ts().nullish(),
};

export const requestCreateSchema = z.object({
  ...sharedCreate,
  ...requestFields,
  request_number: z.string().max(50),
  status: requestFields.status.default('submitted'),
  priority: requestFields.priority.default('medium'),
});

export const requestUpdateSchema = z.object({ ...sharedUpdate, ...requestFields }).partial();

/* -------------------------------------------------------------------------- */
/* Note                                                                        */
/* -------------------------------------------------------------------------- */

const noteFields = {
  parent_type: z.enum([
    'entity',
    'person',
    'deal',
    'case',
    'incident',
    'request',
    'chat_channel',
    'chat_conversation',
    'product',
    'offering',
    'quote',
    'order',
    'subscription',
    'service_delivery',
  ]),
  parent_id: uuid(),
  kind: z.enum(['note', 'system']),
  body: z.string().min(1),
};

export const noteCreateSchema = z.object({
  workspace_id: uuid(),
  created_by_user_id: uuid().nullish(),
  ...noteFields,
  kind: noteFields.kind.default('note'),
});

export const noteUpdateSchema = z.object({ body: noteFields.body }).partial();

/* -------------------------------------------------------------------------- */
/* Chat                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * A chat channel is one configured instance of the chat tool. Everything that
 * differs between instances — prospecting vs support, anonymous vs verified,
 * what the visitor is asked for — is a column here rather than a deployment.
 */
const chatChannelFields = {
  name: z.string().min(1).max(255),
  description: z.string().nullish(),
  intake_mode: z.enum(['deal', 'case', 'none']),
  auth_mode: z.enum(['none', 'optional', 'required']),
  is_enabled: z.boolean(),
  greeting: z.string().nullish(),
  offline_message: z.string().nullish(),
  collect_name: z.boolean(),
  collect_email: z.boolean(),
  auto_create_entity: z.boolean(),
  default_assignee_user_id: uuid().nullish(),
  deal_stage: z.enum(['qualification', 'discovery', 'proposal', 'negotiation', 'won', 'lost']),
  deal_currency_code: z.string().length(3),
  case_priority: z.enum(['low', 'medium', 'high', 'urgent']),
  case_category: z.string().max(100).nullish(),
  allowed_origins: z.string().max(2048).nullish(),
  session_ttl_hours: z.number().int().min(MIN_SESSION_TTL_HOURS).max(MAX_SESSION_TTL_HOURS),
};

export const chatChannelCreateSchema = z.object({
  ...sharedCreate,
  ...chatChannelFields,
  key: channelKeySchema,
  intake_mode: chatChannelFields.intake_mode.default('case'),
  auth_mode: chatChannelFields.auth_mode.default('none'),
  is_enabled: chatChannelFields.is_enabled.default(true),
  collect_name: chatChannelFields.collect_name.default(true),
  collect_email: chatChannelFields.collect_email.default(true),
  auto_create_entity: chatChannelFields.auto_create_entity.default(true),
  deal_stage: chatChannelFields.deal_stage.default('qualification'),
  deal_currency_code: chatChannelFields.deal_currency_code.default('USD'),
  case_priority: chatChannelFields.case_priority.default('medium'),
  session_ttl_hours: chatChannelFields.session_ttl_hours.default(720),
});

export const chatChannelUpdateSchema = z
  .object({ ...sharedUpdate, ...chatChannelFields, key: channelKeySchema })
  .partial();

/* Chat contact ------------------------------------------------------------- */

/** Visitors create themselves through the widget; the CRM side mainly re-links them. */
const chatContactFields = {
  person_id: uuid().nullish(),
  entity_id: uuid().nullish(),
  display_name: z.string().max(255).nullish(),
  email: z.email().max(320).nullish(),
};

export const chatContactCreateSchema = z.object({
  workspace_id: uuid(),
  channel_id: uuid(),
  ...chatContactFields,
});

export const chatContactUpdateSchema = z.object(chatContactFields).partial();

/* Chat conversation -------------------------------------------------------- */

const chatConversationFields = {
  subject: z.string().min(1).max(500),
  status: z.enum(['open', 'pending', 'closed']),
  assigned_user_id: uuid().nullish(),
  entity_id: uuid().nullish(),
  person_id: uuid().nullish(),
  deal_id: uuid().nullish(),
  case_id: uuid().nullish(),
  closed_at: ts().nullish(),
  agent_read_at: ts().nullish(),
};

export const chatConversationCreateSchema = z.object({
  workspace_id: uuid(),
  channel_id: uuid(),
  contact_id: uuid(),
  ...chatConversationFields,
  status: chatConversationFields.status.default('open'),
});

export const chatConversationUpdateSchema = z.object(chatConversationFields).partial();

/* Chat message ------------------------------------------------------------- */

/**
 * Agents post through `POST /api/v1/chat-messages`, which also moves the
 * conversation's activity timestamps; `author_type` is fixed to `user` there.
 */
export const chatMessageCreateSchema = z.object({
  workspace_id: uuid(),
  conversation_id: uuid(),
  body: z.string().min(1).max(MAX_MESSAGE_LENGTH),
  author_user_id: uuid().nullish(),
  author_name: z.string().max(255).nullish(),
  is_internal: z.boolean().default(false),
});

/** Messages are a record of what was said, so nothing about them is editable. */
export const chatMessageUpdateSchema = z.object({}).strict();
