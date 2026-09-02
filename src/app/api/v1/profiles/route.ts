import { NextResponse } from 'next/server';
import { z } from 'zod';

import { toErrorResponse } from '@/lib/api/resource';
import { actorFor } from '@/lib/auth/current-user';
import { requirePermissionAdmin } from '@/lib/security/admin-guard';
import {
  grantEverything,
  listProfiles,
  profilesConfigured,
  replaceGrants,
  toSummary,
} from '@/lib/security/profiles';
import { permissionProvider } from '@/lib/security/registry';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const listSchema = z.object({ workspace_id: z.uuid() });

const createSchema = z.object({
  workspace_id: z.uuid(),
  name: z.string().min(1).max(255),
  /** Lowercase kebab-case, so it reads the same in a seed as in the UI. */
  key: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9-]*$/, 'Use lowercase letters, digits and hyphens'),
  description: z.string().nullish(),
  is_admin: z.boolean().default(false),
  is_default: z.boolean().default(false),
});

/** The workspace's profiles, plus whether permissions are being enforced at all. */
export async function GET(request: Request) {
  try {
    const { workspace_id } = listSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    const { response: denied } = await requirePermissionAdmin(request, workspace_id);
    if (denied) return denied;

    const provider = permissionProvider();
    return NextResponse.json({
      provider: { id: provider.id, label: provider.label, enforces: provider.enforces },
      // False means this workspace has never been configured, so everything is
      // permitted — which the settings screen has to say out loud.
      configured: await profilesConfigured(workspace_id),
      profiles: (await listProfiles(workspace_id)).map(toSummary),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const input = createSchema.parse(body);

    const { response: denied } = await requirePermissionAdmin(request, input.workspace_id);
    if (denied) return denied;

    const profile = await prisma.$transaction(async (tx) => {
      // Only one default per workspace, or an unassigned user's permissions
      // would depend on which row came back first.
      if (input.is_default) {
        await tx.profile.updateMany({
          where: { workspace_id: input.workspace_id, is_default: true },
          data: { is_default: false },
        });
      }
      return tx.profile.create({
        data: {
          workspace_id: input.workspace_id,
          name: input.name,
          key: input.key,
          description: input.description ?? null,
          is_admin: input.is_admin,
          is_default: input.is_default,
          created_by_user_id: actorFor(request).user_id,
        },
      });
    });

    // A new profile starts with nothing granted; an administrator is the
    // exception, since a profile that cannot administer is not one.
    if (profile.is_admin) {
      await replaceGrants(profile.id, grantEverything());
    }

    return NextResponse.json(toSummary(profile), { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
