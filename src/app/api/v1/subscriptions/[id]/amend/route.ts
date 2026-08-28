import { NextResponse } from 'next/server';
import { z } from 'zod';

import { serializeRow } from '@/lib/api/resource';
import { resources } from '@/lib/api/resources';
import { amendSubscriptionSchema } from '@/lib/schemas/selling';
import { amendSubscription } from '@/lib/selling/subscriptions';

import { toSellingResponse } from '@/lib/api/selling';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Amend a subscription: add or remove seats, change plan or price, change how
 * often it bills, renew it, pause it, resume it, or cancel it.
 *
 * The amendment is written first and the subscription updated from it, so the
 * change and any prorated charge stay explainable long after the fact.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { workspace_id } = z
      .object({ workspace_id: z.uuid() })
      .parse(Object.fromEntries(new URL(request.url).searchParams));

    const input = amendSubscriptionSchema.parse(await request.json().catch(() => ({})));

    const { subscription, amendment, proration } = await amendSubscription({
      workspace_id,
      subscription_id: z.uuid().parse(id),
      ...input,
    });

    return NextResponse.json({
      subscription: serializeRow(subscription, resources.subscriptions.dateOnlyFields),
      amendment: serializeRow(amendment, resources['subscription-amendments'].dateOnlyFields),
      proration,
    });
  } catch (error) {
    return toSellingResponse(error);
  }
}
