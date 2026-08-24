import { beforeEach, describe, expect, it } from 'vitest';

import { GET as listEntities, POST as createEntity } from '@/app/api/v1/entities/route';
import { GET as getEntity, PATCH as patchEntity } from '@/app/api/v1/entities/[id]/route';
import { POST as archiveEntity } from '@/app/api/v1/entities/[id]/archive/route';
import { POST as createCase } from '@/app/api/v1/cases/route';
import { POST as createDeal } from '@/app/api/v1/deals/route';
import { POST as createPerson } from '@/app/api/v1/persons/route';
import {
  GET as listEntityPersons,
  POST as createEntityPerson,
} from '@/app/api/v1/entity-persons/route';
import { GET as getEntityPerson } from '@/app/api/v1/entity-persons/[id]/route';

import { BASE, jsonRequest, resetDatabase, routeContext, uuid } from './helpers';

const workspace = uuid();
const otherWorkspace = uuid();

beforeEach(resetDatabase);

const makeEntity = async (overrides: Record<string, unknown> = {}) => {
  const response = await createEntity(
    jsonRequest(`${BASE}/api/v1/entities`, 'POST', {
      workspace_id: workspace,
      name: 'Acme Corp',
      entity_type: 'company',
      ...overrides,
    }),
  );
  expect(response.status).toBe(201);
  return response.json();
};

describe('entities', () => {
  it('creates an entity and applies schema defaults', async () => {
    const entity = await makeEntity();

    expect(entity.id).toEqual(expect.any(String));
    expect(entity.entity_type).toBe('company');
    expect(entity.relationship_stage).toBe('prospect');
    expect(entity.archived_at).toBeNull();
    expect(entity.created_at).toEqual(expect.any(String));
  });

  it('rejects an unknown enum value with 422', async () => {
    const response = await createEntity(
      jsonRequest(`${BASE}/api/v1/entities`, 'POST', {
        workspace_id: workspace,
        name: 'Bad',
        entity_type: 'spaceship',
      }),
    );

    expect(response.status).toBe(422);
    expect((await response.json()).detail).toBeInstanceOf(Array);
  });

  it('requires a workspace_id on list', async () => {
    const response = await listEntities(new Request(`${BASE}/api/v1/entities`));
    expect(response.status).toBe(422);
  });

  it('lists only the requested workspace', async () => {
    await makeEntity({ name: 'Ours' });
    await makeEntity({ workspace_id: otherWorkspace, name: 'Theirs' });

    const response = await listEntities(
      new Request(`${BASE}/api/v1/entities?workspace_id=${workspace}`),
    );
    const rows = await response.json();

    expect(rows.map((row: { name: string }) => row.name)).toEqual(['Ours']);
  });

  it('does not leak a record across workspaces on detail', async () => {
    const entity = await makeEntity();

    const response = await getEntity(
      new Request(`${BASE}/api/v1/entities/${entity.id}?workspace_id=${otherWorkspace}`),
      routeContext(entity.id),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ detail: 'Entity not found' });
  });

  it('applies a partial update without clearing untouched fields', async () => {
    const entity = await makeEntity({ city: 'Berlin', notes: 'keep me' });

    const response = await patchEntity(
      jsonRequest(`${BASE}/api/v1/entities/${entity.id}?workspace_id=${workspace}`, 'PATCH', {
        city: 'Hamburg',
      }),
      routeContext(entity.id),
    );

    const updated = await response.json();
    expect(updated.city).toBe('Hamburg');
    expect(updated.notes).toBe('keep me');
    expect(updated.name).toBe('Acme Corp');
  });

  it('archives a record without deleting it', async () => {
    const entity = await makeEntity();

    const archived = await archiveEntity(
      jsonRequest(`${BASE}/api/v1/entities/${entity.id}/archive?workspace_id=${workspace}`, 'POST'),
      routeContext(entity.id),
    );
    expect(archived.status).toBe(200);
    expect((await archived.json()).archived_at).toEqual(expect.any(String));

    const defaultList = await listEntities(
      new Request(`${BASE}/api/v1/entities?workspace_id=${workspace}`),
    );
    expect(await defaultList.json()).toHaveLength(0);

    const withArchived = await listEntities(
      new Request(`${BASE}/api/v1/entities?workspace_id=${workspace}&include_archived=true`),
    );
    expect(await withArchived.json()).toHaveLength(1);

    const detail = await getEntity(
      new Request(`${BASE}/api/v1/entities/${entity.id}?workspace_id=${workspace}`),
      routeContext(entity.id),
    );
    expect(detail.status).toBe(200);
  });

  it('bounds list results with limit and offset', async () => {
    for (let i = 0; i < 5; i += 1) {
      await makeEntity({ name: `Entity ${i}` });
    }

    const first = await (
      await listEntities(new Request(`${BASE}/api/v1/entities?workspace_id=${workspace}&limit=2`))
    ).json();
    const second = await (
      await listEntities(
        new Request(`${BASE}/api/v1/entities?workspace_id=${workspace}&limit=2&offset=2`),
      )
    ).json();

    expect(first).toHaveLength(2);
    expect(second).toHaveLength(2);
    expect(first.map((r: { id: string }) => r.id)).not.toEqual(
      expect.arrayContaining(second.map((r: { id: string }) => r.id)),
    );
  });

  it('rejects a limit above the maximum', async () => {
    const response = await listEntities(
      new Request(`${BASE}/api/v1/entities?workspace_id=${workspace}&limit=5000`),
    );
    expect(response.status).toBe(422);
  });
});

