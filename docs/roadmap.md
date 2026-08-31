# Roadmap

Phases in dependency order. Each one is finished — usable and verified against
real data — before the next starts.

The ordering rule comes from what broke the previous build: **anything that
mutates stock or money is built after the thing it mutates.** Orders reference
stock. Stock references products. Money references cost.

Note the word *mutates*. Reading a report and showing what it says mutates
nothing, and is not subject to that rule. That distinction is what lets the
noon work start early instead of waiting behind the foundation.

```
0  Foundation ─────────────────────────────────────────────┐
                                                            │
1  Inventory foundation          2  noon import  ★ read-only, parallel
   1a catalogue + channel map ──────► maps into it
   1b stock ledger + locations
   1c costing + valuation
        │
3  Money ledger
        │
        ├──► 4  noon settlements post to the ledger   ★★ the 8-hour win
        │
5  Orders  (lifecycle reviewed first)
        │
        ├──► 6  noon sales move stock and post cost
        ├──► 7  Bosta + payment reconciliation
        └──► 8  Easy Orders ──► 9  Analytics ──► Amazon
```

---

## Phase 0 — Foundation

Monorepo, NestJS + Drizzle + PostgreSQL on a **fresh database name** (the
existing volume holds the previous build's schema and must not be collided
with). Migrations from the first table. `tenant_id` + RLS. Auth with Admin and
Moderator roles. Swagger UI with working *Try it out*.

Ends with the API running in Docker on a **fixed HTTPS domain**. This is phase
0 and not phase 8 on purpose: it is what makes the Easy Orders webhook
permanently solvable instead of repeatedly re-tunnelled.

**Done when:** a fresh clone runs `docker compose up` and `npm run dev`, and
someone with no backend knowledge can log in through Swagger and call an
endpoint on the deployed instance.

---

## Phase 1 — Inventory foundation

**This is the phase that matters.** It is one piece of work in three steps,
because you cannot count stock of a product that does not exist, and you cannot
value stock without knowing what it cost.

### 1a — Catalogue and product identity

Products, variants, categories, **channel listings**. Arabic names throughout,
UTF-8 verified end to end. Seeded from the real 135 products.

The channel listing table is the part that makes everything downstream work: it
is what an incoming noon row or Easy Orders webhook resolves *to*. Without it,
an arriving sale has nothing to decrement.

The seed is **a starting position, not an audited opening balance** — it agrees
with Mega's own footer to 99.4% on units. It is loaded as data to be checked by
a physical count, not as truth.

### 1b — Stock ledger

Locations, moves, on-hand per variant per location. Receipts, transfers to noon,
damage, adjustments, counts. Admin-only, actor recorded on every row.

Opening stock is entered as a **dated opening count** — the cutover the noon
import later splits on.

### 1c — Costing and valuation

Goods receipts with purchase cost and landed cost. A valuation layer per move.
Stock value derived, never stored.

**Done when:** on-hand for any variant reconciles to the sum of its moves, every
number on screen opens to the movements that produced it, and a receipt with
shipping allocated across it produces unit costs that add back to the amount
actually paid.

---

## Phase 2 — noon report import ★ read-only

Starts as soon as phase 0 is done and runs alongside phase 1. It **writes
nothing to stock or money** — it parses, stores and reports. That is why it can
come this early without repeating the previous build's mistake.

Upload a settlement CSV. Rows are stored raw and fingerprinted, so re-uploading
an overlapping export changes nothing. The Statement of Account is
reconstructed from them: net proceeds, the seven fee columns, payouts, closing
balance. Unmapped rows are listed for a human.

**This is where the manual labour dies.** Reading the report and working out
what it says is the 8-to-9-hour job. Doing that automatically does not require
the money ledger, the order lifecycle, or anything still under review.

Once 1a lands, the same rows resolve to products and the report gains a
per-product view.

### Validation milestone

Four real noon exports covering May to August 2026 — **3,173 rows** — are
available, along with the parsed results the previous build produced. The
statements reconstruct cleanly by settlement reference, and the weekly payout
cycle is visible in them.

**Done when** an import of the real files reproduces noon's own Account Summary
within the known 1.99 EGP tolerance, that discrepancy is *shown* rather than
absorbed, and re-importing an overlapping file changes nothing.

---

## Phase 3 — Money ledger

Chart of accounts, journal entries, posting rules. Purchases post cash →
inventory. Capital in and out. Manual entries with an actor.

**Done when:** the trial balance is zero, cash and stock value are both derived
from entries, and every entry can be traced to what caused it.

---

## Phase 4 — noon settlements post to the ledger ★★

The imported statements from phase 2 now post: net proceeds, channel fees,
advertising, payouts. What noon owes appears as a receivable with an expected
payout date; a bank transfer clears it into cash.

**Done when:** the noon balance is visibly a receivable and not cash, and the
weekly accrue-then-pay cycle in the real data reproduces exactly.

At this point the settlement problem is solved end to end and the daily numbers
are real. Everything after this is breadth.

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

## Phase 6 — noon sales into stock and profit

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

## Where the interface work sits

Screens are built with the phase they belong to, not in a separate frontend
phase. The design system — tokens, table, form, filter bar, master-detail
panel — is settled once, before the first screen, and every later screen is
assembled from it. See [ui-ux.md](ui-ux.md).

---

## Not in this roadmap

Partner profit sharing, reorder alerts, SaaS and subscriptions, and automated
test suites. All deferred on purpose. The architecture leaves room for the first
two; the last is the owner's call to make later.
