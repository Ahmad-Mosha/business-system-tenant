# Architecture

The system design, and the reasoning behind every decision that was not already
settled in [business-rules.md](business-rules.md).

Nothing here invents a business rule. Where a business decision is still the
owner's to make, this document says which architecture makes that decision
**cheap to make later** instead of blocking on it.

---

## The core idea

**Record what happened. Derive every number from it.**

Three append-only ledgers hold everything of consequence:

| Ledger | Records | Answers |
|---|---|---|
| **Stock moves** | every unit that moved, from where, to where | how many, where, and why |
| **Valuation layers** | the cost consequence of each move | what stock is worth, what a sale cost |
| **Journal entries** | every money event, double-entry, balanced | cash, receivables, profit |

Nothing is a stored total. On-hand, stock value, cash, and profit are all
queries. A correction is a new row, never an edit. This is the direct answer to
the owner's actual problem — not "show me a number" but "show me why that
number".

---

## 1. Product identity

```
product ──< product_variant ──< channel_listing
```

- `product` — internal id, Arabic name, category. No price. Cost lives on the
  valuation layers, not here.
- `product_variant` — the unit that holds stock. A product with no size/colour
  still gets exactly one variant, so every stock and order row points at a
  variant and there is no second code path.
- `channel_listing` — `(channel, external_product_id, external_variant_id) →
  variant`. noon's Partner SKU, Easy Orders' UUID, Amazon's ASIN and anything
  after them are opaque strings in this table.

**Why:** [channel-identifiers.md](evidence/channel-identifiers.md) proves no
external scheme can be the identity — Easy Orders has no SKU field at all, and
product names already collide in the real noon data. Many listings → one
variant is the whole point: three channels selling one item must decrement one
stock pool.

