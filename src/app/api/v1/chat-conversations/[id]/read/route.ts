import { NextResponse } from 'next/server';
import { z } from 'zod';

import { fail, toErrorResponse } from '@/lib/api/resource';
import { agentConversation } from '@/lib/chat/conversations';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** Mark a thread as read in the inbox, clearing its unread marker. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { workspace_id } = z
      .object({ workspace_id: z.uuid() })
      .parse(Object.fromEntries(new URL(request.url).searchParams));

    const existing = await prisma.chatConversation.findFirst({
      where: { id: z.uuid().parse(id), workspace_id },
    });
    if (!existing) {
      return fail(404, 'Chat conversation not found');
    }

    const conversation = await prisma.chatConversation.update({
      where: { id: existing.id },
      data: { agent_read_at: new Date() },
    });
    return NextResponse.json(agentConversation(conversation));
  } catch (error) {
    return toErrorResponse(error);
  }
}
