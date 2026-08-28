import { NextResponse } from 'next/server';

import { collectionHandlers, fail, serializeRow, toErrorResponse } from '@/lib/api/resource';
import { resources } from '@/lib/api/resources';
import { prisma } from '@/lib/prisma';
import { usageRecordCreateSchema } from '@/lib/schemas/selling';
import { add } from '@/lib/selling/money';

export const dynamic = 'force-dynamic';

/** `GET /api/v1/usage-records?subscription_id=…` reads a usage feed, newest first. */
export const { GET } = collectionHandlers(resources['usage-records']);

/**
 * Record something the customer consumed.
 *
 * Not the generic create: usage is only half a record on its own. When the
 * event names an entitlement, the same transaction rolls the quantity onto that
 * entitlement's running total, so "what may they use" and "what have they used"
 * cannot drift apart. The events stay as they were written, so a period can be
 * re-rated later without inventing history.
 */
export async function POST(request: Request) {
  try {
    const input = usageRecordCreateSchema.parse(await request.json().catch(() => ({})));

    if (input.entitlement_id) {
      const entitlement = await prisma.entitlement.findFirst({
        where: { id: input.entitlement_id, workspace_id: input.workspace_id },
      });
      if (!entitlement) return fail(404, 'Entitlement not found');

      const record = await prisma.$transaction(async (tx) => {
        const created = await tx.usageRecord.create({
          data: {
            ...input,
            // Default the subscription from the entitlement so a feed only has
            // to know the thing it is metering.
            subscription_id: input.subscription_id ?? entitlement.subscription_id,
          },
        });
        await tx.entitlement.update({
          where: { id: entitlement.id },
          data: { used_quantity: add(entitlement.used_quantity, input.quantity) },
        });
        return created;
      });

      return NextResponse.json(serializeRow(record), { status: 201 });
    }

    const record = await prisma.usageRecord.create({ data: input });
    return NextResponse.json(serializeRow(record), { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
