# Prime Market — the business

## What it is

An Egyptian multi-channel reseller. Products are bought — locally or imported —
held in the company's own warehouse, and sold across several channels at
different prices. Payment is heavily cash-on-delivery. Delivery is via Bosta.

Prime Market (the system) is the **internal operations platform** for that
business: one reconciled source of truth for inventory, orders, cash, and
eventually profit.

It is an internal tool for a real, operating business — not a product being
sold to anyone. The architecture should be **multi-tenant-ready** so it could
serve other businesses later, but subscriptions and SaaS features are
explicitly **not** in scope now. The only priority is Prime Market working
properly.

## Sales channels

| Channel | Status | How orders arrive |
|---|---|---|
| **noon** | Live, main revenue source today | Settlement report exports (CSV), downloaded from the noon portal |
| **Amazon** | Live — actively selling | Reports exist but **have not been supplied yet**. No evidence gathered. Expect to design for it, not to guess at it. |
| **Easy Orders** (own website) | Live | Webhook per order, plus a product catalogue API |
| **Social media** | Live | Manually entered by a moderator. Today these live in Google Sheets. |

Channel notes that matter:

- The **same product sells on multiple channels**, at **different prices per
  channel**. Price is a property of the sale, not of the product.
- Each channel gives the same product **its own identifier**. See
  [evidence/channel-identifiers.md](evidence/channel-identifiers.md).
- **noon holds its own stock.** Goods stored at noon are physically not in the
  company warehouse. These are two different locations, and the system needs to
  answer "how many, and *where*".
- Marketplace orders are never entered by hand one at a time. They arrive by
  report import or API and must flow through to stock and money automatically.

## The people

| Who | Count | What they do in the system |
|---|---|---|
| Owners / partners | 3 | Full visibility: money, profit, stock, everything |
| Moderator | 1 today | Handles customers, creates manual orders, tracks their own shipments |
| Marketing | 1 | Not currently a system role |
| Accountant | external | Tax only, with the owner. Outside day-to-day system scope. |

Two roles exist in the system today: **Admin** and **Moderator**.

- **Admin** sees and does everything, including cancelling orders and adjusting
  stock.
- **Moderator** sees only the orders assigned to them, can create a manual
  (social) order — which is then assigned to them — and can follow the shipping
  status of their own orders. They cannot cancel orders and do not see money or
  profit.

Profit-sharing between the three partners (each with a different percentage) is
a **known future requirement**. It is not built and not designed. Do not build
it now, but do not make it structurally impossible either — the numbers it will
depend on are revenue and profit per period.

## What actually hurts

Ranked by the owner's own words:

1. **Manual reconciliation of noon settlements — 8 to 9 hours a day.** The
   owner personally downloads noon reports, reads them, and works out what was
   sold, what was charged in fees, and what is owed. This is the single largest
   time sink in the business and the reason the system exists.
2. **Entering and checking channel sales data by hand.**
3. **Recording social media orders manually in Google Sheets.**
4. **No trustworthy answer to basic questions** — how much cash do we have, what
   is the stock worth, what is actually profitable.

## What the owner wants to see, every day

- Cash
- Stock value
- Sales
- Gross profit, net profit, margin
- What is selling, on which channel, what is profitable, what is being returned

These must be **derived from recorded events**, never hard-coded or
hand-maintained. The definitions of gross/net profit for this business are
**not yet settled** — see [open-decisions.md](open-decisions.md).

## The one thing the system must do

Automation that connects **orders → inventory → money → shipping → channel
reports**, so that any event anywhere updates every number it affects, without
someone re-typing it.

The stated success test: if the business grows three times, the manual work
must not grow three times with it.

## Legacy

The previous business system is called **Mega** — old, and being replaced. Its
only surviving useful output is the product list, which has already been
extracted: see [evidence/mega-inventory.md](evidence/mega-inventory.md) and
[data/mega-products.json](data/mega-products.json).

There is no data to migrate from any earlier version of *this* system. The
catalogue in `data/mega-products.json` is the real starting inventory.
