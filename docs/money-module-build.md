# Money module — build spec

Technical companion to the owner-facing design note. Decisions already taken:
weighted-average costing, landed cost allocated by value, **double-entry-lite**
(~14 fixed accounts, one entry table, everything derived), cash anchor in the
live DB is test data.

Design references pulled for this: Mercury and the Stripe dashboard — visual
calm, right-aligned tabular figures, inline sparklines, a verdict row before
the detail, every figure drilling down to the rows beneath it. That matches the
house style already in `apps/web` (monochrome, dense, 34px rows, master-detail),
so nothing new is imported on the design side.

---

## 1. Database

### `ledger_account` — seeded reference, never user-editable

| code | name_ar | name_en | kind |
|---|---|---|---|
| `CASH` | الخزينة | Cash | ASSET |
| `CHEQUES_PENDING` | شيكات برسم التحصيل | Cheques pending | ASSET |
| `INVENTORY` | المخزون | Inventory | ASSET |
| `NOON_RECEIVABLE` | رصيد نون | noon balance | ASSET |
| `AMAZON_RECEIVABLE` | رصيد أمازون | Amazon balance | ASSET |
| `BOSTA_COD` | تحصيلات بوسطة | Bosta holding | ASSET |
| `SUPPLIER_PAYABLE` | مستحقات الموردين | Supplier payable | LIABILITY |
| `OWNER_CAPITAL` | رأس المال | Owner capital | EQUITY |
| `OPENING_EQUITY` | رصيد افتتاحي | Opening balance | EQUITY |
| `SALES` | المبيعات | Sales revenue | INCOME |
| `COGS` | تكلفة البضاعة المباعة | Cost of goods sold | EXPENSE |
| `CHANNEL_FEES` | عمولات ورسوم القنوات | Channel fees | EXPENSE |
| `SHIPPING` | مصاريف الشحن | Shipping | EXPENSE |
| `OTHER_EXPENSE` | مصروفات أخرى | Other expenses | EXPENSE |

```
ledger_account
  code       text PK
  name_ar    text
  name_en    text
  kind       text          -- ASSET | LIABILITY | EQUITY | INCOME | EXPENSE
  sort       smallint
```

Seeded on boot (same pattern as `auth.seedDevUsers`). A `kind` decides how a
balance reads: assets = Σdebit − Σcredit; everything else = Σcredit − Σdebit.

### `ledger_entry` — the spine

One row = one balanced movement. `amount` is always positive; the two account
codes carry the direction. No multi-line journals — every real event here is
expressible as exactly one from → one to.

```
ledger_entry
  id           uuid PK
  occurred_at  timestamptz          -- when it happened in the business
  amount       numeric(14,2)        -- > 0 always
  debit_code   text FK ledger_account   -- receives value
  credit_code  text FK ledger_account   -- gives value
  kind         text                -- CASH_DEPOSIT | CHEQUE_DEPOSIT | CHEQUE_CLEAR
                                   --  | CHEQUE_BOUNCE | PAYMENT_IN | PAYMENT_OUT
                                   --  | CAPITAL_WITHDRAWAL | PURCHASE | SUPPLIER_PAYMENT
                                   --  | NOON_ACCRUAL | NOON_FEE | NOON_PAYOUT
                                   --  | ORDER_SALE | COGS | BOSTA_PAYOUT
                                   --  | RETURN | STOCK_LOSS | ADJUSTMENT
  memo         text null
  supplier_id  uuid null FK supplier   -- set when SUPPLIER_PAYABLE is involved
  source_type  text null           -- purchase_invoice | noon_transaction | order
                                   --  | cheque | stock_movement | manual
  source_id    text null
  reverses_id  uuid null FK ledger_entry   -- a correction points at what it undoes
  actor_id     uuid null           -- null for automatic (import) entries
  created_at   timestamptz
```

`balanceOf(code, asOf?)` and `entriesFor({code?, kind?, from?, to?, supplierId?})`
cover every read. Nothing is stored as a total.

**Opening balances become entries.** The current `cash_account` /
`cash_transaction` tables are dropped — an opening cash figure is just
`debit CASH / credit OPENING_EQUITY` dated at the cutover. One fewer special
case. (13 test rows in `cash_transaction`, 1 in `cash_account` — no migration,
just re-enter after the switch.)

