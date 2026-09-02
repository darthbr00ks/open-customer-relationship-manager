import { NextResponse } from 'next/server';
import { z } from 'zod';

import { fail, toErrorResponse } from '@/lib/api/resource';
import { requireActor } from '@/lib/auth/current-user';
import { disconnectAccount, findAccount, toPublicAccount } from '@/lib/email/accounts';

const querySchema = z.object({ workspace_id: z.uuid() });

type RouteContext = { params: Promise<{ id: string }> };

/** One connected mailbox. */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { workspace_id } = querySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    const account = await findAccount(workspace_id, z.uuid().parse(id));
    if (!account) return fail(404, 'Email account not found');

    return NextResponse.json(toPublicAccount(account));
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * Disconnect a mailbox.
 *
 * DELETE, because that is what the caller means, but the row survives with its
 * secrets cleared — `email_message` points at it, and dropping it would take
 * the sender off every message it ever sent. See `disconnectAccount`.
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { response: denied } = requireActor(request);
    if (denied) return denied;

    const { id } = await context.params;
    const { workspace_id } = querySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    const account = await findAccount(workspace_id, z.uuid().parse(id));
    if (!account) return fail(404, 'Email account not found');

    return NextResponse.json(toPublicAccount(await disconnectAccount(account)));
  } catch (error) {
    return toErrorResponse(error);
  }
}
