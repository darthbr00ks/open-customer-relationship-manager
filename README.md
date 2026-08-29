# open-rm

An open relationship management tool.

**Stack:** Next.js (App Router) · TypeScript · Prisma + PostgreSQL · Zod ·
shadcn/ui · Zustand · BullMQ + Redis.

## Data model

The relationship objects, then the selling ones:

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
| **Product** | The general thing the company sells. Carries no price of its own. |
| **Offering** | The exact configuration someone can buy — the SKU. |
| **Price** | How one offering is charged. An offering may have several at once. |
| **PriceTier** | One band of a tiered, volume, or graduated price. |
| **PriceBook** | A customer, region, or channel price list. |
| **BundleComponent** | Membership of one offering inside a bundle offering. |
| **InventoryItem** | Stock for one offering at one location. |
| **ServiceDefinition** | What a service offering promises — scope, hours, SLA. |
| **DealLine** | A product being considered on a deal, priced from the live catalog. |
| **Quote** / **QuoteLine** | A formal proposal, and the snapshot of what was offered. |
| **Order** / **OrderLine** | The accepted quote, and what everything downstream hangs off. |
| **Shipment** / **ShipmentLine** | What physically moved, including partials, backorders, and returns. |
| **Subscription** | The continuing agreement after the sale. |
| **SubscriptionAmendment** | One recorded change to a subscription, with its proration. |
| **Entitlement** | What the customer may use, as opposed to what they bought. |
| **UsageRecord** | Something the customer consumed. |
| **ServiceDelivery** / **ServiceMilestone** | The work actually performed, and its checkpoints. |

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

- **Selling pages** — Products list their Offerings; an Offering page carries
  its prices (with tier bands inline), bundle components, stock, service
  definition, and a live price check that answers "what does this cost for 25?"
  from the same engine a quote uses. A Deal gains its lines and a **Create
  Quote** action; a Quote gains its lines and **Accept**; an Order shows its
  lines, shipments, subscriptions, and engagements together, which is the
  clearest view of why the three statuses are separate. Records that belong to
  another record — a price, a tier, a shipment line, a milestone — use
  `ChildFormDialog` with a field list rather than a full object registration,
  since nobody browses a list of price tiers.

There is no admin UI to build layouts by hand yet — see "Known gaps."

## Selling

What you sell, how you charge for it, and how you deliver it are three separate
questions. Keeping them apart is what lets a laptop, a consulting engagement,
and a monthly plan sit on one quote and still behave differently afterwards.

```
Product ──▶ Offering (SKU) ──▶ Price ──▶ (PriceTier)
                │                          │
                ├── BundleComponent        └── PriceBook
                ├── InventoryItem
                └── ServiceDefinition

Deal ──▶ DealLine ──▶ QuoteLine ──▶ OrderLine ──┬──▶ Shipment
                                                ├──▶ Subscription ──▶ Entitlement ──▶ UsageRecord
                                                └──▶ ServiceDelivery ──▶ ServiceMilestone
```

### Catalog

A **Product** is the general thing sold — "Premium Support", "Commercial
Refrigerator". It has no price. The same product may be packaged several ways,
in several currencies, on several contract terms.

An **Offering** is the exact configuration someone can buy: *Professional Plan
billed monthly* and *Enterprise Plan billed annually* are two offerings of one
product. Its `offering_type` (`good` · `service` · `subscription` · `bundle`)
decides what an order line for it turns into. Stock, bundle membership, and the
service definition all hang off the offering, never the product — a large blue
shirt and a medium red one are the same product but different inventory.

A **Price** says how an offering is charged, and an offering can carry several
at once. The spec's own example — *$1,000 setup, $100 per month, $0.02 per
transaction over 10,000* — is three Price rows on one offering, not three
products. Prices support flat, per-unit, tiered, volume, and graduated models,
minimum quantities, included allowances, billing periods and intervals, and an
optional price book for a customer, region, or channel.

Prices are **effective-dated and never overwritten**. Superseding one means
setting its `effective_until` and adding a new row, so a transaction priced last
year still resolves to last year's number. `GET /api/v1/offerings/{id}/price`
answers "what does this cost for 25 of them" with *every* charge that applies,
which is usually the honest answer.

### From deal to order

1. **Deal Lines** are working notes. They point at the live catalog and are
   re-priced every time they are read.
