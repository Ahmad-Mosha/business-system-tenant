# Prime Market — Handoff

Written 2026-08-20 to resume in a fresh chat without re-deriving context.
Read this first, then `docs/decisions/001-product-identity-and-orders.md` for
the domain reasoning behind the schema. Everything below was verified against
the actual repo and running system on the date above, not recalled from memory.

## What Prime Market is

Internal ops platform for an Egyptian multi-channel reseller (Ahmad's
business). Channels: noon, Amazon (not yet integrated), Easy Orders website,
social/manual orders. COD-heavy, Bosta courier. Goal: one reconciled source of
truth for cash, inventory, orders, and eventually profit.

**Full product vision, domain philosophy, and Ahmad's standing instructions on
how to work (senior-owner framing, architecture-first, challenge assumptions,
discover-before-implement) live in the system prompt / CLAUDE.md context that
gets loaded automatically each session — do not re-ask for that context, it
will already be present.** This file only covers *implementation state*.

The repo was **reset from scratch on 2026-08-20** — an earlier attempt was
rejected as over-engineered. Everything described here was built after that
reset, in one continuous session. There is no older code to reconcile with.

## Repo / stack

- Monorepo: `apps/api` (NestJS + TypeORM + Postgres), `apps/web` (Next.js 16
  App Router + Tailwind v4 + shadcn `radix-nova` preset).
- GitHub: `Ahmad-Mosha/business-system-tenant`, branch `main`, clean, all
  pushed. Commit style: short one-liners, pushed every step (Ahmad is strict
  about this — no batching, no essay commit messages).
- `docker-compose.yml` runs Postgres 17 on **port 5433** (not 5432 — a stray
  Homebrew Postgres also happens to be running locally on 5432, ignore it,
  the app uses 5433 via `DATABASE_URL` in `.env`).

### Starting the system

```bash
cd /Users/ahmadgamal/new-workspace/dashboard
docker compose up -d          # postgres 17, port 5433 (may already be up)
npm run dev                   # api :3001 + web :3000 together, concurrently -k
```

`concurrently -k` means killing one kills both — if you restart the API alone
with a targeted `pkill`, the web process dies too and needs restarting
separately. This bit us during the session; just use `npm run dev` for both.

Dev logins (seeded automatically on empty `app_user` table):
- `admin@admin.com` / `admin123`
- `moderator@moderator.com` / `moderator123`

```bash
npm test          # 4 test files, all passing as of last check
npm run typecheck # both workspaces
```

## Domain model (the part that matters most)

Read `docs/decisions/001-product-identity-and-orders.md` in full — it has the
evidence and reasoning. Summary of the load-bearing decisions:

- **Product → ProductVariant → ChannelListing.** Internal UUID is the only
  identity that matters. `ChannelListing(channel, externalId, externalVariantId)`
  maps a channel's own identifier to our variant. This exists because
  **Easy Orders has no SKU field at all** (verified against their live API —
  identity is a UUID + slug) while noon uses `Partner SKU` — no single
  external scheme could have been assumed.
- **Order.status and Order.paymentStatus are separate columns**, not one
  combined state. Evidence: a real Bosta shipment came back `DELIVERED` with
  COD `غير مدفوع` (unpaid) — a single field cannot express "delivered but not
  yet paid," which is the COD-default reality of this business.
- **Stock is `stock_movement` rows, summed** — never a mutable counter.
  Costing method (FIFO vs average, how shipping/damage affects cost) is
  **deliberately unfinished** per Ahmad's explicit instruction not to invent
  accounting rules ahead of stakeholder input.
- **Moderator scoping is enforced in the SQL query itself** (`WHERE
  assigned_to_id = $1`), not just hidden in the UI — verified: a moderator
  hitting another user's order URL directly gets 404, not data.
- Auth: cookie-based JWT (`pm_session`, httpOnly), global `AuthGuard` on every
  endpoint unless `@Public()`, `@Roles('ADMIN')` for admin-only routes.

## What's built and verified working

