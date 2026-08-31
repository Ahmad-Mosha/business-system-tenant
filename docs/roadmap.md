# Roadmap

Phases in dependency order. Each one is finished — usable and verified against
real data — before the next starts.

The ordering rule comes from what broke the previous build: **the thing being
referenced is built before the thing that references it.** Orders reference
stock. Stock references products. Money references cost. Analytics references
all of it.

```
0 Foundation
      │
      ├─► 1 Catalogue ──► 2 Stock ledger ──► 3 Costing ──► 4 Money ledger
      │                        │                               │
      │                        │                               ├─► 6a noon settlements   ★ payoff
      │                        │                               │
      │                        └───────────────────────────────┴─► 5 Orders
      │                                                              │
      │                                                    ┌─────────┼─────────┐
      │                                                    ▼         ▼         ▼
      └───────────────────────────────────────────────► 6b noon   7 Bosta   8 Easy Orders
                                                         sales    shipping   webhook
                                                                       │
                                                                       ▼
                                                                9 Analytics ──► Amazon
```

---

## Phase 0 — Foundation

Monorepo, NestJS + Drizzle + PostgreSQL on a **fresh database name** (the
existing volume holds the previous build's schema and must not be collided
with). Migrations from the first table. `tenant_id` + RLS. Auth with Admin and
Moderator roles. Swagger UI with working *Try it out*.

Ends with the API deployed to a **fixed HTTPS domain**. This is phase 0 and not
phase 8 on purpose: it is what makes the Easy Orders webhook permanently
solvable instead of repeatedly re-tunnelled.

**Done when:** a fresh clone runs `docker compose up` and `npm run dev`, and
someone with no backend knowledge can log in through Swagger and call an
endpoint.

---

## Phase 1 — Catalogue and product identity

Products, variants, categories, channel listings. Arabic names throughout,
UTF-8 verified end to end. Seeded from the real 135 products.

The seed is **a starting position, not an audited opening balance** — it agrees
with Mega's own footer to 99.4% on units. It is loaded as data to be checked by
a physical count, not as truth.

**Done when:** all 135 products are searchable in Arabic, and the noon Partner
SKUs from the real settlement files map onto them with the unmapped remainder
listed rather than invented.

---

## Phase 2 — Stock ledger

Locations, moves, on-hand per variant per location. Receipts, transfers to noon,
damage, adjustments, counts. Admin-only, actor recorded on every row.

Opening stock is entered as a **dated opening count** — the cutover the noon
import later splits on.

**Done when:** on-hand for any variant reconciles to the sum of its moves, and
every number on screen can be opened to the movements that produced it.

---

## Phase 3 — Costing and valuation

Goods receipts with purchase cost and landed cost. A valuation layer per move.
Stock value derived, never stored.

**Done when:** stock value equals the sum of the layers, and a receipt with
shipping allocated across it produces unit costs that add back to the amount
actually paid.

---

## Phase 4 — Money ledger

Chart of accounts, journal entries, posting rules. Purchases post cash →
inventory. Capital in and out. Manual entries with an actor.

**Done when:** the trial balance is zero, cash and stock value are both derived
from entries, and every entry can be traced to what caused it.

---

## Phase 6a — noon settlement import ★

Deliberately **before** orders. It is the owner's single largest time sink — 8
to 9 hours a day — and the statement side of it needs the money ledger, not the
order lifecycle. Nothing about it should wait on a decision still under review.

Import a settlement CSV; reconstruct the Statement of Account; post net
proceeds, fees and payouts to the ledger; show what noon owes and when it is
expected.

### The validation milestone

Four real noon exports covering May to August 2026 — **3,173 rows** — are
available, along with the parsed results the previous build produced. The
statements reconstruct cleanly by settlement reference, and the payout cycle is
visible in the data: statements accrue weekly and are paid about a week in
arrears.

**Done when** an import of the real files reproduces noon's own Account Summary
within the known 1.99 EGP tolerance, that discrepancy is *shown* rather than
absorbed, re-importing an overlapping file changes nothing, and the noon
receivable is a receivable and not cash.

This is the milestone that proves the money model. If it does not hold here, it
does not hold anywhere.

---

## Phase 5 — Orders

**Opens with a lifecycle design reviewed with the owner before any of it is
implemented** — his explicit instruction, and the failure that broke the
previous attempt.

Then: manual and social orders, moderator assignment enforced in the query,
stock moves on dispatch, revenue and COGS posted, cancellation and return as
reversing events.

**Done when:** a moderator can only see their own orders — verified by calling
the API directly, not by looking at the screen — and a cancelled order returns
both the stock and the money to where they were.

---

## Phase 6b — noon sales into stock and profit

Settlement rows after the cutover date map to products, deplete noon's location,
and post COGS. Rows before it stay money-only.

**Done when:** the first real profit-per-product figure exists, built entirely
from recorded events.

---

## Phase 7 — Bosta and payment reconciliation

Shipment tracking, status mapping to the fulfilment axis, COD in transit →
cash on payout. Moderators track their own shipments.

**Done when:** an order can sit visibly delivered and unpaid, and a Bosta
transfer clears it.

---

## Phase 8 — Easy Orders

Webhook ingestion on the fixed domain from phase 0, idempotent on order id and
payload. The missing **order status update** webhook gets registered — without
it, payment status on website orders goes stale silently.

**Done when:** the same order delivered twice creates one order, and a failed
mapping leaves a replayable payload rather than a lost sale.

---

## Phase 9 — Analytics

What sells, on which channel, what makes money, what comes back. Every figure a
query over the three ledgers. Profit definitions confirmed with the owner first.

Amazon joins here **when a real report exists**. The noon work is the reason:
the actual file format dictated nearly every decision, and the natural
assumptions — that there would be a quantity column, that `order_update` meant
"return" — were both wrong.

---

## Not in this roadmap

Partner profit sharing, reorder alerts, SaaS and subscriptions, and automated
test suites. All deferred on purpose. The architecture leaves room for the first
two; the last is the owner's call to make later.
