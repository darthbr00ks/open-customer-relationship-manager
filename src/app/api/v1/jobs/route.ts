import { NextResponse } from 'next/server';
import { z } from 'zod';

import { toErrorResponse } from '@/lib/api/resource';
import { enqueue } from '@/lib/queue';

export const dynamic = 'force-dynamic';

const bodySchema = z.discriminatedUnion('job', [
  z.object({
    job: z.literal('import-entities'),
    workspace_id: z.uuid(),
    csv: z.string().min(1),
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
    const queued = await enqueue(job, payload as never);

    return NextResponse.json({ id: queued.id, job, state: 'queued' }, { status: 202 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
