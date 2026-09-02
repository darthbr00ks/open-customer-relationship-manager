import { fail } from '@/lib/api/resource';
import { actorFor } from '@/lib/auth/current-user';

import { permissionsFor } from './registry';
import type { PermissionSet } from './types';

/**
 * The guard on the permission screens themselves.
 *
 * Only an administrator profile may read or write profiles. Without this,
 * anyone could grant themselves everything and every other check in the app
 * would be decorative.
 *
 * `!permissions.enforces` passes because that is a workspace with no profiles,
 * or a deployment running the open provider — in both cases there is no
 * administrator to be, and refusing would mean nobody could ever set profiles
 * up. It is the same door `bootstrapProfiles` walks through, and it closes the
 * moment the first profile exists.
 */
export async function requirePermissionAdmin(
  request: Request,
  workspaceId: string,
): Promise<{ permissions: PermissionSet; response: null } | { permissions: null; response: Response }> {
  const actor = actorFor(request);
  const permissions = await permissionsFor({ workspace_id: workspaceId, user_id: actor.user_id });

  if (permissions.enforces && !permissions.profile?.is_admin) {
    return {
      permissions: null,
      response: fail(403, 'Only an administrator profile may manage profiles and permissions.'),
    };
  }
  return { permissions, response: null };
}
