# Addendum 01 — noon invoice export: evidence, corrections, revised first slice

Supersedes parts of `00-architecture-discovery.md`. Evidence: `LE4EIV4PYEG_csv_1785747841.csv`,
842 rows, noon, 2026-07-01 → 2026-07-31.

---

## 1. What the file is

**noon's invoice/tax document register** for one seller for one month — the legal document book, not a report.
It contains three document classes mixed into one flat file:

| Class | Rows | Meaning |
|---|---|---|
| `Invoice` / `Purchase Summary` / `Customer` | 745 | One row **per unit sold**. Seller → customer sales invoice |
| `Creditnote` / `Purchase Return Summary` | 68 | Returns. Carries the **original Invoice Nr** → linkable to the sale |
| `Invoice` / `Tax Invoice` / `Statement Fee`\|`Service Fee` | 29 | **noon → seller fee invoices**, at statement level, with 14% VAT |

It is **not** a settlement/payout report, **not** an order report, **not** an inventory report.
It answers "what did I sell and what was I charged", never "what was I paid".

## 2. What the numbers say (July 2026, computed in ~2 seconds)

| Figure | Value | Note |
|---|---|---|
| Gross sales | 327,161.07 | 745 units across 624 orders, 90 SKUs |
| Returns | 31,866.02 | **9.7% of gross**; 13 of 68 relate to prior-period sales |
| Net sales | 295,295.05 | |
| noon fees (inc. VAT) | 52,053.38 | **17.6% of net sales** |
| Seller keeps, before COGS | 243,241.67 | |
| AOV / units per order | 524.30 EGP / 1.19 | ~20 orders/day on noon |
| Revenue concentration | **34.9% from one SKU** | Vibration platform, 24 units |

### Fee taxonomy (this is noon's real fee model — build the mapping table from it)

| Fee | inc. VAT | % net sales | Behaviour |
|---|---|---|---|
| Referral Fee | 29,835.88 | 10.10% | % of item price → **derivable per line** |
| FBN Outbound Fee | 17,114.25 | 5.80% | per unit fulfilled by noon |
| Directship Outbound Fee | 4,074.93 | 1.38% | per unit shipped by seller |
| Advertising Fee | 1,258.95 | 0.43% | not attributable to orders |
| Advertising Fee (Subsidy) | −1,130.40 | −0.38% | credit; **netted 90% of ads this month** |
| FBN RTV Removal Fee | 1,094.13 | 0.37% | stock pulled back out of noon's FC |
| Shipping Fee Rebate | −598.48 | −0.20% | credit |
| Damaged Returns Fee | 387.02 | 0.13% | |
| Return Administration Fee | 17.10 | 0.01% | |

Statement cadence is visible in the fee descriptions (`PS-346654-EG20260708/15/22/29/31`):
**noon issues weekly statements plus a month-end one.** That is the natural reconciliation period.

## 3. Corrections to `00-architecture-discovery.md`

### C1 — A6 was wrong: **the business does use Fulfilled by noon**

`FBN Outbound Fee` (17,114 EGP, 5.8% of net sales) and `FBN RTV Removal Fee` (with Partner SKU
`FBNRTVREMOVALFEE`) can only exist if noon is picking and shipping the seller's stock from noon's
warehouse. `Directship Outbound Fee` in the same period means **both fulfilment modes run
simultaneously on the same channel**.

Consequences:
- `location` is required in **slice 2**, not "someday": Own-Warehouse **and** noon-FC.
- Fulfilment mode is a property of the **order/listing**, not of the channel.
- Stock reconciliation against noon's inventory report becomes a real requirement.
- "All inventory is currently held by us" needs re-confirmation with the owner (§7 Q1).

### C2 — Per-order fee attribution is impossible for noon. Margin needs **provenance**.

0 of 29 fee rows reference a customer order. Fees arrive as statement-level aggregates.
Therefore contribution margin per product is **part measured, part allocated** — permanently, not
temporarily.

**New rule:** every margin figure carries a provenance flag per component —
`MEASURED` (from a document), `DERIVED` (referral fee = rate × price), `ALLOCATED` (FBN outbound
spread by units), `ESTIMATED` (advertising). The UI shows the split. A margin number whose
allocated share is large is a weaker number and must look like one.

This does not weaken §10.6; it makes it honest. It also means the **allocation policy is a
first-class, versioned, auditable object**, not a constant in a query.

### C3 — Source authority table, refined for noon

| Number | Authority | This file? |
|---|---|---|
| Gross sales per SKU/order | **This invoice register** | ✅ |
| Returns per SKU/order | **This invoice register** (credit notes carry original Invoice Nr) | ✅ |
| Fee totals per statement period | **This invoice register** | ✅ |
| Fee per order/unit | Statement / order-level report | ❌ must allocate or obtain |
| Money actually received | **Payout statement** (`PS-346654-EG…`) | ❌ **not in this file** |
| Quantity | inferred from repeated rows | ⚠️ no quantity column |
| Order status / fulfilment mode | noon order report or API | ❌ |
| COGS | our own procurement records | ❌ never from noon |

