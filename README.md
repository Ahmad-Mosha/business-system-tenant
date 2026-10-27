# Prime Market

[![CI](https://github.com/Ahmad-Mosha/business-system-tenant/actions/workflows/ci.yml/badge.svg)](https://github.com/Ahmad-Mosha/business-system-tenant/actions/workflows/ci.yml)
[![In production](https://img.shields.io/badge/status-in%20production%20since%20Aug%202026-2ea44f)](#in-production)

**A real business runs on this system.** Prime Market is the operations
platform of a multi-channel e-commerce reseller in Egypt. It holds the
business's inventory, orders, shipping, marketplace settlements, purchasing and
money in one place. It went live on 31 August 2026, and the owners and their
staff run their operations on it, in Arabic and English.

I built it end to end: I gathered the requirements with the owners, then
designed the system, wrote the code, deployed it, and support it in production.

| | |
|---|---|
| **Status** | Live since 31 August 2026 |
| **Used by** | The business's owners (admin role) and its order moderator |
| **Connected to** | noon and Amazon settlement reports, the website's order webhook, the Bosta courier API |
| **Delivery** | 84 pull requests merged, most of them shipped in small steps while the system was in use |
| **Runs on** | AWS EC2 · Docker Compose · Caddy · Neon Postgres · nightly encrypted backups |

**Stack:** TypeScript · NestJS 11 · TypeORM · PostgreSQL 17 · Next.js 16 (App
Router, React 19) · Tailwind 4 · shadcn/ui · next-intl · Docker · Caddy · AWS
EC2 · Neon · GitHub Actions

---

## The problem

The business buys stock, holds it in its own warehouse and at noon's
fulfilment centre, and sells it at different prices on four channels: **noon**,
**Amazon**, its **own website** (Easy Orders) and **social media**. Most
payments are cash on delivery, collected by the courier **Bosta**.

Before this system:

- noon's settlement reports were reconciled **by hand, for hours every day**,
  just to work out what had sold, what noon had charged, and what noon still
  owed.
- Social media orders lived in spreadsheets.
- Nobody could give a trustworthy answer to *how much cash do we have, what is
  our stock worth, and what is actually profitable?*

The goal: **one reconciled source of truth, where every number can be opened
to show the records behind it.**

## In production

### How the business uses it

- **Website orders:** since 1 September 2026 they arrive through the webhook
  and are handled here, from confirmation to delivery.
- **Social media orders:** these used to live in spreadsheets. The order
  moderator now enters them, and sees only the orders assigned to them.
- **Marketplace reports:** the owners upload noon and Amazon reports instead
  of reconciling them by hand. The money overview puts profit and loss for
  all five channels on one screen.
- **The owners ran it alone for a week** (17–23 October 2026) while I was
  offline, with no laptop or internet, using an Arabic user guide prepared
  for them.

### Checked against the real systems

- **noon:** the statement rebuilt from noon's transaction export matches
  noon's own portal. Net proceeds and payouts match exactly, and fees match to
  within 2 EGP over a full month.
- **Bosta:** "has Bosta paid us for this shipment?" was checked row by row
  against the real Bosta dashboard, and all 24 rows matched. The obvious rule,
  "delivered means paid", turned out to be wrong: cash-on-delivery shipments
  are routinely delivered and still unpaid. The real signal is a payout id
  that only one of Bosta's endpoints returns.
- **Catalogue:** built from the business's real noon, Amazon and website
  exports. Each channel names the same product differently, which is why
  products are linked by listing and never matched by name
  ([docs/evidence](docs/evidence/)).

### Lessons from running it

| What happened | What changed |
|---|---|
| In development, a half-written migration ran under the hot-reloading server, and its missing column surfaced as an error a day later | The migration guard: each migration is fingerprinted once it runs, and an edited one stops the development server and is named |
| The instance's 8 GB disk filled up during a rebuild | Resized it to 20 GB on the running instance, with no downtime |
| The Docker build plugin packaged with Amazon Linux 2023 was too old for current Compose | Fixed it on the server and added the fix to the bootstrap script, so a fresh instance works first time |
| Neon's pooled endpoint starts with an empty `search_path`, which broke raw SQL | Production uses the direct endpoint, and `.env.prod.example` says why |
| The database moved from the EC2 box to Neon | Row counts and per-table content hashes were verified before cutover, and the old database stayed up as a rollback |

### Working with the owners

- **Money rules are agreed before they are built.** Each one goes to the
  owners as a short decision with a worked example in Egyptian Arabic, and
  then becomes a rule in [docs/business-rules.md](docs/business-rules.md).
  For example: a correction is a reversal, never a delete; a sales invoice
  books revenue when it is posted; invoices dated before the opening stock
  count move no stock.
- **Daily use shaped the details:** a hand cash count for the treasury, a
  privacy toggle that hides figures when someone is nearby, forms that keep
  unfinished work, 30-day sessions so nobody signs in every morning, and
  Arabic as the default language.

## What it does

| Module | What it covers |
|---|---|
| **Inventory** | Products and variants, one stock pool fed by every channel, two locations (warehouse and noon) with atomic transfers, stock counts, moving-average cost, stock history per product |
| **Orders & shipments** | Website orders arrive by webhook; social orders are entered by hand. An order lifecycle with separate payment status, returns with condition and reason, moderator assignment, a live Bosta shipments board with cash-collection status |
| **Marketplaces** | Upload noon and Amazon settlement reports: statement of account month by month, fees, payouts, best sellers, products not yet linked, and what each marketplace still owes |
| **Purchasing** | Supplier invoices with landed costs (shipping, customs) spread by value or per unit, draft → post, supplier balances and payments |
| **Sales** | Wholesale sales invoices, customers, receivables and payments |
| **Money** | Treasury, a double-entry ledger, expenses, cheques, a cash count, and a profit and loss across all five channels |
| **Team** | Admin and moderator roles. Moderators see only the orders assigned to them, and the API enforces this in the query |
| **Bilingual** | Every screen in Arabic (right-to-left) and English, with Cairo time and Egyptian formatting |

---

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    UI[Arabic / English UI]
  end

  subgraph EC2["AWS EC2 · Docker Compose"]
    Caddy[Caddy<br/>TLS + routing]
    Web["Next.js<br/>server components<br/>+ server actions"]
    API["NestJS API<br/>auth · rules · ledger"]
  end

  DB[(PostgreSQL 17<br/>Neon)]
  EO[Easy Orders<br/>website]
  Bosta[Bosta<br/>courier API]
  Backup[GitHub Actions<br/>nightly encrypted backup]

  UI -->|HTTPS| Caddy --> Web
  Web -->|REST + session cookie| API
  EO -->|order webhooks| Caddy -->|"/api/*"| API
  API --> DB
  API -->|shipments, COD status| Bosta
  Backup -.->|pg_dump| DB
```

The browser never calls the API itself. Pages read from the API inside
server components; forms write through server actions, which pass the
session cookie on. The only traffic that reaches the API from outside is
the website's webhook.

### Repository layout

```
apps/
  api/                      NestJS API
    src/
      auth/                 session cookie (JWT), global guard, roles, scrypt passwords
      catalog/              products, variants, channel listings, catalogue import
      inventory/            append-only stock movements, row locking, opening count
      orders/               lifecycle, payment status, returns, assignment
      purchasing/           supplier invoices, landed cost, AVCO costing
      sales/                customers, wholesale sales invoices
      finance/              chart of accounts, ledger, treasury, expenses, cheques
      noon/  amazon/        settlement report parsers and importers
      integrations/         Bosta client, Easy Orders webhook
      reporting/            statements, product performance, profit and loss
      database/             migrations, migration guard, integration test
      problem.ts            error shape: stable code + params + blocking records
  web/                      Next.js app
    src/
      app/(app)/<module>/   one folder per screen: page.tsx reads, actions.ts writes
      components/<module>/  screen parts, grouped like the routes
      components/layout/    shell and list-screen kit (Page, TablePanel, FilterBar)
      components/forms/     inputs and dialogs (MoneyInput, DatePicker, FormDialog)
      components/ui/        shadcn primitives, owned code
      lib/                  API client, session, pure helpers (tested)
      i18n/  messages/      next-intl config, Arabic and English messages
docs/                       business rules, frontend, design system, i18n, deployment, integrations
deploy/                     EC2 bootstrap script
```

---

## Core design

### 1. Record what happened; derive every number

Stock and money are **append-only ledgers**. Nothing is stored as a running
total:

- **Stock on hand** = `SUM(stock_movement.quantity)` for a variant. Each
  movement has a reason (purchase, sale, return, transfer, count, damage), a
  location, the unit cost it applied, and the record that caused it.
- **Every balance** (cash, stock value, what noon owes, what a supplier is owed)
  is a `SUM` over `ledger_entry` rows.
- **A mistake is never edited or deleted.** It gets a reversing entry. Editing
  a posted invoice means cancelling it and entering it again. The history
  always explains the number.

This is the direct answer to the owners' real need. They didn't just want to
see a number; they wanted to see *why it is that number*.

### 2. A two-account ledger

Each `ledger_entry` moves one positive `amount` from a credit account to a
debit account, across a fixed chart of 17 accounts (cash, cheques, inventory,
noon and Amazon receivables, Bosta collections, customer receivables, supplier
payables, capital, sales, expenses…). An account's kind decides which way its
balance reads. An order paid in cash posts `CASH ← SALES`. A noon payout posts
`CASH ← NOON_RECEIVABLE`. noon's closing balance is a receivable, not cash, so
it can never leak into the cash figure.

### 3. Costing

Stock is valued at **moving weighted average cost (AVCO)**, kept to four
decimal places. A purchase invoice's extra costs (shipping, customs) are added
to the goods' cost, spread by value or per unit. Each receipt keeps its own
cost and the average right after it, so a past valuation is never rewritten.
Money columns are `numeric` in Postgres and strings in TypeScript. Totals are
summed in SQL, never in floating point.

### 4. Concurrency without double-selling

- Every code path that writes stock first locks the variants involved with
  `SELECT … FOR UPDATE`, **always in sorted id order**. Two orders for the
  last unit can't both succeed, and two writers can't deadlock.
- Webhook redeliveries for one external order, and repeated form submits with
  the same request id, are serialized with transaction-scoped advisory locks.
  A double click or a retry can never create a second order or payment.
- Order numbers come from a database sequence shared by manual and webhook
  orders.

An integration test runs these operations **concurrently against a real
Postgres** and asserts that stock, cash and supplier balances still add up.

### 5. Imports and webhooks are safe to repeat

Reports overlap and webhooks redeliver, so every inbound feed:

1. **stores the raw row or payload first**, before interpreting it;
2. **fingerprints it** (SHA-256) under a unique constraint, so re-uploading the
   same report reads "0 new";
3. **maps it to a product through `channel_listing`**. A row that matches no
   product waits for a person to link it. The system never guesses.

Each channel identifies a product its own way (noon partner SKU, Amazon seller
SKU, website id), and names differ between channels, so the internal variant is
the identity and listings point at it.

**History before go-live:** stock starts from a dated opening count. Sales from
before that count move money only, because they are already inside the count.
Sales after it move both money and stock.

### 6. Errors a person can act on

The API never sends prose to the UI. It answers with a stable **code**, the
**params** the sentence needs, and the **records in the way** (`problem.ts`).
The web app words the code in the reader's language and links each blocking
record. When an action is refused for several reasons, `refuse()` returns all of
them at once, so they can be fixed in one go.

### 7. Security

- A **global auth guard**: every endpoint needs a session unless it opts out
  with `@Public()`, so a new controller is protected without anyone having to
  remember to protect it.
- Sessions are a JWT in an `httpOnly` cookie. Passwords use scrypt from Node's
  own crypto module.
- Production **refuses to start** with a missing or short JWT secret, and
  refuses to seed accounts with the development passwords.
- The webhook checks a shared secret with a constant-time compare, and checks
  the store id.
- Roles are enforced in the API's queries, not just hidden in the UI.

### 8. Schema changes

The schema is owned by **migrations** (16 so far) and applied on boot in
production. A **migration guard** fingerprints each migration once it has run.
If someone later edits a migration that already ran, the development server
stops with the migration's name, and production logs it. That database would
otherwise drift silently from the code. During development, a hot reload never
applies a migration; `npm run db:migrate` does that on purpose.

### Frontend

- **Server-first.** Pages are server components that read through
  `lib/api.ts` (`no-store`, so a screen never shows a stale figure). Writes go
  form → server action → API → `revalidatePath`. There is no client-side cache
  library, because the server already holds the state.
- **The URL is the state** for filters, paging and the reporting period, so
  any view can be shared.
- **Two languages, enforced.** 1,781 messages per language. Tests check that
  Arabic and English have the same keys and the same placeholders, and an
  ESLint rule fails the build on hard-coded text in a screen. Layout uses
  logical CSS, so right-to-left needs no special cases.
- **Built for daily use:** unfinished forms are kept as local drafts per user
  and record; number fields accept Arabic digits; a privacy toggle hides
  money figures on screen; Ctrl/⌘ K searches and jumps anywhere.
- **A design system, not per-screen styling:** shadcn/ui components owned in
  the repo, a list-screen kit shared by every module, and tabular figures for
  money ([docs/ui-ux.md](docs/ui-ux.md)).

---

## Decisions and trade-offs

| Decision | Chosen | Over | Why | What it costs |
|---|---|---|---|---|
| Repository | One monorepo with two apps (npm workspaces) | Separate repos | API and UI change together; one PR, one CI run, one lockfile | Two apps share one dependency install |
| Data access | TypeORM entities + raw SQL where it matters | Prisma, Drizzle | Entities fit Nest's decorators; ledger-shaped reads (running balances, `FOR UPDATE`, advisory locks) are plain SQL | Two styles of data access side by side |
| Nest structure | **One application module** | A module per feature | Every feature posts to the same ledger and stock; per-feature modules would mostly re-export `FinanceService` and `LedgerService`, adding wiring without a real boundary | Nothing enforces boundaries between features. Split it when a feature gets its own team or deployment |
| Ledger | Two accounts per entry | A multi-line journal | Every real event here is one *from* and one *to*; a non-accountant owner can read the table | A compound event becomes several entries linked by their source |
| Corrections | Reversals, cancel and re-enter | Editing or deleting rows | Every figure stays explainable after the fact | More rows; "edit" is two steps behind the scenes |
| Costing | Moving average (AVCO) | FIFO | Costs vary per shipment, there are no expiry dates or lots to track, and margins stay stable | No per-lot cost. Each receipt's cost is stored, so FIFO could be recomputed later |
| Concurrency | Postgres row and advisory locks | Optimistic retries, a queue | Correctness lives in the database where the data is; no extra infrastructure | Writes to the same variant wait for each other, which is fine at this volume |
| Order state | Lifecycle, payment and courier status tracked apart | One status field | "Delivered but not paid" is the normal state of a COD order | More states to show on screen |
| Marketplace data | Report upload (CSV) | Marketplace APIs | noon offers no settlement API; the report is what reconciles to the money | Someone has to upload each report |
| Rendering | Server components + server actions | SPA + client data layer | Dense list screens stay fast and no state is duplicated in the browser | Every interaction is a server round trip |
| API errors | Stable codes, worded by the web app | Localized messages from the API | One place for each language; a new code never breaks a screen | The code list must be kept in sync with the messages |
| Hosting | One EC2 box, Docker Compose, Caddy, Neon Postgres | Serverless, Kubernetes | Cheap, simple, automatic TLS; the database is managed and backed up nightly off the box | Manual deploys and a single instance; no autoscaling, none needed yet |
| Tenancy | Single tenant | `tenant_id` + row-level security from day one | The only priority is this business working properly | Serving other businesses later means adding tenancy to every table |
| Tests | Node's test runner, real Postgres | Jest with mocked repositories | The risky logic is SQL and locking, which mocks can't prove | The integration test needs a database (CI starts one) |

---

## Testing

```bash
npm test
```

- **API:** parsers (noon, Amazon, CSV), costing, ledger rules, password
  hashing, production config checks, migration guard, Bosta status mapping,
  manual stock adjustment rules, and a **database integration test**. It runs orders,
  purchases, payments, returns, imports and webhooks, many of them concurrently,
  against a real Postgres, and checks that stock, cash and balances stay
  consistent.
- **Web:** number input rules, money and date formatting, purchase line maths,
  and Arabic/English message parity.
- The integration test is skipped unless `TEST_DATABASE_URL` is set. It refuses
  any database that is not on localhost and whose name does not end in `_test`.

[CI](.github/workflows/ci.yml) runs typecheck, lint, every test against
Postgres 17, and both production builds on every pull request.

## Running locally

Needs Node 22 and Docker.

```bash
npm install
cp .env.example .env
npm run db:up          # Postgres 17 on localhost:5433
npm run db:migrate     # apply migrations
npm run dev            # API on :3001, web on :3000
```

Development seeds two accounts: `admin@admin.com` / `admin123` and
`moderator@moderator.com` / `moderator123`. Production refuses these
passwords.

To run the integration test too:

```bash
docker compose exec db createdb -U prime prime_market_test
TEST_DATABASE_URL=postgres://prime:prime@localhost:5433/prime_market_test npm test
```

| Script | Does |
|---|---|
| `npm run dev` | API and web together, with hot reload |
| `npm run typecheck` | `tsc` on both apps |
| `npm run lint` | ESLint on the web app, including the no-hard-coded-text rule |
| `npm test` | API and web tests |
| `npm run build` | Production builds of both apps |
| `npm run db:migrate` | Apply pending migrations to `DATABASE_URL` |

Bosta and Easy Orders keys (`BOSTA_KEY`, `EASY_ORDER_KEY`,
`EASYORDERS_WEBHOOK_SECRET`) are optional locally. Without them, the shipments
board says Bosta can't be reached and the webhook refuses deliveries.

## Deployment

`docker-compose.prod.yml` runs the API, the web app and Caddy on one EC2
instance. Caddy gets and renews the TLS certificate on its own. The database
is Neon's managed Postgres. A GitHub Actions workflow takes a `pg_dump` every
night, checks that it restores, encrypts it with AES-256 and keeps it for 90
days off the box. Details: [docs/deployment.md](docs/deployment.md).

## What I would do next

- **Continuous deployment:** today a deploy is a `git pull` and
  `docker compose up` on the box.
- **Post cost of goods to the ledger.** The profit and loss is currently built
  from the records, using the cost captured at each sale.
- **OpenAPI docs** generated from the controllers.
- **Tenancy** if the platform is ever offered to other businesses.

## Documentation

| | |
|---|---|
| [Business rules](docs/business-rules.md) | The rules the system obeys, marked confirmed or open |
| [Frontend](docs/frontend.md) | How the web app is put together and its conventions |
| [Design system](docs/ui-ux.md) | Principles, colour, type, page anatomy |
| [Arabic and English](docs/i18n.md) | Translation, right-to-left, formatting, glossary |
| [Deployment](docs/deployment.md) | Infrastructure, deploys, backups |
| [Integrations](docs/evidence/integrations.md) | Bosta, Easy Orders and noon as they really behave |
