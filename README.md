# open-rm

An open relationship management tool built with TypeScript, Fastify, Drizzle ORM, and PostgreSQL.

## Data model

Open RM manages six primary objects plus two junctions:

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

All records are scoped by `workspace_id`. Primary objects support soft-deletion
via `archived_at`; the junctions do not.

## Getting started

### Prerequisites
- Node.js 20+
- PostgreSQL 14+

### Installation

```bash
npm install
```

### Configuration

Copy `.env.example` to `.env` and set `DATABASE_URL` to your PostgreSQL
connection string.

### Run migrations

```bash
npm run db:migrate
```

Migrations are generated from `src/db/schema.ts`. After changing the schema:

```bash
npm run db:generate   # write a new SQL migration into drizzle/
npm run db:migrate    # apply it
```

### Start the API

```bash
npm run dev     # watch mode
npm run build && npm start   # compiled
```

### Docker Compose

```bash
# Create secrets/db_password.txt with your DB password first
docker compose up
```

## API overview

All endpoints are prefixed with `/api/v1` and scoped by a required
`workspace_id` query parameter (on create, `workspace_id` is part of the body).

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

Each resource supports:

- `GET /` — list, `POST /` — create, `GET /{id}` — detail, `PATCH /{id}` — partial update
- `POST /{id}/archive` — soft-delete (primary objects only)

### List parameters

| Parameter | Default | Notes |
|---|---|---|
| `workspace_id` | — | Required. |
| `limit` | 50 | Maximum 200. |
| `offset` | 0 | |
| `include_archived` | `false` | Primary objects only. |

`entity-persons` additionally filters on `entity_id` and `person_id`;
`incident-cases` on `incident_id` and `case_id`.

Results are ordered newest-first with `id` as a tiebreak, so paging with
`limit`/`offset` is stable.

### Errors

Errors return `{ "detail": ... }`:

| Status | Meaning |
|---|---|
| 404 | No such record in this workspace |
| 409 | Unique constraint violation (e.g. duplicate `case_number`) |
| 422 | Request validation failed; `detail` carries the field-level issues |

## Testing

The suite runs against a real PostgreSQL database and truncates tables between
tests, so point it at a throwaway database:

```bash
DATABASE_URL=postgresql://postgres@localhost:5432/open_rm_test npm test
```

```bash
npm run typecheck
```

## Architecture notes

- `src/db/schema.ts` is the single source of truth for the schema; SQL
  migrations in `drizzle/` are generated from it.
- Property names are snake_case throughout, so the database columns, the
  validation schemas, and the JSON API all agree without a mapping layer.
- `src/http/resource.ts` implements the endpoints shared by every resource;
  `src/app.ts` registers each one with its table and validation schemas. Adding
  a resource means adding a table, a pair of Zod schemas, and one registration.
- Money is stored as `numeric(18,4)` and carried as a string end to end to avoid
  floating-point rounding.

## Known gaps

- **No authentication or authorization.** `workspace_id` is supplied by the
  caller and is not yet a security boundary. Do not expose this service publicly
  as-is.
- Bulk import/export, deduplication, and reporting are not implemented; when
  they are, they belong in a background worker rather than the request path.

## License

See [LICENSE](LICENSE).
