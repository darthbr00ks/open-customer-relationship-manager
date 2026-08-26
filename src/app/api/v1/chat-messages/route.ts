import { NextResponse } from 'next/server';

import { collectionHandlers, fail, toErrorResponse } from '@/lib/api/resource';
import { resources } from '@/lib/api/resources';
import { addAgentMessage, agentMessage } from '@/lib/chat/conversations';
import { prisma } from '@/lib/prisma';
import { chatMessageCreateSchema } from '@/lib/schemas/resources';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/v1/chat-messages?conversation_id=…` reads a thread, newest first
 * like every other list endpoint.
 */
export const { GET } = collectionHandlers(resources['chat-messages']);

/**
 * Reply from the CRM side.
 *
 * Not the generic create: a reply also moves the conversation's activity
 * timestamps (and clears the agent's unread marker), and its `author_type` is
 * always `user` — nothing here can forge a message from the customer. An
 * `is_internal` message is a note for colleagues and is never served to the
 * visitor's browser.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const input = chatMessageCreateSchema.parse(body);

    const conversation = await prisma.chatConversation.findFirst({
      where: { id: input.conversation_id, workspace_id: input.workspace_id },
    });
    if (!conversation) {
      return fail(404, 'Chat conversation not found');
    }

    const message = await addAgentMessage(conversation, {
      body: input.body,
      author_user_id: input.author_user_id,
      author_name: input.author_name,
      is_internal: input.is_internal,
    });

    return NextResponse.json(agentMessage(message), { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
