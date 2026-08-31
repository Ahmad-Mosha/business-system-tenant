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

The courier. Real credentials, verified against real shipments.

### The endpoint trap

**Listing deliveries is `/api/v0/deliveries`**, or `POST /api/v0/deliveries/search`
(also available on `v2`).

**`/api/v1/` has no list route at all** — only per-AWB lookup. Posting to it
expecting a list returns a misleading `400 "Delivery not found"`, which reads
like a data problem and is actually a wrong-endpoint problem. This cost
significant debugging time; do not rediscover it.

There is also no "list everything, unfiltered" convenience — only search or list
scoped to the account.

### FlexShip is Bosta

`flexShippingInfo` appears in Bosta's own responses. "رسوم فليكس شيب" (FlexShip
fees) seen on a courier dashboard was previously an open question about whether
a second courier existed. **It does not.** FlexShip is a Bosta feature. Bosta is
the only courier.

### Delivered ≠ paid — proven

A real Bosta shipment came back with status `DELIVERED` and COD state
**غير مدفوع** (unpaid).

This is the direct evidence behind the rule that fulfilment state and payment
state are two separate things. A single combined status field cannot express
"delivered but not yet paid", which is the default case for a COD-heavy
business.

### Practical notes

Bosta calls should be defensively wrapped — timeouts and a short cache are
warranted, and concurrency should be capped when looking up many shipments at
once. It is an external dependency in the path of screens the team uses daily.

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

### ⚠️ The webhook is currently not reachable

Easy Orders can only deliver to a **public HTTPS URL**. The development machine
has no fixed domain, so a throwaway tunnel was used:

```bash
cloudflared tunnel --url http://localhost:3001
```

(No account needed. ngrok was tried first and is blocked — that account needs
email verification.)

Tunnel URLs die when the tunnel stops, which means **the URL currently saved in
the Easy Orders dashboard is dead**, and the integration will not receive
anything until it is re-pointed. This is the reason the owner set Easy Orders
aside.

**The real fix is deploying the API somewhere with a fixed domain.** Every
session spent re-establishing a tunnel is wasted effort against a problem that
has a permanent solution. This has been suggested and not yet actioned — it is
worth raising early rather than repeating the workaround.

If a tunnel is used again in the meantime: verify it end-to-end with a test POST
*before* changing the dashboard, and ask the owner to paste the current
dashboard values back rather than assuming the stored secret still matches — it
has rotated at least once when the webhook was re-saved from their side.

### Missing webhook type

Only the **order created** webhook is registered. A second webhook — **order
status update** — is needed to learn when a website order is marked paid.
Without it, payment status on website orders will silently go stale. Known gap,
never built.

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
