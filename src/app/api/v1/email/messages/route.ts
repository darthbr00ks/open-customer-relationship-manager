import { NextResponse } from 'next/server';
import { z } from 'zod';

import { fail, serializeRow, toErrorResponse } from '@/lib/api/resource';
import { requireActor } from '@/lib/auth/current-user';
import { defaultAccountFor, findAccount } from '@/lib/email/accounts';
import { InvalidEmailError, MAX_BODY_LENGTH, MAX_SUBJECT_LENGTH, sendEmail } from '@/lib/email/send';
import { prisma } from '@/lib/prisma';
import { NOTE_PARENT_TYPES } from '@/lib/schemas/resources';

/**
 * Sending mail, and the log of what was sent.
 *
 * `POST` sends through a connected mailbox and answers with the stored message,
 * which carries `status` and `error` — so a rejected address comes back as a
 * `failed` message the composer can show rather than a bare 500. A refusal by
 * the *provider* is a recorded outcome, not a broken request; only a malformed
 * request is a 4xx.
 */

const sendSchema = z.object({
  workspace_id: z.uuid(),
  /** Which mailbox to send through; omitted means "the obvious one" — see `defaultAccountFor`. */
  account_id: z.uuid().optional(),
  to: z.string().min(1).max(4000),
  cc: z.string().max(4000).nullish(),
  bcc: z.string().max(4000).nullish(),
  subject: z.string().min(1).max(MAX_SUBJECT_LENGTH),
  body_text: z.string().min(1).max(MAX_BODY_LENGTH),
  body_html: z.string().max(MAX_BODY_LENGTH).nullish(),
  reply_to: z.email().nullish(),
  parent_type: z.enum(NOTE_PARENT_TYPES).nullish(),
  parent_id: z.uuid().nullish(),
  thread_id: z.string().max(255).nullish(),
  in_reply_to: z.string().max(255).nullish(),
  /** Ignored when a session is present; see `src/lib/auth/current-user.ts`. */
  created_by_user_id: z.uuid().nullish(),
});

const listSchema = z.object({
  workspace_id: z.uuid(),
  parent_type: z.enum(NOTE_PARENT_TYPES).optional(),
  parent_id: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function POST(request: Request) {
  try {
    const { actor, response: denied } = requireActor(request);
    if (denied) return denied;

    const body = await request.json().catch(() => ({}));
    const input = sendSchema.parse(body);

    const account = input.account_id
      ? await findAccount(input.workspace_id, input.account_id)
      : await defaultAccountFor(input.workspace_id, actor.user_id);

    if (!account) {
      return fail(
        400,
        input.account_id
          ? 'Email account not found'
          : 'No mailbox is connected to this workspace. Connect one under Settings → Email.',
      );
    }
    if (account.status !== 'connected') {
      return fail(409, `${account.email} needs to be connected again before it can send.`);
    }

    const { message, error } = await sendEmail({
      ...input,
      account,
      // A signed-in caller is whoever the cookie says; only with auth off does
      // the body get to name them.
      created_by_user_id: actor.session?.user_id ?? actor.user_id ?? input.created_by_user_id ?? null,
    });

    return NextResponse.json(
      { ...serializeRow(message as unknown as Record<string, unknown>), error },
      // 201: the message exists either way. `status` says whether it left.
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof InvalidEmailError) return fail(422, error.message);
    return toErrorResponse(error);
  }
}

/** Sent mail, newest first, optionally just for one record. */
export async function GET(request: Request) {
  try {
    const query = listSchema.parse(Object.fromEntries(new URL(request.url).searchParams));

    const messages = await prisma.emailMessage.findMany({
      where: {
        workspace_id: query.workspace_id,
        ...(query.parent_type ? { parent_type: query.parent_type } : {}),
        ...(query.parent_id ? { parent_id: query.parent_id } : {}),
      },
      orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
      take: query.limit,
      skip: query.offset,
    });

    return NextResponse.json(
      messages.map((message) => serializeRow(message as unknown as Record<string, unknown>)),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
