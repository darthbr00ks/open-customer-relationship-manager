import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET as listDeals, POST as createDeal } from '@/app/api/v1/deals/route';
import {
  DELETE as deleteDeal,
  GET as getDeal,
  PATCH as patchDeal,
  PUT as putDeal,
} from '@/app/api/v1/deals/[id]/route';
import { POST as archiveDeal } from '@/app/api/v1/deals/[id]/archive/route';
import { GET as listEntities } from '@/app/api/v1/entities/route';
import { GET as effectivePermissions } from '@/app/api/v1/permissions/me/route';
import { GET as permissionCatalogRoute } from '@/app/api/v1/permissions/catalog/route';
import { GET as listProfilesRoute, POST as createProfileRoute } from '@/app/api/v1/profiles/route';
import { PATCH as patchProfile, DELETE as archiveProfileRoute } from '@/app/api/v1/profiles/[id]/route';
import { PUT as putGrants } from '@/app/api/v1/profiles/[id]/permissions/route';
import { POST as bootstrapRoute } from '@/app/api/v1/profiles/bootstrap/route';
import {
  GET as listAssignments,
  POST as assignProfileRoute,
} from '@/app/api/v1/profile-assignments/route';
import { SESSION_COOKIE, encodeSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { fieldsOf, isKnownField, isKnownObject } from '@/lib/security/catalog';
import { ProfilePermissionSet } from '@/lib/security/permission-set';
import { bootstrapProfiles, replaceGrants } from '@/lib/security/profiles';
import { configuredPermissionProviderId, permissionsFor } from '@/lib/security/registry';

import { BASE, jsonRequest, resetDatabase, routeContext, uuid } from './helpers';

const workspace = uuid();

beforeAll(() => {
  process.env.AUTH_SESSION_SECRET = 'c'.repeat(48);
});

beforeEach(async () => {
  await resetDatabase();

  // Profiles only mean anything when there is someone to attach one to, so the
  // whole suite runs as though an identity provider were configured.
  vi.stubEnv('PERMISSIONS_PROVIDER', 'profiles');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const makeUser = (name: string) =>
  prisma.appUser.create({
    data: { auth_provider: 'auth0', external_id: `auth0|${uuid()}`, name, email: `${name}@test` },
  });

/** A request carrying a session for `userId`. */
function as(userId: string, url: string, method: string, body?: unknown) {
  const request = jsonRequest(url, method, body);
  request.headers.set(
    'cookie',
    `${SESSION_COOKIE}=${encodeSession({
      user_id: userId,
      provider: 'auth0',
      subject: `auth0|${userId}`,
      name: 'Test User',
      email: null,
      picture_url: null,
    })}`,
  );
  return request;
}

const makeProfile = (overrides: Record<string, unknown> = {}) =>
  prisma.profile.create({
    data: {
      workspace_id: workspace,
      name: 'Support Agent',
      key: `support-${uuid().slice(0, 8)}`,
      ...overrides,
    },
  });

const assign = (userId: string, profileId: string) =>
  prisma.profileAssignment.create({
    data: { workspace_id: workspace, user_id: userId, profile_id: profileId },
  });

const seedEntity = () =>
  prisma.entity.create({
    data: { workspace_id: workspace, name: 'Acme Corp', entity_type: 'company' },
  });

const seedDeal = async () => {
  const entity = await seedEntity();
  return prisma.deal.create({
    data: {
      workspace_id: workspace,
      entity_id: entity.id,
      name: 'Acme renewal',
      stage: 'qualification',
      amount: '25000.0000',
      currency_code: 'USD',
      probability: 40,
    },
  });
};

/* -------------------------------------------------------------------------- */
/* The catalog                                                                 */
/* -------------------------------------------------------------------------- */

describe('permission catalog', () => {
  it('derives fields from the registered schemas', () => {
    const fields = fieldsOf('deals');
    expect(fields).toContain('name');
    expect(fields).toContain('amount');
    expect(fields).toContain('stage');
    // `id` and `workspace_id` are how a record is addressed, not data about it.
    expect(fields).not.toContain('id');
    expect(fields).not.toContain('workspace_id');
  });

  it('knows what exists, so a permission row cannot name a typo', () => {
    expect(isKnownObject('deals')).toBe(true);
    expect(isKnownObject('dealz')).toBe(false);
    expect(isKnownField('deals', 'amount')).toBe(true);
    expect(isKnownField('deals', 'amont')).toBe(false);
  });

  it('is served without a workspace', async () => {
    const body = await (await permissionCatalogRoute()).json();
    const deals = body.objects.find((object: { object_key: string }) => object.object_key === 'deals');
    expect(deals.label).toBe('Deal');
    expect(deals.fields).toContain('amount');
  });
});

/* -------------------------------------------------------------------------- */
/* Resolving a permission set                                                  */
/* -------------------------------------------------------------------------- */

describe('ProfilePermissionSet', () => {
  const set = (
    objects: { object_key: string; can_read?: boolean; can_create?: boolean; can_edit?: boolean; can_delete?: boolean }[],
    fields: { object_key: string; field_key: string; access: 'hidden' | 'read' | 'edit' }[] = [],
  ) =>
    new ProfilePermissionSet(
      { id: uuid(), name: 'Support', key: 'support', is_admin: false },
      objects.map((object) => ({
        object_key: object.object_key,
        can_read: object.can_read ?? false,
        can_create: object.can_create ?? false,
        can_edit: object.can_edit ?? false,
        can_delete: object.can_delete ?? false,
      })),
      fields,
    );

  it('denies an object with no row at all', () => {
    const permissions = set([]);
    expect(permissions.can('deals', 'read')).toBe(false);
    expect(permissions.can('deals', 'edit')).toBe(false);
  });

  it('grants only what the row says', () => {
    const permissions = set([{ object_key: 'deals', can_read: true, can_edit: true }]);
    expect(permissions.can('deals', 'read')).toBe(true);
    expect(permissions.can('deals', 'edit')).toBe(true);
    expect(permissions.can('deals', 'create')).toBe(false);
    expect(permissions.can('deals', 'delete')).toBe(false);
  });

  it('inherits field access from the object when no field row exists', () => {
    expect(set([{ object_key: 'deals', can_read: true, can_edit: true }]).fieldAccess('deals', 'name')).toBe('edit');
    expect(set([{ object_key: 'deals', can_read: true }]).fieldAccess('deals', 'name')).toBe('read');
    expect(set([]).fieldAccess('deals', 'name')).toBe('hidden');
  });

  it('lets a field row restrict, but never widen', () => {
    const readOnlyObject = set(
      [{ object_key: 'deals', can_read: true }],
      [{ object_key: 'deals', field_key: 'amount', access: 'edit' }],
    );
    // `edit` on a field of a read-only object is still only readable.
    expect(readOnlyObject.fieldAccess('deals', 'amount')).toBe('read');

    const hiddenField = set(
      [{ object_key: 'deals', can_read: true, can_edit: true }],
      [{ object_key: 'deals', field_key: 'amount', access: 'hidden' }],
    );
    expect(hiddenField.fieldAccess('deals', 'amount')).toBe('hidden');
    expect(hiddenField.fieldAccess('deals', 'name')).toBe('edit');
  });

  it('keeps identifiers readable while the object is', () => {
    const permissions = set(
      [{ object_key: 'deals', can_read: true, can_edit: true }],
      [{ object_key: 'deals', field_key: 'id', access: 'hidden' }],
    );
    // A response nobody can address is broken, not protected.
    expect(permissions.fieldAccess('deals', 'id')).toBe('read');
    expect(set([]).fieldAccess('deals', 'id')).toBe('hidden');
  });

  it('splits a field list into visible and writable', () => {
    const permissions = set(
      [{ object_key: 'deals', can_read: true, can_edit: true }],
      [
        { object_key: 'deals', field_key: 'amount', access: 'hidden' },
        { object_key: 'deals', field_key: 'stage', access: 'read' },
      ],
    );
    expect(permissions.visibleFields('deals', ['name', 'amount', 'stage'])).toEqual(['name', 'stage']);
    expect(permissions.writableFields('deals', ['name', 'amount', 'stage'])).toEqual(['name']);
  });
});

describe('resolving whose permissions apply', () => {
  it('grants everything to an unconfigured workspace', async () => {
    // No profiles: never set up, not locked down. Denying here is the deadlock
    // where nobody can create the first profile.
    const user = await makeUser('ada');
    const permissions = await permissionsFor({ workspace_id: workspace, user_id: user.id });
    expect(permissions.enforces).toBe(false);
    expect(permissions.can('deals', 'delete')).toBe(true);
  });

  it('grants everything when nobody is signed in', async () => {
    await makeProfile();
    const permissions = await permissionsFor({ workspace_id: workspace, user_id: null });
    expect(permissions.enforces).toBe(false);
  });

  it('uses the assigned profile', async () => {
    const user = await makeUser('ada');
    const profile = await makeProfile();
    await replaceGrants(profile.id, {
      objects: { deals: { read: true, create: false, edit: false, delete: false } },
      fields: {},
    });
    await assign(user.id, profile.id);

    const permissions = await permissionsFor({ workspace_id: workspace, user_id: user.id });
    expect(permissions.profile?.id).toBe(profile.id);
    expect(permissions.can('deals', 'read')).toBe(true);
    expect(permissions.can('entities', 'read')).toBe(false);
  });

  it('falls back to the default profile for an unassigned user', async () => {
    const user = await makeUser('ada');
    await makeProfile({ name: 'Not the default', key: 'other' });
    const fallback = await makeProfile({ name: 'Everyone', key: 'everyone', is_default: true });
    await replaceGrants(fallback.id, {
      objects: { entities: { read: true, create: false, edit: false, delete: false } },
      fields: {},
    });

    const permissions = await permissionsFor({ workspace_id: workspace, user_id: user.id });
    expect(permissions.profile?.key).toBe('everyone');
    expect(permissions.can('entities', 'read')).toBe(true);
  });

  it('denies everything with no assignment and no default', async () => {
    const user = await makeUser('ada');
    await makeProfile({ key: 'lonely' });

    const permissions = await permissionsFor({ workspace_id: workspace, user_id: user.id });
    expect(permissions.enforces).toBe(true);
    expect(permissions.profile).toBeNull();
    expect(permissions.can('deals', 'read')).toBe(false);
  });

  it('treats an archived profile as no assignment', async () => {
    const user = await makeUser('ada');
    const retired = await makeProfile({ key: 'retired', archived_at: new Date() });
    const fallback = await makeProfile({ key: 'everyone', is_default: true });
    await replaceGrants(fallback.id, {
      objects: { entities: { read: true, create: false, edit: false, delete: false } },
      fields: {},
    });
    await assign(user.id, retired.id);

    const permissions = await permissionsFor({ workspace_id: workspace, user_id: user.id });
    expect(permissions.profile?.key).toBe('everyone');
  });

  it('short-circuits an administrator', async () => {
    const user = await makeUser('root');
    const admin = await makeProfile({ name: 'Administrator', key: 'administrator', is_admin: true });
    await assign(user.id, admin.id);

    const permissions = await permissionsFor({ workspace_id: workspace, user_id: user.id });
    // No grants were stored, and it does not matter.
    expect(permissions.can('deals', 'delete')).toBe(true);
    expect(permissions.profile?.is_admin).toBe(true);
  });

  it('enforces profiles only when there is someone to enforce against', () => {
    vi.stubEnv('PERMISSIONS_PROVIDER', '');
    vi.stubEnv('AUTH_PROVIDER', 'dev');
    expect(configuredPermissionProviderId()).toBe('open');

    vi.stubEnv('AUTH_PROVIDER', 'auth0');
    vi.stubEnv('AUTH0_DOMAIN', 'tenant.eu.auth0.com');
    vi.stubEnv('AUTH0_CLIENT_ID', 'cid');
    vi.stubEnv('AUTH0_CLIENT_SECRET', 'secret');
    expect(configuredPermissionProviderId()).toBe('profiles');
  });
});

/* -------------------------------------------------------------------------- */
/* Object-level enforcement                                                    */
/* -------------------------------------------------------------------------- */

describe('object-level security', () => {
  it('refuses a list rather than returning an empty one', async () => {
    const user = await makeUser('ada');
    const profile = await makeProfile();
    await assign(user.id, profile.id);
    await seedDeal();

    const response = await listDeals(as(user.id, `${BASE}/api/v1/deals?workspace_id=${workspace}`, 'GET'));
    // An empty list would send someone hunting for a data problem.
    expect(response.status).toBe(403);
    expect(String((await response.json()).detail)).toContain('may not read deals');
  });

  it('allows exactly the actions granted', async () => {
    const user = await makeUser('ada');
    const profile = await makeProfile();
    await replaceGrants(profile.id, {
      objects: { deals: { read: true, create: false, edit: true, delete: false } },
      fields: {},
    });
    await assign(user.id, profile.id);
    const deal = await seedDeal();

    expect(
      (await listDeals(as(user.id, `${BASE}/api/v1/deals?workspace_id=${workspace}`, 'GET'))).status,
    ).toBe(200);

    expect(
      (
        await createDeal(
          as(user.id, `${BASE}/api/v1/deals`, 'POST', {
            workspace_id: workspace,
            entity_id: deal.entity_id,
            name: 'New',
          }),
        )
      ).status,
    ).toBe(403);

    expect(
      (
        await patchDeal(
          as(user.id, `${BASE}/api/v1/deals/${deal.id}?workspace_id=${workspace}`, 'PATCH', {
            name: 'Renamed',
          }),
          routeContext(deal.id),
        )
      ).status,
    ).toBe(200);

    expect(
      (
        await deleteDeal(
          as(user.id, `${BASE}/api/v1/deals/${deal.id}?workspace_id=${workspace}`, 'DELETE'),
          routeContext(deal.id),
        )
      ).status,
    ).toBe(403);
  });

  it('treats archiving as an edit, not a delete', async () => {
    const user = await makeUser('ada');
    const profile = await makeProfile();
    await replaceGrants(profile.id, {
      objects: { deals: { read: true, create: false, edit: true, delete: false } },
      fields: {},
    });
    await assign(user.id, profile.id);
    const deal = await seedDeal();

    const response = await archiveDeal(
      as(user.id, `${BASE}/api/v1/deals/${deal.id}/archive?workspace_id=${workspace}`, 'POST'),
      routeContext(deal.id),
    );
    expect(response.status).toBe(200);
  });

  it('makes an upsert need both create and edit', async () => {
    const user = await makeUser('ada');
    const profile = await makeProfile();
    await replaceGrants(profile.id, {
      // Edit but no create: PUT must not become a way around the missing half.
      objects: { deals: { read: true, create: false, edit: true, delete: false } },
      fields: {},
    });
    await assign(user.id, profile.id);

    const id = uuid();
    const response = await putDeal(
      as(user.id, `${BASE}/api/v1/deals/${id}?workspace_id=${workspace}`, 'PUT', {
        name: 'Upserted',
      }),
      routeContext(id),
    );
    expect(response.status).toBe(403);
  });

  it('leaves other objects alone', async () => {
    const user = await makeUser('ada');
    const profile = await makeProfile();
    await replaceGrants(profile.id, {
      objects: {
        deals: { read: true, create: false, edit: false, delete: false },
        entities: { read: false, create: false, edit: false, delete: false },
      },
      fields: {},
    });
    await assign(user.id, profile.id);

    expect(
      (await listDeals(as(user.id, `${BASE}/api/v1/deals?workspace_id=${workspace}`, 'GET'))).status,
    ).toBe(200);
    expect(
      (await listEntities(as(user.id, `${BASE}/api/v1/entities?workspace_id=${workspace}`, 'GET'))).status,
    ).toBe(403);
  });
});

/* -------------------------------------------------------------------------- */
/* Field-level enforcement                                                     */
/* -------------------------------------------------------------------------- */

describe('field-level security', () => {
  const supportProfile = async (userId: string) => {
    const profile = await makeProfile();
    await replaceGrants(profile.id, {
      objects: { deals: { read: true, create: true, edit: true, delete: true } },
      fields: { deals: { amount: 'hidden', stage: 'read' } },
    });
    await assign(userId, profile.id);
    return profile;
  };

  it('strips hidden fields from a list', async () => {
    const user = await makeUser('ada');
    await supportProfile(user.id);
    await seedDeal();

    const rows = await (
      await listDeals(as(user.id, `${BASE}/api/v1/deals?workspace_id=${workspace}`, 'GET'))
    ).json();

    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty('amount');
    // Read-only is still readable.
    expect(rows[0].stage).toBe('qualification');
    expect(rows[0].name).toBe('Acme renewal');
    // Identifiers survive, or the row could not be opened.
    expect(rows[0].id).toBeDefined();
  });

  it('strips hidden fields from a single record', async () => {
    const user = await makeUser('ada');
    await supportProfile(user.id);
    const deal = await seedDeal();

    const row = await (
      await getDeal(
        as(user.id, `${BASE}/api/v1/deals/${deal.id}?workspace_id=${workspace}`, 'GET'),
        routeContext(deal.id),
      )
    ).json();

    expect(row).not.toHaveProperty('amount');
    expect(row.name).toBe('Acme renewal');
  });

  it('refuses a write to a hidden or read-only field, rather than dropping it', async () => {
    const user = await makeUser('ada');
    await supportProfile(user.id);
    const deal = await seedDeal();

    const response = await patchDeal(
      as(user.id, `${BASE}/api/v1/deals/${deal.id}?workspace_id=${workspace}`, 'PATCH', {
        name: 'Renamed',
        amount: '999999.0000',
      }),
      routeContext(deal.id),
    );

    // Silently dropping the field would look exactly like a save that worked.
    expect(response.status).toBe(403);
    expect(String((await response.json()).detail)).toContain('amount');

    const unchanged = await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } });
    expect(unchanged.name).toBe('Acme renewal');
    expect(String(unchanged.amount)).toBe('25000');
  });

  it('names a read-only field too', async () => {
    const user = await makeUser('ada');
    await supportProfile(user.id);
    const deal = await seedDeal();

    const response = await patchDeal(
      as(user.id, `${BASE}/api/v1/deals/${deal.id}?workspace_id=${workspace}`, 'PATCH', {
        stage: 'won',
      }),
      routeContext(deal.id),
    );
    expect(response.status).toBe(403);
    expect(String((await response.json()).detail)).toContain('stage');
  });

  it('allows a write that stays inside what is granted', async () => {
    const user = await makeUser('ada');
    await supportProfile(user.id);
    const deal = await seedDeal();

    const response = await patchDeal(
      as(user.id, `${BASE}/api/v1/deals/${deal.id}?workspace_id=${workspace}`, 'PATCH', {
        name: 'Renamed',
      }),
      routeContext(deal.id),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).name).toBe('Renamed');
  });

  it('refuses a create that sets a restricted field', async () => {
    const user = await makeUser('ada');
    await supportProfile(user.id);

    const entity = await seedEntity();
    const response = await createDeal(
      as(user.id, `${BASE}/api/v1/deals`, 'POST', {
        workspace_id: workspace,
        entity_id: entity.id,
        name: 'New deal',
        amount: '1000.0000',
      }),
    );
    expect(response.status).toBe(403);
    expect(await prisma.deal.count({ where: { workspace_id: workspace } })).toBe(0);
  });

  it('masks the response of a permitted create', async () => {
    const user = await makeUser('ada');
    await supportProfile(user.id);

    const entity = await seedEntity();
    const response = await createDeal(
      as(user.id, `${BASE}/api/v1/deals`, 'POST', {
        workspace_id: workspace,
        entity_id: entity.id,
        name: 'New deal',
        // `stage` is read-only for this profile and has a schema default, so a
        // create that does not mention it is exactly what the UI would send.
      }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).not.toHaveProperty('amount');
  });
});

