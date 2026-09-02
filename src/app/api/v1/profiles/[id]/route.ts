import { NextResponse } from 'next/server';
import { z } from 'zod';

import { fail, toErrorResponse } from '@/lib/api/resource';
import { actorFor } from '@/lib/auth/current-user';
import { prisma } from '@/lib/prisma';
import { requirePermissionAdmin } from '@/lib/security/admin-guard';
import { loadProfile, toSummary, wouldOrphanWorkspace } from '@/lib/security/profiles';

export const dynamic = 'force-dynamic';

const querySchema = z.object({ workspace_id: z.uuid() });

const updateSchema = z
  .object({
    name: z.string().min(1).max(255),
    description: z.string().nullish(),
    is_admin: z.boolean(),
    is_default: z.boolean(),
  })
  .partial();

type RouteContext = { params: Promise<{ id: string }> };

/** One profile, with its full grant matrix. */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { workspace_id } = querySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    const { response: denied } = await requirePermissionAdmin(request, workspace_id);
    if (denied) return denied;

    const profile = await loadProfile(workspace_id, z.uuid().parse(id));
    if (!profile) return fail(404, 'Profile not found');

    return NextResponse.json(profile);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { workspace_id } = querySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    const { response: denied } = await requirePermissionAdmin(request, workspace_id);
    if (denied) return denied;

    const existing = await prisma.profile.findFirst({
      where: { id: z.uuid().parse(id), workspace_id },
    });
    if (!existing) return fail(404, 'Profile not found');

    const input = updateSchema.parse(await request.json().catch(() => ({})));

    // Standing down the last administrator is unrecoverable through the UI.
    if (input.is_admin === false && (await wouldOrphanWorkspace(existing))) {
      return fail(409, 'This is the workspace’s only administrator profile.');
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (input.is_default) {
        await tx.profile.updateMany({
          where: { workspace_id, is_default: true, id: { not: existing.id } },
          data: { is_default: false },
        });
      }
      return tx.profile.update({
        where: { id: existing.id },
        data: { ...input, updated_by_user_id: actorFor(request).user_id },
      });
    });

    return NextResponse.json(toSummary(updated));
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * Archive a profile.
 *
 * Archived rather than deleted: `profile_assignment` points at it, and its
 * holders fall back to the workspace default rather than losing their access
 * mid-session.
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { workspace_id } = querySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    const { response: denied } = await requirePermissionAdmin(request, workspace_id);
    if (denied) return denied;

    const existing = await prisma.profile.findFirst({
      where: { id: z.uuid().parse(id), workspace_id },
    });
    if (!existing) return fail(404, 'Profile not found');

    if (await wouldOrphanWorkspace(existing)) {
      return fail(409, 'This is the workspace’s only administrator profile.');
    }

    const archived = await prisma.profile.update({
      where: { id: existing.id },
      data: { archived_at: new Date(), is_default: false },
    });
    return NextResponse.json(toSummary(archived));
  } catch (error) {
    return toErrorResponse(error);
  }
}
