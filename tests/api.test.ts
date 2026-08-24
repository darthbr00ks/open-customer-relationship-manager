import { randomUUID } from 'node:crypto';

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { db } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';

let app: FastifyInstance;
const workspace = randomUUID();
const otherWorkspace = randomUUID();

beforeAll(async () => {
  app = buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  // Child tables first: the junctions carry FKs back to entity/person/case.
  await db.delete(schema.incidentCase);
  await db.delete(schema.entityPerson);
  await db.delete(schema.deal);
  await db.delete(schema.request);
  await db.delete(schema.supportCase);
  await db.delete(schema.incident);
  await db.delete(schema.person);
  await db.delete(schema.entity);
});

const createEntity = async (overrides: Record<string, unknown> = {}) => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/entities',
    payload: {
      workspace_id: workspace,
      name: 'Acme Corp',
      entity_type: 'company',
      ...overrides,
    },
  });
  expect(response.statusCode).toBe(201);
  return response.json();
};

describe('health', () => {
  it('reports ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});

describe('entities', () => {
  it('creates an entity and applies schema defaults', async () => {
    const entity = await createEntity();

    expect(entity.id).toEqual(expect.any(String));
    expect(entity.name).toBe('Acme Corp');
    expect(entity.entity_type).toBe('company');
    expect(entity.relationship_stage).toBe('prospect');
    expect(entity.archived_at).toBeNull();
    expect(entity.created_at).toEqual(expect.any(String));
  });

  it('rejects an unknown enum value with 422', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/entities',
      payload: { workspace_id: workspace, name: 'Bad', entity_type: 'spaceship' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().detail).toBeInstanceOf(Array);
  });

  it('requires a workspace_id on list', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/entities' });
    expect(response.statusCode).toBe(422);
  });

  it('lists only the requested workspace', async () => {
    await createEntity({ name: 'Ours' });
    await createEntity({ workspace_id: otherWorkspace, name: 'Theirs' });

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/entities?workspace_id=${workspace}`,
    });

    expect(response.statusCode).toBe(200);
    const names = response.json().map((row: { name: string }) => row.name);
    expect(names).toEqual(['Ours']);
  });

  it('does not leak a record across workspaces on detail', async () => {
    const entity = await createEntity();

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/entities/${entity.id}?workspace_id=${otherWorkspace}`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ detail: 'Entity not found' });
  });

  it('applies a partial update without clearing untouched fields', async () => {
    const entity = await createEntity({ city: 'Berlin', notes: 'keep me' });

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/entities/${entity.id}?workspace_id=${workspace}`,
      payload: { city: 'Hamburg' },
    });

    expect(response.statusCode).toBe(200);
    const updated = response.json();
    expect(updated.city).toBe('Hamburg');
    expect(updated.notes).toBe('keep me');
    expect(updated.name).toBe('Acme Corp');
  });

  it('archives a record without deleting it', async () => {
    const entity = await createEntity();

    const archived = await app.inject({
      method: 'POST',
      url: `/api/v1/entities/${entity.id}/archive?workspace_id=${workspace}`,
    });
    expect(archived.statusCode).toBe(200);
    expect(archived.json().archived_at).toEqual(expect.any(String));

    const defaultList = await app.inject({
      method: 'GET',
      url: `/api/v1/entities?workspace_id=${workspace}`,
    });
    expect(defaultList.json()).toHaveLength(0);

    const withArchived = await app.inject({
      method: 'GET',
      url: `/api/v1/entities?workspace_id=${workspace}&include_archived=true`,
    });
    expect(withArchived.json()).toHaveLength(1);

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/entities/${entity.id}?workspace_id=${workspace}`,
    });
    expect(detail.statusCode).toBe(200);
  });

  it('bounds list results with limit and offset', async () => {
    for (let i = 0; i < 5; i += 1) {
      await createEntity({ name: `Entity ${i}` });
    }

    const firstPage = await app.inject({
      method: 'GET',
      url: `/api/v1/entities?workspace_id=${workspace}&limit=2`,
    });
    expect(firstPage.json()).toHaveLength(2);

    const secondPage = await app.inject({
      method: 'GET',
      url: `/api/v1/entities?workspace_id=${workspace}&limit=2&offset=2`,
    });
    expect(secondPage.json()).toHaveLength(2);

    const firstIds = firstPage.json().map((row: { id: string }) => row.id);
    const secondIds = secondPage.json().map((row: { id: string }) => row.id);
    expect(firstIds).not.toEqual(expect.arrayContaining(secondIds));
  });

  it('rejects a limit above the maximum', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/entities?workspace_id=${workspace}&limit=5000`,
    });
    expect(response.statusCode).toBe(422);
  });
});

describe('entity-persons', () => {
  it('creates an affiliation and filters by entity', async () => {
    const entity = await createEntity();
    const otherEntity = await createEntity({ name: 'Globex' });

    const personResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/persons',
      payload: { workspace_id: workspace, first_name: 'Ada', last_name: 'Lovelace' },
    });
    expect(personResponse.statusCode).toBe(201);
    const person = personResponse.json();

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/entity-persons',
      payload: {
        workspace_id: workspace,
        entity_id: entity.id,
        person_id: person.id,
        relationship_type: 'employee',
        job_title: 'Engineer',
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().status).toBe('current');
    expect(created.json().is_primary_contact).toBe(false);

    const matching = await app.inject({
      method: 'GET',
      url: `/api/v1/entity-persons?workspace_id=${workspace}&entity_id=${entity.id}`,
    });
    expect(matching.json()).toHaveLength(1);

    const nonMatching = await app.inject({
      method: 'GET',
      url: `/api/v1/entity-persons?workspace_id=${workspace}&entity_id=${otherEntity.id}`,
    });
    expect(nonMatching.json()).toHaveLength(0);
  });

  it('has no archive endpoint', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/entity-persons/${randomUUID()}/archive?workspace_id=${workspace}`,
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('cases and incidents', () => {
  it('links a case to an incident and stamps linked_at', async () => {
    const entity = await createEntity();

    const caseResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      payload: {
        workspace_id: workspace,
        case_number: 'CASE-1',
        subject: 'Login fails',
        description: 'Users cannot sign in.',
        entity_id: entity.id,
      },
    });
    expect(caseResponse.statusCode).toBe(201);
    expect(caseResponse.json().status).toBe('new');
    expect(caseResponse.json().priority).toBe('medium');

    const incidentResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/incidents',
      payload: {
        workspace_id: workspace,
        incident_number: 'INC-1',
        title: 'Auth outage',
        description: 'Auth provider degraded.',
        severity: 'high',
      },
    });
    expect(incidentResponse.statusCode).toBe(201);
    expect(incidentResponse.json().status).toBe('investigating');

    const link = await app.inject({
      method: 'POST',
      url: '/api/v1/incident-cases',
      payload: {
        workspace_id: workspace,
        incident_id: incidentResponse.json().id,
        case_id: caseResponse.json().id,
        entity_id: entity.id,
        impact_level: 'major',
      },
    });
    expect(link.statusCode).toBe(201);
    expect(link.json().linked_at).toEqual(expect.any(String));
    expect(link.json().unlinked_at).toBeNull();
  });

  it('enforces the unique case number within a workspace', async () => {
    const payload = {
      workspace_id: workspace,
      case_number: 'CASE-DUP',
      subject: 'First',
      description: 'First case.',
    };

    expect((await app.inject({ method: 'POST', url: '/api/v1/cases', payload })).statusCode).toBe(
      201,
    );

    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      payload: { ...payload, subject: 'Second' },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toEqual({ detail: 'Resource already exists' });
  });
});

describe('deals', () => {
  it('stores monetary amounts without precision loss', async () => {
    const entity = await createEntity();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/deals',
      payload: {
        workspace_id: workspace,
        name: 'Platform renewal',
        entity_id: entity.id,
        amount: '12345.6789',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().amount).toBe('12345.6789');
    expect(response.json().currency_code).toBe('USD');
    expect(response.json().stage).toBe('qualification');
  });
});
