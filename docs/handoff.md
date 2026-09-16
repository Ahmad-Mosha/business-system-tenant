# Handoff — current state

Read this first when continuing the build in a new session. It records what is
**actually** built and running, which is not the same as the phased plan in
[roadmap.md](roadmap.md).

Last updated: 2026-09-16.

---

## Active production-readiness work

The owner's 2026-09-16 instructions supersede the old money-system blockers
below. Current decisions, audit findings and implementation progress are in
[production-readiness.md](production-readiness.md). Order/payment/stock and
purchasing writes now serialize concurrent changes; paid order edits require
reversing payment first. No production data has been rewritten. Full received returns now require a reason
and condition; paid returns/cancellations reverse revenue into customer refunds
due, with cash paid separately. A received return is final. Existing historical
returns require reconciliation, not automatic backfill. Inventory now separates
WAREHOUSE/NOON with atomic transfers; the legacy pooled balance stays WAREHOUSE
until an owner reconciles actual noon holdings. No quantities are guessed.

## Toolchain (what's real)

- **npm workspaces** monorepo — `apps/api` (NestJS 11 + **TypeORM** + Postgres)
  and `apps/web` (Next.js 16 — a modified build; read `apps/web/AGENTS.md`
  before touching it).
- Local DB: Postgres 17 in Docker — `npm run db:up` → `localhost:5433`, db
  `prime_market`, `prime` / `prime`. Connection string in the repo-root `.env`.
- Run everything: `npm run dev` (API :3001, web :3000). `npm run typecheck`,
  `npm test` (api), `npm test -w @prime/web`.
- `docs/architecture.md` describes a stack (Drizzle, RLS, multi-tenant) that
  was **reverted**. Treat it as intent, not fact. Business rules in `docs/` are
  authoritative; its stack section is not.

## Database & schema

- **Schema is owned by migrations, not `synchronize`** (since 2026-09-15).
  `apps/api/src/database/migrations/` — `migrationsRun: true` applies pending
  ones on every API boot, so deploys still need no separate step.
