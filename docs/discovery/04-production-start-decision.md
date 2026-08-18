# Production Start Decision

Date: 2026-08-18 · Status: **awaiting approval**. No code written yet.

---

## 0. Security first — rotate the credentials

The EasyOrders **API key** and **webhook secret** were pasted into a chat transcript. Treat both as
compromised and regenerate them in the seller dashboard before we build anything. EasyOrders'
own documentation says to regenerate immediately if a key is exposed.

Neither value appears in this repository, and neither will. Handling from day one:
`.env` (gitignored) locally, platform secret store in deployment, `.env.example` with names only,
and a startup config schema that fails fast on a missing/blank secret rather than booting degraded.

---

## 1. First-slice decision: **Order/Operations is Slice 1. Your reasoning is better than mine was.**

I recommended noon-first. That recommendation is superseded. Three reasons, in order of weight.

### 1.1 Retroactivity is asymmetric — and I under-weighted it

Marketplace data is **retroactively importable**. If we build the noon importer in December, we can
still import January onward and get complete history. Operational order data is **not**: every day
without order capture is a day of assignment history, confirmation outcomes, moderator activity and
cancellation reasons that is gone permanently.

That asymmetry alone orders the work. **Start the clock on the data that cannot be recovered later.**
I did not give this proper weight in the earlier recommendation, and it is decisive.

### 1.2 My own screenshot analysis undercut the noon-first business case

Addendum 03 established that all 15 numbers on the Statement of Account are produced by noon for
free. So the near-term value of a noon slice is **smaller than I estimated** when I recommended it,
and — as you correctly say — we still do not know what the 8 hours actually consists of. Building a
slice to attack an unmeasured problem is speculative optimisation. Your instinct is right.

### 1.3 The objection I raised against your sequence is now satisfied

I argued the financial core must not be designed before we understood marketplace money mechanics.
That objection was about **knowledge**, not build order — and we now have that knowledge banked in
Addenda 01–03: settlement lag, statement-vs-item rounding authority, the RTO dead-cost pool,
pre-settlement returns, receivable behaviour, real fee taxonomy and rates.

**We got the learning without building the slice.** The constraint is satisfied. The discovery work
was not wasted; it became the acceptance specification for a later slice and it de-risks the
financial core in advance.

### Revised sequence

| # | Slice | Note |
|---|---|---|
| **1** | **Order / Operations** | Split 1a / 1b — see §2 |
| 2 | Bosta + fulfilment | Moved up: closes the order loop, and the adoption risk in §2.4 lives here |
| 3 | Inventory (Own / Amazon-FBA / noon-FBN) | |
| 4 | Financial core | Purchases, cash, COGS, revenue on delivery, COD receivable |
| 5 | noon reconciliation | Now reconciles against real orders and posts to the ledger. Acceptance spec already written |
| 6 | Amazon | |

Only Slice 1 is committed. Everything after is direction.

---

## 2. Slice 1 scope

### 2.1 Split it in two

Your proposed scope is coherent but is about two slices of work, and the halves have different
dependencies — the operational half needs nothing external, the ingestion half needs a public HTTPS
endpoint, a registered webhook, and answers to open API questions (§4.6).

**Do not let the integration block the workflow.** Ship 1a, get moderators using it, then 1b.

**Slice 1a — Operational core** (no external dependencies)

```
Auth → roles & permissions → catalog (variant + listing) → manual order creation
→ assignment → moderator-scoped access → confirmation workflow → status + history → audit
```

**Slice 1b — EasyOrders ingestion**

```
webhook receiver → raw inbound event → idempotency → re-fetch by ID → canonical order
→ product resolution → mapping inbox for unresolved SKUs → reconciliation sweep
```

### 2.2 Building

