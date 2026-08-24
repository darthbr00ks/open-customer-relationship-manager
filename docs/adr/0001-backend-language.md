# ADR 0001: Implementation language for open-rm

- Status: Accepted
- Date: 2026-08-24
- History: implemented in Python/FastAPI (PR #1), ported to TypeScript, then
  moved to a full-stack Next.js architecture

## Context

open-rm is a greenfield, GPLv3, open-source CRM. Two goals are in tension and
drive the choice of language:

1. **Performance** — the tool should stay responsive with realistic data
   volumes (hundreds of thousands of contacts, activity timelines, reporting).
2. **Contributor base** — an open-source project lives or dies on how many
   people can read the code, fix a bug on a weekend, and how easily a
   self-hoster can run it.

A third constraint sits underneath both: **self-hosting friction**. A CRM is
deployed by small teams and solo admins, not only by platform engineers.

## What "performance" actually means for a CRM

A CRM is an I/O-bound CRUD and reporting application. A typical request does a
handful of database round-trips, serializes some JSON, and returns. Language
runtime cost is a small slice of that budget — usually single-digit
milliseconds out of a 30-100ms request. The things that actually decide whether
open-rm feels fast are, in order:

1. Query patterns (N+1 queries, missing indexes, unbounded list endpoints)
2. Pagination and result-set discipline on every list and report
3. Caching of derived/report data
4. Payload size and frontend rendering strategy
5. Only then: raw language throughput

Choosing a runtime that is 2-3x faster on a synthetic benchmark moves p95 by a
few percent on this workload. Choosing an architecture that avoids N+1 queries
moves it by an order of magnitude. Language selection should therefore be
optimized for maintainability and contribution volume, with performance treated
as a floor requirement ("fast enough, with a clear path to optimize hot spots")
rather than the primary axis.

The exception to watch: bulk import/export, deduplication passes, and large
aggregate reports are genuinely CPU- and memory-sensitive. These should be
isolated as background jobs so they can be optimized — or rewritten in a
different language — without touching the main application.

## Options considered

### TypeScript (Node.js) — chosen

- **Contributor base:** the largest on GitHub. Critically, the web UI will be
  TypeScript regardless of the backend choice, so a TS backend means one
  language across the whole codebase. A contributor can trace and fix a bug
  from the form field to the SQL query without switching ecosystems, and types
  can be shared between client and server instead of duplicated.
- **Performance:** mid-tier on synthetic benchmarks; comfortably sufficient for
  I/O-bound CRUD. The event loop suits many concurrent, mostly-waiting
  requests. CPU-heavy jobs are the weak spot and belong in workers.
- **Ecosystem:** mature HTTP, ORM, auth, queue, and background-job libraries.
- **Risks:** dependency churn and supply-chain surface; memory use is higher
  than compiled alternatives; discipline is required to keep the dependency
  tree small.
- **Precedent:** the most active modern open-source CRM (Twenty) is built this
  way.

### PHP (Laravel or Symfony) — strong runner-up

- **Contributor base:** very large, and the deployment story is the best of any
  option — shared hosting, cPanel, and one-click installers are realistic
  distribution channels for a self-hosted CRM.
- **Performance:** modern PHP 8.x with opcache is respectable and in the same
  broad range as Node for this workload. Not a blocker.
- **Precedent:** nearly every long-lived open-source CRM is PHP — SuiteCRM,
  EspoCRM, Vtiger, Krayin.
- **Risks:** still requires a separate TypeScript frontend, so the codebase is
  bilingual anyway; attracting new contributors to a greenfield PHP project is
  harder than it was a decade ago.

### Go

- **Performance:** excellent, and a single static binary is the friendliest
  possible self-hosting artifact.
- **Risks:** smaller pool of contributors for business-CRUD work specifically,
  a thinner ORM/admin ecosystem, and more boilerplate per feature — which slows
  the rate of community contributions, the resource this project is most short
  of. Still bilingual with the frontend.

### Python (Django)

- **Contributor base:** very large; Django's ORM, migrations, and admin
  scaffolding would accelerate early development significantly.
- **Risks:** the slowest of the candidates under concurrent request load, a
  fragmented async story, and packaging/deployment friction for self-hosters.

### Java / Kotlin (Spring Boot), C# (.NET)

- **Performance:** the strongest of the group, and the best fit if open-rm were
  aiming at large-enterprise deployments.
- **Risks:** heavier memory and startup footprint for small self-hosted
  installs, more ceremony per feature, and a contributor pool that skews toward
  paid enterprise work rather than weekend open-source contribution.

## Decision

Build open-rm as a **TypeScript monorepo**:

- **Backend:** Node.js with a typed HTTP framework, exposing a versioned REST
  (or tRPC) API.
- **Frontend:** TypeScript SPA sharing types with the backend.
- **Database:** PostgreSQL — the real performance lever, and the source of
  full-text search, JSONB custom fields, and reporting.
- **Background work:** a separate worker process for imports, exports,
  deduplication, and report generation, kept behind a queue so it can be
  scaled — or reimplemented in another language — independently.

The reasoning in one line: performance for this workload is decided by the
database and the query patterns, not by the language, so the language should be
chosen for contributor reach — and one TypeScript codebase end to end maximizes
that.

## What would change this decision

- If **non-technical self-hosting on commodity shared hosting** becomes a
  primary distribution goal, PHP/Laravel becomes the better choice.
- If **single-binary distribution** is the priority, Go becomes the better
  choice.
- If the target shifts to **large-enterprise deployments** with heavy
  concurrency and compliance requirements, Java/Kotlin or .NET becomes the
  better choice.

## Implementation

open-rm was first implemented as a Python/FastAPI service, then ported to
TypeScript per this decision, and subsequently moved onto a full-stack Next.js
architecture. The current stack is:

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router), React 19 |
| Language | TypeScript, strict mode |
| Persistence | Prisma over PostgreSQL |
| Validation | Zod |
| UI components | shadcn/ui (Radix primitives, owned in-repo) |
| Client state | Zustand |
| Background jobs | BullMQ over Redis |
| Tests | Vitest against real Postgres and Redis |

