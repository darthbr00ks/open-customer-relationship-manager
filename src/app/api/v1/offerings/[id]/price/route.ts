import { NextResponse } from 'next/server';
import { z } from 'zod';

import { fail, toErrorResponse } from '@/lib/api/resource';
import { prisma } from '@/lib/prisma';
import { quoteOffering } from '@/lib/selling/pricing';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

const querySchema = z.object({
  workspace_id: z.uuid(),
  quantity: z.string().default('1'),
  currency_code: z.string().length(3).default('USD'),
  price_book_id: z.uuid().optional(),
  /** Price the offering as of a past or future date, e.g. to re-check a quote. */
  on: z.iso.date().optional(),
});

/**
 * What an offering costs for a quantity — every charge, not one number.
 *
 * A subscription with a setup fee and usage overage answers with three charges,
 * because that is the honest answer, and because a quote line is built from
 * each of them.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));

    const offering = await prisma.offering.findFirst({
      where: { id: z.uuid().parse(id), workspace_id: query.workspace_id },
    });
    if (!offering) return fail(404, 'Offering not found');

    const prices = await prisma.price.findMany({
      where: { workspace_id: query.workspace_id, offering_id: offering.id },
      include: { tiers: true },
    });

    const charges = quoteOffering(
      prices.map((price) => ({
        id: price.id,
        name: price.name,
        unit_of_measure: price.unit_of_measure,
        currency_code: price.currency_code,
        charge_type: price.charge_type,
        pricing_model: price.pricing_model,
        unit_amount: price.unit_amount == null ? null : String(price.unit_amount),
        billing_period: price.billing_period,
        billing_interval_count: price.billing_interval_count,
        minimum_quantity: price.minimum_quantity == null ? null : String(price.minimum_quantity),
        included_quantity: price.included_quantity == null ? null : String(price.included_quantity),
        effective_from: price.effective_from,
        effective_until: price.effective_until,
        price_book_id: price.price_book_id,
        tiers: price.tiers.map((tier) => ({
          up_to: tier.up_to == null ? null : String(tier.up_to),
          unit_amount: tier.unit_amount == null ? null : String(tier.unit_amount),
          flat_amount: tier.flat_amount == null ? null : String(tier.flat_amount),
        })),
      })),
      query.quantity,
      {
        currency_code: query.currency_code,
        price_book_id: query.price_book_id ?? null,
        on: query.on ? new Date(query.on) : undefined,
      },
    );

    return NextResponse.json({
      offering_id: offering.id,
      sku: offering.sku,
      quantity: query.quantity,
      currency_code: query.currency_code,
      charges,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
