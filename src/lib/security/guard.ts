import { fail } from '@/lib/api/resource';
import { actorFor } from '@/lib/auth/current-user';

import { ALWAYS_VISIBLE_FIELDS } from './catalog';
import { permissionsFor } from './registry';
import type { ObjectAction, PermissionSet } from './types';

/**
 * Enforcement, for route handlers.
 *
 * Two things happen on every request that touches a permissioned object:
 *
 * 1. **The object check**, before any work. A caller who may not read deals
 *    gets a 403 rather than an empty list — an empty list is a lie, and it
 *    sends people looking for a data problem that does not exist.
 * 2. **The field pass**, on the way in and on the way out. Hidden fields are
 *    stripped from responses; non-writable fields are refused on writes.
 *
 * Writes are refused rather than silently stripped. Dropping a field the caller
 * sent looks exactly like a save that worked, and the caller has no way to tell
 * that the value they typed was thrown away.
 */

export type Guarded = { permissions: PermissionSet; response: null };
export type Refused = { permissions: null; response: Response };

/**
 * Resolve the caller's permissions and check one object action.
 *
 * The permission set comes back on success so a handler can go on to mask
 * fields without resolving it a second time.
 */
export async function guard(
  request: Request,
  objectKey: string,
  action: ObjectAction,
  workspaceId: string,
): Promise<Guarded | Refused> {
  const actor = actorFor(request);
  const permissions = await permissionsFor({
    workspace_id: workspaceId,
    user_id: actor.user_id,
  });

  if (!permissions.can(objectKey, action)) {
    return {
      permissions: null,
      response: fail(403, deniedMessage(permissions, objectKey, action)),
    };
  }
  return { permissions, response: null };
}

function deniedMessage(permissions: PermissionSet, objectKey: string, action: ObjectAction): string {
  const who = permissions.profile ? `The ${permissions.profile.name} profile` : 'You have no profile assigned, so nothing';
  return `${who} may not ${action} ${objectKey}.`;
}

/**
 * Drop the fields this caller may not see.
 *
 * Applied to every row on the way out. `id` and `workspace_id` always survive
 * (see `ALWAYS_VISIBLE_FIELDS`), because a response nobody can address is not a
 * protected response, it is a broken one.
 */
export function maskRow(
  permissions: PermissionSet,
  objectKey: string,
  row: Record<string, unknown>,
): Record<string, unknown> {
  if (!permissions.enforces) return row;

  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (ALWAYS_VISIBLE_FIELDS.includes(key) || permissions.fieldAccess(objectKey, key) !== 'hidden') {
      masked[key] = value;
    }
  }
  return masked;
}

export const maskRows = (
  permissions: PermissionSet,
  objectKey: string,
  rows: Record<string, unknown>[],
): Record<string, unknown>[] => rows.map((row) => maskRow(permissions, objectKey, row));

/**
 * The fields in a write the caller may not write, if any.
 *
 * `workspace_id` is exempt: it is the scope of the request rather than a value
 * being set, and every create carries it.
 */
export function unwritableFields(
  permissions: PermissionSet,
  objectKey: string,
  body: Record<string, unknown>,
): string[] {
  if (!permissions.enforces) return [];

  return Object.keys(body).filter(
    (key) => key !== 'workspace_id' && permissions.fieldAccess(objectKey, key) !== 'edit',
  );
}

/** The 403 for a write that named fields the caller may not set. */
export const fieldWriteRefusal = (objectKey: string, fields: string[]): Response =>
  fail(
    403,
    `You may not set ${fields.join(', ')} on ${objectKey}. Remove ${
      fields.length === 1 ? 'it' : 'them'
    } and try again.`,
  );
