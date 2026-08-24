# open-rm

An open relationship management tool built with FastAPI, SQLAlchemy, and PostgreSQL.

## Data model

Open RM manages six primary objects:

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

All records are scoped by `workspace_id` and support soft-deletion via `archived_at`.

## Getting started

### Prerequisites
- Python 3.11+
- PostgreSQL 14+

### Installation

```bash
pip install -e .
```

### Configuration

Copy `.env.example` to `.env` and set `DATABASE_URL` to your PostgreSQL connection string.

### Run migrations

```bash
alembic upgrade head
```

### Start the API

```bash
uvicorn app.main:app --reload
```

API docs are available at `http://localhost:8000/docs`.

### Docker Compose

```bash
# Create secrets/db_password.txt with your DB password first
docker compose up
```

## API overview

All endpoints are prefixed with `/api/v1` and scoped by `workspace_id` query parameter.

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

Each resource supports `GET` (list + detail), `POST` (create), `PATCH` (update), and `POST /{id}/archive` (soft-delete).

## License

See [LICENSE](LICENSE).