### 1. noon settlement import (first slice, most mature)
Upload a noon CSV export → parses, dedupes by row-hash fingerprint (so
re-uploading an overlapping export is a no-op), discovers products from
`Partner SKU` on first sight, stores every row verbatim. Reporting is pure SQL
aggregation over stored rows (`/noon/statement`, `/noon/products`,
`/noon/periods`) — nothing cached, nothing mutated.

**Verified against real data**: 4 months imported (May–Aug 2026), 3,173 rows,
149 products. The running-balance anchor (`channel_account` table, one row:
opening balance 89,006.06 as of 2026-05-01) reproduces noon's own portal
balance across all 4 months to the exact piastre except a **known, accepted
1.99 EGP rounding gap that exists in noon's own CSV vs their portal** — this
was investigated and is not our bug (see `docs/evidence/noon-settlement-report.md`).

Screens: Overview (`/`), Months (`/months`, `/months/[month]`), Products
(`/products` — has filters: month chips, name search, "has returns", "missing
cost", all URL-driven), Imports (`/imports`, drag-drop upload with real
progress states).

### 2. Orders + moderator workflow
Two sources: `SOCIAL` (manual, via `/orders/new`) and `EASYORDERS` (webhook).
Status lifecycle enforced server-side via `ALLOWED_TRANSITIONS` map (NEW →
ASSIGNED → CONFIRMED → SHIPPED → DELIVERED, with CANCELLED/RETURNED branches).
Status dropdown right on the list (`OrderStatusMenu` component) as well as
full workflow controls on the detail page. Every change writes an
`OrderEvent` row (append-only audit trail, who + when + from→to).

### 3. Inventory / catalogue
`/inventory` — list with search + channel/category/stock filters, manual
"Add product" (creates product + default variant + optional opening stock in
one transaction), per-variant stock recording with reasons
(PURCHASE/SALE/RETURN/ADJUSTMENT/DAMAGE/COUNT) and running-total history.
"Sync website catalogue" button pulls Easy Orders' live product list and
creates/updates listings — **15 live products, all 15 currently mapped**.

### 4. Bosta shipment tracking — LIVE, real credentials
Real API key in `.env` as `BOSTA_KEY`. Key finding: **the list endpoint is
`/api/v0/deliveries`** (or `POST /api/v0|v2/deliveries/search`) — `/api/v1/`
has no list route, only per-AWB lookup, and returns a misleading `400
"Delivery not found"` if you POST to it expecting a list. This cost real
debugging time; don't rediscover it.

**"FlexShip" is Bosta's own feature** (`flexShippingInfo` in their response),
not a separate courier — this was an open question, now closed by evidence.

`/shipments` page: live list (scoped by role — moderator sees only shipments
on their assigned orders) + a manual AWB lookup panel
(`ShipmentTrackerView`) for tracking numbers not yet on any order (Bosta has
no "list all, unfiltered" convenience — only search/list against the account).
8s timeout + 60s in-process cache on every Bosta call, capped concurrency (6)
when listing many.

### 5. Easy Orders webhook — LIVE, verified with a real order
This is the integration that took the most iteration this session. Current
state: **fully working**, confirmed with one genuine order from the real
website (PM-1000, Ahmed Waled, 710.00 EGP, item correctly matched to
inventory).

Endpoint: `POST /integrations/easyorders/webhook`, auth via `secret` header
(constant-time compare against `EASYORDERS_WEBHOOK_SECRET`), plus a
`store_id` check against `EASYORDERS_STORE_ID` so a leaked secret can't inject
orders from another store. Idempotent on the raw-payload hash (redelivery
returns `duplicate`, no double order) and additionally on Easy Orders' own
order `id` (unique constraint on `(source, external_id)`). Raw payload is
always stored to `easyorders_event` before processing, so a mapping bug never
loses a real order — it sits there with `error` populated for reprocessing.

**The env var name for the API key has changed at least twice** —
`easyorder_api_key` → `EASYORDERS_API_KEY` → now `EASY_ORDER_KEY`. The
controller (`catalog.controller.ts`) now checks all three, in that order. If
Ahmad renames it again, add it to that chain rather than assuming.

