import { prisma } from '@/lib/prisma';
import type { JobPayloads } from '@/lib/queue';
import { cacheKey, redis } from '@/lib/redis';

/** How long a computed report stays served from cache. */
const CACHE_TTL_SECONDS = 300;

export type PipelineReport = {
  workspace_id: string;
  generated_at: string;
  total_open_value: string;
  by_stage: { stage: string; count: number; value: string }[];
};

export const pipelineReportKey = (workspaceId: string) =>
  cacheKey('report', 'pipeline', workspaceId);

/**
 * Summarise open deal value by stage.
 *
 * This is the kind of aggregate that gets slow on a large workspace, so it runs
 * in the worker and is served from Redis rather than recomputed per request.
 */
export async function buildPipelineReport(
  payload: JobPayloads['pipeline-report'],
): Promise<PipelineReport> {
  const grouped = await prisma.deal.groupBy({
    by: ['stage'],
    where: {
      workspace_id: payload.workspace_id,
      archived_at: null,
      stage: { notIn: ['won', 'lost'] },
    },
    _count: { _all: true },
    _sum: { amount: true },
  });

  const by_stage = grouped
    .map((group) => ({
      stage: String(group.stage),
      count: group._count._all,
      value: (group._sum.amount ?? 0).toString(),
    }))
    .sort((a, b) => a.stage.localeCompare(b.stage));

  const total = by_stage.reduce((sum, row) => sum + Number(row.value), 0);

  const report: PipelineReport = {
    workspace_id: payload.workspace_id,
    generated_at: new Date().toISOString(),
    total_open_value: total.toFixed(4),
    by_stage,
  };

  await redis.set(pipelineReportKey(payload.workspace_id), JSON.stringify(report), 'EX', CACHE_TTL_SECONDS);

  return report;
}
