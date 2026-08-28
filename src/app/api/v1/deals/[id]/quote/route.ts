import { NextResponse } from 'next/server';
import { z } from 'zod';

import { serializeRow } from '@/lib/api/resource';
import { resources } from '@/lib/api/resources';
import { toSellingResponse } from '@/lib/api/selling';
import { day } from '@/lib/schemas/common';
import { createQuoteFromDeal } from '@/lib/selling/flow';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z
  .object({
    name: z.string().max(255).optional(),
    currency_code: z.string().length(3).optional(),
    price_book_id: z.uuid().nullish(),
    valid_until: day().nullish(),
    contract_term_months: z.number().int().min(0).nullish(),
    payment_terms: z.string().max(100).nullish(),
    owner_user_id: z.uuid().nullish(),
    created_by_user_id: z.uuid().nullish(),
  })
  .strict();

/**
 * Turn a Deal's lines into a formal Quote.
 *
 * This is where the catalog stops being live: each Deal Line is priced against
 * the catalog once, and everything the customer will see is copied onto the
 * Quote Lines. Bundles are expanded into their components on the way through.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { workspace_id } = z
      .object({ workspace_id: z.uuid() })
      .parse(Object.fromEntries(new URL(request.url).searchParams));

    const body = bodySchema.parse(await request.json().catch(() => ({})));

    const { quote, lines } = await createQuoteFromDeal({
      workspace_id,
      deal_id: z.uuid().parse(id),
      ...body,
    });

    return NextResponse.json(
      {
        quote: serializeRow(quote, resources.quotes.dateOnlyFields),
        lines: lines.map((line) => serializeRow(line)),
      },
      { status: 201 },
    );
  } catch (error) {
    return toSellingResponse(error);
  }
}
