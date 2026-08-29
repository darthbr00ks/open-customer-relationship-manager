import { prisma } from '@/lib/prisma';
import { parseCsvRecordsWithRows } from '@/lib/csv';
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
  const records = parseCsvRecordsWithRows(payload.csv);
  const result: ImportResult = { received: records.length, imported: 0, skipped: [] };

  let batch: Record<string, unknown>[] = [];
  let reported = 0;

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
      ...record.values,
      workspace_id: payload.workspace_id,
      created_by_user_id: payload.created_by_user_id ?? null,
    };

    const parsed = entityCreateSchema.safeParse(candidate);
    if (!parsed.success) {
      // The row the user will find in their file, not this record's index:
      // blank lines are skipped and a quoted field can span several lines.
      result.skipped.push({
        row: record.row,
        reason: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
      });
      continue;
    }

    batch.push(parsed.data as Record<string, unknown>);
    if (batch.length >= BATCH_SIZE) {
      await flush();
    }

    // Driven by the percentage rather than the batch, so a file smaller than
    // one batch still moves — and reported only when the number changes, so a
    // large file does not write progress once per row.
    const percent = Math.round(((index + 1) / records.length) * 100);
    if (percent !== reported) {
      reported = percent;
      await onProgress?.(percent);
    }
  }

  await flush();
  await onProgress?.(100);

  return result;
}
