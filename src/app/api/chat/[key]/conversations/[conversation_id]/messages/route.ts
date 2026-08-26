import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { PUBLIC_PAGE_SIZE } from '@/lib/chat/config';
import { addContactMessage, publicMessage } from '@/lib/chat/conversations';
import { publicError, publicFail, publicJson, publicPreflight, requireChannel } from '@/lib/chat/public';
import { requireSession } from '@/lib/chat/session';
import { postMessageSchema } from '@/lib/schemas/chat-public';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ key: string; conversation_id: string }> };

const afterSchema = z.iso.datetime().optional();

/**
 * The thread, oldest first. `?after=<ISO timestamp>` returns only what has
 * arrived since — the widget polls with it rather than refetching everything.
 *
 * Internal notes written in the agent inbox are filtered out here, which is
 * the only place that guarantee can be made for every client at once.
 */
export async function GET(request: Request, context: Context) {
  const { key, conversation_id } = await context.params;
  const { channel, response } = await requireChannel(request, key);
  if (!channel) return response;

  try {
    const { context: session, response: denied } = await requireSession(request, channel);
    if (!session) return denied;

    const conversation = await prisma.chatConversation.findFirst({
      where: { id: z.uuid().parse(conversation_id), channel_id: channel.id, contact_id: session.contact.id },
    });
    if (!conversation) {
      return publicFail(404, 'Conversation not found', { request, channel });
    }

    const after = afterSchema.parse(new URL(request.url).searchParams.get('after') ?? undefined);
    const messages = await prisma.chatMessage.findMany({
      where: {
        conversation_id: conversation.id,
        is_internal: false,
        ...(after ? { created_at: { gt: new Date(after) } } : {}),
      },
      orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
      take: PUBLIC_PAGE_SIZE,
    });

    // Reading the thread is what clears the visitor's unread marker.
    await prisma.chatConversation.update({
      where: { id: conversation.id },
      data: { contact_read_at: new Date() },
    });

    return publicJson(messages.map(publicMessage), { request, channel });
  } catch (error) {
    return publicError(error, { request, channel });
  }
}

/** Say something. A closed thread reopens rather than refusing the message. */
export async function POST(request: Request, context: Context) {
  const { key, conversation_id } = await context.params;
  const { channel, response } = await requireChannel(request, key);
  if (!channel) return response;

  try {
    if (!channel.is_enabled) {
      return publicFail(403, channel.offline_message ?? 'This chat channel is not accepting messages.', {
        request,
        channel,
      });
    }

    const { context: session, response: denied } = await requireSession(request, channel);
    if (!session) return denied;

    const conversation = await prisma.chatConversation.findFirst({
      where: { id: z.uuid().parse(conversation_id), channel_id: channel.id, contact_id: session.contact.id },
    });
    if (!conversation) {
      return publicFail(404, 'Conversation not found', { request, channel });
    }

    const { body } = postMessageSchema.parse(await request.json().catch(() => ({})));
    const message = await addContactMessage(conversation, session.contact, body);

    return publicJson(publicMessage(message), { status: 201, request, channel });
  } catch (error) {
    return publicError(error, { request, channel });
  }
}

export async function OPTIONS(request: Request, context: Context) {
  const { key } = await context.params;
  return publicPreflight(request, key);
}