Next.js collapses what were previously two deployables — an API service and a
separate frontend — into one codebase, which serves the contributor-reach
argument above: a contributor can follow a change from the form field to the SQL
query without crossing a repository or a language boundary.

The worker is a second process running the same code. This is the "keep
CPU-bound work out of the request path" consequence below, made concrete: bulk
CSV import and pipeline report aggregation run there, and reports are cached in
Redis so a cold read enqueues a rebuild rather than blocking on a full
aggregate.

### Preserved across the ports

Table names, column names, native PostgreSQL enum types, indexes, and unique
constraints have carried through every port unchanged, as have the JSON field
names of the REST API. Field names are snake_case at every layer — database,
Prisma model, Zod schema, JSON — so no mapping layer exists to drift.

### Deliberate deviations from the original FastAPI service

Each fixes a defect rather than reproducing it:

1. **List endpoints are bounded.** The original returned every matching row;
   lists now take `limit` (default 50, max 200) and `offset`, ordered by
   `created_at DESC, id ASC` so paging is stable. Unbounded list endpoints were
   identified above as the top performance risk for this workload.
2. **Junction lookups are workspace-scoped.** Detail and update on
   `entity-persons` and `incident-cases` previously matched on id alone, which
   let a caller read or modify another workspace's rows.
3. **Duplicate keys return 409** rather than an unhandled 500.

## Consequences

- Contributors need only one language to work across the stack.
- Dependency hygiene must be an explicit, enforced policy given the npm
  supply-chain surface.
- CPU-bound work must be kept out of the request path from day one.
- Performance work belongs in schema design, indexing, and query review — these
  should be part of the code review checklist, not an afterthought.
