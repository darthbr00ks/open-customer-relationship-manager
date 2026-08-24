import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/* -------------------------------------------------------------------------- */
/* Enums                                                                       */
/* -------------------------------------------------------------------------- */

export const entityTypeEnum = pgEnum('entity_type_enum', [
  'company',
  'nonprofit',
  'government',
  'education',
  'association',
  'household',
  'other',
]);

export const relationshipStageEnum = pgEnum('relationship_stage_enum', [
  'prospect',
  'customer',
  'partner',
  'former_customer',
  'inactive',
]);

export const relationshipTypeEnum = pgEnum('relationship_type_enum', [
  'employee',
  'owner',
  'advisor',
  'board_member',
  'volunteer',
  'contractor',
  'customer_contact',
  'other',
]);

export const affiliationStatusEnum = pgEnum('affiliation_status_enum', ['current', 'former']);

export const dealStageEnum = pgEnum('deal_stage_enum', [
  'qualification',
  'discovery',
  'proposal',
  'negotiation',
  'won',
  'lost',
]);

export const caseStatusEnum = pgEnum('case_status_enum', [
  'new',
  'open',
  'pending',
  'resolved',
  'closed',
]);

export const casePriorityEnum = pgEnum('case_priority_enum', ['low', 'medium', 'high', 'urgent']);

export const caseSourceEnum = pgEnum('case_source_enum', [
  'email',
  'phone',
  'web',
  'internal',
  'integration',
  'other',
]);

export const incidentStatusEnum = pgEnum('incident_status_enum', [
  'investigating',
  'identified',
  'monitoring',
  'resolved',
  'closed',
]);

export const incidentSeverityEnum = pgEnum('incident_severity_enum', [
  'low',
  'medium',
  'high',
  'critical',
]);

export const impactLevelEnum = pgEnum('impact_level_enum', [
  'minor',
  'moderate',
  'major',
  'critical',
]);

export const requestStatusEnum = pgEnum('request_status_enum', [
  'submitted',
  'under_review',
  'planned',
  'in_progress',
  'completed',
  'declined',
]);

export const requestPriorityEnum = pgEnum('request_priority_enum', ['low', 'medium', 'high']);

/* -------------------------------------------------------------------------- */
/* Shared columns                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Columns carried by every primary RM object: workspace scoping, audit trail,
 * and soft-deletion via `archived_at`.
 */
