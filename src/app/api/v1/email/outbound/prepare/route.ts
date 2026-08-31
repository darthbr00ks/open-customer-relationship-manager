import { randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { toErrorResponse } from '@/lib/api/resource';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const schema = z.object({
  workspace_id: z.uuid(),
  to_address: z.email().max(320),
  subject: z.string().trim().min(1).max(998),
  text_body: z.string().default(''),
  related_deal_id: z.uuid().optional(),
  related_person_id: z.uuid().optional(),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json().catch(() => ({})));
    const result = await prisma.$transaction(async (tx) => {
      if (input.related_deal_id) {
        const deal = await tx.deal.findFirst({
          where: { id: input.related_deal_id, workspace_id: input.workspace_id },
        });
        if (!deal) throw new Error('Deal not found in this workspace');
      }
      if (input.related_person_id) {
        const person = await tx.person.findFirst({
          where: { id: input.related_person_id, workspace_id: input.workspace_id },
        });
        if (!person) throw new Error('Person not found in this workspace');
      }

      let thread = input.related_deal_id
        ? await tx.emailThread.findFirst({
            where: {
              workspace_id: input.workspace_id,
              related_record_type: 'deal',
              related_record_id: input.related_deal_id,
            },
            orderBy: { last_message_at: 'desc' },
          })
        : null;
      if (!thread) {
        thread = await tx.emailThread.create({
          data: {
            workspace_id: input.workspace_id,
            external_reference_id: randomUUID().replaceAll('-', ''),
            related_record_type: input.related_deal_id ? 'deal' : 'none',
            related_record_id: input.related_deal_id ?? null,
            deal_id: input.related_deal_id ?? null,
            participants: [input.to_address.toLowerCase()],
          },
        });
      }
      const now = new Date();
      const message = await tx.emailMessage.create({
        data: {
          workspace_id: input.workspace_id,
          provider: 'local-mail-client',
          external_message_id: `<${randomUUID()}@open-rm.local>`,
          thread_id: thread.id,
          direction: 'outbound',
          from_address: 'open-rm@localhost',
          to_addresses: [input.to_address.toLowerCase()],
          cc_addresses: [],
          bcc_addresses: [],
          subject: input.subject,
          text_body: input.text_body,
          reference_message_ids: [],
          related_record_type: thread.related_record_type,
          related_record_id: thread.related_record_id,
          received_at: now,
        },
      });
      await tx.emailThread.update({ where: { id: thread.id }, data: { last_message_at: now } });
      if (input.related_person_id) {
        await tx.note.create({
          data: {
            workspace_id: input.workspace_id,
            parent_type: 'person',
            parent_id: input.related_person_id,
            kind: 'system',
            body: `Email prepared for ${input.to_address}: ${input.subject}`,
          },
        });
      }
      return { message_id: message.id, thread_id: thread.id, external_reference_id: thread.external_reference_id };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

