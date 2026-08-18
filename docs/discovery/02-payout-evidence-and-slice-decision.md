# Addendum 02 — noon payout statement, full reconciliation, and the first-slice decision

Evidence: `noon_financeweb_transactionviewreportonitemlevelwithcontractselection.csv`
(924 rows, noon EG, July 2026), reconciled against the invoice register from Addendum 01.

**Retracts Addendum 01 §C2.** Details in §C below.

---

## A. What the payout file is

noon's **item-level transaction / settlement report**. Unlike the invoice register (a legal
document book), this is the **money ledger**: every event that moved the seller's noon balance,
with a per-item fee breakdown and the actual bank transfers out.

Five transaction types, and they are the whole model:

| Type | Rows | Meaning |
|---|---|---|
| `order` | 802 | An item settled. Carries gross revenue + its own fees |
| `order_update` | 113 | Post-settlement adjustment: returns, RTO fulfilment charges |
| `statement_fee` | 4 | Period-level fees (advertising) — the only non-attributable ones |
| `balance_transfer` | 1 | FBN RTV removal fee, deducted from a payout |
| `payment` | 4 | **Actual bank transfers to the seller** |

Grouping key is `Reference Nr`: either a statement (`PS-346654-EG2026MMDD`) or a bank transfer.

**Raw vs derived:** all nine money columns are raw as supplied. `Total` is derived
(= sum of the other nine) — verified on **924/924 rows with zero variance**. That identity is a
free integrity check on every import.

### July figures

| | EGP |
|---|---|
| Gross settled sales (802 order rows) | 256,976.01 |
| Return / adjustment revenue | −5,081.00 |
| Referral fees | −29,837.88 |
| Fulfilment & logistics fees | −21,189.18 |
| Shipping credits | +598.50 |
| Other order fees | +369.92 |
| Order subsidies | −0.01 |
| Statement (advertising) fees, net of subsidy | −128.55 |
| Balance transfer (FBN RTV removal) | −1,094.13 |
| **= Earned in July** | **200,613.68** |
| Paid to bank in July | −132,705.53 |
| **= Increase in noon receivable** | **67,908.15** |

Matches the file's own row total exactly. When first computed, this chain was off by **0.01** —
because `Order Subsidies` had been omitted. The identity caught it. That is precisely the class of
error a spreadsheet makes silently every month.

### Statement → payout

| Statement | Earned | Paid | Lag | Variance |
|---|---|---|---|---|
| PS-…20260708 | 20,090.50 | 20,091.09 on 07-14 | 6d | −0.59 |
| PS-…20260715 | 30,914.63 | 30,915.09 on 07-21 | 6d | −0.46 |
| PS-…20260722 | 60,645.58 | 59,551.91 on 07-29 | 7d | −0.46 after the 1,094.13 RTV deduction |
| PS-…20260729 | 77,701.58 | unpaid at month end | | |
| PS-…20260731 | 12,355.52 | unpaid at month end | | |

**noon pays weekly, statement date + 6–7 days.** Payouts are predictable, so cash can be forecast.
**Receivable at 31 July: 90,057.10 EGP** — about 35% of a month's gross sitting outside the bank.

The 07-08 transfer of 22,147.44 belongs to a June statement not present in this file: **every
monthly export is period-open at both ends.**

## B. Reconciliation findings

### The chain works — but not the chain we assumed

The real chain has five levels and four gaps:

```
1. Our own orders          (what we think we sold)      -- NOT YET IN THE SYSTEM
2. noon transaction report (what settled, per item + fees)
3. Statement total         (earned per period)
4. Bank transfer           (money noon sent)
5. Bank statement          (money that arrived)
```

| Gap | Automatable today? | Basis |
|---|---|---|
| 2 → 3 | **Yes, exactly** | `Total` sums per `Reference Nr` |
| 3 → 4 | **Yes**, ±1 EGP tolerance | statement → bank transfer, 6–7 day lag |
| 4 → 5 | Yes, once bank data is entered | payout amount vs deposit |
| 1 → 2 | **No** — requires the operational core | our order ↔ noon order |

**Three of the four gaps close with file ingestion alone.** That is the finding that decides §D.

### What matched

- Item-level cross-file match on `Item Nr` ↔ `Source Doc Line Nr` (strip `-P1`): **663 of ~745**
  lines matched, **619 agreeing on gross value to the cent**.
- Every statement reconciled to its bank transfer within 0.59 EGP.
- `Total` identity held on all 924 rows.

### What did not match, and why

