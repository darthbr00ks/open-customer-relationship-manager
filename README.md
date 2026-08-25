# open-rm

An open relationship management tool.

**Stack:** Next.js (App Router) · TypeScript · Prisma + PostgreSQL · Zod ·
shadcn/ui · Zustand · BullMQ + Redis.

## Data model

Six primary objects plus two junctions:

| Object | Description |
|---|---|
| **Entity** | An organization — company, nonprofit, government agency, school, etc. |
| **Person** | An individual who may be affiliated with one or more entities. |
| **EntityPerson** | Junction describing a person's role at a specific entity. |
| **Deal** | A business, funding, or partnership opportunity linked to an entity. |
| **Case** | A customer-specific support ticket or problem report. |
| **Incident** | A shared operational problem affecting multiple entities/cases. |
| **IncidentCase** | Junction linking a case and an entity to a shared incident. |
| **Request** | A feature or improvement suggestion from a customer or entity. |
| **Note** | A timeline entry (hand-written or system-generated) on any of the above — powers each record's Activity/Notes tabs. |

All records are scoped by `workspace_id`. Primary objects support soft-deletion
via `archived_at`; the junctions do not.

## Architecture

```
Browser ──▶ Next.js App Router
              ├── /app/*             UI (shadcn/ui components, Zustand store)
              └── /app/api/v1/*      REST API (Zod validation, Prisma)
                                          │
                        ┌─────────────────┴─────────────────┐
                        ▼                                   ▼
                  PostgreSQL                         Redis (BullMQ)
                                                            │
                                                            ▼
                                                    Worker process
                                              (bulk import, reporting)
```

The worker is a separate process running the same codebase. Bulk import and
report aggregation are the CPU- and memory-heavy parts of a CRM, so they run
there rather than in a request handler.

## UI

Every object gets the same generic, metadata-driven experience — built once
in `src/components/{list-view,record-*}.tsx` and driven by per-object config
in `src/lib/objects.ts` / `src/lib/schema/*.ts`, so a new object needs a field
list and a layout, not a new page.

- **App shell** (`src/components/app-shell.tsx`) — one tab per object across
  the top, plus Search (⌘K / `/`), Create, a density control, Notifications,
  Help, and a combined workspace/identity menu on the right.
- **List views** (`src/components/list-view.tsx`) — saved views (All / Mine /
  custom, stored per-browser), sortable and show/hide-able columns, filters,
  search, bulk-select + archive, and pagination over the loaded page.
- **Record pages** (`src/app/*/[id]/page.tsx`) — a header with contextual
  actions, then Overview (fields grouped into sections per
  `src/lib/schema/*.ts`), Related (compact tables of the object's actual
  relationships — junctions are never exposed directly), Activity, and Notes.
  On an Entity, the People related list expands inline (no navigation) to
  show a contact's info and their other affiliations — the single-view case
  for "I need this person and this entity on screen together."
- **Density** — a header control (Comfortable → Compact → Dense → Ultra)
  rescales row height, padding, and type size everywhere via CSS custom
  properties (`--d-*` in `globals.css`), for agents who want the most records
  on screen at once.
- **Create/edit forms** — generated from the same per-object layout, in a
  dialog. When the fields overflow the visible height, a "fold" line marks
  where scrolling would be needed, so it's clear what's above vs. below it
  before you commit to a layout.

There is no admin UI to build layouts by hand yet — see "Known gaps."

## Getting started

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- Redis 6+

### Installation

```bash
npm install
cp .env.example .env    # then set DATABASE_URL and REDIS_URL
npx prisma generate
npm run db:migrate:dev  # or db:migrate in production
npm run db:seed         # optional: loads a demo workspace the app opens by default
```

On macOS without Docker, Postgres and Redis are one `brew` command each:

```bash
brew install postgresql@16 redis
brew services start postgresql@16
brew services start redis
createuser -s open_rm_user            # or any role with CREATEDB for migrate's shadow database
createdb -O open_rm_user open_rm
```

### Run

```bash
npm run dev       # Next.js app on :3000
npm run worker    # background worker (separate terminal, required for import/reports)
```

`npm run db:seed` loads its data into a fixed workspace id
(`src/lib/demo-workspace.ts`) that the UI defaults to, so a fresh browser
shows a populated CRM immediately — no id to copy in by hand. Switch
workspaces (or generate a new empty one) from the user menu in the top right.

### Docker Compose

```bash
# Create secrets/db_password.txt with your DB password first
docker compose up
```

