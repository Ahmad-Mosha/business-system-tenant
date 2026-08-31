# Evidence: the Mega inventory export

The starting product catalogue, and what is known about how reliable it is.

**Data:** [../data/mega-products.json](../data/mega-products.json) — 135 products.
**Source:** `files/المخزن.xlsx`, `files/المخزن11.xlsx`, `files/المخزن1111.xlsx` at
the repo root.

## The source files are screenshots, not spreadsheets

Mega's "export to Excel" produces a spreadsheet shell containing a **screen
capture image**, not cell data. Each `.xlsx` holds an `xl/media/image1.png` of
400–540 KB, while its `sheetData` contains only one to three cells.

Any normal spreadsheet parser reads these files as effectively empty. That is
not a corruption — it is what Mega produces. The images themselves are legible.

**Consequence:** the JSON was produced by reading the images directly. There is
no machine-readable original to re-parse, and none can be obtained from Mega
short of a different export path.

## What was extracted

Per product: `row`, `name` (Arabic, verbatim), `category`, `quantity`,
`unitCost`. Nothing else from Mega's layout was carried over — the rest was
legacy-system noise with no meaning in the new model.

| | |
|---|---|
| Products | 135 |
| Cosmetics | 58 |
| Home (منزلي) | 77 |
| Electronics / TV Shop | 0 — the categories exist in the business, but no products in this export |
| Total units | 2,344 |
| Total value at cost | 1,109,873.86 EGP |
| Products with no cost | 1 |

## Accuracy — read this before trusting the numbers

The extraction was cross-checked against **Mega's own printed grand total** at
the foot of the report:

| | Transcribed | Mega's own total | Difference |
|---|---|---|---|
| Units | 2,344 | 2,329 | +15 (0.64%) |
| Value | 1,109,873.86 | 1,107,812.89 | +2,060.97 (0.19%) |

Roughly **99.4% agreement on units and 99.8% on value**, against the source's
own footer.

This is good enough to confirm no row was wholly missed or grossly misread, and
**not** good enough to call any individual row certified. The difference could
be a handful of misread digits, or it could be that Mega's own footer is stale
— that was never resolved.

The owner reviewed the extracted list before it was used.

**Recommendation:** treat this as a strong starting position, not as an audited
opening balance. The right way to make it authoritative is a physical stock
count that produces real opening figures — at which point these numbers become
the thing being checked, not the source of truth.

## Data quirks worth knowing

- **One product has no cost.** It will not contribute to stock value. Do not
  silently substitute zero as though it were known to be free.
- **One cost carried four decimal places** (`145.6471`, on فازلين 250 مل).
  Money stored at two decimals must round these deliberately, not let a
  database column truncate them silently.
- **Names are Arabic and stay Arabic.** They are the business's own names and
  are how staff refer to products. Any interface, search, or export has to
  handle Arabic text properly — including correct UTF-8 encoding on anything
  generated or served.
- **No internal Mega id was captured.** Mega's own id column was too small to
  read reliably in the screenshots, so it was deliberately left out rather than
  guessed. There is therefore no key linking these rows back to Mega — matching
  is by name only, which is exactly why this is a one-time seed and not a
  repeatable sync.
- **Nothing here carries a selling price**, which is correct: price comes from
  the order and varies by channel.