| Area | In scope for Slice 1 |
|---|---|
| Identity | Email/password login, httpOnly session cookie, password hashing (argon2id), logout. **No** SSO, no signup, no password reset (admin creates users) |
| Authorization | Permissions as data (`order:read`, `order:assign`, `order:update_status`, `catalog:write`, `user:manage`), roles as bundles, seeded Admin + Moderator. **Scope** `ALL` vs `ASSIGNED_TO_ME`. Enforced in the application layer, never in the UI |
| Tenancy | `organization_id` on every business table, one seeded org, no UI |
| Catalog | `product`, `variant` (internal SKU, the atomic unit), `channel_listing` + `listing_component` (listing → (variant, qty)). **No** pricing history, images, categories, attributes |
| Customer | Order-time **snapshot** on the order (authoritative for that order) **plus** a light `customer` record keyed by normalised phone for lookup/repeat detection |
| Orders | `order`, `order_line`, `order_status_history`, `order_assignment`. Manual creation by moderator/admin |
| Lifecycle | `NEW → CONTACTED → CONFIRMED → READY_TO_SHIP → SHIPPED`, plus `ON_HOLD` and `CANCELLED` (terminal, requires a reason) |
| Audit | `audit_event`: actor (user \| integration \| system), action, entity, before/after, reason, correlation id. Immutable. Visible in the order detail UI |
| Ingestion (1b) | `inbound_event` raw store, EasyOrders adapter, idempotency, mapping inbox, repair sweep |

### 2.3 Explicitly NOT building

Finance/ledger/COGS · inventory movements and stock levels · Bosta · Amazon · noon · analytics or
dashboard · returns/RTO handling · shipping labels · notifications/SMS/WhatsApp · reporting exports ·
multi-tenant UI · billing · password reset/SSO · file uploads · product images.

### 2.4 Two design stances worth stating

**`DELIVERED` and `RETURNED` are not in Slice 1.** They will be owned by the courier in Slice 2.
Letting a moderator hand-type them now creates a second source of truth and a migration. `SHIPPED`
*is* included — in Slice 1 a moderator sets it; in Slice 2 Bosta becomes the authority. The state
survives, only the authority changes. That is an authority migration, not a throwaway abstraction.

**The real adoption risk is double entry.** If moderators today live in the Bosta dashboard, a
system that stops at `READY_TO_SHIP` makes them work in two places, and adoption fails regardless of
code quality. Slice 1 is deliberately aimed at the pre-shipment work — customer confirmation calls —
which is where moderator time actually goes. **Confirm this with the moderators before we build**
(§7 of the questions). If it turns out their day is mostly shipment tracking, Bosta moves into
Slice 1.

---

## 3. Minimal architecture baseline

Four documents and four ADRs. Not more.

```
docs/
  architecture.md            system overview, module map, conventions, "decided but not yet built"
  domain-model.md            entities + invariants for shipped slices ONLY
  workflows/
    order-lifecycle.md       states, transitions, who may perform each, side effects
  decisions/
    ADR-001-backend-architecture.md      NestJS, modular monolith (records the Nest-vs-Hono call)
    ADR-002-persistence-conventions.md   Postgres, Drizzle, UUIDv7, money minor units, UTC/Africa-Cairo, organization_id
    ADR-003-authorization-model.md       permissions as data + scope, enforced in application layer
    ADR-004-integration-boundary.md      provider adapters → canonical documents; webhook = trigger, API = truth
  discovery/                 00-04, frozen as historical evidence
```

Rules that keep it useful: `domain-model.md` documents only what exists (no aspirational tables);
ADRs are immutable once accepted — a change means a new ADR that supersedes; `architecture.md`
carries a short "decided, not yet built" section so settled decisions (the append-only stock and
money ledgers) are not relitigated when we reach Slice 4.

---

## 4. EasyOrders integration decision

Verified against current official documentation, 2026-08-18.

| Item | Finding |
|---|---|
| Base URL | `https://api.easy-orders.net/api/v1/external-apps/` |
| Auth | Header `Api-Key: <key>`. Keys carry scoped permissions (e.g. `orders:read`) |
| Rate limit | **40 requests/minute**, `429` when exceeded |
| Fetch one order | `GET /orders/:order_id` → full order incl. cart items, product/variant, customer, costs |
| Webhook auth | A **`secret` header** containing the generated token |
| Events | Order created (full payload); `order-status-update` (order id, old/new status, optional payment reference) |
| Webhook identity | The URL **is** the identity — there is a `DELETE /webhooks/delete-by-url` |
| Separate URLs | The authorized-app flow exposes `orders_webhook` and an optional `order_status_webhook_url` — creation and status changes can target different endpoints |
| Retry behaviour | **Not documented.** Must not be relied upon |

### 4.1 What the secret is, and what it is not

It is a **shared bearer secret**, not an HMAC signature. It proves only that the caller knows a
token. It does **not** prove payload integrity, and it does not prevent replay.

Required consequences:

