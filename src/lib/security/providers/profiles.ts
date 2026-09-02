import { prisma } from '@/lib/prisma';

import { profilesConfigured } from '../profiles';

import {
  AdminPermissionSet,
  NoPermissionSet,
  OpenPermissionSet,
  ProfilePermissionSet,
} from '../permission-set';
import type { PermissionContext, PermissionProvider, PermissionSet } from '../types';

/**
 * Permissions from the `profile` tables — the provider this app ships with.
 *
 * Resolution order, and why each step is where it is:
 *
 * 1. **Nobody signed in → grant everything.** There is no user to look a
 *    profile up for. This is not a hole being opened: it is the deployment
 *    having no authentication, which the README says plainly and which the
 *    route guard already reflects. Turning sign-in on is what makes profiles
 *    mean anything.
 * 2. **The workspace has no profiles → grant everything.** It has never been
 *    configured, not locked down. Denying here would be the deadlock: the
 *    profile screens are themselves permissioned, so nobody could create the
 *    first profile. `bootstrapProfiles` is what ends this state.
 * 3. **The user's own assignment**, for this workspace.
 * 4. **The workspace's default profile**, so a new user is useful on their
 *    first sign-in instead of seeing an empty app.
 * 5. **Nothing** → deny everything, and let the API say so.
 *
 * An administrator profile short-circuits to a set that grants everything,
 * because a workspace that can lock itself out of its own permission screens is
 * a workspace nobody can fix.
 */
export class ProfilePermissionProvider implements PermissionProvider {
  readonly id = 'profiles';
  readonly label = 'Profiles';
  readonly enforces = true;

  isConfigured(): boolean {
    return true;
  }

  async permissionsFor(context: PermissionContext): Promise<PermissionSet> {
    if (!context.user_id) {
      return new OpenPermissionSet();
    }

    if (!(await profilesConfigured(context.workspace_id))) {
      return new OpenPermissionSet();
    }

    const assignment = await prisma.profileAssignment.findUnique({
      where: {
        workspace_id_user_id: { workspace_id: context.workspace_id, user_id: context.user_id },
      },
      include: { profile: true },
    });

    // An archived profile is treated as no assignment at all, so retiring one
    // falls its holders back to the default rather than stranding them.
    const assigned = assignment && assignment.profile.archived_at == null ? assignment.profile : null;

    const resolved =
      assigned ??
      (await prisma.profile.findFirst({
        where: { workspace_id: context.workspace_id, is_default: true, archived_at: null },
        orderBy: { created_at: 'asc' },
      }));

    if (!resolved) return new NoPermissionSet();

    const summary = {
      id: resolved.id,
      name: resolved.name,
      key: resolved.key,
      is_admin: resolved.is_admin,
    };
    if (resolved.is_admin) return new AdminPermissionSet(summary);

    const [objectGrants, fieldGrants] = await Promise.all([
      prisma.objectPermission.findMany({ where: { profile_id: resolved.id } }),
      prisma.fieldPermission.findMany({ where: { profile_id: resolved.id } }),
    ]);

    return new ProfilePermissionSet(summary, objectGrants, fieldGrants);
  }
}
