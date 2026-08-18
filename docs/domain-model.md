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

**Not built yet:** order lines, status history, assignment history, customers as their
own entity, catalog. Each arrives with the step that needs it.

## Order status

See [workflows/order-lifecycle.md](workflows/order-lifecycle.md).