Compose starts Postgres, Redis, the app, and the worker.

## API

All endpoints are under `/api/v1` and scoped by a required `workspace_id` query
parameter (on create, `workspace_id` is part of the body).

| Resource | Prefix |
|---|---|
| Entities | `/api/v1/entities` |
| Persons | `/api/v1/persons` |
| Entity-Person affiliations | `/api/v1/entity-persons` |
| Deals | `/api/v1/deals` |
| Cases | `/api/v1/cases` |
| Incidents | `/api/v1/incidents` |
| Incident-Case links | `/api/v1/incident-cases` |
| Requests | `/api/v1/requests` |
| Notes | `/api/v1/notes` |

Each resource supports:

- `GET /` — list · `POST /` — create · `GET /{id}` — detail · `PATCH /{id}` — partial update
- `POST /{id}/archive` — soft-delete (primary objects only)

### List parameters

| Parameter | Default | Notes |
|---|---|---|
| `workspace_id` | — | Required. |
| `limit` | 50 | Maximum 200. |
| `offset` | 0 | |
| `include_archived` | `false` | Primary objects only. |

`entity-persons` also filters on `entity_id` / `person_id`; `incident-cases` on
`incident_id` / `case_id`; `notes` on `parent_id`. Results are ordered
newest-first with `id` as a tiebreak, so paging is stable.

### Jobs and reports

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/jobs` | Enqueue `import-entities` or `pipeline-report`; returns a job id |
| `GET /api/v1/jobs/{id}` | Job state, progress, and result |
| `GET /api/v1/reports/pipeline` | Cached pipeline report; queues a rebuild on a cache miss |

`POST /api/v1/jobs` with `{"job":"import-entities","workspace_id":"…","csv":"…"}`
bulk-imports entities. Invalid rows are reported with their row number and
reason rather than failing the whole file.

### Errors

Errors return `{ "detail": ... }`:

| Status | Meaning |
|---|---|
| 404 | No such record in this workspace |
| 409 | Unique constraint violation (e.g. duplicate `case_number`) |
| 422 | Validation failed; `detail` carries the field-level issues |

## Development

```bash
npm run typecheck
npm run lint
npm test          # needs a throwaway Postgres and a Redis
```

The test suite runs against real Postgres and Redis and truncates tables between
tests:

```bash
DATABASE_URL=postgresql://open_rm_user:PASSWORD@localhost:5432/open_rm_test \
REDIS_URL=redis://localhost:6379 \
npm test
```

The test database needs the same schema as the dev one — run
`npx prisma migrate deploy` against it once (its `DATABASE_URL`, same as above).

## Conventions

- **Field names are snake_case everywhere** — database columns, Prisma model
  fields, Zod schemas, and JSON responses all agree, so there is no mapping
  layer to keep in sync.
- `prisma/schema.prisma` is the source of truth for the schema; SQL migrations
  are generated from it.
- `src/lib/api/resource.ts` implements the endpoints shared by every resource
  and `src/lib/api/resources.ts` registers them. Adding a resource means adding
  a Prisma model, a pair of Zod schemas, one registry entry, and the route files.
- Money is stored as `numeric(18,4)` and carried as a string end to end to avoid
  floating-point rounding.
- shadcn/ui components live in `src/components/ui` and are owned by this repo,
  as shadcn intends — edit them directly.
- On the UI side, `src/lib/schema/*.ts` defines each object's fields
  (type, options, badge colors, lookup targets) grouped into layout sections;
  `src/lib/objects.ts` registers each object (nav label, icon, route, default
  list columns) against that. `ListView`, `RecordOverview`, `RecordFormDialog`,
  and `FieldValue`/`FieldInput` all read this metadata instead of being
  written per object. Layouts are code for now; the field system is shaped
  so an admin UI could write to the same structures later.

## Known gaps

- **No authentication or authorization.** `workspace_id` is supplied by the
  caller and is not a security boundary. Do not expose this service publicly
  as-is. The "current user" in the UI (for owner assignment and activity
  attribution) is a name typed into the user menu, stored per-browser —
  not a real identity.
- List/related-list filtering, search, and sort are client-side over the
  loaded page (up to 200 rows); server-side search is not implemented.
- Saved list views are stored per-browser (`localStorage`), not shared across
  a workspace's users — there's no user directory to share them with yet.
- Page layouts are defined in code (`src/lib/schema/*.ts`), not editable from
  the UI. An admin-configuration screen is a natural next step, not built yet.

## License

See [LICENSE](LICENSE).
