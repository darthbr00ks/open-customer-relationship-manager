import { NextResponse } from 'next/server';
import { z } from 'zod';

import { fail, toErrorResponse } from '@/lib/api/resource';
import { prisma } from '@/lib/prisma';
import { requirePermissionAdmin } from '@/lib/security/admin-guard';

export const dynamic = 'force-dynamic';

const listSchema = z.object({ workspace_id: z.uuid() });

const assignSchema = z.object({
  workspace_id: z.uuid(),
  user_id: z.uuid(),
  /** Null clears the assignment, dropping the user back to the default profile. */
  profile_id: z.uuid().nullable(),
});

/**
 * Who carries which profile in this workspace.
 *
 * Lists every user known to the app, assigned or not, because the question an
 * administrator has is "who has what" — and a user with no assignment is the
 * interesting case, not one to hide.
 */
export async function GET(request: Request) {
  try {
    const { workspace_id } = listSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    const { response: denied } = await requirePermissionAdmin(request, workspace_id);
    if (denied) return denied;

    const [users, assignments] = await Promise.all([
      prisma.appUser.findMany({ orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 500 }),
      prisma.profileAssignment.findMany({ where: { workspace_id } }),
    ]);

    const byUser = new Map(assignments.map((row) => [row.user_id, row.profile_id]));

    return NextResponse.json({
      users: users.map((user) => ({
        user_id: user.id,
        name: user.name,
        email: user.email,
        last_login_at: user.last_login_at?.toISOString() ?? null,
        profile_id: byUser.get(user.id) ?? null,
      })),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** Assign a profile, or clear the assignment with `profile_id: null`. */
export async function POST(request: Request) {
  try {
    const input = assignSchema.parse(await request.json().catch(() => ({})));

    const { response: denied } = await requirePermissionAdmin(request, input.workspace_id);
    if (denied) return denied;

    if (!input.profile_id) {
      await prisma.profileAssignment.deleteMany({
        where: { workspace_id: input.workspace_id, user_id: input.user_id },
      });
      return NextResponse.json({ user_id: input.user_id, profile_id: null });
    }

    // The profile has to belong to this workspace, or an administrator could
    // borrow another workspace's grants by id.
    const profile = await prisma.profile.findFirst({
      where: { id: input.profile_id, workspace_id: input.workspace_id, archived_at: null },
    });
    if (!profile) return fail(404, 'Profile not found in this workspace');

    const assignment = await prisma.profileAssignment.upsert({
      where: {
        workspace_id_user_id: { workspace_id: input.workspace_id, user_id: input.user_id },
      },
      create: {
        workspace_id: input.workspace_id,
        user_id: input.user_id,
        profile_id: profile.id,
      },
      update: { profile_id: profile.id },
    });

    return NextResponse.json({
      user_id: assignment.user_id,
      profile_id: assignment.profile_id,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
