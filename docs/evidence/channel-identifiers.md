# Evidence: how each channel identifies a product

Derived from real noon settlement exports and live calls to the Easy Orders
product API. **Facts and their direct consequences only.**

This is the single constraint that most shapes the catalogue design, so it is
worth reading before modelling products.

## What each channel actually uses

| Channel | Identifier | Format seen | Variants |
|---|---|---|---|
| **noon** | `Partner SKU` (ours, given to noon) | `PSKU_346654_<digits>_X` — and an older `CCC-0014` convention still present | Implied by the `-1` suffix on noon's own SKU |
| **noon** | noon's own SKU | `Z<20 hex>Z-1` (850/850 rows carry the `-1` suffix; one outlier `N53408309A`) | Variant-level |
| **Easy Orders** | product **UUID** + `slug` | UUID. **No SKU field exists in the live product API at all.** | `variant_id`, with `variation_props` carrying `color` and `size` |
| **Social / manual** | none | — | none |
| **Amazon** | unknown — presumably ASIN/SKU | **No report supplied. No evidence.** | unknown |

## The consequence

**No external identifier scheme can be used as the internal identity.**

- Easy Orders has **no SKU at all**, so SKU cannot be universal.
- noon's Partner SKU is ours-given but exists only for noon.
- Social and manual orders carry no product identifier whatsoever.
- Amazon's scheme is still unknown, and will be a fourth variation.

Therefore the internal product needs **its own identity**, and every channel
identifier is an opaque external string mapped onto it. A channel renaming a
SKU, delisting an item, or a new channel appearing then touches only the
mapping — never product identity, stock, or order history.

## Product names cannot be used for matching

**Three noon products currently share a name.** Names are marketing copy, are
edited freely by whoever manages the listing, and already collide in the real
data. Matching an incoming sale to a product by name will silently attach it to
the wrong one.

## Mapping is currently 1:1, but do not hard-code that

In the noon data examined: **zero cases** of one noon SKU mapping to multiple
Partner SKUs. The mapping is clean today.

That is a fact about today's data, not a guarantee. The relationship that must
be supported is many channel listings → one internal product, because that is
the entire point: selling the same item on three channels must decrement **one**
stock pool.

## Unmapped listings are normal — never guess

`Partner SKU` is populated on **854 of 924** rows in the settlement export. The
remainder are payouts, advertising fees and shipping-only lines that carry no
product at all — around 8% of rows legitimately have nothing to map.

An import must be able to say "this line refers to something I don't recognise"
and surface it, rather than inventing a product to attach it to. A fabricated
product is worse than a visible gap: it looks connected without being connected,
and it corrupts every number computed from it afterwards.

Related: the VAT report carries `Partner SKU` on only **1 of 842 rows** — it is
effectively unusable for mapping. See
[noon-settlement-report.md](noon-settlement-report.md).

## Known unresolved item

Three noon products appear duplicated under different Partner SKUs, one using
the older `CCC-0014` convention. Whether these are true duplicates or genuine
variants is a **business question**, still unanswered. Listed as open decision
#10.
