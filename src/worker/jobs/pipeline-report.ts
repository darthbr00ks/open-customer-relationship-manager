import { prisma } from '@/lib/prisma';
import type { JobPayloads } from '@/lib/queue';
import { cacheKey, getRedis } from '@/lib/redis';
import { SCALE, fromScaled, toScaled } from '@/lib/selling/money';

/** How long a computed report stays served from cache. */
export const CACHE_TTL_SECONDS = 300;

export type PipelineReport = {
  workspace_id: string;
  generated_at: string;
  total_open_value: string;
  by_stage: { stage: string; count: number; value: string }[];
};

export const pipelineReportKey = (workspaceId: string) =>
  cacheKey('report', 'pipeline', workspaceId);

/**
 * Job id used to collapse duplicate requests for one workspace's report.
 *
 * BullMQ keeps a finished job under its id for a while, and reusing one id
 * forever would mean the second computation never runs — the report would
 * freeze at its first value. So the id carries the cache window it belongs to:
 * every reader inside one window shares a run, and the window after the cache
 * expires gets a new id and a fresh run.
 */
export const pipelineReportJobId = (workspaceId: string, now: number = Date.now()) =>
  `${pipelineReportKey(workspaceId)}:${Math.floor(now / (CACHE_TTL_SECONDS * 1000))}`;

/**
 * Add the per-stage values and render them at the column's own scale.
 *
 * Deal amounts are `numeric(18,4)`, so they are summed in fixed point rather
 * than through `Number` — a pipeline total is money, and money does not go
 * through binary floating point anywhere else in this codebase.
 */
function totalOf(values: string[]): string {
  const scaled = values.reduce<bigint>((running, value) => running + toScaled(value), 0n);
  const [whole, fraction = ''] = fromScaled(scaled).split('.');
  return `${whole}.${fraction.padEnd(SCALE, '0')}`;
}

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

  const report: PipelineReport = {
    workspace_id: payload.workspace_id,
    generated_at: new Date().toISOString(),
    total_open_value: totalOf(by_stage.map((row) => row.value)),
    by_stage,
  };

  await getRedis().set(
    pipelineReportKey(payload.workspace_id),
    JSON.stringify(report),
    'EX',
    CACHE_TTL_SECONDS,
  );

  return report;
}
