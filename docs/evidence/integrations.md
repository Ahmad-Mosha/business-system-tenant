# Evidence: external systems

Facts about the systems Prime Market connects to, established against real
credentials and live endpoints. Each of these cost real debugging time.

Credentials live in `.env` at the repo root. **Key names only below — never
copy secret values into documentation.**

| Variable | For |
|---|---|
| `DATABASE_URL` | Postgres |
| `API_PORT`, `API_URL` | local service wiring |
| `BOSTA_KEY` | Bosta API — real, working |
| `EASY_ORDER_KEY` | Easy Orders API — real, working |
| `EASYORDERS_WEBHOOK_SECRET` | shared secret for inbound webhooks |
| `EASYORDERS_STORE_ID` | store identity check on inbound webhooks |
| `JWT_SECRET` | session signing |

---

## Bosta — live, working

The courier. Real credentials, verified against real shipments and against the
Bosta dashboard row-by-row (2026-09-01). Base host `https://api.bosta.co`, key
`BOSTA_KEY` sent as a bare `Authorization` header (no `Bearer`).

### Use `POST /api/v2/deliveries/search` for everything

Body `{ "limit": <=100, "page": N }` — real pagination. Its objects carry
`cashoutInfo` (the COD payout signal). The response's `count` is **always 0** —
page until a page returns fewer than `limit`. Single-tracking lookup: same
endpoint, body `{ "trackingNumbers": ["<tn>"] }` → identical object shape, so a
list row and a single-tracking refresh can never disagree.

Endpoints **not** to use, and why (each cost real debugging time):

- `GET /api/v0/deliveries` — silently caps every page at **10**, ignoring
  `limit`. This is why "only 10 of 24 shipments showed" recurred three times.
  (`?perPage=` and `?page=` do work on it, and its `count` is accurate — but v2
  search is the documented path.)
- `GET /api/v1/deliveries/{tn}` — returns `cashoutInfo: null` for **every**
  delivery, even paid ones. Its unique extras (`timeline[]`, `attempts[]` driver
  names, `wallet.cashCycle` fee/VAT/deposit breakdown) are not in the v2 object;
  fetch it only when the money module needs the fee breakdown.
- `GET /api/v1/deliveries` (the old SDK list route, `pageNumber`/`limit`) — dead,
  `Cannot GET`.

### Status mapping — verified against the dashboard

Bosta's API only ever sends the state in **English** (`state.value` /
`state.code`); the Arabic on its dashboard is Bosta's own front-end
translation. `bosta.service.ts` `STATUS_LABEL_AR` redoes that map, keyed on our
normalised status; an unrecognised state falls back to Bosta's raw English text,
never a guessed Arabic label.

| Shown | Driven by (per row) |
|---|---|
| جديد | `state.code == 10` and `pendingPickup` empty |
| في انتظار الاستلام | `state.code == 10` and `pendingPickup` set (a timestamp) |
| تم التوصيل / تم بنجاح | `state.code == 45` |
| مُرتجع / تم الاسترجاع | `type.value` contains "return" (Bosta reuses `state "Delivered"` for RTO — check `type` first) |
| في الطريق / خرج للتوصيل / تم الاستلام | `state.code` 30 / 41 / 21 — **wording not yet checked against a live row** |

### COD collection (`حالة المبلغ المحصل`) — verified against the dashboard

The signal is `cashoutInfo` on the delivery object (list/search only — `v1`
detail always has it null):

| Shown | Driven by |
|---|---|
| مدفوع | `cashoutInfo.oracleTransactionId` present (an executed payout) |
| غير مدفوع | `cashoutInfo` present, no `oracleTransactionId` (payout scheduled, not run) |
| قيد التنفيذ | no `cashoutInfo` on the row (not delivered / nothing computed) |

**Delivered ≠ paid, and `cod == 0` ≠ paid.** A delivered COD shipment and a
returned (cod 0) shipment both routinely show غير مدفوع on the dashboard. Only
an executed payout is paid. `wallet.cashCycle.deposited_at` does **not** track
this — a shipment can have it set and still be unpaid. This is the evidence
behind keeping fulfilment state and payment state as two separate fields.

### FlexShip is Bosta

`flexShippingInfo` appears in Bosta's own responses. "رسوم فليكس شيب" (FlexShip
fees) was once an open question about whether a second courier existed. **It
does not.** FlexShip is a Bosta feature. Bosta is the only courier. When
`flexShippingInfo` is absent the row is labelled "غير مُطبَّق".

### Practical notes

Bosta calls are wrapped with an 8s timeout and a 60s in-process cache
(`bosta.client.ts`); the list call warms the per-AWB cache so opening one costs
nothing. It is an external dependency in the path of screens the team uses
daily.