describe('cases', () => {
  it('returns 409 on a duplicate case number', async () => {
    const payload = {
      workspace_id: workspace,
      case_number: 'CASE-DUP',
      subject: 'First',
      description: 'First case.',
    };

    expect((await createCase(jsonRequest(`${BASE}/api/v1/cases`, 'POST', payload))).status).toBe(201);

    const duplicate = await createCase(
      jsonRequest(`${BASE}/api/v1/cases`, 'POST', { ...payload, subject: 'Second' }),
    );
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toEqual({ detail: 'Resource already exists' });
  });

  it('applies status and priority defaults', async () => {
    const response = await createCase(
      jsonRequest(`${BASE}/api/v1/cases`, 'POST', {
        workspace_id: workspace,
        case_number: 'CASE-1',
        subject: 'Login fails',
        description: 'Users cannot sign in.',
      }),
    );

    const created = await response.json();
    expect(created.status).toBe('new');
    expect(created.priority).toBe('medium');
  });
});

describe('deals', () => {
  it('keeps monetary precision and renders dates as YYYY-MM-DD', async () => {
    const entity = await makeEntity();

    const response = await createDeal(
      jsonRequest(`${BASE}/api/v1/deals`, 'POST', {
        workspace_id: workspace,
        name: 'Platform renewal',
        entity_id: entity.id,
        amount: '12345.6789',
        expected_close_date: '2026-11-30',
      }),
    );

    const deal = await response.json();
    expect(response.status).toBe(201);
    expect(deal.amount).toBe('12345.6789');
    expect(deal.currency_code).toBe('USD');
    expect(deal.stage).toBe('qualification');
    expect(deal.expected_close_date).toBe('2026-11-30');
  });
});

describe('entity-persons', () => {
  it('creates an affiliation and filters by entity', async () => {
    const entity = await makeEntity();
    const other = await makeEntity({ name: 'Globex' });

    const person = await (
      await createPerson(
        jsonRequest(`${BASE}/api/v1/persons`, 'POST', {
          workspace_id: workspace,
          first_name: 'Ada',
          last_name: 'Lovelace',
        }),
      )
    ).json();

    const created = await createEntityPerson(
      jsonRequest(`${BASE}/api/v1/entity-persons`, 'POST', {
        workspace_id: workspace,
        entity_id: entity.id,
        person_id: person.id,
        relationship_type: 'employee',
        job_title: 'Engineer',
      }),
    );
    const affiliation = await created.json();

    expect(created.status).toBe(201);
    expect(affiliation.status).toBe('current');
    expect(affiliation.is_primary_contact).toBe(false);

    const matching = await (
      await listEntityPersons(
        new Request(
          `${BASE}/api/v1/entity-persons?workspace_id=${workspace}&entity_id=${entity.id}`,
        ),
      )
    ).json();
    expect(matching).toHaveLength(1);

    const nonMatching = await (
      await listEntityPersons(
        new Request(`${BASE}/api/v1/entity-persons?workspace_id=${workspace}&entity_id=${other.id}`),
      )
    ).json();
    expect(nonMatching).toHaveLength(0);
  });

  it('scopes junction detail by workspace', async () => {
    const entity = await makeEntity();
    const person = await (
      await createPerson(
        jsonRequest(`${BASE}/api/v1/persons`, 'POST', {
          workspace_id: workspace,
          first_name: 'Grace',
        }),
      )
    ).json();

    const affiliation = await (
      await createEntityPerson(
        jsonRequest(`${BASE}/api/v1/entity-persons`, 'POST', {
          workspace_id: workspace,
          entity_id: entity.id,
          person_id: person.id,
          relationship_type: 'employee',
        }),
      )
    ).json();

    const response = await getEntityPerson(
      new Request(`${BASE}/api/v1/entity-persons/${affiliation.id}?workspace_id=${otherWorkspace}`),
      routeContext(affiliation.id),
    );
    expect(response.status).toBe(404);
  });
});
