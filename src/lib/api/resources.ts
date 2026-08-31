import { prisma } from '@/lib/prisma';
import * as v from '@/lib/schemas/resources';
import {
  emailAliasCreateSchema,
  emailAliasUpdateSchema,
  emailPolicyCreateSchema,
  emailPolicyUpdateSchema,
} from '@/lib/schemas/email';

import type { ResourceConfig, ResourceDelegate } from './resource';

/**
 * Prisma generates a distinct delegate type per model; the handlers only use
 * the common subset described by `ResourceDelegate`.
 */
const delegate = (model: unknown) => model as unknown as ResourceDelegate;

export const resources = {
  entities: {
    delegate: delegate(prisma.entity),
    label: 'Entity',
    createSchema: v.entityCreateSchema,
    updateSchema: v.entityUpdateSchema,
    orderBy: 'created_at',
    archivable: true,
  },
  persons: {
    delegate: delegate(prisma.person),
    label: 'Person',
    createSchema: v.personCreateSchema,
    updateSchema: v.personUpdateSchema,
    orderBy: 'created_at',
    archivable: true,
  },
  'entity-persons': {
    delegate: delegate(prisma.entityPerson),
    label: 'EntityPerson',
    createSchema: v.entityPersonCreateSchema,
    updateSchema: v.entityPersonUpdateSchema,
    orderBy: 'created_at',
    archivable: false,
    filters: ['entity_id', 'person_id'],
    dateOnlyFields: ['started_on', 'ended_on'],
  },
  deals: {
    delegate: delegate(prisma.deal),
    label: 'Deal',
    createSchema: v.dealCreateSchema,
    updateSchema: v.dealUpdateSchema,
    orderBy: 'created_at',
    archivable: true,
    dateOnlyFields: ['expected_close_date'],
  },
  cases: {
    delegate: delegate(prisma.supportCase),
    label: 'Case',
    createSchema: v.caseCreateSchema,
    updateSchema: v.caseUpdateSchema,
    orderBy: 'created_at',
    archivable: true,
  },
  incidents: {
    delegate: delegate(prisma.incident),
    label: 'Incident',
    createSchema: v.incidentCreateSchema,
    updateSchema: v.incidentUpdateSchema,
    orderBy: 'created_at',
    archivable: true,
  },
  'incident-cases': {
    delegate: delegate(prisma.incidentCase),
    label: 'IncidentCase',
    createSchema: v.incidentCaseCreateSchema,
    updateSchema: v.incidentCaseUpdateSchema,
    orderBy: 'linked_at',
    archivable: false,
    filters: ['incident_id', 'case_id'],
  },
  requests: {
    delegate: delegate(prisma.featureRequest),
    label: 'Request',
    createSchema: v.requestCreateSchema,
    updateSchema: v.requestUpdateSchema,
    orderBy: 'created_at',
    archivable: true,
    dateOnlyFields: ['target_date'],
  },
  notes: {
    delegate: delegate(prisma.note),
    label: 'Note',
    createSchema: v.noteCreateSchema,
    updateSchema: v.noteUpdateSchema,
    orderBy: 'created_at',
    archivable: false,
    filters: ['parent_id'],
  },
  'email-aliases': {
    delegate: delegate(prisma.emailAlias),
    label: 'EmailAlias',
    createSchema: emailAliasCreateSchema,
    updateSchema: emailAliasUpdateSchema,
    orderBy: 'created_at',
    archivable: false,
  },
  'email-policies': {
    delegate: delegate(prisma.emailAutomationPolicy),
    label: 'EmailAutomationPolicy',
    createSchema: emailPolicyCreateSchema,
    updateSchema: emailPolicyUpdateSchema,
    orderBy: 'created_at',
    archivable: false,
    filters: ['alias_id', 'profile_id', 'user_id'],
  },
  'exception-logs': {
    delegate: delegate(prisma.exceptionLog),
    label: 'ExceptionLog',
    createSchema: v.exceptionLogCreateSchema,
    updateSchema: v.exceptionLogUpdateSchema,
    orderBy: 'timestamp',
    archivable: true,
  },
} as const satisfies Record<string, ResourceConfig>;

export type ResourceName = keyof typeof resources;