- **HTTPS only.** The secret travels in a header on every request; an HTTP endpoint leaks it.
- **Constant-time comparison.** A naive `===` leaks the secret through timing.
- **Never trust the payload as truth.** See §4.3.
- Rotating the secret means delete + recreate the webhook, so the receiver must accept **two valid
  secrets during a rotation window**. Build that in now; it is three lines and avoids downtime later.

### 4.2 The webhook URL, and why `*` is wrong

The field is *"the endpoint URL where you want to receive webhook notifications"* — the literal
destination EasyOrders POSTs to. **`*` is not a URL.** Either the registration is invalid or
EasyOrders has nowhere to deliver, and webhooks will silently never arrive. There is no
documented wildcard support, and a wildcard would make no sense for an outbound destination.

Set it to a fully-qualified HTTPS URL pointing at our receiver:

```
https://api.<our-domain>/webhooks/easyorders/orders
https://api.<our-domain>/webhooks/easyorders/order-status
```

Because the URL is the webhook's identity, **each environment needs its own registration** with its
own URL and its own secret. For local development, use a stable tunnel hostname
(Cloudflare Tunnel or ngrok with a reserved domain) — not a URL that changes on every restart.

Practical consequence: **we cannot register the real webhook until the receiver is deployed.**
Slice 1a has no such dependency, which is the second reason for the split.

### 4.3 Recommended ingestion pattern: **webhook is a trigger, the API is the truth**

```
EasyOrders POST
  → verify secret (constant-time)     → 401 if wrong
  → persist inbound_event (raw body, headers, received_at, dedup key)
  → return 200 immediately            → never process inline
  → queue job
       → GET /orders/:id              → authoritative state
       → map to canonical order
       → resolve listings → variants  → unresolved goes to the mapping inbox, never dropped
       → upsert by (channel_account_id, external_order_id)
       → emit audit event
```

Why re-fetch when the created payload is already complete: it defends against replay and forgery
(the shared secret cannot), it yields the current state rather than the state at emission, and it
gives webhook-driven and sweep-driven ingestion **one code path**. At tens of orders per day against
a 40 req/min limit, the cost is irrelevant.

### 4.4 Idempotency

| Layer | Key |
|---|---|
| Inbound event | `(provider, endpoint, sha256(raw_body))` — unique; a duplicate POST is recorded and skipped |
| Order | `(channel_account_id, external_order_id)` — unique; upsert |
| Order line | `(order_id, external_line_id)` |
| Status change | Applied only if it advances state; a repeated `order-status-update` is a no-op with an audit note |

### 4.5 Failure handling

Retry behaviour is undocumented, so we assume **at-least-once at best, and possible silent loss**.
Defences: a bounded-retry job queue with exponential backoff and a dead-letter queue; failures
surfaced on an integration health view (not just logs); and a **reconciliation sweep** that re-pulls
recent orders and reports anything EasyOrders has that we do not.

### 4.6 Open questions to answer against the live API before writing the adapter

These are unknowns, not guesses — a ~30-minute probe with the rotated key answers all of them:

1. **Is there a list/search orders endpoint with date filters and pagination?** The sweep in §4.5
   depends on it. If it does not exist, we need a different safety net and I will propose one.
2. The complete set of `status` values EasyOrders can emit.
3. Whether `variant_id` is stable and always present, and how `sku`/`taager_code` behave.
4. Whether the status-change webhook fires for every transition or only some.
5. Whether one webhook registration receives both event types, or two are required.

**No adapter code gets written before these are answered.**

---

## 5. Backend structure (Slice 1 only)

```
/
  package.json                pnpm workspaces
  docker-compose.yml          postgres + redis (redis only when 1b lands)
  apps/
    api/                      NestJS
      src/
        main.ts  app.module.ts
        config/               env schema, fail-fast validation
        shared/               ids, clock, errors, result types, correlation-id middleware
        db/                   drizzle client, schema/, migrations/
        modules/
          identity/           users, roles, permissions, auth, guards, policy service
          catalog/            product, variant, channel_listing, listing_component
          sales/              order, order_line, assignment, status transitions
          audit/              audit_event, actor context
          ingestion/          [1b] inbound_event, easyorders/ adapter, jobs
      test/                   e2e
    web/                      Next.js (App Router)
  packages/
    contracts/                shared request/response types + zod schemas
```

That is the whole tree. No folders for modules we are not building.