---

## Easy Orders (own website) — live, with one broken piece

### Product catalogue API

`GET https://api.easy-orders.net/api/v1/external-apps/products`, authenticated
with an `Api-Key` header.

**Products are identified by UUID and slug. There is no SKU field.** Variants
come as `variant_id` with `variation_props` (`color`, `size`). **15 live
products** at last check.

This absence of a SKU is the main evidence that no external identifier scheme
can serve as internal product identity — see
[channel-identifiers.md](channel-identifiers.md).

### The API key has been renamed repeatedly

`easyorder_api_key` → `EASYORDERS_API_KEY` → **`EASY_ORDER_KEY`** (current).

If it changes again, treat the name as a moving target rather than assuming the
old one.

### Webhooks

Easy Orders delivers one webhook per order. Two protections are appropriate and
were verified working: a shared `secret` header (compared in constant time) and
a `store_id` check, so that even a leaked secret cannot inject orders belonging
to a different store.

Two properties matter more than the transport:

- **Redelivery is normal.** The same order will arrive more than once. Ingestion
  must be idempotent — on Easy Orders' own order id, and ideally on the raw
  payload too.
- **Store the raw payload before processing it.** If mapping fails, the order
  must still exist somewhere to be reprocessed, rather than being lost.

### The webhook is live

Easy Orders can only deliver to a **public HTTPS URL**. That is now the deployed
API:

```
https://prime-market.duckdns.org/api/integrations/easyorders/webhook
```

Caddy proxies everything under `/api/*` straight through, path intact, so this
URL never changes as routes are added. The throwaway-tunnel era is over — if you
find yourself starting `cloudflared` again, deploy instead.

Verified reachable: a `POST` with no `secret` header returns `403 invalid
secret` from our controller, i.e. the request reached us and the gate works.

### The secret is generated by Easy Orders, and must be copied to the box

Easy Orders **generates** the `secret` when the webhook is saved — you do not
choose it, and it is shown once. Three values then have to agree:

1. the secret Easy Orders shows at creation
2. `EASYORDERS_WEBHOOK_SECRET` in the `.env` **next to `docker-compose.prod.yml`
   on the EC2 box** — not the repo `.env`, which is dev-only
3. `docker compose -f docker-compose.prod.yml up -d api` to reload it

It has rotated before when the webhook was re-saved. Any time the webhook is
recreated, redo steps 2–3.

### Two webhooks, one URL

Register both against the URL above:

| Easy Orders event | Why | Handler |
|---|---|---|
| order created | new website orders → `customer_order` (`status NEW`, `COD`) | `createOrder` |
| order status update | website order marked paid → `paymentStatus PAID` + cash-in ledger entry | `applyStatusChange` |

Without the second, payment status on website orders goes stale silently. The
handler keys on `event_type` being present in the body (order-created has none).

### Diagnostics

`GET /api/integrations/easyorders/failures` (admin session) lists deliveries
that were stored but not turned into an order — `error` carries the reason. The
raw payload is always kept, so a failed delivery can be replayed after a fix.

A wrong or unset `EASYORDERS_STORE_ID` on the box fails **every** order into
that list (`payload belongs to store … , not ours`); the id is the `store_id`
field on any order-created payload.

---

## noon — reports, no API

Data arrives as **CSV exports downloaded manually from the noon portal**. There
is no API integration.

Two different reports exist, at different grains, and neither substitutes for
the other. The transaction report is what reconciles to the money; the VAT
report is gross customer-facing revenue. Full analysis, including the exact
reconciliation against noon's own portal figures and the fields that do **not**
exist, is in
[noon-settlement-report.md](noon-settlement-report.md) — **read it before
designing anything that consumes noon data.**

The three facts that most often get assumed wrong:

1. **There is no quantity column.** Quantity is implicit: one row per unit.
   Count rows.
2. **There is no cost data.** Profit cannot be derived from noon data alone —
   it requires our own cost, which is why the catalogue has to exist first.
3. **The closing balance is a receivable, not cash.** noon holds one to two
   weeks of proceeds and pays out roughly a week in arrears.

Also worth carrying forward: the CSV is faithful but **not penny-authoritative**
— it disagrees with noon's own portal by 1.99 EGP on the period examined, for
reasons that were investigated and never explained. Any reconciliation needs a
tolerance, and any discrepancy should be surfaced rather than silently
absorbed.

---

## Amazon — nothing yet

Selling is live. **No reports have been supplied and no evidence has been
gathered.**

Do not design an Amazon integration speculatively. The noon work is the
cautionary example: the actual file format dictated almost every decision, and
several natural-seeming assumptions (that there would be a quantity column, that
`order_update` meant "return") turned out to be wrong. Ask for a real export
first.