const sharedColumns = () => ({
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').notNull(),
  owner_user_id: uuid('owner_user_id'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  created_by_user_id: uuid('created_by_user_id'),
  updated_by_user_id: uuid('updated_by_user_id'),
  archived_at: timestamp('archived_at', { withTimezone: true }),
});

/* -------------------------------------------------------------------------- */
/* Tables                                                                      */
/* -------------------------------------------------------------------------- */

export const entity = pgTable(
  'entity',
  {
    ...sharedColumns(),
    name: varchar('name', { length: 255 }).notNull(),
    legal_name: varchar('legal_name', { length: 255 }),
    entity_type: entityTypeEnum('entity_type').notNull(),
    relationship_stage: relationshipStageEnum('relationship_stage').notNull().default('prospect'),
    description: text('description'),
    website_url: varchar('website_url', { length: 2048 }),
    primary_domain: varchar('primary_domain', { length: 255 }),
    primary_email: varchar('primary_email', { length: 320 }),
    primary_phone: varchar('primary_phone', { length: 50 }),
    address_line_1: varchar('address_line_1', { length: 255 }),
    address_line_2: varchar('address_line_2', { length: 255 }),
    city: varchar('city', { length: 100 }),
    region: varchar('region', { length: 100 }),
    postal_code: varchar('postal_code', { length: 20 }),
    country_code: varchar('country_code', { length: 2 }),
    notes: text('notes'),
  },
  (t) => [
    index('ix_entity_workspace_name').on(t.workspace_id, t.name),
    index('ix_entity_workspace_stage').on(t.workspace_id, t.relationship_stage),
    index('ix_entity_workspace_domain').on(t.workspace_id, t.primary_domain),
    index('ix_entity_workspace_id').on(t.workspace_id),
    index('ix_entity_owner_user_id').on(t.owner_user_id),
  ],
);

export const person = pgTable(
  'person',
  {
    ...sharedColumns(),
    first_name: varchar('first_name', { length: 100 }).notNull(),
    last_name: varchar('last_name', { length: 100 }),
    preferred_name: varchar('preferred_name', { length: 100 }),
    primary_email: varchar('primary_email', { length: 320 }),
    primary_phone: varchar('primary_phone', { length: 50 }),
    linkedin_url: varchar('linkedin_url', { length: 2048 }),
    description: text('description'),
    notes: text('notes'),
  },
  (t) => [
    index('ix_person_workspace_last_name').on(t.workspace_id, t.last_name),
    index('ix_person_workspace_email').on(t.workspace_id, t.primary_email),
    index('ix_person_workspace_id').on(t.workspace_id),
  ],
);

export const entityPerson = pgTable(
  'entity_person',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspace_id: uuid('workspace_id').notNull(),
    entity_id: uuid('entity_id')
      .notNull()
      .references(() => entity.id),
    person_id: uuid('person_id')
      .notNull()
      .references(() => person.id),
    relationship_type: relationshipTypeEnum('relationship_type').notNull(),
    job_title: varchar('job_title', { length: 255 }),
    department: varchar('department', { length: 255 }),
    is_primary_contact: boolean('is_primary_contact').notNull().default(false),
    status: affiliationStatusEnum('status').notNull().default('current'),
    started_on: date('started_on'),
    ended_on: date('ended_on'),
    notes: text('notes'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('uq_entity_person').on(t.workspace_id, t.entity_id, t.person_id),
    index('ix_entity_person_workspace').on(t.workspace_id),
  ],
);

export const deal = pgTable(
  'deal',
  {
    ...sharedColumns(),
    name: varchar('name', { length: 255 }).notNull(),
    entity_id: uuid('entity_id')
      .notNull()
      .references(() => entity.id),
    primary_contact_person_id: uuid('primary_contact_person_id').references(() => person.id),
    description: text('description'),
    stage: dealStageEnum('stage').notNull().default('qualification'),
    amount: numeric('amount', { precision: 18, scale: 4 }),
    currency_code: varchar('currency_code', { length: 3 }).notNull().default('USD'),
    probability: integer('probability'),
    expected_close_date: date('expected_close_date'),
    closed_at: timestamp('closed_at', { withTimezone: true }),
    next_step: text('next_step'),
    lost_reason: text('lost_reason'),
    notes: text('notes'),
  },
  (t) => [
    index('ix_deal_workspace_entity').on(t.workspace_id, t.entity_id),
    index('ix_deal_workspace_stage').on(t.workspace_id, t.stage),
    index('ix_deal_workspace_owner').on(t.workspace_id, t.owner_user_id),
    index('ix_deal_expected_close_date').on(t.workspace_id, t.expected_close_date),
  ],
);

export const supportCase = pgTable(
  'case',
  {
    ...sharedColumns(),
    case_number: varchar('case_number', { length: 50 }).notNull(),
    subject: varchar('subject', { length: 500 }).notNull(),
    description: text('description').notNull(),
    entity_id: uuid('entity_id').references(() => entity.id),
    reported_by_person_id: uuid('reported_by_person_id').references(() => person.id),
    status: caseStatusEnum('status').notNull().default('new'),
    priority: casePriorityEnum('priority').notNull().default('medium'),
    category: varchar('category', { length: 100 }),
    source: caseSourceEnum('source'),
    due_at: timestamp('due_at', { withTimezone: true }),
    resolved_at: timestamp('resolved_at', { withTimezone: true }),
    resolution: text('resolution'),
  },
  (t) => [
    unique('uq_case_number').on(t.workspace_id, t.case_number),
    index('ix_case_workspace_status').on(t.workspace_id, t.status),
    index('ix_case_workspace_priority').on(t.workspace_id, t.priority),
    index('ix_case_workspace_owner').on(t.workspace_id, t.owner_user_id),
  ],
);

export const incident = pgTable(
  'incident',
  {
    ...sharedColumns(),
    incident_number: varchar('incident_number', { length: 50 }).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description').notNull(),
    status: incidentStatusEnum('status').notNull().default('investigating'),
    severity: incidentSeverityEnum('severity').notNull(),
    started_at: timestamp('started_at', { withTimezone: true }),
    identified_at: timestamp('identified_at', { withTimezone: true }),
    resolved_at: timestamp('resolved_at', { withTimezone: true }),
    closed_at: timestamp('closed_at', { withTimezone: true }),
    root_cause: text('root_cause'),
    resolution: text('resolution'),
    internal_notes: text('internal_notes'),
    public_update: text('public_update'),
  },
  (t) => [
    unique('uq_incident_number').on(t.workspace_id, t.incident_number),
    index('ix_incident_workspace_status').on(t.workspace_id, t.status),
    index('ix_incident_workspace_severity').on(t.workspace_id, t.severity),
  ],
);

export const incidentCase = pgTable(
  'incident_case',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspace_id: uuid('workspace_id').notNull(),
    incident_id: uuid('incident_id')
      .notNull()
      .references(() => incident.id),
    case_id: uuid('case_id')
      .notNull()
      .references(() => supportCase.id),
    entity_id: uuid('entity_id')
      .notNull()
      .references(() => entity.id),
    impact_level: impactLevelEnum('impact_level'),
    impact_description: text('impact_description'),
    linked_at: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
    unlinked_at: timestamp('unlinked_at', { withTimezone: true }),
    created_by_user_id: uuid('created_by_user_id'),
  },
  (t) => [
    unique('uq_incident_case').on(t.incident_id, t.case_id),
    index('ix_incident_case_workspace').on(t.workspace_id),
    index('ix_incident_case_entity').on(t.workspace_id, t.entity_id),
  ],
);

export const request = pgTable(
  'request',
  {
    ...sharedColumns(),
    request_number: varchar('request_number', { length: 50 }).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description').notNull(),
    entity_id: uuid('entity_id').references(() => entity.id),
    requested_by_person_id: uuid('requested_by_person_id').references(() => person.id),
    status: requestStatusEnum('status').notNull().default('submitted'),
    priority: requestPriorityEnum('priority').notNull().default('medium'),
    category: varchar('category', { length: 100 }),
    business_need: text('business_need'),
    decision_notes: text('decision_notes'),
    target_date: date('target_date'),
    completed_at: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    unique('uq_request_number').on(t.workspace_id, t.request_number),
    index('ix_request_workspace_status').on(t.workspace_id, t.status),
    index('ix_request_workspace_priority').on(t.workspace_id, t.priority),
    index('ix_request_workspace_owner').on(t.workspace_id, t.owner_user_id),
  ],
);
