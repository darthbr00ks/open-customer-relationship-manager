import { NextResponse } from 'next/server';
import { z } from 'zod';

import { toErrorResponse } from '@/lib/api/resource';
import { actorFor } from '@/lib/auth/current-user';
import { OBJECT_KEYS, fieldsOf } from '@/lib/security/catalog';
import { permissionsFor } from '@/lib/security/registry';
import { OBJECT_ACTIONS } from '@/lib/security/types';

export const dynamic = 'force-dynamic';

const schema = z.object({ workspace_id: z.uuid() });

/**
 * The caller's own effective permissions, flattened for the client.
 *
 * The UI needs these to hide what it must not show — a column for a field
 * nobody can read, an Edit button that would only ever 403. The server is still
 * the authority; this exists so the app is honest about what it is offering,
 * not to decide anything.
 *
 * Only restricted fields are listed. Sending the full access level of every
 * field of every object would be a payload proportional to the schema, on every
 * page load, to say "nothing is restricted" in the common case.
 */
export async function GET(request: Request) {
  try {
    const { workspace_id } = schema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const permissions = await permissionsFor({
      workspace_id,
      user_id: actorFor(request).user_id,
    });

    const objects: Record<string, Record<string, boolean>> = {};
    const fields: Record<string, Record<string, 'hidden' | 'read'>> = {};

    for (const objectKey of OBJECT_KEYS) {
      objects[objectKey] = Object.fromEntries(
        OBJECT_ACTIONS.map((action) => [action, permissions.can(objectKey, action)]),
      );

      if (!permissions.enforces) continue;
      for (const fieldKey of fieldsOf(objectKey)) {
        const access = permissions.fieldAccess(objectKey, fieldKey);
        if (access !== 'edit') (fields[objectKey] ??= {})[fieldKey] = access;
      }
    }

    return NextResponse.json({
      enforced: permissions.enforces,
      profile: permissions.profile,
      objects,
      fields,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
