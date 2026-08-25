import { NextResponse } from 'next/server';

import { fail, toErrorResponse } from '@/lib/api/resource';
import { getJobQueue } from '@/lib/queue';

export const dynamic = 'force-dynamic';

/** Report a job's state, progress, and result. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const job = await getJobQueue().getJob(id);

    if (!job) {
      return fail(404, 'Job not found');
    }

    return NextResponse.json({
      id: job.id,
      job: job.name,
      state: await job.getState(),
      progress: job.progress,
      result: job.returnvalue ?? null,
      failed_reason: job.failedReason ?? null,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
