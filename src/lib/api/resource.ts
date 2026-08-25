import { NextResponse } from 'next/server';
import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/* Request/response helpers                                                    */
/* -------------------------------------------------------------------------- */

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

/** Error responses mirror `{ "detail": ... }`. */
export const fail = (status: number, detail: unknown) =>
  NextResponse.json({ detail }, { status });

/** Postgres SQLSTATE / Prisma code for a unique constraint violation. */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current != null && depth < 5; depth += 1) {
    const code = (current as { code?: unknown }).code;
    if (code === '23505' || code === 'P2002') {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/** Translate thrown errors into the API's error shape. */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof z.ZodError) {
    return fail(422, error.issues);
  }
  if (isUniqueViolation(error)) {
    return fail(409, 'Resource already exists');
  }
  console.error(error);
  return fail(500, 'Internal server error');
}

/**
 * Restrict an update to the keys the client actually sent, so omitted fields
 * keep their stored value.
 */
function onlyProvided(
  parsed: Record<string, unknown>,
  rawBody: Record<string, unknown>,
): Record<string, unknown> {
  const sent = new Set(Object.keys(rawBody));
  return Object.fromEntries(Object.entries(parsed).filter(([key]) => sent.has(key)));
}

/* -------------------------------------------------------------------------- */
/* Serialization                                                               */
/* -------------------------------------------------------------------------- */

type Row = Record<string, unknown>;

/**
 * Render a row for JSON.
 *
 * Prisma returns `Decimal` for money and `Date` for both timestamp and date
 * columns; date-only columns are emitted as `YYYY-MM-DD` rather than a full
 * timestamp so the API keeps the shape clients already expect.
 */
