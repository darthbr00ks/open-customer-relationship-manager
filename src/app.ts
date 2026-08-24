import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

import * as schema from './db/schema.js';
import { HttpError } from './http/errors.js';
import { registerResource } from './http/resource.js';
import * as v from './schemas/index.js';

/** Postgres SQLSTATE for a unique constraint violation. */
const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current != null && depth < 5; depth += 1) {
    if ((current as { code?: unknown }).code === UNIQUE_VIOLATION) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.register(cors);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({ detail: error.detail });
    }
    if (error instanceof ZodError) {
      return reply.code(422).send({ detail: error.issues });
    }
    // Postgres unique_violation: a duplicate case/incident/request number is a
    // client error, not a server fault. Drizzle wraps driver errors, so the
    // SQLSTATE can sit on the error itself or on its cause.
    if (isUniqueViolation(error)) {
      return reply.code(409).send({ detail: 'Resource already exists' });
    }

    const status = (error as { statusCode?: number }).statusCode;
    if (typeof status === 'number' && status < 500) {
      return reply.code(status).send({ detail: (error as Error).message });
    }
    app.log.error(error);
    return reply.code(500).send({ detail: 'Internal server error' });
  });

  app.get('/health', async () => ({ status: 'ok' }));

  const prefix = '/api/v1';

  registerResource(app, {
    path: `${prefix}/entities`,
    label: 'Entity',
    table: schema.entity,
    createSchema: v.entityCreateSchema,
    updateSchema: v.entityUpdateSchema,
    orderBy: schema.entity.created_at,
  });

  registerResource(app, {
    path: `${prefix}/persons`,
    label: 'Person',
    table: schema.person,
    createSchema: v.personCreateSchema,
    updateSchema: v.personUpdateSchema,
    orderBy: schema.person.created_at,
  });

  registerResource(app, {
    path: `${prefix}/entity-persons`,
    label: 'EntityPerson',
    table: schema.entityPerson,
    createSchema: v.entityPersonCreateSchema,
    updateSchema: v.entityPersonUpdateSchema,
    orderBy: schema.entityPerson.created_at,
    filters: {
      entity_id: schema.entityPerson.entity_id,
      person_id: schema.entityPerson.person_id,
    },
  });

  registerResource(app, {
    path: `${prefix}/deals`,
    label: 'Deal',
    table: schema.deal,
    createSchema: v.dealCreateSchema,
    updateSchema: v.dealUpdateSchema,
    orderBy: schema.deal.created_at,
  });

  registerResource(app, {
    path: `${prefix}/cases`,
    label: 'Case',
    table: schema.supportCase,
    createSchema: v.caseCreateSchema,
    updateSchema: v.caseUpdateSchema,
    orderBy: schema.supportCase.created_at,
  });

  registerResource(app, {
    path: `${prefix}/incidents`,
    label: 'Incident',
    table: schema.incident,
    createSchema: v.incidentCreateSchema,
    updateSchema: v.incidentUpdateSchema,
    orderBy: schema.incident.created_at,
  });

  registerResource(app, {
    path: `${prefix}/incident-cases`,
    label: 'IncidentCase',
    table: schema.incidentCase,
    createSchema: v.incidentCaseCreateSchema,
    updateSchema: v.incidentCaseUpdateSchema,
    orderBy: schema.incidentCase.linked_at,
    filters: {
      incident_id: schema.incidentCase.incident_id,
      case_id: schema.incidentCase.case_id,
    },
  });

  registerResource(app, {
    path: `${prefix}/requests`,
    label: 'Request',
    table: schema.request,
    createSchema: v.requestCreateSchema,
    updateSchema: v.requestUpdateSchema,
    orderBy: schema.request.created_at,
  });

  return app;
}