### `supplier`

```
supplier
  id          uuid PK
  name        text            -- Arabic
  phone       text null
  note        text null
  active      bool default true
  created_at  timestamptz
```

Balance owed = `balanceOf(SUPPLIER_PAYABLE)` filtered by `supplier_id` on the
entries.

### `purchase_invoice` + `purchase_invoice_line`

```
purchase_invoice
  id             uuid PK
  supplier_id    uuid FK supplier
  invoice_no     text null       -- supplier's own reference
  invoice_date   date
  status         text            -- DRAFT | POSTED
  payment        text            -- CASH | CREDIT
  goods_total    numeric(14,2)
  extra_costs    numeric(14,2) default 0   -- shipping, customs, clearance
  allocation     text default 'BY_VALUE'   -- BY_VALUE | PER_UNIT
  landed_total   numeric(14,2)             -- goods_total + extra_costs
  posted_at      timestamptz null
  created_by_id  uuid
  created_at     timestamptz

purchase_invoice_line
  id                uuid PK
  invoice_id        uuid FK purchase_invoice (cascade)
  variant_id        uuid FK product_variant
  quantity          int
  unit_cost         numeric(14,2)          -- goods only, before allocation
  landed_unit_cost  numeric(14,2) null     -- filled on post
  line_total        numeric(14,2)
```

**On POST (one transaction):**
1. Allocate `extra_costs` across lines by value (default) or per unit → each
   line's `landed_unit_cost`.
2. Per line: insert a `stock_movement` (`PURCHASE`, `+quantity`,
   `unit_cost = landed_unit_cost`, source = this invoice).
3. Per line: recompute the variant's moving-average cost —
   `new = (on_hand · old_avg + qty_in · landed_unit_cost) / (on_hand + qty_in)`.
4. One `ledger_entry`: `debit INVENTORY / credit CASH` (payment CASH) or
   `credit SUPPLIER_PAYABLE` (payment CREDIT), `amount = landed_total`,
   `supplier_id` set.

A posted invoice is immutable; a mistake is a new reversing invoice.

### Changes to existing tables

- **`stock_movement`**: add `avg_cost_after numeric(14,2) null`. Populate
  `unit_cost` on *every* movement — landed cost on receipts, average cost at the
  time on sales (that value **is** COGS). Period COGS = `Σ(−quantity · unit_cost)`
  over `SALE` rows.
- **`product_variant.unit_cost`**: keep the column name, its meaning becomes
  *moving-average cost*. Manual edits still allowed (Admin), recorded as an
  `ADJUSTMENT` movement so the change is traceable.

> `ponytail:` AVCO assumes movements are costed in `occurred_at` order. A
> backdated receipt inserted before existing sales would need a recost pass —
> not built; noon sales don't move stock yet, and manual receipts are entered
> live.

### `cheque` — for إيداع سندي

```
cheque
  id             uuid PK
  amount         numeric(14,2)
  from_party     text            -- who it's from (free text)
  received_date  date
  due_date       date null
  status         text            -- PENDING | CLEARED | BOUNCED
  cleared_date   date null
  memo           text null
  created_by_id  uuid
  created_at     timestamptz
```

