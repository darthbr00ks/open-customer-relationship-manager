import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { publicConversation } from '@/lib/chat/conversations';
import { publicError, publicFail, publicJson, publicPreflight, requireChannel } from '@/lib/chat/public';
import { requireSession } from '@/lib/chat/session';
import { updateConversationSchema } from '@/lib/schemas/chat-public';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ key: string; conversation_id: string }> };

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
    return publicJson(publicConversation(conversation), { request, channel });
  } catch (error) {
    return publicError(error, { request, channel });
  }
}

/** The visitor can close their own thread; writing to it again reopens it. */
export async function PATCH(request: Request, context: Context) {
  const { key, conversation_id } = await context.params;
  const { channel, response } = await requireChannel(request, key);
  if (!channel) return response;

  try {
    const { context: session, response: denied } = await requireSession(request, channel);
    if (!session) return denied;

    const existing = await prisma.chatConversation.findFirst({
      where: { id: z.uuid().parse(conversation_id), channel_id: channel.id, contact_id: session.contact.id },
    });
    if (!existing) {
      return publicFail(404, 'Conversation not found', { request, channel });
    }

    updateConversationSchema.parse(await request.json().catch(() => ({})));
    const conversation = await prisma.chatConversation.update({
      where: { id: existing.id },
      data: { status: 'closed', closed_at: new Date() },
    });

    return publicJson(publicConversation(conversation), { request, channel });
  } catch (error) {
    return publicError(error, { request, channel });
  }
}

export async function OPTIONS(request: Request, context: Context) {
  const { key } = await context.params;
  return publicPreflight(request, key);
}