- CLI (needs `DATABASE_URL` set inline — it doesn't read `.env`):
  ```bash
  DATABASE_URL=... npm run migration:generate -w @prime/api -- src/database/migrations/Name
  DATABASE_URL=... npm run migration:run -w @prime/api
  ```
- Entities, naming strategy and migration glob are shared between the app and
  the CLI in `src/database/orm-options.ts` + `entities.ts`.
- **`order_number_seq` is not in any migration** — `OrdersService.onModuleInit`
  creates it (`START 1000`). Any fresh database copied from real data must have
  it `setval`'d to the last used number, or order numbers restart at PM-1000.

## Environments

| | Compute | Database |
|---|---|---|
| Live (real business) | AWS EC2, `https://prime-market.duckdns.org` | **Neon Prod** project |
| Dev database | — (nothing points at it yet) | **Neon Dev** project, same schema, empty |
| Local | your machine | Docker Postgres :5433 |

- Moved from EC2's own Postgres container to Neon on 2026-09-15; verified by
  row counts **and** per-table content hashes before cutover. See
  [deployment.md](deployment.md).
- **Use Neon's direct endpoint, never the `-pooler` one** — the pooler has an
  empty `search_path` and this app's raw SQL doesn't schema-qualify tables.
- EC2's old `db` container is still running with the pre-migration data as a
  rollback path. Backup: `~/prime_market_backup_20260915.dump` on the box.
  Don't remove either without Ahmad's go-ahead.
- Turso/libSQL was evaluated and rejected (no TypeORM driver, Postgres-only SQL,
  `numeric` money). Don't re-propose it.

## Deploying

No CI/CD. The box updates only when someone runs:
```bash
ssh -i ~/Downloads/prime-key.pem ec2-user@prime-market.duckdns.org
cd ~/dashboard && git pull && docker compose -f docker-compose.prod.yml up -d --build api web
```
SSH is locked to one IP in the security group — if it times out, update the
port-22 rule's source to "My IP" in the AWS console. As of 2026-09-16 EC2 runs
`main` at PR #57.

---

## Numbers audit (2026-09-15) — read before touching money

Traced end to end in code. Cash and stock value are correct. **Profit is not.**

1. **COGS is never posted.** The `COGS` account, entry kind and the
   `periodSummary` formula all exist, but nothing writes a `debit COGS / credit
   INVENTORY` entry, and `OrdersService.debitStockForOrder` doesn't even set
   `unit_cost` on SALE movements. Any gross/net profit shown treats cost of
   goods as zero. The UI deliberately hides profit while COGS is zero.
2. **Placeholder formula** (`ledger.service.ts`): `gross = revenue − COGS −
   channel fees`, `net = gross − shipping − other`. Not owner-confirmed.
3. **Revenue** posts `debit CASH / credit SALES` for `order.total` only when an
   order's payment turns PAID (`FinanceService.recordOrderPayment`), and
   reverses when it leaves PAID. Marking an order RETURNED does **not** reverse
   revenue by itself — the payment status has to change too.
4. **`product_variant.sellingPrice`** is only a pre-fill for the manual order
   form. It never feeds revenue, stock value or profit (revenue comes from
   `order_item.unitPrice`).
5. **Manual stock movements** (product screen) touch the ledger only for
   `PURCHASE` + positive quantity + a unit cost on file. Every other reason, or
   any removal, changes the count only. The form currently allows any reason
   with either direction (e.g. "Purchased −201") — worth constraining.
6. **noon/Amazon** sales don't create orders or stock movements at all
   (`Order.source` is `EASYORDERS | SOCIAL` only); noon fees/COGS aren't posted.
7. No stock locations — one pool per variant, no warehouse vs noon split.

**Blocked on the owners.** Questions are in
[owner-questions-money-system.md](owner-questions-money-system.md) (Egyptian
Arabic, for the meeting). Don't implement COGS posting, profit definitions,
returns handling or noon posting until those are answered.

---

## Built recently

- **Multi-SKU per channel** (PR #57) — a product can have several SKUs on the
  same channel (e.g. two Amazon listings). Backend already allowed it
  (`channel_listing` is unique on channel + external id); both the product
  screen (`channel-listings.tsx`) and Add Product (`new-product-form.tsx`, "+"
  per channel, `formData.getAll`) now support it. Multi-**variant** products
  still can't be mapped.
- **Profit section on `/money`** (PR #57) — under the cash-on-hand chart: stat
  row + stacked bars (COGS, channel fees, gross profit) with a gross-margin
  line, from `GET /finance/profit-series?from&to&bucket`. Shows the
  "COGS not posted yet" note instead while COGS is zero (i.e. in production).
- **Demo seed** `apps/api/scripts/seed-demo-money.ts` — local only, needs
  `DATABASE_URL` inline, tags everything `[DEMO]`. The demo rows were deleted
  from the local DB after the 2026-09-16 meeting.

## Money module

Double-entry-lite: `ledger_account` (14 fixed accounts, seeded on boot) +
append-only `ledger_entry` (one debit + one credit + positive amount). Every
balance is a `SUM`. AVCO costing on purchase invoices; landed cost allocated by
value. Spec: [money-module-build.md](money-module-build.md). Owner guide:
[دليل-الوحدة-المالية.md](دليل-الوحدة-المالية.md). Screens: `/money`,
`/money/treasury`, `/money/purchases`, `/money/suppliers`, `/money/ledger`.
Supplier "owed" is derived from invoices, not the `SUPPLIER_PAYABLE` balance.

## Orders, team, integrations

- **Roles:** `ADMIN` sees everything; `MODERATOR` sees only Orders + Shipments
  for orders assigned to them (enforced in the query). A moderator's manual
  order auto-assigns to them. `/team` screen; `POST /auth/moderators` is the
  only account-creation path. Lifecycle `NEW→ASSIGNED→CONFIRMED→SHIPPED→
  DELIVERED` (+`CANCELLED`/`RETURNED`) — admins can jump to any status;
  never formally reviewed with the owners.
- **Stock leaves at order creation** for manual and Easy Orders orders;
  cancel/return credits it back.
- **Bosta** — only courier. Use `POST /api/v2/deliveries/search` for list and
  detail (v0 caps at 10, v1 has no `cashoutInfo`). COD → ledger not built.
  Details: [evidence/integrations.md](evidence/integrations.md).
- **Easy Orders** — webhook live in production (~180 real orders since
  2026-09-01); orders arrive unmapped until their product has a website listing.
- **noon** — manual CSV import, no API; no quantity column; closing balance is a
  receivable. [evidence/noon-settlement-report.md](evidence/noon-settlement-report.md).
  The historical backlog is intentionally still unmapped.

---

## Working agreements (do not relearn the hard way)

- **Architecture first.** Design / discuss / agree before code. Never invent a
  business rule — ask.
- **Git:** one-line commit messages, no `feat:`/`fix:` prefixes, push after
  every step, branch → PR → merge → pull. **No Claude co-author trailer, no
  "Generated with Claude Code" in PRs.** Merging without review is blocked for
  Claude — Ahmad clicks merge.
- **Visual:** shadcn, teal primary, `num` for figures, compact headers. Arabic
  and English on every screen ([i18n.md](i18n.md)); API errors are stable codes,
  never localized text.
- Verify UI at a real desktop width (1920+), not just the narrow preview pane.
- Repo is **public** (`Ahmad-Mosha/business-system-tenant`). Never commit
  secrets or connection strings.
