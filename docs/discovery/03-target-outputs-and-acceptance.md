# Addendum 03 — Target outputs: noon Statement of Account, verified line by line

Evidence: two screenshots of noon's **Statement of Account** (`n-payments.noon.partners`,
contract PRJ346654 "Sazine", July 2026), reconciled against the invoice register and the item-level
transaction report.

---

## The headline finding

**These screens are noon's own UI. The business is not spending 8 hours producing them — noon
produces them for free.**

Every one of the 15 numbers is reproducible from noon data alone. None requires our orders, our
inventory, COGS, Bosta, or Amazon. So if reproducing this screen were the goal of Slice 1, Slice 1
would be worth nothing: we would be rebuilding a vendor screen.

That reframes what these screenshots are for:

> **The screenshots are our acceptance test, not our feature specification.**

They are the perfect test oracle — a vendor-published set of correct answers we can verify our
pipeline against to the cent. What the *product* must add is everything this screen cannot show:
profit, per-product economics, the RTO cost pool, cash actually received, and Amazon in the same
view. That is where the 8 hours actually goes.

## Verification results

**11 of 15 numbers reproduce exactly. 3 differ by 1.99 EGP total, now fully explained. 1 requires
period chaining.**

### The 1.99 EGP, traced to the cent

noon publishes the same period through **three surfaces that do not agree**:

| Surface | Referral fee | Shipping | Order subsidies |
|---|---|---|---|
| Item-level transaction report | −29,837.88 | +598.50 | −0.01 |
| Statement tax invoice (invoice register) | −29,835.88 | +598.48 | not shown |
| Statement of Account UI | −29,835.88 | +598.48 | omitted |

Cause: **noon rounds referral fee at statement level when issuing the tax invoice**; the item-level
detail sums to slightly more. Per statement: −0.60, −0.47, −0.45, −0.42, −0.06 = **−2.00**, plus
0.02 shipping and 0.01 subsidies = **1.99**.

This also **closes the variance flagged in Addendum 02**. The 0.46–0.59 EGP statement→payout
differences were not noise:

| Statement | Item-level earned | Rounding adj | Adjusted | Paid | Unexplained |
|---|---|---|---|---|---|
| PS-…0708 | 20,090.50 | +0.60 | 20,091.10 | 20,091.09 | **0.01** |
| PS-…0715 | 30,914.63 | +0.47 | 30,915.10 | 30,915.09 | **0.01** |
| PS-…0722 | 60,645.58 | +0.45 | 60,646.03 | 60,646.04 | **−0.01** |

**noon pays on the statement-rounded figure, not the item-level sum.** Unexplained variance is now
±0.01 — pure cent rounding. The chain is deterministic.

### Authority rule this establishes

| Purpose | Authority |
|---|---|
| **What we get paid** | Statement-level figures (tax invoice / Statement of Account) |
| **Per-item attribution and margin** | Item-level transaction report |
| **Fulfilment split (FBN vs Directship)** | Invoice register only — the transaction report **combines them** into one column |

All three are needed. Tolerance: **±1.00 EGP per statement**, alert above.

## Four things the screenshots reveal

1. **noon's "Payouts" ≠ cash received.** The 133,799.66 includes a 1,094.13 *balance transfer*
   (FBN RTV removal fee settled against another contract). Only **132,705.53 reached the bank**.
   Never map noon's Payouts line to cash.
2. **"Damaged Returns Fee" is a credit, not a charge** (+387.02, shown in the positive group).
   Label says fee, sign says credit. **This corrects Addendum 01**, which counted it as a cost.
   A parser keying on the word "Fee" gets this wrong.
3. **Closing Balance = our receivable from noon** (90,057.58 at 31 July, ~36% of a month's settled
   sales). It requires **period chaining**: closing(n) = opening(n) + movements, opening(n) =
   closing(n−1). A single export cannot produce it; the first opening balance is entered once by
   hand.
4. **The effective take rate depends entirely on the denominator.** 19.92% on the settlement basis
   (50,185.21 / 251,895.01) versus 17.00% on the invoice basis. **This corrects Addendum 01's
   17.6%**, which used the wrong base and the wrong sign on damaged returns. The settlement basis is
   authoritative — it is what happened to money.

## Metric specification (acceptance criteria for Slice 1)

Verified 2026-08-18 against July 2026 data.

