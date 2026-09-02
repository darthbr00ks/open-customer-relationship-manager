import { NextResponse } from 'next/server';
import { z } from 'zod';

import { fail, toErrorResponse } from '@/lib/api/resource';
import { prisma } from '@/lib/prisma';
import { requirePermissionAdmin } from '@/lib/security/admin-guard';
import { loadProfile, replaceGrants } from '@/lib/security/profiles';

export const dynamic = 'force-dynamic';

const querySchema = z.object({ workspace_id: z.uuid() });

const actionsSchema = z.object({
  read: z.boolean().default(false),
  create: z.boolean().default(false),
  edit: z.boolean().default(false),
  delete: z.boolean().default(false),
});

/**
 * The whole matrix, replaced in one call.
 *
 * PUT rather than PATCH because that is what it is: the editor sends the
 * complete grid it is showing, and what comes back is what is stored. Patching
 * a permission grid row by row is how a profile ends up half-applied.
 */
const grantsSchema = z.object({
  objects: z.record(z.string(), actionsSchema).default({}),
  fields: z.record(z.string(), z.record(z.string(), z.enum(['hidden', 'read', 'edit']))).default({}),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { workspace_id } = querySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    const { response: denied } = await requirePermissionAdmin(request, workspace_id);
    if (denied) return denied;

    const profileId = z.uuid().parse(id);
    const profile = await prisma.profile.findFirst({ where: { id: profileId, workspace_id } });
    if (!profile) return fail(404, 'Profile not found');

    // An administrator's grants are not editable, because they are not
    // consulted: `AdminPermissionSet` short-circuits every check. Letting
    // someone save a restricted matrix here would show a lie on the screen.
    if (profile.is_admin) {
      return fail(409, 'An administrator profile always has full access; its grants are not editable.');
    }

    await replaceGrants(profileId, grantsSchema.parse(await request.json().catch(() => ({}))));

    return NextResponse.json(await loadProfile(workspace_id, profileId));
  } catch (error) {
    return toErrorResponse(error);
  }
}
