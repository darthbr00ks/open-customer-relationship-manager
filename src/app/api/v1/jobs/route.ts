import { NextResponse } from 'next/server';
import { z } from 'zod';

import { toErrorResponse } from '@/lib/api/resource';
import { enqueue } from '@/lib/queue';

export const dynamic = 'force-dynamic';

/**
 * Ceiling on an uploaded CSV, in characters.
 *
 * The file is held in memory by this handler, carried whole inside the Redis
 * job payload, and parsed in the worker, so an unbounded one costs memory in
 * three places at once. Roughly 40,000 rows of contact data.
 */
const MAX_CSV_LENGTH = 5_000_000;

const bodySchema = z.discriminatedUnion('job', [
  z.object({
    job: z.literal('import-entities'),
    workspace_id: z.uuid(),
    csv: z
      .string()
      .min(1)
      .max(MAX_CSV_LENGTH, `CSV must be ${MAX_CSV_LENGTH.toLocaleString('en-US')} characters or fewer`),
    created_by_user_id: z.uuid().nullish(),
  }),
  z.object({
    job: z.literal('pipeline-report'),
    workspace_id: z.uuid(),
  }),
]);

/** Enqueue a background job and return its id for polling. */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.parse(body);

    const { job, ...payload } = parsed;
    // An import writes rows as it goes and has no key to write them against
    // twice, so a retry would duplicate everything already imported. A failure
    // is reported and re-run deliberately instead.
    const queued = await enqueue(job, payload as never, job === 'import-entities' ? { attempts: 1 } : {});

    return NextResponse.json({ id: queued.id, job, state: 'queued' }, { status: 202 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
