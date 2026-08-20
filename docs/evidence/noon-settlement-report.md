# Evidence: noon settlement & VAT reports (July 2026)

Facts derived from the two CSVs provided 2026-08-20. **Facts only** — no design decisions here.
Files: `noon_financeweb_transactionviewreportonitemlevelwithcontractselection.csv` (924 rows),
`LE4EIV4PYEG_csv_1785747841.csv` (842 rows). Both are **noon**. No Amazon report has been supplied yet.

## 1. The transaction report reconstructs the Statement of Account

The portal's Account Summary is fully derivable from the CSV:

| Portal line | Derivation from CSV | Value |
|---|---|---|
| Net Proceeds | `sum(Net Proceeds)` | 251,895.01 ✅ exact |
| Fees | sum of the 7 fee/subsidy columns | −50,187.20 (portal −50,185.21, **Δ 1.99**) |
| Payouts | `sum(Others)` = Bank Transfer + Balance Transfer | −133,799.66 ✅ exact |
| Closing | Opening + Net Proceeds − Fees − Payouts | 90,055.59 (portal 90,057.58, **Δ 1.99**) |

Portal fee labels map onto CSV columns exactly:

| Portal label | CSV column | Value |
|---|---|---|
| Directship Outbound + FBN Outbound Fee | `Fullfilment & Logistics Fees` | −4,074.93 + −17,114.25 = −21,189.18 ✅ |
| Damaged Returns Fee + Return Administration Fee | `Other Order Fees` | 387.02 + −17.10 = 369.92 ✅ |
| Advertising Fee | `Non-Order Fees` | −1,258.95 ✅ |
| Advertising Fee (Subsidy) | `Non-Order Subsidies` | 1,130.40 ✅ |
| Bank Transfer + Balance Transfer | `Others` | −132,705.53 + −1,094.13 ✅ |

**Δ 1.99 is unexplained** (referral Δ −2.00, shipping credits Δ +0.02). No single row accounts for it;
per-period subtotals drift ~0.5 too. Working hypothesis: portal aggregates unrounded values, CSV rounds
per row. → The CSV is faithful but **not penny-authoritative**. Reconciliation needs a tolerance, and
the discrepancy must be surfaced, never silently absorbed.

## 2. Cash cycle is fully visible

Payouts tie to statements one week in arrears. The 2026-07-08 bank transfer is −22,147.44 —
**exactly the opening balance**. Closing balance = the two most recent unpaid statements
(77,701.58 + 12,355.52). So noon holds ~1–2 weeks of proceeds at any time.

| Settlement period | Accrued | Paid out |
|---|---|---|
| (prior, = opening balance) | 22,147.44 | 2026-07-08 |
| PS-EG20260708 | 20,090.50 | 2026-07-14 (−20,091.09) |
| PS-EG20260715 | 30,914.63 | 2026-07-21 (−30,915.09) |
| PS-EG20260722 | 60,645.58 | 2026-07-29 (−59,551.91 + 1,094.13 balance transfer) |
| PS-EG20260729 | 77,701.58 | unpaid |
| PS-EG20260731 | 12,355.52 | unpaid |

## 3. Transaction types and their financial signature

| Type | n | Carries | Meaning |
|---|---|---|---|
| `order` | 802 | net proceeds, referral, fulfilment, shipping credits | the sale |
| `order_update` | 113 | mostly fee-only; 2 rows with negative net proceeds (−6,048) | returns & post-hoc fee adjustments |
| `payment` | 4 | `Others` only | bank payout to us |
| `statement_fee` | 4 | non-order fees/subsidies | advertising |
| `balance_transfer` | 1 | `Others` | inter-account move |

`order_update` is **not** a clean "return" event: 107 of 113 rows have zero net proceeds and only
adjust fees; 4 rows are *positive* net proceeds (+967, all the same "Blob" hair product — looks like a
reversal of an earlier deduction). Only 2 rows are true value-reversing returns. 62 item numbers appear
as both `order` and `order_update`.

## 4. ⚠ There is no quantity column

Quantity is **implicit**: one row per unit. `Item Nr` is `<OrderNr>-<lineIndex>`; the same SKU appearing
twice in one order (56 such cases) means qty 2. Any importer must derive quantity by counting rows,
not by reading a field. 89 orders have >1 item line.

## 5. SKU mapping is clean — 1:1 today

- noon SKU format: `Z<20 hex>Z-1` (850/850 carry the `-1` suffix; one outlier `N53408309A`).
- `Partner SKUs` (our identifier) is populated on 854/924 rows: `PSKU_346654_<digits>_X`.
- **Zero cases** of one noon SKU mapping to multiple partner SKUs. The mapping is currently 1:1.
- The VAT report carries `Partner SKU` on only **1 of 842 rows** — it is effectively unusable for mapping.

## 6. The two reports are different grains and do not fully overlap

| | Transaction report | VAT/invoice report |
|---|---|---|
| Grain | settlement line | tax document line |
| Money | net proceeds + fees | gross price, VAT |
| Sum | 251,895.01 net | 404,735.46 excl-VAT / 411,080.47 incl |
| Order nrs | 683 | 641 (**578 overlap**) |

The VAT report is **gross customer-facing revenue**; the transaction report is **what noon owes us**.
Neither is a substitute for the other. 68 credit notes ("Purchase Return Summary") in the VAT report are
a *better* return signal than `order_update`. VAT is 0% on 814/842 lines (goods, `nontax_local`) and 14%
on the 28 `Statement Fee` lines — i.e. we pay VAT on noon's fees, not on our sales.

## 7. What these reports cannot tell us

- **Cost of goods** — absent. Profit is uncomputable from marketplace data alone.
- **Quantity** — implicit only (see §4).
- **Customer identity / address** — absent.
- **Inventory on hand** — absent; FBN vs Directship fee lines only hint at fulfilment mode.
- **Order status / shipment progress** — absent. This is a *finance* feed, not an operations feed.

## Open questions this evidence raises

1. What explains the 1.99 gap? Needs a second month's report to see whether it scales.
2. Are the 4 positive `order_update` rows reversals? If so, what triggered them?
3. Is `Partner SKU` set for *every* live listing, or only the 854/924 rows seen here?
4. Screenshot 1 shows a courier dashboard billing **"رسوم فليكس شيب" (FlexShip fees, 80 EGP)** — the brief
   says the courier is Bosta. Are both in use, or has the courier changed?
