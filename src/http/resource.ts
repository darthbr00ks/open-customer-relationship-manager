import { and, asc, desc, eq, isNull, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { db } from '../db/client.js';
import { HttpError, notFound } from './errors.js';

/** Bounds on list endpoints so a large workspace cannot return an unbounded result set. */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const listQuerySchema = z.object({
  workspace_id: z.uuid(),
  include_archived: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});

const workspaceQuerySchema = z.object({ workspace_id: z.uuid() });

const idParamsSchema = z.object({ id: z.uuid() });

/** Columns every resource table exposes to the generic handlers. */
type ResourceColumns = {
  id: PgColumn;
  workspace_id: PgColumn;
  archived_at?: PgColumn;
  updated_at?: PgColumn;
};

export type ResourceOptions = {
  /** URL segment, e.g. `/entities`. */
  path: string;
  /** Human-readable name used in 404 messages. */
  label: string;
  table: PgTable & ResourceColumns;
  createSchema: z.ZodType<Record<string, unknown>>;
  updateSchema: z.ZodType<Record<string, unknown>>;
  /** Column that orders list results; must be stable and indexed. */
  orderBy: PgColumn;
  /** Optional exact-match list filters, e.g. `entity_id`. */
  filters?: Record<string, PgColumn>;
};

/** Parse a request body, surfacing validation problems as 422 like FastAPI did. */
function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    throw new HttpError(422, result.error.issues);
  }
  return result.data;
}

function parseQuery<T>(schema: z.ZodType<T>, query: unknown): T {
  const result = schema.safeParse(query ?? {});
  if (!result.success) {
    throw new HttpError(422, result.error.issues);
  }
  return result.data;
}

/**
 * Restrict an update to the keys the client actually sent, so that omitted
 * fields keep their stored value (the equivalent of Pydantic's exclude_unset).
 */
function onlyProvided(
  parsed: Record<string, unknown>,
  rawBody: unknown,
): Record<string, unknown> {
  const sent = new Set(Object.keys((rawBody ?? {}) as Record<string, unknown>));
  return Object.fromEntries(Object.entries(parsed).filter(([key]) => sent.has(key)));
}

/**
 * Register the standard RM endpoints for one resource.
 *
 * Every resource is scoped by `workspace_id`; primary objects additionally
 * support archiving, which hides a record from lists without deleting it.
 */
export function registerResource(app: FastifyInstance, options: ResourceOptions): void {
  const { path, label, table, createSchema, updateSchema, orderBy, filters = {} } = options;
  const supportsArchive = table.archived_at !== undefined;

  const scopedTo = (workspaceId: string, id?: string): SQL => {
    const clauses: SQL[] = [eq(table.workspace_id, workspaceId)];
    if (id !== undefined) {
      clauses.push(eq(table.id, id));
    }
    return and(...clauses) as SQL;
  };

  /** Look up one record in the caller's workspace; archived records stay reachable by id. */
  const findOrFail = async (workspaceId: string, id: string) => {
    const [row] = await db.select().from(table).where(scopedTo(workspaceId, id)).limit(1);
    if (!row) {
      throw notFound(label);
    }
    return row;
  };

  app.get(path, async (request) => {
    const query = parseQuery(listQuerySchema.catchall(z.string().optional()), request.query);
    const clauses: SQL[] = [eq(table.workspace_id, query.workspace_id)];

    if (supportsArchive && !query.include_archived) {
      clauses.push(isNull(table.archived_at!));
    }

    for (const [param, column] of Object.entries(filters)) {
      const value = (request.query as Record<string, unknown>)[param];
      if (typeof value === 'string' && value.length > 0) {
        clauses.push(eq(column, z.uuid().parse(value)));
      }
    }

    return db
      .select()
      .from(table)
      .where(and(...clauses))
      .orderBy(desc(orderBy), asc(table.id))
      .limit(query.limit)
      .offset(query.offset);
  });

  app.post(path, async (request, reply) => {
    const values = parseBody(createSchema, request.body);
    const [row] = await db.insert(table).values(values).returning();
    return reply.code(201).send(row);
  });

  app.get(`${path}/:id`, async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    const { workspace_id } = parseQuery(workspaceQuerySchema, request.query);
    return findOrFail(workspace_id, id);
  });

  app.patch(`${path}/:id`, async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    const { workspace_id } = parseQuery(workspaceQuerySchema, request.query);
    await findOrFail(workspace_id, id);

    const patch = onlyProvided(parseBody(updateSchema, request.body), request.body);
    if (table.updated_at !== undefined) {
      patch.updated_at = new Date();
    }

    const [row] = await db.update(table).set(patch).where(scopedTo(workspace_id, id)).returning();
    return row;
  });

  if (supportsArchive) {
    app.post(`${path}/:id/archive`, async (request) => {
      const { id } = idParamsSchema.parse(request.params);
      const { workspace_id } = parseQuery(workspaceQuerySchema, request.query);
      await findOrFail(workspace_id, id);

      const [row] = await db
        .update(table)
        .set({ archived_at: new Date(), updated_at: new Date() })
        .where(scopedTo(workspace_id, id))
        .returning();
      return row;
    });
  }
}
