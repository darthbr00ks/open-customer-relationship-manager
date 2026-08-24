import { NextResponse } from 'next/server';
import { z } from 'zod';

import { toErrorResponse } from '@/lib/api/resource';
import { enqueue } from '@/lib/queue';
import { redis } from '@/lib/redis';
import { pipelineReportKey } from '@/worker/jobs/pipeline-report';

export const dynamic = 'force-dynamic';

/**
 * Serve the cached pipeline report.
 *
 * On a cache miss the computation is queued and the caller is told to retry,
 * so a cold read never blocks the request on a full aggregate.
 */
export async function GET(request: Request) {
  try {
    const { workspace_id } = z
      .object({ workspace_id: z.uuid() })
      .parse(Object.fromEntries(new URL(request.url).searchParams));

    const cached = await redis.get(pipelineReportKey(workspace_id));
    if (cached) {
      return NextResponse.json(JSON.parse(cached));
    }

    const job = await enqueue('pipeline-report', { workspace_id });
    return NextResponse.json(
      { detail: 'Report is being generated', job_id: job.id },
      { status: 202 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
