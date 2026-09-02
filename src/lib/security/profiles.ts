import type { FieldAccess, Prisma, Profile } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { fieldsOf, isKnownField, isKnownObject, OBJECT_KEYS } from './catalog';
import type { ObjectAction } from './types';

/**
 * Managing profiles: reading them, writing their grants, and getting the first
 * one into a workspace without locking anybody out.
 *
 * The API routes are thin over this; the reason it is a module rather than
 * inline in the handlers is the bootstrap, which has to be reasoned about in
 * one place.
 */

/**
 * The grant matrix a profile carries, as the editor sends and receives it.
 *
 * The whole matrix is replaced in one call rather than patched row by row. A
 * permissions screen is edited as a grid and saved once; per-row CRUD would
 * turn one save into a hundred requests and leave the profile half-applied if
 * one of them failed.
 */
export type ProfileGrants = {
  objects: Record<string, Record<ObjectAction, boolean>>;
  /** `object_key` → `field_key` → access. Only restrictions need to appear. */
  fields: Record<string, Record<string, FieldAccess>>;
};

export type ProfileDetail = {
  id: string;
  workspace_id: string;
  name: string;
  key: string;
  description: string | null;
  is_admin: boolean;
  is_default: boolean;
  archived_at: string | null;
  created_at: string;
  /** How many users carry it, so an administrator can see what a change affects. */
  assigned_users: number;
  grants: ProfileGrants;
};

const emptyGrants = (): ProfileGrants => ({ objects: {}, fields: {} });

/**
 * Whether a workspace has taken control of its own permissions yet.
 *
 * Everything hangs off this. A workspace with no profiles is not "locked down
 * with nothing granted" — it has simply never been configured, and treating it
 * as a total denial would mean nobody could ever create the first profile.
 */
export const profilesConfigured = async (workspaceId: string): Promise<boolean> =>
  (await prisma.profile.count({ where: { workspace_id: workspaceId, archived_at: null } })) > 0;

export async function listProfiles(workspaceId: string): Promise<Profile[]> {
  return prisma.profile.findMany({
    where: { workspace_id: workspaceId, archived_at: null },
    orderBy: [{ is_admin: 'desc' }, { name: 'asc' }],
  });
}

export async function loadProfile(workspaceId: string, id: string): Promise<ProfileDetail | null> {
  const profile = await prisma.profile.findFirst({ where: { id, workspace_id: workspaceId } });
  if (!profile) return null;

  const [objects, fields, assigned] = await Promise.all([
    prisma.objectPermission.findMany({ where: { profile_id: profile.id } }),
    prisma.fieldPermission.findMany({ where: { profile_id: profile.id } }),
    prisma.profileAssignment.count({ where: { profile_id: profile.id } }),
  ]);

  const grants = emptyGrants();
  for (const row of objects) {
    grants.objects[row.object_key] = {
      read: row.can_read,
      create: row.can_create,
      edit: row.can_edit,
      delete: row.can_delete,
    };
  }
  for (const row of fields) {
    (grants.fields[row.object_key] ??= {})[row.field_key] = row.access;
  }

  return { ...toSummary(profile), assigned_users: assigned, grants };
}

export const toSummary = (profile: Profile) => ({
  id: profile.id,
  workspace_id: profile.workspace_id,
  name: profile.name,
  key: profile.key,
  description: profile.description,
  is_admin: profile.is_admin,
  is_default: profile.is_default,
  archived_at: profile.archived_at?.toISOString() ?? null,
  created_at: profile.created_at.toISOString(),
});

/**
 * Replace a profile's grants.
 *
 * In one transaction, and by deletion followed by insertion rather than a diff:
 * the editor always sends the complete matrix, so "what is stored" and "what
 * was sent" should be the same thing afterwards, and a diff is a longer way to
 * arrive at that with more ways to be wrong.
 *
 * Unknown object and field keys are dropped rather than rejected. They come
 * from a screen rendered against the catalog, so the only realistic source is a
 * resource or column that has since been removed — and refusing the whole save
 * because of a stale key would leave an administrator unable to fix anything.
 */
