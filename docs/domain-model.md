# Domain model

Only tables that exist. Nothing aspirational.

## Identity

```
organizations ──< users ──< user_roles >── roles ──< role_permissions >── permissions
                    │
                    └──< sessions
```

| Table | Purpose | Notes |
|---|---|---|
| `organizations` | The tenant | One row today; the column exists everywhere so multi-tenancy is not a migration later |
| `users` | People who sign in | Email is globally unique and stored lower-cased. No public signup |
| `roles` | A named bundle of grants | `ADMIN`, `MODERATOR` seeded |
| `permissions` | The capability catalogue | Rows, not code branches. Currently: `order:read` |
| `role_permissions` | A grant | Carries **scope** (`ALL` / `ASSIGNED`) |
| `user_roles` | Role assignment | A user may hold several; the broadest scope wins |
| `sessions` | Live sign-ins | Stores only `sha256(token)` |

**Invariants**

- A user always belongs to exactly one organization.
- A permission a user does not hold is absent, never present-and-false.
- When two roles grant the same permission, the broader scope applies (`ALL` beats
  `ASSIGNED`).

## Audit

| Table | Purpose |
|---|---|
| `audit_events` | Who did what, when, to which entity, and under which correlation id |

**Invariants**

- Append-only. Never updated, never deleted. A correction is a new row.
- `actor_type` distinguishes `USER`, `SYSTEM` and `INTEGRATION`, so an automated change
  is never mistaken for a person's.
- Distinct from application logs, which are transient and technical.

## Catalog

```
products ──< variants ──< listing_components >── channel_listings
                │
          (stock and cost will attach here)
```

| Table | Purpose |
|---|---|
| `products` | Marketing grouping. No stock, no logic |
| `variants` | **The atomic unit.** Internal SKU; stock and cost attach here |
| `channel_listings` | One sellable thing on one channel, holding that channel's ids |
| `listing_components` | How a listing resolves to variants, with a quantity |

**Invariants**

- One physical item sold on EasyOrders, Amazon and noon is **one variant** with three
  listings. Three sales therefore move one stock figure by three.
- A plain item is one component of quantity 1; a two-pack is quantity 2; a bundle is
  several components. Modelling this from the start is what avoids rewriting order
  history when the first multi-pack appears.
- `(organization_id, channel, external_id)` is unique - the idempotency key for
  catalog import.
- Internal SKUs are ours (`SKU-00001`), never a provider's, though a provider SKU is
  adopted when it exists.

## Sales

| Table | Purpose |
|---|---|
| `orders` | A customer order from any channel |

**Invariants**

- `(organization_id, order_number)` is unique.
- `(organization_id, source, external_id)` is unique when `external_id` is present -
  the idempotency key that makes re-delivering a provider webhook safe.
- Customer details are **snapshotted** onto the order. Editing a customer later must
  not rewrite what was agreed on a past order.
- Amounts are minor units with an explicit currency.

| `order_lines` | What was ordered, and what it resolved to |
| `order_status_history` | Every status change, with actor and note |
| `order_assignments` | Who held the order, and when |

**More invariants**

- A line always keeps `external_sku` and `external_title` alongside the resolved
  `variant_id`. An unrecognised SKU produces a line marked `UNRESOLVED` - never
  dropped, never guessed at, and visibly excluded downstream.
- Assignment is sticky in normal operation, but reassignment closes the previous
  holder's period rather than overwriting it, so who worked an order survives.
- Legal transitions live in `@app/contracts` so the API and UI cannot disagree.

**Not built yet:** customers as their own entity, inventory, cost. Each arrives with
the step that needs it.

## Order status

See [workflows/order-lifecycle.md](workflows/order-lifecycle.md).
