import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { importEntities } from '@/worker/jobs/import-entities';
import { buildPipelineReport, pipelineReportKey } from '@/worker/jobs/pipeline-report';

import { resetDatabase, uuid } from './helpers';

const workspace = uuid();

beforeEach(async () => {
  await resetDatabase();
  await redis.del(pipelineReportKey(workspace));
});

afterAll(async () => {
  await redis.quit();
});

describe('importEntities', () => {
  it('imports valid rows and reports the invalid ones', async () => {
    const csv = [
      'name,entity_type,relationship_stage,primary_email',
      'Acme Corp,company,customer,hello@acme.test',
      'Wayne Foundation,nonprofit,partner,contact@wayne.test',
      'Broken Inc,spaceship,customer,bad@broken.test',
    ].join('\n');

    const result = await importEntities({ workspace_id: workspace, csv });

    expect(result.received).toBe(3);
    expect(result.imported).toBe(2);
    expect(result.skipped).toHaveLength(1);
    // Row 4 in the file: header plus two good rows before it.
    expect(result.skipped[0]?.row).toBe(4);
    expect(result.skipped[0]?.reason).toContain('entity_type');

    const stored = await prisma.entity.findMany({ where: { workspace_id: workspace } });
    expect(stored.map((row) => row.name).sort()).toEqual(['Acme Corp', 'Wayne Foundation']);
  });

  it('reports progress and finishes at 100', async () => {
    const seen: number[] = [];
    await importEntities(
      { workspace_id: workspace, csv: 'name,entity_type\nAcme,company' },
      async (percent) => {
        seen.push(percent);
      },
    );
    expect(seen.at(-1)).toBe(100);
  });

  it('handles an empty file without writing anything', async () => {
    const result = await importEntities({ workspace_id: workspace, csv: 'name,entity_type\n' });
    expect(result).toMatchObject({ received: 0, imported: 0 });
  });
});

describe('buildPipelineReport', () => {
  it('aggregates open deals by stage and caches the result', async () => {
    const entity = await prisma.entity.create({
      data: { workspace_id: workspace, name: 'Acme', entity_type: 'company' },
    });

    await prisma.deal.createMany({
      data: [
        { workspace_id: workspace, name: 'A', entity_id: entity.id, stage: 'proposal', amount: '1000.0000' },
        { workspace_id: workspace, name: 'B', entity_id: entity.id, stage: 'proposal', amount: '2500.5000' },
        { workspace_id: workspace, name: 'C', entity_id: entity.id, stage: 'discovery', amount: '400.0000' },
        // Closed and archived deals are outside the open pipeline.
        { workspace_id: workspace, name: 'D', entity_id: entity.id, stage: 'won', amount: '9999.0000' },
        {
          workspace_id: workspace,
          name: 'E',
          entity_id: entity.id,
          stage: 'proposal',
          amount: '8888.0000',
          archived_at: new Date(),
        },
      ],
    });

    const report = await buildPipelineReport({ workspace_id: workspace });

    expect(report.by_stage).toEqual([
      { stage: 'discovery', count: 1, value: '400' },
      { stage: 'proposal', count: 2, value: '3500.5' },
    ]);
    expect(report.total_open_value).toBe('3900.5000');

    const cached = await redis.get(pipelineReportKey(workspace));
    expect(JSON.parse(cached!)).toEqual(report);
  });

  it('returns an empty report for a workspace with no deals', async () => {
    const report = await buildPipelineReport({ workspace_id: workspace });
    expect(report.by_stage).toEqual([]);
    expect(report.total_open_value).toBe('0.0000');
  });
});
