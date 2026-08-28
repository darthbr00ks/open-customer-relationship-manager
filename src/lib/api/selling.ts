import { NextResponse } from 'next/server';

import { toErrorResponse } from './resource';
import { SellingError } from '@/lib/selling/flow';

/**
 * The selling flow rejects some requests for reasons the generic handler cannot
 * know about — a quote that was already accepted, a deal with nothing on it —
 * and each carries the status it should be reported with.
 */
export function toSellingResponse(error: unknown): NextResponse {
  if (error instanceof SellingError) {
    return NextResponse.json({ detail: error.message }, { status: error.status });
  }
  return toErrorResponse(error);
}
