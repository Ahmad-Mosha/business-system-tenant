# Product identity, orders and roles

Decisions taken 2026-08-20, before implementing orders and inventory.
Marked **[Confirmed]** (stated by the business or proven by data), **[Assumption]**,
**[Recommendation]**, or **[Open]**.

---

## 1. Internal product identity

**Evidence.** The two live channels identify products incompatibly:

| Channel | Identifier | Variants |
|---|---|---|
| noon | `Partner SKU` — `PSKU_346654_…`, and an older `CCC-0014` convention | implied by the `-1` suffix on noon SKUs |
| Easy Orders | product **UUID** + `slug`. **No SKU field exists** in the live product API | `variant_id` with `variation_props` (`color`, `size`) |
| Social | none | none |

**Decision.** Internal identity is our own UUID. External identifiers are never primary
keys; they live in a mapping table as opaque strings.

Rejected: using SKU as identity — Easy Orders has no SKU, so it cannot be universal.
Rejected: matching on product name — names are marketing copy, are edited freely, and
already collide (three noon products share a name today).

**Consequence.** A marketplace SKU change, a rename, a delisting, or a new channel
touches only the listing row. Product identity, inventory and order history are untouched.

## 2. Product vs Variant  **[Recommendation, implemented]**

`Product` (what it is) → `ProductVariant` (the thing on the shelf). Every product has at
least one variant; simple products have exactly one, created automatically.

Variants are the unit that **inventory** counts and that **listings** point at, because:

- Easy Orders already sends `variant_id` per cart item — the concept exists in live data.
- noon SKUs are variant-level (`…Z-1`).
- A Large and a Small are physically different items on the shelf. Stock cannot be a
  product-level number without being wrong the first time a variant exists.

Rejected: separate `SellableItem` / `InventoryItem` entities. With one warehouse they
would be a 1:1 wrapper around Variant and pure ceremony. If a second warehouse appears,
stock moves to `(variant, location)` without disturbing identity.

**Bundles are not blocked.** A bundle later becomes a variant with a `variant_component`
table (`parent_variant`, `child_variant`, `qty`). Nothing here prevents that. Not built.

## 3. Channel listing  **[Confirmed by data]**

`ChannelListing` maps `(channel, externalId) → variant`. `externalId` is opaque: a noon
Partner SKU, an Easy Orders UUID, later an Amazon ASIN/SKU.

- One variant may have many listings (one per channel). Selling on three channels
  decrements **one** stock pool — this is the whole point.
- A listing carries the channel's own title and price for reconciliation, never as truth.
- Unmapped listings are allowed and visible; an import must never silently guess.

**[Open]** Three noon products are duplicates under different Partner SKUs. Merging them
is a business decision (same item, or genuine variants?) and needs a merge action.

## 4. Order lifecycle  **[Recommendation, implemented]**

**Two independent state fields, not one, and not four.**

`status` — the operational lifecycle the team drives:

```
NEW → ASSIGNED → CONFIRMED → SHIPPED → DELIVERED
   ↘ CANCELLED (from any pre-shipped state)   DELIVERED → RETURNED
```

`paymentStatus` — `UNPAID | PAID | REFUNDED`.

**Why payment is separate — this is evidenced, not assumed.** The courier screenshot
shows an order simultaneously *delivered* (`تم بنجاح`) and *unpaid* (`غير مدفوع`): with
COD the courier collects cash days before remitting it. A single status field cannot
express that, and collapsing them would make cash reconciliation impossible.

**Why shipment is *not* a third state field.** A shipment is an entity with its own
identity (tracking number, courier, event history), not a state of the order. When Bosta
credentials arrive it becomes its own table. Until then `SHIPPED` is enough and nothing
fake is stored.

**[Assumption]** `CONFIRMED` means the moderator reached the customer and verified the
address. Needs stakeholder confirmation.
**[Open]** Does a cancellation after shipping happen in practice (refused delivery)?
Currently modelled as `RETURNED`, not `CANCELLED`.

## 5. Inventory  **[Deliberately unfinished]**

Stock is recorded as movements (`stock_movement`), never as a mutable number. Quantity on
hand is `SUM(movements)`. This is the one inventory decision taken now, because a mutable
counter cannot answer "why is this 94?" and retrofitting history is impossible.

**Not decided, per instruction:** costing method (FIFO / weighted average), how COGS is
computed, how damaged stock hits profit, how shipping and import costs are allocated,
how returns are valued. `unitCost` on a variant is a single current figure and is
explicitly a placeholder. No order currently deducts stock.

## 6. Roles  **[Confirmed]**

`ADMIN` — full access. `MODERATOR` — only orders assigned to them, plus creating social
orders and moving their own orders' status.

Enforced in the API, not the UI: every order query for a moderator is filtered by
`assignedToId` at the database level, so a guessed URL or a direct API call returns
nothing rather than someone else's order.

## 7. Easy Orders integration  **[Confirmed by docs + live API]**

Webhooks are the documented real-time mechanism: `Order Created` and `Order Status
Change`, authenticated by a `secret` header, registered in the seller dashboard.
No polling endpoint for orders exists (`/external-apps/orders` returns 404).

Receiver is built and idempotent on the Easy Orders order `id`. Raw payloads are stored
before parsing so a malformed or unmappable order is never lost.

**[Open]** The webhook must still be registered in the seller dashboard against a public
URL. Until then the endpoint is reachable but will receive nothing.
**[Open]** Status values beyond `pending` and `paid` are undocumented; mapping is
conservative and unknown values are preserved verbatim rather than guessed.

## 8. Bosta  **[Resolved — live]**

Credentials arrived and the integration is live against `api.bosta.co/api/v1`.
An order carries a `trackingNumber`; shipment detail is read from Bosta on demand
rather than stored, with a 60s cache and an 8s timeout.

**"FlexShip" is Bosta, not a second courier.** The earlier screenshot showing
`رسوم فليكس شيب` came from Bosta's own `flexShippingInfo` block. That open
question is closed — there is one courier.

Verified against a real AWB: Bosta returns COD 4,500 EGP marked `غير مدفوع`
against a *delivered* shipment — the exact case that justified separating
`status` from `paymentStatus` in §4.

**[Open]** Bosta reports a shipment delivered while our order may still sit at
`CONFIRMED`. Whether courier state should advance our order status automatically
is a business rule, not a technical one, and is deliberately not implemented.

## 9. Easy Orders webhook  **[Blocked on configuration]**

The receiver is live and verified with the real secret from the seller dashboard,
including store-id validation and replay protection.

**The registered webhook's URL is literally `*`**, so Easy Orders has nowhere to
deliver. It needs a public HTTPS URL pointing at
`POST /integrations/easyorders/webhook`. Only the `orders` type is registered;
`Order Status Update` needs a second webhook to keep payment state in sync.
