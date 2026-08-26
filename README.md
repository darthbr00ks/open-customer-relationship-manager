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
| **ChatChannel** | One configured instance of the chat tool: what it opens (deal/case/nothing) and whether visitors must verify their email. |
| **ChatContact** | Who a visitor is, as far as one channel knows — optionally linked to a Person and an Entity. |
| **ChatConversation** | A thread between a visitor and the workspace, plus the records it opened. |
| **ChatMessage** | One message in a thread, from the visitor, a user, or the app itself. |

All records are scoped by `workspace_id`. Primary objects support soft-deletion
via `archived_at`; the junctions do not.

## Architecture

```
Browser ──▶ Next.js App Router
              ├── /app/(crm)/*       UI (shadcn/ui components, Zustand store)
              ├── /app/(public)/*    Customer-facing chat widget
              ├── /app/api/v1/*      REST API (Zod validation, Prisma)
              └── /app/api/chat/*    Public chat API (channel key + visitor session)
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
- **Inline editing** — double-click any editable field on the Overview tab
  (`src/components/fields/editable-field.tsx`) to edit it in place: Enter or
  clicking away saves, Escape discards. Select/lookup/checkbox fields save as
  soon as you pick a value.
- **Density** — a header control (Comfortable → Compact → Dense → Ultra)
  rescales row height, padding, and type size everywhere via CSS custom
  properties (`--d-*` in `globals.css`), plus a 1–6 columns-per-section
  control for how many fields sit side by side on record pages and forms.
- **Theme** — Light / Dark / High contrast (`src/stores/theme.ts`), applied as
  `data-theme` on `<html>`; High contrast pushes to a true black/white
  palette with much heavier borders for maximum legibility.
- **Create/edit forms** — generated from the same per-object layout, in a
  dialog.
- **Chat inbox** (`src/components/chat/agent-inbox.tsx`) — the one screen that
  is not metadata-driven, because a conversation is a stream rather than a
  record: a filterable list, the thread, and a composer. Chat channels *are*
  metadata-driven like every other object (`src/lib/schema/chat-channel.ts`).

There is no admin UI to build layouts by hand yet — see "Known gaps."

## Chat

Customers message the workspace from a chat widget; users answer from an inbox
inside the CRM. A workspace can run **as many channels as it has places to put
a chat box**, and each channel is configured on its own — the two questions
that matter most are answered per channel, not per deployment:

| Setting | Options | What it decides |
|---|---|---|
| `intake_mode` | `deal` · `case` · `none` | What a new conversation opens: a Deal for prospecting, a Case for support, or nothing at all. |
| `auth_mode` | `none` · `optional` · `required` | Whether the visitor must prove an email address with a one-time code before they can chat. |

The rest of a channel is configuration too: greeting and offline message,
whether a guest is asked for a name and an email, whether intake may open an
Entity from the visitor's email domain, the stage/priority/category and default
assignee stamped on whatever it opens, which origins may embed the widget, and
how long a visitor stays signed in.

So one workspace can run a no-sign-in sales box on its marketing site that
opens a qualification-stage Deal, and a sign-in-required support desk that
opens a medium-priority Case — from the same code, with no branching.

### Intake

Before opening anything, intake works out *who* is talking, matching what the
workspace already has rather than duplicating it:

1. **Person** — matched on email, otherwise created (name split from what the
   visitor gave, else their email's local part).
2. **Entity** — an organization the person is already affiliated with, else one
   whose `primary_domain` matches their email domain, else a new one when
   `auto_create_entity` is on. Consumer mailboxes (gmail.com and friends) never
   name an Entity; on a `deal` channel, where a Deal cannot exist without one,
   a `household` Entity stands for the person instead.
3. **Affiliation** — the person is added to the entity's contact list if they
   were not on it already.

Then the Deal or Case is opened, a system note on it records which channel it
came from, and the conversation stores every id it touched. Opening a
conversation is one transaction: a workspace never ends up with a Case whose
thread is missing, or the reverse.

### Authentication

`auth_mode: 'required'` means a visitor must verify an email address before
reading or writing anything on that channel — which is also what lets them pick
up their history from another device. Verification is a six-digit code:

- stored only as a SHA-256 hash, salted with the channel id;
- single use, valid 10 minutes, 5 wrong guesses and it is burned;
- rate limited to 5 codes per address per channel per 15 minutes.

A successful verification issues a **session token** (256 bits, stored hashed,
sent as `Authorization: Bearer …`). Channels with `auth_mode: 'none'` or
`'optional'` also issue guest tokens, so every conversation endpoint works the
same way whichever mode a channel is in.

> **No mail provider is wired up.** Delivery is a queued job
> (`src/worker/jobs/deliver-chat-code.ts`) that logs the code; replacing that
> one function is all a real deployment needs. Outside production the code is
> also returned as `debug_code` so the flow is usable locally — set
> `CHAT_RETURN_AUTH_CODE=false` to turn that off.

### Using it

- **Inbox** — `/chat`: every channel's conversations, filterable by channel and
  status, with the thread, a reply box, an internal-note toggle (never shown to
  the customer), status and assignment, and links to the Deal/Case/Entity the
  conversation opened.
- **Channels** — `/chat/channels`: the same list/record/form treatment as every
  other object, plus the embed snippet for each channel.
- **Widget** — `/chat/widget/<key>`: what the customer sees. It carries none of
  the CRM's chrome, so it can be linked directly or dropped into an iframe:

  ```html
  <iframe src="https://your-open-rm/chat/widget/support"
          title="Chat" width="400" height="600" style="border:0"></iframe>
  ```

`npm run db:seed` creates two channels to look at: `sales` (deal, no sign-in)
and `support` (case, sign-in required).

### Public API

Endpoints under `/api/chat/<channel_key>` are the customer's half. They are not
workspace-scoped — the channel key identifies the workspace — and every one of
them answers CORS preflight against the channel's allowed origins.

| Endpoint | Purpose |
|---|---|
| `GET /api/chat/{key}` | Public channel config: name, greeting, what it collects, whether it requires sign-in |
| `POST /api/chat/{key}/sessions` | Start a guest session (401 on a `required` channel) |
| `GET /api/chat/{key}/sessions` | Who the caller's token belongs to |
| `POST /api/chat/{key}/auth/request-code` | Email a verification code |
| `POST /api/chat/{key}/auth/verify` | Exchange a code for an authenticated session |
| `GET·POST /api/chat/{key}/conversations` | List the caller's threads · open one (runs intake) |
| `GET·PATCH /api/chat/{key}/conversations/{id}` | Read one · close it |
| `GET·POST /api/chat/{key}/conversations/{id}/messages` | Read (`?after=<ISO>` for polling) · send |

A visitor only ever sees their own threads, on the one channel their token was
issued for, and internal notes are filtered out server-side.


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
| Chat channels | `/api/v1/chat-channels` |
| Chat contacts | `/api/v1/chat-contacts` |
| Chat conversations | `/api/v1/chat-conversations` |
| Chat messages | `/api/v1/chat-messages` |

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
`incident_id` / `case_id`; `notes` on `parent_id`; `chat-conversations` on
`channel_id` / `contact_id` / `deal_id` / `case_id`; `chat-messages` on
`conversation_id`. Results are ordered newest-first with `id` as a tiebreak, so
paging is stable.

Two chat endpoints are not the generic ones. `POST /api/v1/chat-messages`
posts a reply from the CRM side: it also moves the conversation's activity
timestamps, always writes `author_type: "user"` (nothing can forge a message
from the customer), and takes `is_internal` for a note colleagues can see but
the visitor cannot. `POST /api/v1/chat-conversations/{id}/read` clears a
thread's unread marker in the inbox. Chat messages are a record of what was
said, so they cannot be edited or deleted.

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

- **No authentication or authorization for CRM users.** `workspace_id` is
  supplied by the caller and is not a security boundary. Do not expose this
  service publicly as-is. The "current user" in the UI (for owner assignment and
  activity attribution) is a name typed into the user menu, stored per-browser —
  not a real identity. Chat's `auth_mode` authenticates *customers* on a
  channel, which is a different question: it decides who may read and write one
  visitor's threads, not who may use the CRM.
- **Chat verification codes are not actually emailed.** Delivery is a queued job
  that logs them (see "Chat"), and outside production the code comes back in the
  API response.
- No rate limiting on message sending, and no attachments in chat — a message is
  text, capped at 4,000 characters.
- List/related-list filtering, search, and sort are client-side over the
  loaded page (up to 200 rows); server-side search is not implemented.
- Saved list views are stored per-browser (`localStorage`), not shared across
  a workspace's users — there's no user directory to share them with yet.
- Page layouts are defined in code (`src/lib/schema/*.ts`), not editable from
  the UI. An admin-configuration screen is a natural next step, not built yet.

## License

See [LICENSE](LICENSE).