export async function replaceGrants(profileId: string, grants: ProfileGrants): Promise<void> {
  const objectRows: Prisma.ObjectPermissionCreateManyInput[] = [];
  for (const [objectKey, actions] of Object.entries(grants.objects ?? {})) {
    if (!isKnownObject(objectKey)) continue;
    // A row granting nothing is the same as no row; not storing it keeps the
    // table to what was actually granted.
    if (!actions.read && !actions.create && !actions.edit && !actions.delete) continue;

    objectRows.push({
      profile_id: profileId,
      object_key: objectKey,
      can_read: Boolean(actions.read),
      can_create: Boolean(actions.create),
      can_edit: Boolean(actions.edit),
      can_delete: Boolean(actions.delete),
    });
  }

  const fieldRows: Prisma.FieldPermissionCreateManyInput[] = [];
  for (const [objectKey, fields] of Object.entries(grants.fields ?? {})) {
    if (!isKnownObject(objectKey)) continue;
    for (const [fieldKey, access] of Object.entries(fields)) {
      if (!isKnownField(objectKey, fieldKey)) continue;
      // `edit` is the inherited default, so storing it would be a row that
      // changes nothing.
      if (access === 'edit') continue;
      fieldRows.push({ profile_id: profileId, object_key: objectKey, field_key: fieldKey, access });
    }
  }

  await prisma.$transaction([
    prisma.objectPermission.deleteMany({ where: { profile_id: profileId } }),
    prisma.fieldPermission.deleteMany({ where: { profile_id: profileId } }),
    ...(objectRows.length ? [prisma.objectPermission.createMany({ data: objectRows })] : []),
    ...(fieldRows.length ? [prisma.fieldPermission.createMany({ data: fieldRows })] : []),
  ]);
}

/** Full access to everything, for the profile that is allowed to have it. */
export const grantEverything = (): ProfileGrants => ({
  objects: Object.fromEntries(
    OBJECT_KEYS.map((key) => [key, { read: true, create: true, edit: true, delete: true }]),
  ),
  fields: {},
});

/** Read everything, change the day-to-day records, delete nothing. */
function standardUserGrants(): ProfileGrants {
  const objects: ProfileGrants['objects'] = {};
  for (const key of OBJECT_KEYS) {
    objects[key] = { read: true, create: true, edit: true, delete: false };
  }
  // The catalog and the price books are what everything else is priced from;
  // a starting profile reads them rather than rewriting them.
  for (const key of ['products', 'offerings', 'price-books', 'prices', 'price-tiers']) {
    objects[key] = { read: true, create: false, edit: false, delete: false };
  }
  return { objects, fields: {} };
}

export type BootstrapResult = { profiles: Profile[]; assigned: Profile | null };

/**
 * Give a workspace its first profiles, and make the caller an administrator.
 *
 * This is the answer to the obvious deadlock: enforcement means the profile
 * screens are themselves permissioned, so the first profile can never be
 * created by someone who already holds one. Rather than a back door in the
 * guard, the rule is that a workspace with no profiles is unconfigured and
 * behaves exactly as it did before profiles existed — and this is the one
 * action that ends that state, run by whoever is setting the workspace up.
 *
 * Idempotent: called twice, the second call assigns and changes nothing else.
 */
export async function bootstrapProfiles(
  workspaceId: string,
  userId: string | null,
): Promise<BootstrapResult> {
  const existing = await listProfiles(workspaceId);
  let administrator = existing.find((profile) => profile.is_admin) ?? null;

  if (existing.length === 0) {
    administrator = await prisma.profile.create({
      data: {
        workspace_id: workspaceId,
        name: 'Administrator',
        key: 'administrator',
        description: 'Full access to every object and field, including these settings.',
        is_admin: true,
        created_by_user_id: userId,
      },
    });
    await replaceGrants(administrator.id, grantEverything());

    const standard = await prisma.profile.create({
      data: {
        workspace_id: workspaceId,
        name: 'Standard User',
        key: 'standard-user',
        description:
          'Reads everything and works the day-to-day records. Cannot delete, and reads the catalog rather than editing it.',
        is_default: true,
        created_by_user_id: userId,
      },
    });
    await replaceGrants(standard.id, standardUserGrants());
  }

  // Whoever set this up must end up able to administer it, or they have just
  // locked themselves out of the screen they are standing on.
  if (userId && administrator) {
    await prisma.profileAssignment.upsert({
      where: { workspace_id_user_id: { workspace_id: workspaceId, user_id: userId } },
      create: { workspace_id: workspaceId, user_id: userId, profile_id: administrator.id },
      update: { profile_id: administrator.id },
    });
  }

  return { profiles: await listProfiles(workspaceId), assigned: administrator };
}

/**
 * Refuse to leave a workspace with no administrator.
 *
 * Checked before a profile is archived or has its admin flag cleared, because
 * either one can be the last of its kind and there is no way back from that
 * through the UI.
 */
export async function wouldOrphanWorkspace(profile: Profile): Promise<boolean> {
  if (!profile.is_admin) return false;
  const others = await prisma.profile.count({
    where: {
      workspace_id: profile.workspace_id,
      is_admin: true,
      archived_at: null,
      id: { not: profile.id },
    },
  });
  return others === 0;
}

/** Every field on every object, for the editor to render a grid against. */
export const catalogFor = (objectKey: string): string[] => fieldsOf(objectKey);
