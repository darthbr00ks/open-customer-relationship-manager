import { NextResponse } from 'next/server';
import { z } from 'zod';

import { serializeRow } from '@/lib/api/resource';
import { acceptQuote } from '@/lib/selling/flow';

import { toSellingResponse } from '@/lib/api/selling';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z
  .object({
    purchase_order_number: z.string().max(100).nullish(),
    payment_terms: z.string().max(100).nullish(),
    created_by_user_id: z.uuid().nullish(),
  })
  .strict();

/**
 * Accept a quote and open the Order it becomes.
 *
 * One call, because the steps are not separable: the Order's lines have to
 * carry the accepted Quote's snapshot exactly, and the subscriptions, service
 * deliveries, and stock reservations those lines promise have to exist or the
 * order is a promise nobody is keeping. The response reports what was opened.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { workspace_id } = z
      .object({ workspace_id: z.uuid() })
      .parse(Object.fromEntries(new URL(request.url).searchParams));

    const body = bodySchema.parse(await request.json().catch(() => ({})));

    const { order, lines, provisioning } = await acceptQuote({
      workspace_id,
      quote_id: z.uuid().parse(id),
      ...body,
    });

    return NextResponse.json(
      {
        order: serializeRow(order),
        lines: lines.map((line) => serializeRow(line)),
        provisioning,
      },
      { status: 201 },
    );
  } catch (error) {
    return toSellingResponse(error);
  }
}