/* -------------------------------------------------------------------------- */
/* Managing profiles                                                           */
/* -------------------------------------------------------------------------- */

describe('the profile API', () => {
  it('bootstraps a workspace and makes the caller an administrator', async () => {
    const user = await makeUser('ada');

    const response = await bootstrapRoute(
      as(user.id, `${BASE}/api/v1/profiles/bootstrap`, 'POST', { workspace_id: workspace }),
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.profiles.map((p: { key: string }) => p.key).sort()).toEqual([
      'administrator',
      'standard-user',
    ]);
    expect(body.assigned_profile.key).toBe('administrator');

    const permissions = await permissionsFor({ workspace_id: workspace, user_id: user.id });
    expect(permissions.profile?.is_admin).toBe(true);
  });

  it('is idempotent', async () => {
    const user = await makeUser('ada');
    await bootstrapProfiles(workspace, user.id);
    await bootstrapProfiles(workspace, user.id);
    expect(await prisma.profile.count({ where: { workspace_id: workspace } })).toBe(2);
  });

  it('lets only an administrator manage profiles', async () => {
    const admin = await makeUser('root');
    await bootstrapProfiles(workspace, admin.id);

    const standard = await prisma.profile.findFirstOrThrow({
      where: { workspace_id: workspace, key: 'standard-user' },
    });
    const agent = await makeUser('ada');
    await assign(agent.id, standard.id);

    expect(
      (await listProfilesRoute(as(agent.id, `${BASE}/api/v1/profiles?workspace_id=${workspace}`, 'GET')))
        .status,
    ).toBe(403);

    expect(
      (await listProfilesRoute(as(admin.id, `${BASE}/api/v1/profiles?workspace_id=${workspace}`, 'GET')))
        .status,
    ).toBe(200);

    // And cannot grant themselves anything.
    const escalation = await putGrants(
      as(agent.id, `${BASE}/api/v1/profiles/${standard.id}/permissions?workspace_id=${workspace}`, 'PUT', {
        objects: { deals: { read: true, create: true, edit: true, delete: true } },
        fields: {},
      }),
      routeContext(standard.id),
    );
    expect(escalation.status).toBe(403);
  });

  it('replaces the whole grant matrix on save', async () => {
    const admin = await makeUser('root');
    await bootstrapProfiles(workspace, admin.id);
    const profile = await makeProfile({ key: 'agent' });
    await replaceGrants(profile.id, {
      objects: { entities: { read: true, create: true, edit: true, delete: true } },
      fields: { entities: { notes: 'hidden' } },
    });

    const response = await putGrants(
      as(admin.id, `${BASE}/api/v1/profiles/${profile.id}/permissions?workspace_id=${workspace}`, 'PUT', {
        objects: { deals: { read: true, create: false, edit: false, delete: false } },
        fields: { deals: { amount: 'read' } },
      }),
      routeContext(profile.id),
    );
    expect(response.status).toBe(200);

    const detail = await response.json();
    // The previous entities grant is gone, not merged.
    expect(detail.grants.objects).toEqual({
      deals: { read: true, create: false, edit: false, delete: false },
    });
    expect(detail.grants.fields).toEqual({ deals: { amount: 'read' } });
  });

  it('does not store rows that change nothing', async () => {
    const profile = await makeProfile({ key: 'agent' });
    await replaceGrants(profile.id, {
      objects: {
        deals: { read: true, create: false, edit: false, delete: false },
        // Granting nothing is the same as no row.
        entities: { read: false, create: false, edit: false, delete: false },
      },
      // `edit` is the inherited default, so it is not a restriction.
      fields: { deals: { name: 'edit', amount: 'hidden' } },
    });

    expect(await prisma.objectPermission.count({ where: { profile_id: profile.id } })).toBe(1);
    const fields = await prisma.fieldPermission.findMany({ where: { profile_id: profile.id } });
    expect(fields.map((row) => row.field_key)).toEqual(['amount']);
  });

  it('drops keys that no longer exist rather than failing the save', async () => {
    const profile = await makeProfile({ key: 'agent' });
    await replaceGrants(profile.id, {
      objects: {
        deals: { read: true, create: false, edit: false, delete: false },
        removed_resource: { read: true, create: true, edit: true, delete: true },
      },
      fields: { deals: { removed_column: 'hidden' } },
    });

    expect(await prisma.objectPermission.count({ where: { profile_id: profile.id } })).toBe(1);
    expect(await prisma.fieldPermission.count({ where: { profile_id: profile.id } })).toBe(0);
  });

  it('refuses to edit an administrator profile’s grants', async () => {
    const admin = await makeUser('root');
    await bootstrapProfiles(workspace, admin.id);
    const adminProfile = await prisma.profile.findFirstOrThrow({
      where: { workspace_id: workspace, is_admin: true },
    });

    const response = await putGrants(
      as(admin.id, `${BASE}/api/v1/profiles/${adminProfile.id}/permissions?workspace_id=${workspace}`, 'PUT', {
        objects: {},
        fields: {},
      }),
      routeContext(adminProfile.id),
    );
    // Its grants are never consulted, so saving a restricted matrix would put a
    // lie on the screen.
    expect(response.status).toBe(409);
  });

  it('will not leave a workspace without an administrator', async () => {
    const admin = await makeUser('root');
    await bootstrapProfiles(workspace, admin.id);
    const adminProfile = await prisma.profile.findFirstOrThrow({
      where: { workspace_id: workspace, is_admin: true },
    });

    const archived = await archiveProfileRoute(
      as(admin.id, `${BASE}/api/v1/profiles/${adminProfile.id}?workspace_id=${workspace}`, 'DELETE'),
      routeContext(adminProfile.id),
    );
    expect(archived.status).toBe(409);

    const demoted = await patchProfile(
      as(admin.id, `${BASE}/api/v1/profiles/${adminProfile.id}?workspace_id=${workspace}`, 'PATCH', {
        is_admin: false,
      }),
      routeContext(adminProfile.id),
    );
    expect(demoted.status).toBe(409);
  });

  it('keeps one default profile per workspace', async () => {
    const admin = await makeUser('root');
    await bootstrapProfiles(workspace, admin.id);

    const created = await createProfileRoute(
      as(admin.id, `${BASE}/api/v1/profiles`, 'POST', {
        workspace_id: workspace,
        name: 'Everyone',
        key: 'everyone',
        is_default: true,
      }),
    );
    expect(created.status).toBe(201);

    const defaults = await prisma.profile.findMany({
      where: { workspace_id: workspace, is_default: true },
    });
    expect(defaults).toHaveLength(1);
    expect(defaults[0].key).toBe('everyone');
  });

  it('assigns and clears a profile', async () => {
    const admin = await makeUser('root');
    await bootstrapProfiles(workspace, admin.id);
    const agent = await makeUser('ada');
    const standard = await prisma.profile.findFirstOrThrow({
      where: { workspace_id: workspace, key: 'standard-user' },
    });

    await assignProfileRoute(
      as(admin.id, `${BASE}/api/v1/profile-assignments`, 'POST', {
        workspace_id: workspace,
        user_id: agent.id,
        profile_id: standard.id,
      }),
    );

    const listed = await (
      await listAssignments(
        as(admin.id, `${BASE}/api/v1/profile-assignments?workspace_id=${workspace}`, 'GET'),
      )
    ).json();
    expect(listed.users.find((row: { user_id: string }) => row.user_id === agent.id).profile_id).toBe(
      standard.id,
    );

    await assignProfileRoute(
      as(admin.id, `${BASE}/api/v1/profile-assignments`, 'POST', {
        workspace_id: workspace,
        user_id: agent.id,
        profile_id: null,
      }),
    );
    expect(
      await prisma.profileAssignment.count({ where: { workspace_id: workspace, user_id: agent.id } }),
    ).toBe(0);
  });

  it('will not borrow another workspace’s profile', async () => {
    const admin = await makeUser('root');
    await bootstrapProfiles(workspace, admin.id);
    const elsewhere = await prisma.profile.create({
      data: { workspace_id: uuid(), name: 'Admin elsewhere', key: 'admin', is_admin: true },
    });

    const response = await assignProfileRoute(
      as(admin.id, `${BASE}/api/v1/profile-assignments`, 'POST', {
        workspace_id: workspace,
        user_id: admin.id,
        profile_id: elsewhere.id,
      }),
    );
    expect(response.status).toBe(404);
  });
});

