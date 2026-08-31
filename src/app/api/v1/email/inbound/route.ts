import { NextResponse } from 'next/server';

import { toErrorResponse } from '@/lib/api/resource';
import { processInboundEmail } from '@/lib/email/inbound';
import { inboundEmailSchema } from '@/lib/schemas/email';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const input = inboundEmailSchema.parse(await request.json().catch(() => ({})));
    const result = await processInboundEmail(input);
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

