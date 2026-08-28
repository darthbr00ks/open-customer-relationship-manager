import { NextResponse } from 'next/server';
import { z } from 'zod';

import { serializeRow } from '@/lib/api/resource';
import { shipShipment } from '@/lib/selling/flow';

import { toSellingResponse } from '@/lib/api/selling';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Send a shipment: stock leaves the shelf and its reservation, each order line
 * records what has now been fulfilled, and the order's fulfillment status
 * follows — while its billing status stays exactly where it was.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { workspace_id } = z
      .object({ workspace_id: z.uuid() })
      .parse(Object.fromEntries(new URL(request.url).searchParams));

    const { shipment, order } = await shipShipment(workspace_id, z.uuid().parse(id));

    return NextResponse.json({ shipment: serializeRow(shipment), order: serializeRow(order) });
  } catch (error) {
    return toSellingResponse(error);
  }
}
