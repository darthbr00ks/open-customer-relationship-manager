import { NextResponse } from 'next/server';
import { z } from 'zod';

import { toErrorResponse } from '@/lib/api/resource';
import { actorFor } from '@/lib/auth/current-user';
import { requirePermissionAdmin } from '@/lib/security/admin-guard';
import { bootstrapProfiles, toSummary } from '@/lib/security/profiles';

export const dynamic = 'force-dynamic';

const schema = z.object({ workspace_id: z.uuid() });

/**
 * Turn permissions on for a workspace.
 *
 * Creates an Administrator and a Standard User profile and assigns the caller
 * to the former. Until this runs, a workspace has no profiles and everything is
 * permitted — see `bootstrapProfiles` for why that is the only way the first
 * profile can ever be created.
 *
 * Idempotent, and guarded like every other permission screen: once profiles
 * exist, only an administrator can call it.
 */
export async function POST(request: Request) {
  try {
    const { workspace_id } = schema.parse(await request.json().catch(() => ({})));

    const { response: denied } = await requirePermissionAdmin(request, workspace_id);
    if (denied) return denied;

    const result = await bootstrapProfiles(workspace_id, actorFor(request).user_id);

    return NextResponse.json({
      profiles: result.profiles.map(toSummary),
      assigned_profile: result.assigned ? toSummary(result.assigned) : null,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