| # | Metric | Expected | Computed | Match | Source | Kind | Calculation |
|---|---|---:|---:|:---:|---|---|---|
| 1 | Opening Balance | 22,147.44 | 22,147.44 | ✅ | prior period | derived | closing(n−1); seeded manually once |
| 2 | Net Proceeds | 251,895.01 | 251,895.01 | ✅ | txn report | derived | Σ `Net Proceeds`, all rows |
| 3 | Fees | −50,185.21 | −50,187.20 | ⚠️ 1.99 | both | derived | Σ 7 fee components; statement basis is authoritative |
| 4 | Payouts | −133,799.66 | −133,799.66 | ✅ | txn report | raw | Σ `Total` of `payment` + `balance_transfer` |
| 5 | Closing Balance | 90,057.58 | 90,055.59 | ⚠️ 1.99 | derived | reconciled | 1 + 2 + 3 + 4 |
| 6 | Shipping Fee | 598.48 | 598.50 | ⚠️ 0.02 | txn report | raw | Σ `Shipping Credits` |
| 7 | Advertising Fee (Subsidy) | 1,130.40 | 1,130.40 | ✅ | txn report | raw | Σ `Non-Order Subsidies` |
| 8 | Damaged Returns Fee | 387.02 | 387.02 | ✅ | txn report | raw | Σ positive `Other Order Fees` — **a credit** |
| 9 | Advertising Fee | −1,258.95 | −1,258.95 | ✅ | txn report | raw | Σ `Non-Order Fees` |
| 10 | Referral Fee | −29,835.88 | −29,837.88 | ⚠️ 2.00 | both | raw/derived | statement-rounded vs Σ item-level |
| 11 | Directship Outbound Fee | −4,074.93 | −4,074.93 | ✅ | **invoice register only** | raw | txn report cannot split this |
| 12 | FBN Outbound Fee | −17,114.25 | −17,114.25 | ✅ | **invoice register only** | raw | txn report cannot split this |
| 13 | Return Administration Fee | −17.10 | −17.10 | ✅ | txn report | raw | Σ negative `Other Order Fees` |
| 14 | Bank Transfer | −132,705.53 | −132,705.53 | ✅ | txn report | raw | Σ `Total` of `payment` |
| 15 | Balance Transfer | −1,094.13 | −1,094.13 | ✅ | txn report | raw | Σ `Total` of `balance_transfer` |

Cross-check: 11+12 = −21,189.18 = Σ `Fullfilment & Logistics Fees` exactly.

**Additional data needed:** metric 1 needs a manually-seeded opening balance for the first imported
period. Metrics 11–12 need the invoice register alongside the transaction report. Nothing else.

**All 15 are automatable and deterministic.** All 15 belong to **Slice 1**.

## Dependency map

| Metric group | COGS | Inventory | Orders | Bosta | Amazon | noon | Payout/Bank |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| All 15 screenshot metrics | — | — | — | — | — | ✅ | ✅ |
| Per-product revenue, units, return rate | — | — | — | — | — | ✅ | — |
| **RTO / dead-cost pool** (−6,908.98) | — | — | — | — | — | ✅ | — |
| Receivable + payout forecast | — | — | — | — | — | ✅ | ✅ |
| Bank arrival confirmation | — | — | — | — | — | ✅ | ✅ |
| **Gross profit / margin per product** | ✅ | — | — | — | — | ✅ | — |
| Inventory value | ✅ | ✅ | — | — | — | — | — |
| Cash position | ✅ | — | ✅ | ✅ | — | ✅ | ✅ |
| Channel P&L comparison | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Delivery performance, RTO by moderator | — | — | ✅ | ✅ | — | — | — |

The gap is stark: **everything on the screenshots needs only noon. Everything the business actually
asked for in discovery needs COGS.** COGS remains the single gating input, and no marketplace file
will ever contain it.

## What this changes

**Nothing architectural.** The findings confirm the existing design — source authority per field,
tolerances, the mapping inbox, provenance. Three refinements:

1. **Slice 1 needs a running noon account balance** (opening → movements → closing) with a
   manually-seeded first opening balance. This is a *balance projection over imported documents*,
   not a ledger. §F of Addendum 02 stands: no postings, no chart of accounts before Slice 5.
2. **Slice 1 imports both noon files**, not one. Neither alone reproduces the target.
3. **Slice 1's deliverable is what noon does not show** — per-product economics, the RTO cost pool,
   receivable ageing and payout forecast, bank arrival confirmation. Reproducing the Statement of
   Account is the *test*, not the feature.

## Acceptance test for Slice 1

Import July 2026. The system must produce all 15 values above, with metric 3/5/10 matching on the
statement basis, and must report the item-vs-statement difference as a **classified, explained
variance** — not silently absorb it. Total unexplained variance must be ≤ 0.01 EGP per statement.