function serialize(row: Row, dateOnlyFields: readonly string[]): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) {
      out[key] = dateOnlyFields.includes(key)
        ? value.toISOString().slice(0, 10)
        : value.toISOString();
    } else if (value !== null && typeof value === 'object' && 'toFixed' in value) {
      // Prisma Decimal: keep full precision by carrying it as a string.
      out[key] = String(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Resource definition                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The slice of a Prisma model delegate these handlers use.
 *
 * Prisma generates a distinct delegate type per model, so each resource casts
 * its delegate to this shape once when it is registered.
 */
export type ResourceDelegate = {
  findFirst(args: { where: Row }): Promise<Row | null>;
  findMany(args: {
    where: Row;
    orderBy: Row[];
    take: number;
    skip: number;
  }): Promise<Row[]>;
  create(args: { data: Row }): Promise<Row>;
  update(args: { where: Row; data: Row }): Promise<Row>;
  upsert(args: { where: Row; create: Row; update: Row }): Promise<Row>;
  delete(args: { where: Row }): Promise<Row>;
};

export type ResourceConfig = {
  /** Prisma delegate, e.g. `prisma.entity`. */
  delegate: ResourceDelegate;
  /** Name used in 404 messages. */
  label: string;
  createSchema: z.ZodType;
  updateSchema: z.ZodType;
  /** Column that orders list results. */
  orderBy: string;
  /** Whether the resource supports archiving. */
  archivable: boolean;
  /** Exact-match list filters, e.g. `{ entity_id: true }`. */
  filters?: readonly string[];
  /** Fields rendered as `YYYY-MM-DD` rather than a full timestamp. */
  dateOnlyFields?: readonly string[];
};

/* -------------------------------------------------------------------------- */
/* Handlers                                                                    */
/* -------------------------------------------------------------------------- */

/** GET (list) and POST (create) for `/api/v1/<resource>`. */
export function collectionHandlers(config: ResourceConfig) {
  const { delegate, createSchema, orderBy, archivable, filters = [], dateOnlyFields = [] } = config;

  return {
    async GET(request: Request) {
      try {
        const params = Object.fromEntries(new URL(request.url).searchParams);
        const query = listQuerySchema.parse(params);

        const where: Row = { workspace_id: query.workspace_id };
        if (archivable && !query.include_archived) {
          where.archived_at = null;
        }
        for (const filter of filters) {
          const value = params[filter];
          if (typeof value === 'string' && value.length > 0) {
            where[filter] = z.uuid().parse(value);
          }
        }

        const rows = await delegate.findMany({
          where,
          // `id` breaks ties so paging stays stable across pages.
          orderBy: [{ [orderBy]: 'desc' }, { id: 'asc' }],
          take: query.limit,
          skip: query.offset,
        });

        return NextResponse.json(rows.map((row) => serialize(row, dateOnlyFields)));
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    async POST(request: Request) {
      try {
        const body = (await request.json().catch(() => ({}))) as Row;
        const data = createSchema.parse(body) as Row;
        const row = await delegate.create({ data });
        return NextResponse.json(serialize(row, dateOnlyFields), { status: 201 });
      } catch (error) {
        return toErrorResponse(error);
      }
    },
  };
}

type RouteContext = { params: Promise<{ id: string }> };

/** GET (detail), PATCH, PUT (upsert), and DELETE for `/api/v1/<resource>/[id]`. */
export function itemHandlers(config: ResourceConfig) {
  const { delegate, label, createSchema, updateSchema, dateOnlyFields = [] } = config;

  /** Archived records stay reachable by id so a client can still read them. */
  const findScoped = async (workspaceId: string, id: string) =>
    delegate.findFirst({ where: { id, workspace_id: workspaceId } });

  return {
    async GET(request: Request, context: RouteContext) {
      try {
        const { id } = await context.params;
        const { workspace_id } = workspaceQuerySchema.parse(
          Object.fromEntries(new URL(request.url).searchParams),
        );

        const row = await findScoped(workspace_id, z.uuid().parse(id));
        if (!row) {
          return fail(404, `${label} not found`);
        }
        return NextResponse.json(serialize(row, dateOnlyFields));
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    async PATCH(request: Request, context: RouteContext) {
      try {
        const { id } = await context.params;
        const { workspace_id } = workspaceQuerySchema.parse(
          Object.fromEntries(new URL(request.url).searchParams),
        );

        const existing = await findScoped(workspace_id, z.uuid().parse(id));
        if (!existing) {
          return fail(404, `${label} not found`);
        }

        const body = (await request.json().catch(() => ({}))) as Row;
        const data = onlyProvided(updateSchema.parse(body) as Row, body);

        const row = await delegate.update({ where: { id }, data });
        return NextResponse.json(serialize(row, dateOnlyFields));
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    async PUT(request: Request, context: RouteContext) {
      try {
        const { id } = await context.params;
        const { workspace_id } = workspaceQuerySchema.parse(
          Object.fromEntries(new URL(request.url).searchParams),
        );

        const parsedId = z.uuid().parse(id);
        const body = (await request.json().catch(() => ({}))) as Row;
        // Merge workspace_id from the query string so callers don't repeat it in the body.
        const createData = createSchema.parse({ ...body, workspace_id }) as Row;
        const updateData = onlyProvided(updateSchema.parse(body) as Row, body);

        const row = await delegate.upsert({
          where: { id: parsedId, workspace_id },
          create: { id: parsedId, ...createData },
          update: updateData,
        });
        return NextResponse.json(serialize(row, dateOnlyFields));
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    async DELETE(request: Request, context: RouteContext) {
      try {
        const { id } = await context.params;
        const { workspace_id } = workspaceQuerySchema.parse(
          Object.fromEntries(new URL(request.url).searchParams),
        );

        const existing = await findScoped(workspace_id, z.uuid().parse(id));
        if (!existing) {
          return fail(404, `${label} not found`);
        }

        const row = await delegate.delete({ where: { id, workspace_id } });
        return NextResponse.json(serialize(row, dateOnlyFields));
      } catch (error) {
        return toErrorResponse(error);
      }
    },
  };
}

/** POST for `/api/v1/<resource>/[id]/archive`. */
export function archiveHandler(config: ResourceConfig) {
  const { delegate, label, dateOnlyFields = [] } = config;

  return {
    async POST(request: Request, context: RouteContext) {
      try {
        const { id } = await context.params;
        const { workspace_id } = workspaceQuerySchema.parse(
          Object.fromEntries(new URL(request.url).searchParams),
        );

        const existing = await delegate.findFirst({
          where: { id: z.uuid().parse(id), workspace_id },
        });
        if (!existing) {
          return fail(404, `${label} not found`);
        }

        const row = await delegate.update({
          where: { id },
          data: { archived_at: new Date() },
        });
        return NextResponse.json(serialize(row, dateOnlyFields));
      } catch (error) {
        return toErrorResponse(error);
      }
    },
  };
}