| Finding | Explanation |
|---|---|
| 44 matched items show gross in the invoice register but **0 in the payout** | All 44 were credit-noted. **A return before settlement never enters revenue at all** — it is simply never paid |
| 83 payout items absent from the invoice register / 82 the reverse | Period boundary: June sales settling in July, July sales settling in August |
| Credit notes 31,866.02 vs `order_update` revenue −5,081.00 | **Not comparable.** Different events, different timing, different basis. Do not build a check that compares them |
| −0.46 to −0.59 EGP per statement | Consistent, tiny, always in the seller's favour. Set tolerance ±1 EGP; alert only if the pattern changes |

### The cost pool that is invisible in the invoice register

| | Rows | EGP |
|---|---|---|
| `order` rows with **zero revenue** but real fees | 119 | −4,385.27 |
| `order_update` rows with zero revenue, fees only | 107 | −2,523.71 |
| **Total pure cost, no revenue** | **226** | **−6,908.98** |

**2.69% of gross settled sales is RTO / failed-delivery cost that does not appear anywhere in the
invoice register.** Any profit figure built on the invoice register alone overstates profit by this
amount and cannot see why.

### Fee attribution — measured, not allocated

| Fee | Attribution | Rate |
|---|---|---|
| Referral | **per item** | 11.75% of gross; 10 distinct category rates, dominated by 13.1% (416 items) and 10.3% (188) |
| Fulfilment & logistics | **per item** | 5.17% of gross; per-unit, not a percentage |
| Shipping credits / other order fees | per item | small |
| Advertising (`statement_fee`) | period only | **−128.55 net = 0.05% of gross** |

Because referral is a per-category percentage, fees for **unsettled** orders can be *predicted*,
which is what makes "expected marketplace result" possible before the statement arrives.

### SKU mapping reality

`Partner SKUs` is populated with a real seller SKU (`CCC-0001`, `AAA-0003`…) for only
**11 of 84 noon listings (13%)**; 547 rows carry noon-generated `PSKU_…` and 70 are empty.
**87% of listings need manual mapping once.** The mapping inbox is mandatory, not optional.

## C. Corrections to previous understanding

**C1 — Addendum 01 §C2 is retracted.** I claimed per-order fee attribution was impossible for noon,
based on the invoice register. Wrong: the transaction report attributes referral and fulfilment fees
**per item**. Only advertising is period-level, and it is 0.05% of gross. noon margin is
~99.9% **measured**, not allocated.

The provenance flag (`MEASURED` / `DERIVED` / `ALLOCATED` / `ESTIMATED`) survives — it is still
needed for advertising, for predicted fees on unsettled orders, and probably for Amazon — but it
stops being a headline concern for noon. *Lesson: a conclusion drawn from one export was wrong
because the export was the wrong document. Grade source authority before drawing conclusions.*

**C2 — Source authority for noon changes.**

| Number | New authority |
|---|---|
| Revenue, fees, returns, payouts, RTO cost | **Transaction / payout report** |
| VAT, legal invoice numbers, tax documents | Invoice register |
| Per-SKU units sold | Either; prefer the payout report |

The invoice register is a **tax artifact**, not a financial one. It was the wrong file to reason
from — though it was the right file to learn the fee taxonomy from.

**C3 — Two distinct return concepts, confirmed by data.**
*Pre-settlement return*: never becomes revenue (44 items). *Post-settlement return*: reverses
revenue via `order_update` (2 items). They need different handling and produce different "return
rates". The invoice-basis rate (9.7%) is not the settlement-basis rate.

**C4 — Money-in-transit is now measured, not assumed.** 90,057 EGP receivable at month end, ~35% of
monthly gross. Discovery §3.2 is confirmed with a number.

**C5 — Fulfilment mode is per listing/order, not per channel.** FBN, directship and (per your
confirmation) Amazon FBA all coexist. `location` ∈ {Own-Warehouse, Amazon-FBA, noon-FBN} and
`fulfilment_mode` on the order/listing. Model it correctly in the inventory slice; do not build
warehouse features beyond that.

## D. First-slice decision

| Approach | Benefits | Risks | Learning value | Business value | Verdict |
|---|---|---|---|---|---|
| **noon-first** | Closes 3 of 4 reconciliation gaps immediately; kills a quantified 8h task; needs **no** unanswered business decision; seeds the catalog with 84 real listings; validated against data already in hand | Produces a report, not a daily habit; touches no authorization; risks a "BI tool" mental model | **High** — teaches the real financial mechanics (settlement lag, RTO pool, pre-settlement returns) *before* we design the financial model | High for the owner, zero for moderators | Strong, but incomplete alone |
| **order-first** (your sequence) | Establishes the spine everything attaches to; daily use by moderators; the operational core is unavoidable | Order lifecycle would be designed from **assumption** — we have not yet documented the real moderator workflow; delivers nothing to the sponsor for weeks | Medium — exercises authz, adapters, audit, catalog | High for moderators, zero for the owner's 8h | Right idea, wrong position for one slice |
| **hybrid** | Both, in dependency order, with the sequencing defect fixed | Slightly more up-front sequencing discipline | Highest | Both audiences inside a month | **Recommended** |

