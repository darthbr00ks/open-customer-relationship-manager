import { prisma } from '@/lib/prisma';
import { parseCsvRecords } from '@/lib/csv';
import type { JobPayloads } from '@/lib/queue';
import { entityCreateSchema } from '@/lib/schemas/resources';

/** Rows are written in batches so a large file does not build one huge statement. */
const BATCH_SIZE = 500;

export type ImportResult = {
  received: number;
  imported: number;
  skipped: { row: number; reason: string }[];
};

/**
 * Bulk-import entities from CSV.
 *
 * Invalid rows are reported rather than failing the whole file, so a user gets
 * back the rows that need fixing instead of an all-or-nothing error.
 */
export async function importEntities(
  payload: JobPayloads['import-entities'],
  onProgress?: (percent: number) => Promise<void>,
): Promise<ImportResult> {
  const records = parseCsvRecords(payload.csv);
  const result: ImportResult = { received: records.length, imported: 0, skipped: [] };

  let batch: Record<string, unknown>[] = [];

  const flush = async () => {
    if (batch.length === 0) {
      return;
    }
    const written = await prisma.entity.createMany({ data: batch as never, skipDuplicates: true });
    result.imported += written.count;
    batch = [];
  };

  for (const [index, record] of records.entries()) {
    const candidate = {
      ...record,
      workspace_id: payload.workspace_id,
      created_by_user_id: payload.created_by_user_id ?? null,
    };

    const parsed = entityCreateSchema.safeParse(candidate);
    if (!parsed.success) {
      // Row numbers are 1-based and skip the header, matching what the user sees.
      result.skipped.push({
        row: index + 2,
        reason: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
      });
      continue;
    }

    batch.push(parsed.data as Record<string, unknown>);
    if (batch.length >= BATCH_SIZE) {
      await flush();
      await onProgress?.(Math.round(((index + 1) / records.length) * 100));
    }
  }

  await flush();
  await onProgress?.(100);

  return result;
}