### C4 — VAT is not fully out of scope (A12 softened)

Sales are issued `nontax_local` at 0% VAT, while noon's fee invoices to the seller carry **14% VAT
(6,345 EGP in one month)**. If the seller cannot reclaim that input VAT it is a hard cost sitting in
the fee line; if they can, it is a receivable. The ledger must store fee amounts **net, VAT, and
gross separately** from day one — cheap now, and it decides whether the fee ratio is 15.4% or 17.6%.
The seller TRN also appears in three formats including Arabic-Indic digits — normalise on ingest.

### C5 — The canonical ingestion unit is a **business document**, not a row

The requirement "the domain must not care whether data came from API, webhook, CSV or XLSX" is
satisfied by mapping every source onto a small closed set of typed documents:

```
SalesDocument · CreditNote · FeeDocument · PayoutStatement · OrderEvent · StockSnapshot
```

An adapter's only job is `source → one or more of these`. A generic "row importer" would push the
mess into the domain. This file alone produces three of the six document types, which is exactly why
a per-file schema would have been the wrong abstraction.

## 4. Parsing traps found in the real data (regression tests, not hypotheticals)

| # | Trap | Impact if missed |
|---|---|---|
| 1 | Credit notes carry **positive** amounts; sign lives in `Document Type` | Naive SUM overstates sales by 63,732 EGP (**19.5%**) |
| 2 | One fee row filed under `Document Subtype = Purchase Summary` | Filtering by subtype counts 387 EGP of fees as revenue |
| 3 | Fee rows carry **fake SKUs** (9 distinct) that look like product SKUs | Joining SKU→catalog invents 9 phantom products |
| 4 | **No quantity column**; qty = repeated rows (59 cases) | Unit counts understated ~19% |
| 5 | Two `Contract` values; the RTV fee sits under a different one | Filtering on the main contract silently drops 1,094 EGP |
| 6 | Same product description → 2 different noon SKUs (4 cases) | Confirms listing→variant mapping is needed *within* a channel |
| 7 | 13 of 68 returns belong to prior-period sales | Period profit needs an explicit cross-period returns policy |

Each becomes a fixture-based test. This file is the fixture.

## 5. Revised first vertical slice

**Changed from `00-…md` §18.** Previous slice 1 was order intake + moderator workflow. The evidence
moves it.

> **Slice 1 — "noon month in 30 seconds": import the invoice register → resolve SKUs → period
> performance view.**

Scope: upload the CSV → raw store + hash → profile detect/version → row staging + validation →
classify into SalesDocument / CreditNote / FeeDocument → resolve noon SKU to internal variant via
mapping inbox → period view (gross sales, returns, return rate, fee breakdown, fee ratio, per-SKU
revenue and return rate) with drill-down to source rows.

Out of scope: money ledger, COGS, margin, orders, moderators, authorization beyond admin-only,
Amazon, Bosta, API sync.

**Why this now beats order intake:**
- It removes a **quantified, recurring 8-hour** manual task, mostly on the first day.
- It needs **no unanswered business decision** — no recognition rule, no costing method, no cash model.
- It front-loads the two hardest-to-reverse decisions (catalog identity, ingestion/document model)
  and defers the ones still under discussion.
- It **seeds the catalog**: mapping 90 noon SKUs creates the variants that slice 2's order intake
  will resolve against. Better sequencing than the original order.
- It is honestly throwaway-able. Nothing in it commits the financial model.

Slice 2 becomes order intake + moderator workflow (now with a real catalog), slice 3 procurement +
COGS + ledger — at which point slice 1's view upgrades from *revenue* to *margin* with no rework.

**Done means:** re-importing the same file changes nothing; the seven traps above are covered by
tests; unmapped SKUs are workable and visibly excluded; every figure drills to source rows; the
July numbers in §2 are reproduced exactly by the system.

## 6. Ingestion strategy per data type (post-evidence)

| Data | Mechanism now | Target | Authority | History | Constraint |
|---|---|---|---|---|---|
| noon sales/returns/fees | **CSV import** | noon bulk export API | invoice register | portal-limited | monthly file; weekly statements |
| noon payouts | CSV/portal (**not yet seen**) | export API | payout statement | portal-limited | required for cash truth |
| noon stock at FC | not yet | Stock API | noon inventory report | snapshot only | needed because of C1 |
| Amazon orders | — | SP-API + notifications | Orders API | ~2 years | notification + repair sweep |
| Amazon money | — | Settlement V2 report | settlement report | Amazon's schedule | cannot force a period |
| EasyOrders orders | — | **webhooks + API** | EasyOrders | API-limited | webhook + nightly sweep |
| Bosta shipments | — | **API + webhooks** | Bosta | API-limited | COD remittance likely file |
| COGS / purchases | manual today | manual entry | **us** | n/a | the one input nobody else has |

Build CSV import first (it is the only mechanism with evidence in hand); add API sync behind the
same document interface later without touching the domain.
