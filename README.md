# Prime Market

Operations and commerce platform for Prime Market. Currently one working slice:
turning noon settlement exports into per-product answers.

## Running it

```bash
npm install
npm run db:up          # postgres 17 via docker
cp .env.example .env
npm run dev:api        # api on :3001
npm run dev:web        # ui  on :3000
```

Without Docker, point `DATABASE_URL` at any Postgres 14+ and create the database.

```bash
npm test               # parser tests
npm run typecheck
```

## The noon slice

```bash
curl -X POST localhost:3001/noon/imports -F "file=@noon_export.csv"
curl "localhost:3001/noon/statement?from=2026-07-01&to=2026-07-31&openingBalance=22147.44"
curl "localhost:3001/noon/products?from=2026-07-01&to=2026-07-31"
curl "localhost:3001/noon/unattributed?from=2026-07-01&to=2026-07-31"
```

Verified against the real July 2026 export: 924 rows, 84 products discovered,
net proceeds and payouts reproduce noon's portal exactly.

### Two things worth knowing

**Products are discovered, not seeded.** A report can be imported before any
catalogue exists. Each `Partner SKU` we have not seen creates a stub `Product`
flagged `discovered`, which someone enriches later with cost and category.
Marketplace SKUs point at products, never the reverse — so the same item sold on
noon, Amazon and the website resolves to one product and one pool of stock.

**Imports are idempotent, twice over.** An identical file is recognised by its
hash. An *overlapping* export is deduplicated row by row against a SHA-256
fingerprint of the raw line, so re-uploading a wider date range inserts only
what is genuinely new.

## Interface

Three screens: **Overview** (statement, fee breakdown, best performers),
**Products** (per-product performance), **Imports** (upload and history).

Monochrome by design — colour carries meaning or is absent. Semantic tokens
(`--success`, `--warning`, `--destructive`) live in `globals.css`; nothing
hard-codes a hex. The UI stays legible with all of them collapsed to grey.

Pages are server components that fetch and render on the server. The only
client code is the sidebar (needs the current path) and the import form (needs
upload state). Uploads go through a server action, so the API origin stays
private and the browser never needs CORS.

## Layout

```
apps/api/src/
  catalog/     product identity and channel SKU mapping
  noon/        settlement export: parser, import, endpoints
  reporting/   read models (SQL aggregates, nothing cached)
  database/    naming strategy
apps/web/src/
  app/         routes (server components)
  components/  sidebar, page chrome, import form
  lib/         api client, formatting
docs/evidence/ what the source reports actually contain
```

Money is `numeric(14,2)` and crosses into TypeScript as a string; all arithmetic
happens in Postgres so nothing is routed through a float.

## Known gaps

- **Cost is absent from every marketplace report**, so margin stays null until
  purchasing data is entered. `unitCost` on `Product` is the placeholder.
- Fees reconcile to within **1.99 EGP** of noon's portal on the July export.
  The gap is in noon's own CSV, not in this code — see `docs/evidence/`.
- Schema is `synchronize: true`. Needs migrations before real data lands.
- No auth yet. Do not expose this.
- Three products appear twice under different Partner SKUs (one uses an older
  `CCC-0014` convention). They may be duplicate listings or genuine variants —
  merging them is a business decision, and there is no merge action yet.
