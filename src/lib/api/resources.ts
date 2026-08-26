import { prisma } from '@/lib/prisma';
import * as v from '@/lib/schemas/resources';

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
  'chat-channels': {
    delegate: delegate(prisma.chatChannel),
    label: 'Chat channel',
    createSchema: v.chatChannelCreateSchema,
    updateSchema: v.chatChannelUpdateSchema,
    orderBy: 'created_at',
    archivable: true,
  },
  'chat-contacts': {
    delegate: delegate(prisma.chatContact),
    label: 'Chat contact',
    createSchema: v.chatContactCreateSchema,
    updateSchema: v.chatContactUpdateSchema,
    orderBy: 'created_at',
    archivable: false,
    filters: ['channel_id', 'person_id', 'entity_id'],
  },
  'chat-conversations': {
    delegate: delegate(prisma.chatConversation),
    label: 'Chat conversation',
    createSchema: v.chatConversationCreateSchema,
    updateSchema: v.chatConversationUpdateSchema,
    // The inbox is ordered by activity, not by when a thread was opened.
    orderBy: 'last_message_at',
    archivable: false,
    filters: ['channel_id', 'contact_id', 'entity_id', 'person_id', 'deal_id', 'case_id'],
  },
  'chat-messages': {
    delegate: delegate(prisma.chatMessage),
    label: 'Chat message',
    createSchema: v.chatMessageCreateSchema,
    updateSchema: v.chatMessageUpdateSchema,
    orderBy: 'created_at',
    archivable: false,
    filters: ['conversation_id'],
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
} as const satisfies Record<string, ResourceConfig>;

export type ResourceName = keyof typeof resources;