| Decision | Choice | Note |
|---|---|---|
| ORM | Drizzle | SQL-first, explicit migrations checked in |
| Validation | Zod, shared via `contracts` | One schema, both sides |
| Domain purity | Business rules (status transitions, scope) as **framework-free TypeScript**; Nest supplies HTTP/DI/jobs only | Keeps ADR-001 reversible |
| Tests | Unit for domain rules; integration against a **real Postgres**; e2e through the HTTP API | No mocked database |
| Logging | pino, structured, correlation id per request/job | |
| Jobs | BullMQ + Redis, introduced in **1b** only | Not needed for 1a |

---

## 6. Frontend scope (Slice 1)

Next.js App Router, TypeScript, Tailwind + **shadcn/ui** — you own the component code rather than
fighting a library's aesthetic, which fits "clean, professional, not flashy". Design tokens defined
once (colour, type scale, spacing, radius) before the second screen.

Five screens. Nothing else.

| Screen | Admin | Moderator |
|---|---|---|
| Login | ✅ | ✅ |
| Orders list — filters, status, assignee | all orders | assigned only |
| Order detail — customer, lines, status actions, history + audit timeline | full | assigned only, permitted transitions only |
| Create manual order | ✅ | ✅ |
| Catalog list + create variant/listing | ✅ | ✗ |

Plus (1b): a **mapping inbox** for unresolved external SKUs.

No dashboard, no charts, no settings, no user management UI in Slice 1 (users seeded by migration).
The UI renders from server-provided capabilities; it never decides permissions.

---

## 7. Acceptance criteria

Slice 1 is complete when **a real moderator works a full day in it**, not when it merges.

Workflow:
1. A moderator handles a real customer order end to end: sees it assigned, contacts the customer,
   confirms, moves it to ready-to-ship — without opening a spreadsheet.
2. An admin assigns and reassigns orders and sees who did what and when.
3. (1b) A real EasyOrders order appears automatically within seconds of being placed.

Technical, verified by automated test:
1. The same webhook delivered 5× produces exactly one order and one set of audit events.
2. A moderator calling the orders API **directly** receives only their assigned orders — asserted
   against the HTTP response, not the UI.
3. A moderator cannot perform a transition outside their permitted set; the attempt is audited.
4. An order line with an unknown external SKU still creates a workable order, raises a mapping work
   item, and is visibly flagged as unresolved.
5. An unrecognised EasyOrders status creates a work item rather than mapping to a default.
6. Every status change, assignment and edit is reconstructable from the audit log with actor,
   timestamp and before/after.
7. The raw inbound payload for any ingested order is retrievable.
8. A wrong or missing `secret` header returns 401 and is logged with no order created.
9. Config boots with a fail-fast error when a required secret is absent.
10. CI is green: lint, typecheck, unit, integration, e2e.

---

## 8. First implementation step

**Walking skeleton: login → empty orders list, running on real infrastructure.**

One vertical cut through every layer, production-quality, no placeholders: repo + pnpm workspaces +
docker-compose Postgres → Drizzle schema and first migration (`organization`, `user`, `role`,
`permission`, `role_permission`, `user_role`) → seeded org, admin and moderator → real login with
argon2id and an httpOnly session cookie → one guarded `GET /orders` returning an empty scoped list →
Next.js login page and orders list consuming it → e2e test proving a moderator cannot reach an
admin-only route → CI green.

It is small, it is real, none of it is thrown away, and it de-risks the entire delivery pipeline
before any domain complexity lands.

**Prerequisite, same day (~30 min, no code):** rotate the EasyOrders credentials and run the §4.6
API probe. The answers shape the 1b adapter, and one of them (list-orders endpoint) may change the
sweep design.

---

## Open questions

1. **What does a moderator's day actually look like?** Specifically: do they spend it on customer
   confirmation calls, or on shipment tracking in the Bosta dashboard? This decides whether Bosta
   stays in Slice 2 or moves into Slice 1 (§2.4). Highest-value question here.
2. How many moderators, and does an order belong to one moderator or move between them?
3. What are the real cancellation reasons? They should be a closed list from day one — free text
   destroys the analysis later.
4. Do EasyOrders orders already carry a SKU that matches anything you use internally, or is every
   listing going to need manual mapping?
5. Is there an existing spreadsheet/tool the moderators use today that I should see? It is the
   fastest way to get the lifecycle right the first time.