**⚠️ Public URL problem — the one thing that will break next session:**
Easy Orders can only deliver webhooks to a public HTTPS URL. This machine has
no fixed domain, so every session used a throwaway tunnel
(`cloudflared tunnel --url http://localhost:3001`, no account needed — ngrok
was tried first but is blocked, Ahmad's account needs email verification at
dashboard.ngrok.com/user/settings). **The tunnel is not running right now**
(checked: no cloudflared/ngrok/localtunnel process alive), so the URL
currently saved in the Easy Orders dashboard webhook config is dead.

To test Easy Orders again in a new session:
1. `cloudflared tunnel --url http://localhost:3001` (run persistently,
   capture its printed `https://xxx.trycloudflare.com` URL)
2. Verify it actually works before touching the dashboard — POST to
   `{tunnel_url}/integrations/easyorders/webhook` with header
   `secret: <value from .env EASYORDERS_WEBHOOK_SECRET>` and a JSON body
   containing at minimum `id`, `store_id` (must equal `.env`'s
   `EASYORDERS_STORE_ID`), `full_name`, `phone`, `cost`, `total_cost`,
   `cart_items: []`. Expect `{"status":"created",...}`.
3. Only then tell Ahmad to update the webhook URL in the Easy Orders
   dashboard (Webhooks table, the row with type `order`) to
   `{tunnel_url}/integrations/easyorders/webhook`. Secret stays whatever's
   already in `.env` unless Ahmad says it changed (it rotated once already
   when he re-saved the webhook from their side — always ask him to paste
   the current dashboard values back if anything seems off, rather than
   assuming the old secret still matches).
4. **This is the permanent fix Ahmad hasn't greenlit yet**: deploy the API
   somewhere with a fixed domain, so this tunnel dance stops being necessary
   every session. Suggested but not yet actioned.

Only the `orders` webhook type is registered. **A second webhook of type
`Order Status Update` is still needed** to sync payment status back when a
website order gets marked paid — this is a known gap, not yet built.

## Known gaps / explicitly deferred (don't silently build these)

- **Inventory costing method** (FIFO/average, how damage/shipping affects
  cost) — Ahmad explicitly said not to invent this ahead of stakeholder input.
  `unitCost` on a variant is one current number, nothing more.
- **No product-merge UI.** Three noon products were found duplicated under
  different Partner SKUs (one using an old `CCC-0014` convention) — flagged
  in the decision doc, never resolved. Could be genuine variants or true
  duplicates; needs a business answer, not a technical guess.
- **No delete-product endpoint.** Two demo products exist in the live DB
  right now — `test` (TV Shop) and `GTX 1050 ti` (Computer), 100 units each,
  created while testing the Add Product form. Harmless, but cosmetic clutter
  Ahmad may want removed or may want kept as a demo. Ask before deleting
  anything — don't assume test data is safe to nuke without checking first
  (this cost real data once already this session, when I had to distinguish
  10 of my own test orders from real ones before deleting).
- **Amazon integration**: not started. No evidence gathered yet.
- **Bundle/kit products, product variants (size/color) beyond the schema
  supporting them**: schema supports it (`ProductVariant`, `attributes`
  jsonb), no UI for creating a non-default variant yet — every product today
  has exactly one variant named `Default`.
- **`docs/discovery/اسئلة-الشغل.md`** — 128 discovery questions in Egyptian
  Arabic, written for Ahmad's stakeholder meeting, sent to him as a file.
  **Unknown whether that meeting has happened yet or what the answers were**
  — ask Ahmad directly rather than assuming silence means no progress.

## Working style Ahmad has been explicit about

- Short, honest answers. He calls out over-explaining.
- Commit small, commit often, push every step — never batch changes.
- When something is broken, verify with real evidence (curl the real API,
  query the real DB) before proposing a fix — several bugs this session were
  found exactly this way (stock-count double-join bug, missing auth-header
  forwarding in two server actions, wrong env var name).
- He gets frustrated by repeated unresolved churn on the same issue (see the
  tunnel saga above) — if something is flaky, say so plainly and fix the root
  cause rather than repeating the same workaround.
- Monochrome design system is intentional and specific — semantic colour
  (success/warning/destructive tokens in `globals.css`) only, never brand
  colours or decorative hues. This was enforced once already (channel badges
  had hard-coded noon-yellow/Amazon-orange hex, removed).