Create → `debit CHEQUES_PENDING / credit OWNER_CAPITAL`.
Clear → `debit CASH / credit CHEQUES_PENDING`.
Bounce → reversing entry against the create.
(Direction is IN only for now — issued cheques aren't a confirmed need.)

### Vouchers are not a table

سند قبض / سند صرف / إيداع نقدي are each just a `ledger_entry` the user creates
by hand: pick amount, date, the other account (an expense account, or
`OWNER_CAPITAL`), a memo. The entry **is** the voucher.

---

## 2. Screens

Nav gets a **Money** section: `Overview · Treasury · Purchases · Suppliers · Ledger`.
All admin-only, same guard as today.

### Overview — `/money`

Full-width, four bands top to bottom:

1. **Verdict row** — 5 read-only metric cards: Cash on hand (large, 30-day
   sparkline, Δ vs last month), noon balance, Bosta holding, Cheques pending,
   Stock value. Each card links to its filtered Ledger view.
2. **Cash flow** — an area chart of daily cash balance, 90 days, with a
   30d / 90d / 12m toggle. Hand-rolled SVG, no chart dependency.
3. **This month** — a single horizontal stacked bar: revenue split into COGS ·
   channel fees · shipping · **gross profit**, with the margin % called out.
4. **Recent activity** — last 15 ledger entries, running effect, "See all →".

### Treasury — `/money/treasury`

- Header: current cash, this-month in / out.
- Actions (open a right-hand side sheet, two-column form, sticky summary):
  **Cash in** · **Cash out** · **Cash deposit** · **Cheque deposit**.
- Filter bar (reason, date range) above a paginated table (20/page): date,
  description, reason chip, in, out, running balance — tabular figures.
- Row click → detail panel: full entry, what moved, source link, actor.

### Purchases — `/money/purchases`

- Metric cards: this-month purchases, total unpaid to suppliers.
- List: invoice no, supplier, date, status chip, landed total, payment.
- **New invoice** is its own screen (`/money/purchases/new`) — supplier, date,
  payment; a lines table with variant search to add rows; extra-costs + allocation;
  a live summary showing each line's landed unit cost; **Post**.
- Detail: a posted invoice shows the stock movements and the ledger entry it
  produced.

### Suppliers — `/money/suppliers`

- List: name, phone, balance owed, last invoice.
- Detail panel: invoice history + payment history, **Record payment** action
  (`debit SUPPLIER_PAYABLE / credit CASH`).

### Ledger — `/money/ledger`

- Every entry, filter by account / kind / date. This is where every "trace →"
  link lands.
- **Export CSV** for the accountant.

The current `/finance` route and its components are deleted.

---

## 3. Build order

Small commits, pushed each step.

**A — ledger core**
1. `ledger_account` entity + boot seed
2. `ledger_entry` entity + `LedgerService` (post / reverse / balanceOf / entriesFor)
3. Rewrite `FinanceService` onto the ledger; `overview()` derives from it; keep endpoints green
4. Opening balance → `OPENING_EQUITY` entry; remove `cash_account` / `cash_transaction` from code

**B — treasury**
5. Voucher endpoints (cash in / out / deposit)
6. `cheque` entity + create / clear / bounce
7. Treasury screen: metrics, filter bar, table, side-sheet forms, detail panel

**C — purchases + suppliers**
8. `supplier` entity + endpoints + screen
9. `purchase_invoice` + lines + POST logic (stock movement + AVCO + ledger entry)
10. `avg_cost_after` on `stock_movement`; variant average recompute on receipt
11. Purchases list + new-invoice screen + detail; supplier payment action

**D — overview + ledger**
12. Money overview: verdict cards, cash-flow area chart, month breakdown bar, recent activity
13. Ledger screen + CSV export
14. Wire every "trace →" deep link

**E — cleanup**
15. Delete `/finance` route + components; dark-mode and density pass across the new screens

---

## 4. Status — BUILT (2026-09-01)

All of A–E shipped, plus three rounds of testing fixes, in **PRs #26–#33**
(merged to `main`). Current-state summary, DB state, and what's still open:
[../handoff.md](../handoff.md).

Notable decisions that landed differently from the spec above:

- Supplier "owed" is derived from invoices — `SUM(landedTotal − settledAmount)`
  over posted CREDIT invoices — **not** the `SUPPLIER_PAYABLE` ledger balance.
  During testing the two drifted; invoices are now the single source, and a
  payment is capped by invoice remaining so `settledAmount` and the ledger move
  together. `paidStatusOf()` short-circuits `payment === 'CASH'` → PAID.
- Invoice paid axis: `settledAmount` column + derived `DRAFT / UNPAID / PARTIAL
  / PAID` (`paidStatusOf` in `purchase-invoice.entity.ts`). FIFO payment
  allocation across invoices is the pure `allocateOldestFirst()` in `costing.ts`.
- pg `date` columns are parsed as plain `YYYY-MM-DD` strings
  (`main.ts` + `pg.d.ts`) to stop a timezone day-shift.

All money-module test data was **wiped 2026-09-01** for a fresh test (see
handoff). The 14 `ledger_account` rows stay — re-seeded on boot regardless.