### The real defect in the proposed sequence

It is not "order-first". It is that **Slice 3 (Financial Core) sits before Slice 4 (noon
ingestion)** — and this evidence proves that is backwards.

A financial core designed only against website/social COD orders would model none of the following,
all now measured:

- settlement lag of 6–7 days and a 90,057 EGP receivable
- 2.69% of gross as RTO cost carrying no revenue
- returns that never become revenue at all
- per-item fees at 10 different category rates
- period-open boundaries at both ends of every export

We would build the financial model against the easy case, then rework it against the hard case.
That rework lands on ledger postings — the most expensive place in this system to change.

**Rule: design the financial model against the hardest money flow you have evidence for, then let
the simple flows be special cases of it.** Never the reverse.

Everything else in your sequence is sound, and the instinct that the operational core must come
early is correct.

## E. Recommended sequence

Only slices 1 and 2 are committed. The rest is direction, not a plan.

| # | Slice | Why here | Delivers |
|---|---|---|---|
| **1** | **noon reconciliation (read-only, admin-only)**: import both files → catalog + mapping inbox → statement/payout reconciliation → period view | Only slice with fully validated evidence in hand. No open business decision. Seeds the catalog | 8h → minutes; reconciliation gaps 2→3→4 closed |
| **2** | **Core order flow**: catalog → order → lines → assignment → moderator access → confirmation workflow → status history → audit. Sources: manual/social + EasyOrders | Your slice 1, unchanged, now resolving against a real catalog | Moderators leave WhatsApp/sheets |
| **3** | **Bosta shipping + delivery lifecycle**: create shipment, tracking, delivery/RTO status, COD remittance import | Moved up from your #6. `delivered` is the event that creates revenue and COD receivable — the financial core needs it | Completes the order loop; daily moderator win |
| **4** | **Inventory core**: locations (Own / Amazon-FBA / noon-FBN), stock movements, reservation, history | Needs orders (2) and fulfilment (3) to have anything to move | Real stock truth across three locations |
| **5** | **Financial core**: purchases → cash → inventory value; delivery → revenue → COGS → margin; COD + marketplace receivables; ledger | Now designed with full knowledge of both the easy and the hard money flow | Cash, inventory value, real profit |
| **6** | **Amazon ingestion** + unified reconciliation across channels | Same canonical documents as slice 1; second proof of the abstraction | The other half of the 8h |

Slice 1 upgrades from *revenue* to *margin* for free when slice 5 lands. Nothing is rebuilt.

## F. What we should explicitly NOT build yet

- No ledger, no chart of accounts, no postings before slice 5. Slice 1 is **read-only analytics over
  imported documents** — it must not write financial records.
- No API sync for noon in slice 1. Files only. The document interface makes API a later swap.
- No Amazon anything until slice 6.
- No inventory valuation, COGS or margin before slice 5.
- No multi-tenant features beyond the `organization_id` column.
- No warehouse features beyond three named locations — no bins, no transfers UI, no cycle counting.
- No forecasting, no reorder automation, no ads analytics, no customer/loyalty model.
- No microservices, no data warehouse, no Kubernetes, no event sourcing outside the two ledgers.
- No generated frontend code from prototyping tools entering the codebase (see note below).

## G. Remaining high-value questions

1. **Does the noon transaction report export for arbitrary date ranges, and how far back?** Decides
   whether history is loadable or opening balances are entered manually.
2. **What is the Amazon equivalent of this file today** — which report do you download for the
   8h analysis? Settlement V2, or something from Seller Central's payments view? Decides whether
   slice 6 is a copy of slice 1.
3. **Where do product costs live today?** Still unanswered and still the gating input for profit.
   Nothing in any marketplace file will ever contain it.
4. **Cross-period returns policy:** a July return of a June sale — does it reduce June or July?
5. **Do you want predicted fees on unsettled orders?** Referral rate is derivable per category, so
   "expected payout" is computable before the statement. Useful, but it is an estimate and must be
   labelled as one.
6. **Are those 11 real Partner SKUs (`CCC-0001`, `AAA-0003`…) your internal SKU scheme?** If yes,
   they become the seed of the internal SKU namespace and mapping gets easier over time.

---

### Note on frontend direction

Use Stitch/Bolt for **visual exploration only**. Generated code must not enter the codebase — it
carries its own state, styling and data assumptions, and those leak into the domain. Concretely:
prototype → extract design tokens (colour, type scale, spacing, radius) → hand-build a small
component library against the real API. The frontend consumes the canonical API and nothing else;
if a screen wants a number the API does not expose, that is a domain question, not a UI question.
Defer the visual system until slice 2, when there is a real screen with real data to design against.
