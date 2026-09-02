# Handoff — current state

Read this first when continuing the build in a new session. It records what is
**actually** built and running, which is not the same as the phased plan in
[roadmap.md](roadmap.md).

Last updated: 2026-09-01.

---

## Toolchain (what's real)

- **npm workspaces** monorepo — `apps/api` (NestJS 11 + **TypeORM**, not Drizzle)
  and `apps/web` (Next.js — a modified build; read `apps/web/AGENTS.md` before
  touching it).
- Postgres 17 in Docker: `npm run db:up` → `localhost:5433`, db `prime_market`,
  user/pass `prime` / `prime`. Connection string in `.env` at repo root.
- `TypeORM synchronize: true` is **on** deliberately while testing — no
  migrations yet.
- Run everything: `npm run dev` (API on :3001, web on :3000). Dev accounts:
  `admin@admin.com` / `admin123`, `moderator@moderator.com` / `moderator123`.
- `docs/architecture.md` describes a stack (Drizzle, RLS, migrations, fixed
  HTTPS domain) that was **reverted**. Treat it as intent, not fact.
- Deployed live on AWS since 2026-08-31 with real named users. Be careful what
  you push.

## How the build actually went

Breadth-first, not the phased roadmap. Catalogue, inventory, noon import,
orders, and Bosta all exist at some depth.

**Channel mapping (`channel_listing`) — CRUD + screen built 2026-09-02 (PR #39).**
The table and its resolvers (noon import, Easy Orders webhook, order→stock) were
always there; nothing could *create* a mapping. Now: `POST
/catalog/products/:id/listings`, `PATCH`/`DELETE /catalog/listings/:id`, and an
editable "Channels" block on the product screen — one optional field per channel
(noon Partner SKU / Amazon Seller SKU / Website id). noon's `partnerSku` is
mirrored to `externalId` (what the settlement importer matches on).
**Not done, on purpose:** the 3,173 historical noon rows / 132 SKUs are still
unmapped and there's no bulk-map tool — Ahmad is rebuilding the catalogue by
hand with the owner and entering real SKUs from that screen. Follow-ups: SKU
fields on the new-product form, multi-variant channel mapping, an Easy Orders
picker.

---

## Money module — BUILT

Replaces the deleted `/finance` screen. Double-entry-lite: `ledger_account`
(14 fixed accounts, seeded in code, never user-editable) + append-only
`ledger_entry` (one debit code + one credit code + positive amount). Every
balance is a `SUM`. AVCO costing; landed cost allocated by value.

- Spec: [money-module-build.md](money-module-build.md)
- Owner guide (Egyptian Arabic): [دليل-الوحدة-المالية.md](دليل-الوحدة-المالية.md)
- Screens: `/money` (overview) · `/money/treasury` · `/money/purchases` ·
  `/money/suppliers` · `/money/ledger`. Charts are hand-rolled SVG
  (`apps/web/src/components/charts.tsx`), no chart dependency.
- Backend: `apps/api/src/finance/` (ledger) + `apps/api/src/purchasing/`
  (suppliers, purchase invoices).

Merged: **PRs #26–#33**. Round-1/2/3 fixes covered: pg `date` timezone shift,
compact headers, `MoneyInput` grouped digits, invoice-builder redesign,
per-invoice payment, `settledAmount` + derived paid status, `<bdi>` for Arabic
names, red negatives / green positives, and **supplier "owed" derived from
invoices** (`SUM(landedTotal − settledAmount)` over posted CREDIT invoices) so
`settledAmount` and the ledger can't drift.

### DB state

**All money-module test data was wiped 2026-09-01** for a fresh test — 0
ledger entries, 0 invoices, 0 suppliers, 0 cheques. The 14 `ledger_account`
rows remain (re-seeded on boot regardless). Inventory that the test purchases
had touched was reverted (`اكسجين بلوب` → 46.37, `املاح بديكير` → 19.75; test
product `اختبار منتج` deleted). `/money` shows the "set opening balance" state.

### Not done in the money module

- noon settlements / orders posting real receivable + COGS entries — the
  `recordNoonPayout` / `recordOrderPayment` helpers post entries but their
  counterparties wait for the mapping phase.
- Stock-value card on `/money` still uses the stock query, not the `INVENTORY`
  ledger account — reconcile later.

---

## Bosta integration — REWORKED this session

Bosta is the only courier (FlexShip is a Bosta feature, not a second courier).
Shipments screen at `/shipments`; per-order tracking on the order page.

**PRs #34 and #35 (2026-09-01)** fixed three long-standing "wrong data" bugs:

1. **Only 10 of N deliveries showed.** `GET /api/v0/deliveries` silently caps a
   page at 10. Now pages through **`POST /api/v2/deliveries/search`**
   (`{limit,page}`, loop until a short page — its `count` is always 0).
2. **Refresh / order page showed wrong COD state.** `GET /api/v1/deliveries/{tn}`
   returns `cashoutInfo: null` for everyone. Single-tracking now uses the same
   v2 search (`{trackingNumbers:[tn]}`), so list and detail can't disagree.
3. **Status & label mismatches vs the Bosta dashboard.** "Pickup requested" →
   جديد / في انتظار الاستلام (split on `pendingPickup`); Arabic status labels
   via `STATUS_LABEL_AR` with English fallback for unknown states; PENDING COD
   label → قيد التنفيذ.

Full endpoint facts and the verified mapping table:
[evidence/integrations.md](evidence/integrations.md) → Bosta section.

Code: `apps/api/src/integrations/bosta/` (`bosta.client.ts` transport +
`collectPages`, `bosta.service.ts` normalisation, `bosta.test.ts`).

**Not yet verified:** the Arabic labels for in-transit / out-for-delivery
states — no shipment is in those states yet. Fallback shows Bosta's English, so
nothing renders *wrong*, just possibly in English until checked against a live
row.

**Not done:** COD reconciliation into the ledger (Bosta payout → `BOSTA_COD` →
`CASH`). The `wallet.cashCycle` fee breakdown (per-shipment Bosta fees, VAT,
actual deposited amount) is only on the `v1` detail endpoint — fetch it there
when the money module needs it.

---

## Easy Orders — parked

Webhook-only (no orders API). The registered webhook URL is invalid (`*`), and
tunnel URLs die. Real fix is a fixed HTTPS domain. See
[evidence/integrations.md](evidence/integrations.md).

## noon — reports, no API

Manual CSV exports. No quantity column, no cost data, closing balance is a
receivable. See [evidence/noon-settlement-report.md](evidence/noon-settlement-report.md).

---

## Working agreements (do not relearn the hard way)

- **Architecture first.** Design / discuss / get agreement before writing code.
  Two earlier builds were rejected for being built before being designed.
- **Git:** one-line commit messages, push after every step, never batch. Branch
  off `main`, PR, merge, pull. Claude runs `gh pr merge` (admin-only rule is in
  the user's own settings).
- **Visual:** monochrome-first, semantic colour only, tokens not hex. English
  UI + Arabic names. Compact headers (`ContextBar`, not big hero space).
- Repo is **public** (`Ahmad-Mosha/business-system-tenant`). Only this repo's
  work goes in.

Deeper context is in the session memory index (`MEMORY.md`), auto-loaded each
session.
