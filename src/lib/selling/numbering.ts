/**
 * Human-readable document numbers: `QUO-0007`, `ORD-0012`, `SUB-0003`.
 *
 * The sequence is derived from how many of that document a workspace already
 * has, which can collide if two are created at the same moment. A collision is
 * a unique-constraint violation on `(workspace_id, number)`, and Postgres aborts
 * the whole transaction when one happens — so the retry runs the entire
 * transaction again with the next sequence rather than patching it from inside.
 */

import { isUniqueViolation } from '@/lib/api/resource';

const MAX_ATTEMPTS = 5;

export const formatDocumentNumber = (prefix: string, sequence: number) =>
  `${prefix}-${String(sequence).padStart(4, '0')}`;

export async function withDocumentNumber<T>(
  prefix: string,
  countExisting: () => Promise<number>,
  run: (documentNumber: string) => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const sequence = (await countExisting()) + 1 + attempt;
    try {
      return await run(formatDocumentNumber(prefix, sequence));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      lastError = error;
    }
  }
  throw lastError;
}
