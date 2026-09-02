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
Browser ──▶ src/proxy.ts (route guard) ──▶ Next.js App Router
              ├── /app/(crm)/*       UI (shadcn/ui components, Zustand store)
              ├── /app/(public)/*    Chat widget, sign-in screen
              ├── /app/api/v1/*      REST API (Zod validation, Prisma)
              ├── /app/api/auth/*    Sign-in flow (AuthProvider → Auth0)
              └── /app/api/chat/*    Public chat API (channel key + visitor session)
                                          │
                        ┌─────────────────┼─────────────────┬──────────────────┐
                        ▼                 ▼                 ▼                  ▼
                  PostgreSQL      Redis (BullMQ)     Identity provider    Mail provider
                   (profiles,               │            (Auth0)              (Gmail)
                    permissions)            ▼
                                    Worker process
                              (bulk import, reporting, mail delivery)
```

The worker is a separate process running the same codebase. Bulk import and
report aggregation are the CPU- and memory-heavy parts of a CRM, so they run
there rather than in a request handler.

Each outside service sits behind an interface — `AuthProvider`
(`src/lib/auth/types.ts`), `EmailProvider` (`src/lib/email/types.ts`) and
`PermissionProvider` (`src/lib/security/types.ts`) — so Auth0, Gmail and the
profile tables are each one file plus one registry entry, and none of those
names appears anywhere else in the app. See "Signing in", "Profiles and
permissions", and "Email".

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
- **Email** — a **Send email** action on a Person, an Entity, and a Case opens
  a composer (`src/components/compose-email-dialog.tsx`) pre-filled with the
  record's address; what is sent lands on that record's Activity tab.
  **Settings → Email** (`src/app/(crm)/settings/email/page.tsx`, reached from
  the user menu) connects and disconnects mailboxes, and says what is missing
  when it cannot.
- **Profiles** — **Settings → Profiles** is one grid: a row per object with
  read/create/edit/delete, expanding to a row per field with
  Edit / Read only / Hidden (`src/components/security/permission-grid.tsx`).
  Object and field security are edited together because they are one decision —
  "Support may read Deals but not the amount" is a single sentence, and
  splitting it across two screens is how the second half gets forgotten. A
  second tab assigns profiles to people.
- **Chat inbox** (`src/components/chat/agent-inbox.tsx`) — the one screen that
  is not metadata-driven, because a conversation is a stream rather than a
  record: a filterable list, the thread, and a composer. Chat channels *are*
  metadata-driven like every other object (`src/lib/schema/chat-channel.ts`).
  Email settings and the composer are the same kind of exception, for the same
  reason: neither a provider connection nor a message is a record anyone
  browses a list of.

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

## Signing in

CRM users authenticate against an identity provider over OIDC. Auth0 ships in
the box; the app talks to `AuthProvider`, not to Auth0.

```
/api/auth/login ──▶ provider consent ──▶ /api/auth/callback ──▶ session cookie ──▶ CRM
```

- **Authorization code + PKCE.** This app never sees a password, so MFA, SSO,
  and password policy are the provider's business.
- **The ID token is verified** against the issuer's published JWKS —
  RS256 only, with `iss`, `aud`, `exp`, and the `nonce` this browser started
  with all checked (`src/lib/auth/jwt.ts`). `alg: none` and HMAC are refused.
- **The session is a signed cookie**, http-only and short-lived
  (`src/lib/auth/session.ts`). There is no session table to read on every
  request or sweep on a schedule; rotating `AUTH_SESSION_SECRET` invalidates
  every session at once.
- **`src/proxy.ts` guards the routes** — an optimistic check that keeps a
  signed-out browser off CRM screens. It is not the authorization boundary;
  handlers that write on someone's behalf re-check
  (`src/lib/auth/current-user.ts`).
- **`app_user` maps the provider's subject to a uuid.** Records already carry
  `owner_user_id` / `created_by_user_id` uuids, and an identity provider hands
  out subjects like `auth0|65f0c1…`; the uuid is minted once, on first sign-in,
  and survives a change of provider.

### Configuring it

Create an Auth0 **Regular Web Application** and set:

| Auth0 setting | Value |
|---|---|
| Allowed Callback URLs | `<PUBLIC_BASE_URL>/api/auth/callback` |
| Allowed Logout URLs | `<PUBLIC_BASE_URL>/` |

Then `AUTH_PROVIDER=auth0`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`,
`AUTH0_CLIENT_SECRET`, and `AUTH_SESSION_SECRET` (see `.env.example`).

**With none of that set, nothing changes.** The `dev` provider takes over,
`authEnabled()` is false, the route guard steps aside, and the app behaves as it
always has: a name typed into the user menu, stored per browser. That is what
keeps a fresh clone usable. It refuses to run in production.

### Swapping the provider

Write a class against `AuthProvider` in `src/lib/auth/providers/`, add a line to
`src/lib/auth/registry.ts`, and set `AUTH_PROVIDER`. Nothing else moves: the
session, the user mapping, the route guard, and the UI are all provider-agnostic
by construction, and `DevAuthProvider` exists partly to keep them that way.

## Profiles and permissions

What a signed-in user may do, as two levels that compose in one direction:

| Level | Question | Stored in |
|---|---|---|
| **Object** | May this profile read / create / edit / delete this resource at all? | `object_permission` |
| **Field** | Of the fields it may touch, which are visible and which are writable? | `field_permission` |

A `no` at the object level ends the request; field access is never consulted.
And a field is never *more* accessible than its object — `edit` on a field of a
read-only object still reads as `read`.

### The two defaults, and why they differ

- **Objects are deny-by-default.** No row means no access. Permission is granted
  deliberately, never inherited from silence.
- **Fields are inherit-by-default.** No row means the field is as accessible as
  its object. Only *restrictions* are stored, so `field_permission` stays
  proportional to what an administrator actually did rather than to the size of
  the schema.

`id` and `workspace_id` are never hidden: they are how a record is addressed,
so masking them would break a response rather than protect it.

### Enforcement

In `src/lib/api/resource.ts`, which every generic endpoint goes through, so a
new resource is permissioned the moment it is registered:

- **List and read** — refused with 403 rather than returned empty. An empty list
  is a lie that sends people hunting for a data problem that does not exist.
  Rows come back with hidden fields stripped.
- **Create, edit, upsert** — a write naming a field the caller may not set is
  **refused**, not silently stripped. A dropped field looks exactly like a save
  that worked, and the caller never learns the value was lost. An upsert needs
  both `create` and `edit`, so `PUT` is not a way around the missing half.
- **Archive** — needs `edit`, not `delete`: the row stays, and stays readable.

The UI reads the same answers from `/api/v1/permissions/me` and stops offering
what the server would refuse — a tab, a Create entry, a column, a form field, an
inline editor. That is honesty, not security; every one of them is re-checked
server-side.

### Getting the first profile in

There is an obvious deadlock: the profile screens are themselves permissioned,
so the first profile can never be created by somebody who already holds one. The
rule that resolves it is that **a workspace with no profiles is unconfigured,
not locked down** — it behaves exactly as it did before profiles existed.
**Settings → Profiles → Set up profiles** ends that state: it creates an
**Administrator** and a **Standard User** profile and makes you an
administrator. From then on only an administrator can reach those screens.

Two guards keep a workspace from locking itself out afterwards: the last
administrator profile cannot be archived or demoted, and an administrator's
grants are not editable (they are never consulted — `AdminPermissionSet`
short-circuits every check — so a restricted matrix would be a lie on screen).

### Who gets which profile

`app_user` → `profile_assignment` → `profile`, per workspace, so the same person
can administer one workspace and read another. An unassigned user falls back to
the workspace's **default** profile; with no default, they can do nothing.
Assignments are edited under **Settings → Profiles → People**.

### Swapping the provider

`PermissionProvider` (`src/lib/security/types.ts`) resolves one caller in one
workspace into a `PermissionSet` that is then asked many cheap questions. Add a
class in `src/lib/security/providers/`, a line in
`src/lib/security/registry.ts`, and set `PERMISSIONS_PROVIDER` — LDAP groups,
OPA, or a permissions service all fit the same shape. `OpenPermissionProvider`
grants everything and is the second implementation that keeps the interface
honest; unlike the `dev` and `console` providers it is safe in production, since
"everyone who can sign in may do everything" is the right answer for a
single-team CRM.

The catalog of what is permissionable — every object and every field — is
derived from the Zod schemas already in `src/lib/api/resources.ts`
(`src/lib/security/catalog.ts`), not written out again. A second
hand-maintained list would drift the first time somebody added a column, and the
failure mode of that is a field nobody can restrict because the permission
screen has never heard of it.

## Email

Connect a Gmail mailbox over OAuth and the CRM sends from it — from a Person, an
Entity, or a Case, with the sent message filed on that record's timeline.

```
Settings → Email ──▶ Google consent ──▶ /api/v1/email/callback ──▶ email_account
                                                                        │
Record → Email ──▶ POST /api/v1/email/messages ──▶ EmailProvider.send ──┘
```

- **Narrow scope.** Only `gmail.send` is requested, which grants no read access
  to the mailbox at all, plus `openid`/`email`/`profile` to name the account.
- **Offline access with forced consent.** Google issues a refresh token only on
  a first consent, and only when it is asked for — so `access_type=offline` and
  `prompt=consent` are both required, or re-connecting a mailbox silently stores
  tokens that cannot be renewed.
- **Tokens are encrypted at rest** with AES-256-GCM under
  `SECRET_ENCRYPTION_KEY` (`src/lib/crypto.ts`). Only
  `src/lib/email/accounts.ts` reads them; providers are handed a live access
  token and nothing else.
- **Access tokens refresh themselves** a minute before expiry. A refresh
  rejected with `invalid_grant` parks the mailbox as `needs_reauth` instead of
  being retried forever.
- **The message row is written before the provider is called**, so a send that
  fails is a `failed` row with the provider's reason on it rather than an event
  that left no trace.
- **Sending is inline, not queued.** Handing a message to Gmail is one HTTPS
  round trip, and someone who just pressed Send should learn immediately that
  the address was wrong — unlike import and reporting, which are on the worker
  because of how much data they touch.
- **Disconnecting keeps the row**, with its secrets cleared: `email_message`
  points at it, and deleting it would take the sender off every message it ever
  sent.

Chat verification codes go through the same provider (`src/worker/jobs/deliver-chat-code.ts`),
so one connected mailbox serves both. With none connected, they are logged as
before.

### Configuring it

Create an OAuth client ID of type **Web application** in the Google Cloud
console with the Gmail API enabled, and add
`<PUBLIC_BASE_URL>/api/v1/email/callback` as an authorized redirect URI. Then
set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `SECRET_ENCRYPTION_KEY`, and
connect a mailbox from **Settings → Email** in the app.

With no credentials, `EMAIL_PROVIDER` falls back to the `console` provider
outside production: it logs the fully rendered message and reports success, so
the whole path — compose, outbound row, timeline entry — is developable with no
Google project. It is never the fallback in production, because silently
swallowing a customer's mail is worse than failing to send it.

### Swapping the provider

`EmailProvider` (`src/lib/email/types.ts`) is two methods plus, for a provider
whose mailboxes are connected by a person rather than configured in the
environment, the consent/exchange/refresh surface of `OAuthEmailProvider`. Add a
class in `src/lib/email/providers/`, a line in `src/lib/email/registry.ts`, and
set `EMAIL_PROVIDER`. `email_account.provider` records which implementation owns
each mailbox, so changing the setting cannot strand rows behind a backend that
no longer handles them.

RFC 5322 rendering is shared (`src/lib/email/mime.ts`) rather than owned by
Gmail, because SMTP and Microsoft Graph want the same bytes.

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

Signing in and sending mail are both optional: with none of the `AUTH0_*` or
`GOOGLE_*` variables set, the app runs exactly as it did before either existed.
See "Signing in" and "Email" for turning them on.

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

### Email endpoints

| Endpoint | What it does |
|---|---|
| `GET /api/v1/email/connect` | Redirects to the provider's consent screen to connect a mailbox |
| `GET /api/v1/email/callback` | Finishes that flow and stores the grant; redirects back to Settings → Email |
| `GET /api/v1/email/accounts` | Connected mailboxes, plus which provider is active and whether it is configured |
| `DELETE /api/v1/email/accounts/{id}` | Disconnects a mailbox (clears its secrets; the row stays) |
| `POST /api/v1/email/messages` | Sends a message and files it against a record |
| `GET /api/v1/email/messages` | Sent mail, optionally for one record |

`POST /api/v1/email/messages` answers `201` with the stored message whether or
not the provider accepted it — `status` is `sent` or `failed`, and `error`
carries the provider's reason. A rejected address is a recorded outcome, not a
broken request; only a malformed request is a 4xx.

### Permission endpoints

| Endpoint | What it does |
|---|---|
| `GET /api/v1/profiles` | The workspace's profiles, the active provider, and whether profiles are set up |
| `POST /api/v1/profiles` | Create a profile (starts with nothing granted) |
| `GET /api/v1/profiles/{id}` | One profile with its full grant matrix |
| `PATCH /api/v1/profiles/{id}` | Rename, re-describe, change the admin/default flags |
| `DELETE /api/v1/profiles/{id}` | Archive it (holders fall back to the default) |
| `PUT /api/v1/profiles/{id}/permissions` | Replace the whole object + field matrix |
| `POST /api/v1/profiles/bootstrap` | Set profiles up for a workspace and make the caller an administrator |
| `GET`/`POST /api/v1/profile-assignments` | Who carries which profile; assign or clear |
| `GET /api/v1/permissions/catalog` | Every object and field there is to permission |
| `GET /api/v1/permissions/me` | The caller's own effective permissions |

All but the last two require an administrator profile. The grant matrix is
replaced wholesale rather than patched: the editor sends the complete grid it is
showing, and patching a permission grid row by row is how a profile ends up
half-applied.

### Auth endpoints

Outside `/api/v1`, since they are the flow rather than a resource:

| Endpoint | What it does |
|---|---|
| `GET /api/auth/login` | Starts the OIDC flow |
| `GET /api/auth/callback` | Completes it, upserts the user, sets the session cookie |
| `POST /api/auth/logout` | Clears the session and ends the provider's session too |
| `GET /api/auth/session` | Who is signed in, and whether this deployment requires it |
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
reason rather than failing the whole file.

### Errors

Errors return `{ "detail": ... }`:

| Status | Meaning |
|---|---|
| 401 | Sign-in required (only when an identity provider is configured) |
| 403 | Your profile may not do this, or the write named a field you may not set |
| 404 | No such record in this workspace |
| 409 | Unique constraint violation (e.g. duplicate `case_number`), or a mailbox that needs reconnecting |
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
  floating-point rounding. Arithmetic on it goes through
  `src/lib/selling/money.ts`, which works in `bigint` ten-thousandths rather
  than touching a float at any point.
- Catalog rows describe what *can* be sold; quote and order lines record what
  *was* sold, as a snapshot. Never make a transaction read through to the
  catalog for a name, a price, or a term.
- **Anything that could be decided elsewhere sits behind an interface.**
  `AuthProvider` (`src/lib/auth/types.ts`), `EmailProvider`
  (`src/lib/email/types.ts`) and `PermissionProvider`
  (`src/lib/security/types.ts`) each have a real second implementation — `dev`,
  `console` and `open` — that is not a mock:
  they are what a fresh clone runs on, and they are what stops the interface
  quietly growing a shape only Auth0, only Gmail, or only the profile tables can
  satisfy. A provider id is a `VarChar`, never an enum, so adding one is never a
  migration — and so is an `object_key`, so a new resource is permissionable the
  moment it is registered.
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

- **No workspace membership.** Profiles say what a user may do *in* a workspace
  (see "Profiles and permissions"), but nothing says which workspaces they may
  open at all — `workspace_id` is still supplied by the caller. A signed-in user
  who names another workspace gets that workspace's **default** profile, or
  nothing if it has none, so this is no longer wide open; but "no default
  profile" is not the same as "not a member", and a workspace with a permissive
  default is readable by anyone who can sign in. A `workspace_member` table is
  the next piece of work, and `src/lib/auth/current-user.ts` is where it goes.
  Chat's `auth_mode` is a different question again: it authenticates *customers*
  on a channel, deciding who may read one visitor's threads, not who may use
  the CRM.
- **No record-level security.** Permissions are per object and per field, not
  per row: a profile that may read Deals may read *every* Deal in the workspace.
  There is no owner-based sharing, no role hierarchy, and no sharing rules, so
  Salesforce's "View All / Modify All" distinction has deliberately not been
  modelled — it only means something once records can be restricted
  individually.
- **Only the generic endpoints are permissioned.** Everything through
  `src/lib/api/resource.ts` is, which covers all CRUD on every resource. The
  action routes that do more than CRUD — `deals/{id}/quote`,
  `quotes/{id}/accept`, `subscriptions/{id}/amend`, `shipments/{id}/ship` — and
  the email routes check that you are signed in but not what your profile
  allows. They should call `guard()` too; email in particular has no object key
  of its own yet, so "who may send as this workspace" is currently "anyone
  signed in".
- **No sign-out everywhere.** The session is a stateless signed cookie, so
  signing out clears it on that browser. Rotating `AUTH_SESSION_SECRET` is the
  blunt instrument that ends every session at once.
- **Email is send-only.** Nothing reads a mailbox, so a customer's reply does
  not come back into the CRM. `provider_thread_id` is stored against every sent
  message precisely so that threading works when it does, and no attachments
  can be sent yet.
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
