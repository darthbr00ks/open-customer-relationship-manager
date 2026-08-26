import { prisma } from '@/lib/prisma';
import { PUBLIC_PAGE_SIZE } from '@/lib/chat/config';
import { publicConversation, startConversation } from '@/lib/chat/conversations';
import { publicError, publicFail, publicJson, publicPreflight, requireChannel } from '@/lib/chat/public';
import { requireSession } from '@/lib/chat/session';
import { startConversationSchema } from '@/lib/schemas/chat-public';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ key: string }> };

/** The caller's own threads on this channel, newest activity first. */
export async function GET(request: Request, context: Context) {
  const { key } = await context.params;
  const { channel, response } = await requireChannel(request, key);
  if (!channel) return response;

  try {
    const { context: session, response: denied } = await requireSession(request, channel);
    if (!session) return denied;

    const conversations = await prisma.chatConversation.findMany({
      where: { channel_id: channel.id, contact_id: session.contact.id },
      orderBy: [{ last_message_at: 'desc' }, { id: 'asc' }],
      take: PUBLIC_PAGE_SIZE,
    });

    // One query for the previews rather than one per thread.
    const latest = await prisma.chatMessage.findMany({
      where: { conversation_id: { in: conversations.map((row) => row.id) }, is_internal: false },
      orderBy: { created_at: 'desc' },
    });
    const previewFor = new Map<string, (typeof latest)[number]>();
    for (const message of latest) {
      if (!previewFor.has(message.conversation_id)) previewFor.set(message.conversation_id, message);
    }

    return publicJson(
      conversations.map((row) => publicConversation(row, previewFor.get(row.id))),
      { request, channel },
    );
  } catch (error) {
    return publicError(error, { request, channel });
  }
}

/**
 * Open a thread. This is where the channel's configuration does its work: the
 * same call opens a Deal on a prospecting channel and a Case on a support one.
 */
export async function POST(request: Request, context: Context) {
  const { key } = await context.params;
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

    const input = startConversationSchema.parse(await request.json().catch(() => ({})));
    const conversation = await startConversation(channel, session.contact, input);

    return publicJson(publicConversation(conversation), { status: 201, request, channel });
  } catch (error) {
    return publicError(error, { request, channel });
  }
}

export async function OPTIONS(request: Request, context: Context) {
  const { key } = await context.params;
  return publicPreflight(request, key);
}