2. **`POST /api/v1/deals/{id}/quote`** builds the proposal. Every deal line is
   priced once, each charge becomes its own quote line, bundles are expanded
   into their components, and everything the customer will see — name,
   description, SKU, unit, price, discount, billing terms — is **copied onto the
   line**. From here a catalog edit changes what can be sold next, never what
   was already agreed.
3. **`POST /api/v1/quotes/{id}/accept`** opens the Order, copies each line's
   snapshot onto it, and starts what those lines promised: a Subscription with
   its Entitlements, a Service Delivery against the offering's Service
   Definition, an inventory reservation for anything physical. Optional lines the
   customer did not take are not carried over. It is one call because the steps
   are not separable — an order whose promises were not opened is a promise
   nobody is keeping.

A line's quantity is the number it was sized by, but its charges are not all
measured in the same thing. A per-seat plan that meters API calls has a
`unit_of_measure` on the charge as well as on the offering, and a usage charge
with an included allowance is quoted at the allowance it buys rather than at the
seat count.

### Delivery

**Fulfillment, billing, and lifecycle move independently.** An order can be paid
but not shipped, shipped but not activated, or active but past due, so
`status`, `fulfillment_status`, and `billing_status` are three columns.

- **Shipments** carry part of an order line at a time, to whatever address, with
  tracking, serials, lots, backorders, returns, and replacements.
  `POST /api/v1/shipments/{id}/ship` takes the stock off the shelf and off its
  reservation, advances each line's fulfilled quantity, and rolls the order's
  fulfillment status up — and touches billing status not at all.
- **Subscriptions** are the continuing agreement, not a repeating deal line.
  They keep their own status, current period, commitment end date, billing
  frequency, quantity, and renewal behavior. How long a customer is committed
  and how often they are billed are different questions: a one-year commitment
  can be invoiced monthly.
- **Amendments** are how a subscription changes.
  `POST /api/v1/subscriptions/{id}/amend` adds or removes seats, changes plan or
  price, changes billing frequency, renews, pauses, resumes, or cancels —
  immediately or at period end. Each writes a `SubscriptionAmendment` with the
  before and after values and any prorated charge, then applies the change. The
  original agreement survives, and "why was this invoice $48.39 more" has an
  answer in the record.
- **Entitlements** say what may be used — 25 users, 100 GB, premium support —
  as against what was bought. `POST /api/v1/usage-records` records consumption
  and rolls it onto the entitlement in the same transaction, so an allowance and
  its usage cannot drift apart. The events stay as written, so a period can be
  re-rated without inventing history.
- **Service deliveries** are the work performed for one customer, against the
  offering's reusable Service Definition: who is doing it, when, hours consumed,
  milestones (30% at kickoff, 40% at delivery, 30% at completion), customer
  acceptance, and any Case or Incident it came out of.

### Money

Amounts are `numeric(18,4)` in the database and strings end to end. The pricing
engine (`src/lib/selling/`) works in fixed point on `bigint` ten-thousandths and
never touches a float, so `0.1 + 0.2` is `0.3` where it is somebody's invoice.
It also touches no database — selection, tier walking, discounts, proration, and
billing-period arithmetic are unit-tested directly in `tests/pricing.test.ts`.

Discounts are recorded next to a line or a document as a type and a value, and
never modify the catalog price.

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
| Products | `/api/v1/products` |
| Offerings | `/api/v1/offerings` |
| Prices | `/api/v1/prices` |
| Price tiers | `/api/v1/price-tiers` |
| Price books | `/api/v1/price-books` |
| Bundle components | `/api/v1/bundle-components` |
| Inventory items | `/api/v1/inventory-items` |
| Service definitions | `/api/v1/service-definitions` |
| Deal lines | `/api/v1/deal-lines` |
| Quotes / quote lines | `/api/v1/quotes` · `/api/v1/quote-lines` |
| Orders / order lines | `/api/v1/orders` · `/api/v1/order-lines` |
| Shipments / shipment lines | `/api/v1/shipments` · `/api/v1/shipment-lines` |
| Subscriptions | `/api/v1/subscriptions` |
| Subscription amendments | `/api/v1/subscription-amendments` |
| Entitlements | `/api/v1/entitlements` |
| Usage records | `/api/v1/usage-records` |
| Service deliveries | `/api/v1/service-deliveries` |
| Service milestones | `/api/v1/service-milestones` |

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
`conversation_id`. On the selling side, the child resources filter on their
parent — `offerings` on `product_id`, `prices` on `offering_id` /
`price_book_id`, `quote-lines` on `quote_id`, `order-lines` on `order_id`,
`entitlements` and `subscription-amendments` on `subscription_id`, and so on.
Results are ordered newest-first with `id` as a tiebreak, so paging is stable —
except document lines and price bands, which read in the order they were
arranged (`sort_order`, `sequence`, `up_to` ascending).