**Design** is treated as a variant dimension alongside size and colour (open
decision #15). It costs nothing — a variant is a bag of named attributes — and
being wrong is a data edit, not a migration.

---

## 2. Stock: moves between locations

Every movement is **from one location to another**. Quantity is conserved; it
never appears or vanishes.

Real locations: `WAREHOUSE`, `NOON_FC`.
Virtual counterparties: `SUPPLIER`, `CUSTOMER`, `DAMAGE`, `ADJUSTMENT`.

| Event | Move |
|---|---|
| Goods received | `SUPPLIER → WAREHOUSE` |
| Sent to noon | `WAREHOUSE → NOON_FC` |
| Sold and dispatched | `WAREHOUSE → CUSTOMER` |
| noon sale | `NOON_FC → CUSTOMER` |
| Return | `CUSTOMER → WAREHOUSE` |
| Breakage / loss | `WAREHOUSE → DAMAGE` |
| Count correction | `ADJUSTMENT ↔ WAREHOUSE` |

On-hand at a location is `SUM(in) − SUM(out)`.

**Why not a signed quantity column:** a signed number can say a unit left, but
not where it went. With locations on both sides, "how many, and where" — a
confirmed requirement — is the same query as "how many", the noon warehouse
needs no special case, and damage and adjustments are ordinary moves rather
than exceptions with their own rules. This is how Odoo and every mature WMS
models it, for the same reason.

**Decision taken:** locations exist from day one (open decision #3). Adding
them later means rewriting every stock query, and noon stock is already
confirmed to be physically elsewhere.

---

## 3. Valuation: one layer per move

Every move that changes value writes a **valuation layer**: quantity, unit
cost, total value, and the move that caused it.

This is the decision that matters most, because of what it does to
**open decision #1, the costing method**:

> With layers recorded, the costing method is a **read** over the layers, not a
> shape of the schema. Average cost today; FIFO later is a recompute over data
> already stored, not a rebuild.

**Proposed default: moving weighted average (AVCO)** per variant.
- Purchase cost genuinely varies between shipments, which is exactly what AVCO
  smooths.
- There are no expiry dates and no confirmed need to know which shipment a unit
  came from, which is the main reason to pay for FIFO's per-lot bookkeeping.
- It keeps margin percentages stable, which is what the owner will actually read
  every day.

**Landed cost** (open decision #2) is entered against a receipt and allocated
**by value** by default, per unit as an option. Value tracks duties and
insurance correctly, and the goods here are small-parcel consumer items where
weight-based allocation would need weights nobody records. The allocation
method is stored on the receipt, so a change of policy applies to future
receipts without touching history.

Both proposals need the owner's yes. Neither blocks the build.

---

## 4. Money: a double-entry journal

Every financial event posts a **journal entry** of two or more lines that sum
to zero. Entries are immutable; a mistake is corrected by a reversing entry.

A deliberately small chart of accounts:

| Assets | Liabilities / Equity | Income | Expenses |
|---|---|---|---|
| Cash | Owner capital | Sales revenue | Cost of goods sold |
| Inventory | | | Channel fees |
| noon receivable | | | Shipping cost |
| Bosta COD in transit | | | Advertising |

What this buys, immediately:

- **"noon's closing balance is a receivable, not cash"** stops being a rule
  someone has to remember. They are two different accounts. Cash is the cash
  account's balance; nothing else can leak into it.
- **Delivered ≠ paid** is structural. A delivery posts to `Bosta COD in
  transit`; the payout moves it to `Cash`. There is no way to express
  "delivered" as "money in hand".
- **Open decision #6, the profit definitions, stops blocking the build.** Gross
  and net profit become a choice of which accounts to subtract — a reporting
  configuration, decided once the owner can see real numbers, and changed
  without a migration.
- Manual entries (open decision #7) are just entries with a human actor
  recorded. The permitted set is a validation list, not a schema question.

**Why double-entry rather than a cash table with a running total:** the legacy
build had a cash ledger and still could not answer where a number came from,
because value that left cash and became inventory was tracked in a different
system with no link between them. Double-entry makes that link an invariant the
database enforces: every entry balances, or it does not post.

---

## 5. Orders: three independent axes

An order carries three states, not one:

| Axis | Values | Driven by |
|---|---|---|
| **Lifecycle** | draft → confirmed → dispatched → completed / cancelled / returned | us |
| **Fulfilment** | unfulfilled / in transit / delivered / failed / returned | Bosta |
| **Payment** | unpaid / partly paid / paid / refunded | settlement and cash events |

**Why:** a single combined status cannot express "delivered but not paid",
which is the *normal* case for a COD business and is proven in real Bosta data
(status `DELIVERED`, COD state غير مدفوع). Shopify separates financial from
fulfilment status for the same reason. One field here would force a lie into
every COD order.

The lifecycle state list itself is **open decision #4** and the owner asked
explicitly to review it before it is implemented. It gets designed and
presented as a diagram at the start of the orders phase — not guessed at now.

---

## 6. Inbound feeds: raw first, then map

Every channel feed — noon CSV, Easy Orders webhook, Amazon later — goes through
the same three steps:

1. **Store the raw payload**, always, before anything is interpreted.
2. **Fingerprint it** (SHA-256 of the raw row or body). A repeat is skipped, not
   re-applied. Reports overlap; webhooks redeliver. Both are proven.
3. **Map to internal products.** Anything unrecognised lands in an **unmapped
   queue** for a human. A product is never invented to make a row fit.

This is not speculative: the four real noon files carry 8–78 unmapped rows
each, and about 8% of settlement rows legitimately reference no product at all.

**The historical-import problem** (open decision #5) has a clean answer:

> Stock starts at a dated opening count. Settlement rows **before** that date
> post money only. Rows **after** it post money *and* stock.

Sales that happened weeks ago are already reflected in the count that opens the
ledger. Replaying them against stock would double-count; ignoring their money
would lose the receivable history the owner needs. Splitting on the count date
keeps both correct, and the cutover date is a single stored value.

---

## 7. Multi-tenancy

Every business table carries `tenant_id`. PostgreSQL row-level security
enforces it with `tenant_id = current_setting('app.tenant_id')`, set per
transaction. One tenant row is seeded. There is no tenant switcher, no signup,
no billing, no tenant-facing anything.

**Cost now:** one column and one policy per table.
**Cost of retrofitting later:** every table, every query, every endpoint.

The application filters by tenant too. RLS is the second line — the one that
holds when someone forgets the first.

---

## 8. Stack

| Layer | Choice | Why |
|---|---|---|
| API | **NestJS 12** + TypeScript | Module boundaries match the domains; `@nestjs/swagger` gives first-class OpenAPI from the same decorators that validate — a hard requirement, not an afterthought |
| Database | **PostgreSQL 17** | RLS for tenancy, exact `numeric` money, window functions for ledger balances |
| Data access | **Drizzle** | The system is ledger-shaped: running balances, lateral joins, aggregate-heavy reads. SQL-first suits that. Real reviewable migration files — a money schema can never be auto-synced. RLS-friendly session variables, no engine binary |
| Web | **Next.js 16** + React 19 + Tailwind 4 + shadcn/ui | Server components keep the dense list screens fast; shadcn is owned code, not a dependency to fight on design |
| Tables | **TanStack Table** | Tables are the product. Sorting, column visibility, pinning and virtualisation are solved problems |
| Validation | **Zod** | One schema drives runtime validation and the OpenAPI body — they cannot drift |

Rejected: **Prisma 8** is a release candidate; **TypeORM 1.1** is a brand-new
major. Neither is where a financial schema should be this month.

**Deployment is part of the architecture, not an afterthought.** The API needs a
fixed HTTPS domain from the first phase. Easy Orders can only deliver webhooks
to a public URL, the throwaway tunnel currently registered in their dashboard is
dead, and every session spent re-establishing one is effort spent against a
problem that has a permanent solution.

---

## 9. What this design does not decide

Left to the owner, in the phase that needs them:

| Open | When it is needed | Blocking? |
|---|---|---|
| #4 Order lifecycle | designed and reviewed before the orders phase | **Yes** — by his own instruction |
| #1 Costing method | confirm AVCO before the first profit report | No — layers keep FIFO reachable |
| #2 Landed cost rule | confirm by-value before the first import shipment | No |
| #6 Profit definitions | before the analytics phase | No — a reporting choice over accounts |
| #9 Returns policy | before returns are built | No |
| #10 Duplicate noon SKUs | during catalogue seeding | No — surfaces in the unmapped queue |
| #19 Amazon | when a real report exists | No |

Everything else on that list is either answered above or genuinely later.