/* -------------------------------------------------------------------------- */
/* What the client is told                                                     */
/* -------------------------------------------------------------------------- */

describe('GET /api/v1/permissions/me', () => {
  it('reports nothing enforced for an unconfigured workspace', async () => {
    const user = await makeUser('ada');
    const body = await (
      await effectivePermissions(
        as(user.id, `${BASE}/api/v1/permissions/me?workspace_id=${workspace}`, 'GET'),
      )
    ).json();

    expect(body.enforced).toBe(false);
    expect(body.objects.deals.read).toBe(true);
    // Nothing to list when nothing is restricted.
    expect(body.fields).toEqual({});
  });

  it('lists only the restricted fields', async () => {
    const user = await makeUser('ada');
    const profile = await makeProfile();
    await replaceGrants(profile.id, {
      objects: { deals: { read: true, create: false, edit: true, delete: false } },
      fields: { deals: { amount: 'hidden', stage: 'read' } },
    });
    await assign(user.id, profile.id);

    const body = await (
      await effectivePermissions(
        as(user.id, `${BASE}/api/v1/permissions/me?workspace_id=${workspace}`, 'GET'),
      )
    ).json();

    expect(body.enforced).toBe(true);
    expect(body.profile.name).toBe('Support Agent');
    expect(body.objects.deals).toEqual({ read: true, create: false, edit: true, delete: false });
    expect(body.fields.deals).toEqual({ amount: 'hidden', stage: 'read' });
    // An object nobody may read reports every field as hidden, so it is not
    // worth enumerating separately — the object flags already said so.
    expect(body.objects.entities.read).toBe(false);
  });
});
