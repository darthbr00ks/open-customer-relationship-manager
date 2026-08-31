import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/* Shared building blocks                                                      */
/* -------------------------------------------------------------------------- */

const uuid = () => z.uuid();
/** timestamptz column: accepts an ISO-8601 string, stores a Date. */
const ts = () => z.coerce.date();
/**
 * date column. Accepts `YYYY-MM-DD` (or any ISO date) and yields a Date, which
 * is what Prisma expects for a `@db.Date` field; responses render it back to
 * `YYYY-MM-DD`.
 */
const day = () => z.union([z.iso.date(), z.iso.datetime()]).pipe(z.coerce.date());

/** Scoping and audit fields accepted when creating any primary RM object. */
const sharedCreate = {
  workspace_id: uuid(),
  owner_user_id: uuid().nullish(),
  created_by_user_id: uuid().nullish(),
  updated_by_user_id: uuid().nullish(),
  archived_at: ts().nullish(),
};

/** Audit fields a client may reassign on update. */
const sharedUpdate = {
  owner_user_id: uuid().nullish(),
  updated_by_user_id: uuid().nullish(),
};

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
  parent_type: z.enum(['entity', 'person', 'deal', 'case', 'incident', 'request']),
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
/* Exception Log                                                              */
/* -------------------------------------------------------------------------- */

const exceptionLogFields = {
  timestamp: ts(),
  level: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']),
  error_code: z.string().trim().min(1).max(100),
  exception_type: z.string().max(255).nullish(),
  message: z.string().min(1),
  correlation_id: z.string().max(255).nullish(),
  request_id: z.string().max(255).nullish(),
  user_id: z.string().max(255).nullish(),
  tenant_id: z.string().max(255).nullish(),
  entity_id: z.string().max(255).nullish(),
  operation: z.string().max(255).nullish(),
  service: z.string().max(255).nullish(),
  environment: z.string().max(100).nullish(),
  version: z.string().max(100).nullish(),
  dependency: z.string().max(255).nullish(),
  retry_count: z.coerce.number().int().min(0),
  retryable: z.boolean(),
  duration_ms: z.coerce.number().int().min(0).nullish(),
  stack_trace: z.string().nullish(),
  cause: z.string().nullish(),
  data: z.string().nullish(),
};

export const exceptionLogCreateSchema = z.object({
  ...sharedCreate,
  ...exceptionLogFields,
  timestamp: exceptionLogFields.timestamp.default(() => new Date()),
  retry_count: exceptionLogFields.retry_count.default(0),
  retryable: exceptionLogFields.retryable.default(false),
});

export const exceptionLogUpdateSchema = z
  .object({ ...sharedUpdate, ...exceptionLogFields })
  .partial();