Two chat endpoints are not the generic ones. `POST /api/v1/chat-messages`
posts a reply from the CRM side: it also moves the conversation's activity
timestamps, always writes `author_type: "user"` (nothing can forge a message
from the customer), and takes `is_internal` for a note colleagues can see but
the visitor cannot. `POST /api/v1/chat-conversations/{id}/read` clears a
thread's unread marker in the inbox. Chat messages are a record of what was
said, so they cannot be edited or deleted.

### Selling endpoints

Five endpoints do more than generic CRUD, because the steps they take are not
separable:

| Endpoint | What it does |
|---|---|
| `POST /api/v1/deals/{id}/quote` | Prices the deal's lines against the catalog and snapshots them onto a new Quote, expanding bundles |
| `POST /api/v1/quotes/{id}/accept` | Opens the Order, copies each line's snapshot, and provisions subscriptions, service deliveries, and stock reservations |
| `POST /api/v1/shipments/{id}/ship` | Moves stock and fulfillment status; leaves billing status alone |
| `POST /api/v1/subscriptions/{id}/amend` | Records an amendment with its proration, then applies it |
| `GET /api/v1/offerings/{id}/price` | Every charge that applies to a quantity, as of a date, in a currency and price book |

`POST /api/v1/usage-records` is also not the generic create: it rolls the
recorded quantity onto the entitlement being consumed in the same transaction.

### Jobs and reports

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/jobs` | Enqueue `import-entities` or `pipeline-report`; returns a job id |
| `GET /api/v1/jobs/{id}` | Job state, progress, and result |
| `GET /api/v1/reports/pipeline` | Cached pipeline report; queues a rebuild on a cache miss |

`POST /api/v1/jobs` with `{"job":"import-entities","workspace_id":"…","csv":"…"}`
bulk-imports entities. Invalid rows are reported with their row number and
reason rather than failing the whole file. The CSV is capped at 5,000,000
characters — it is held in memory by the request, the queue, and the worker at
once. An import that fails partway is not retried automatically, because the
rows already written have no key to write them against twice; the reported
failure is meant to be fixed and the file re-sent.

### Errors

Errors return `{ "detail": ... }`:

| Status | Meaning |
|---|---|
| 404 | No such record in this workspace |
| 409 | Unique constraint violation (e.g. duplicate `case_number`), or a document already acted on (e.g. a quote accepted twice) |
| 422 | Validation failed; `detail` carries the field-level issues, or a referenced record does not exist |

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
  floating-point rounding. Arithmetic on it goes through
  `src/lib/selling/money.ts`, which works in `bigint` ten-thousandths rather
  than touching a float at any point.
- Catalog rows describe what *can* be sold; quote and order lines record what
  *was* sold, as a snapshot. Never make a transaction read through to the
  catalog for a name, a price, or a term.
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
- **No invoices or payments.** The flow stops at the Order: `billing_status`
  records where billing has got to, but nothing generates an invoice, applies a
  payment, or bills a subscription period. Amendments compute their proration
  and store it; nothing charges it.
- **Taxes are stored, not calculated.** `tax_amount` and `tax_category` are
  carried on every line and offering, but no tax engine fills them in.
- Document numbers (`QUO-0007`, `ORD-0012`) are derived from a count and retried
  on collision, which is fine for one workspace's throughput but is not a
  sequence. Two orders created in the same instant take a second attempt.
- Inventory reservation is per offering across locations, first come first
  served; there is no allocation strategy, no serial-level tracking on
  reservation, and no automatic backorder record beyond the shortfall the accept
  response reports.
- Scheduled amendments are storable (`effective_date` in the future, no
  `applied_at`) but nothing applies them when the date arrives — there is no
  billing scheduler.

## License

See [LICENSE](LICENSE).
