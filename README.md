# Prime Market

Internal operations platform for an Egyptian multi-channel reseller — inventory,
orders, cash, and profit across noon, Amazon, the Easy Orders website, and
social/manual sales.

**There is no application code in this repo right now.** It is being rebuilt.
What remains is the knowledge needed to build it properly.

## Start here

**[`docs/README.md`](docs/README.md)** — the brief, the business rules, the open
decisions, and the evidence about every external system.

Read it before writing code. The business facts in it were expensive to derive
and should not be re-derived; the open decisions in it must not be guessed.

## What's in the repo

| Path | What it is |
|---|---|
| `docs/` | The full brief — business, rules, open decisions, evidence |
| `docs/data/mega-products.json` | The real catalogue: 135 products with Arabic names, quantities and costs |
| `files/` | The raw legacy exports the catalogue came from |
| `docker-compose.yml` | Postgres 17 on port **5433** — matches `DATABASE_URL` in `.env` |
| `.env` | Real credentials (Bosta, Easy Orders, database). Not in git — kept locally. |

## Previous versions

Full working implementations are preserved as git tags. Nothing was deleted from
history.

| Tag | What it holds |
|---|---|
| `legacy-v1` | Complete system: NestJS API + Next.js web, noon settlement import, Bosta tracking, Easy Orders webhook, inventory, orders, cash ledger |
| `pre-reset` | The build before that |

```bash
git show legacy-v1 --stat     # what was in it
git checkout legacy-v1        # look around (detached HEAD)
git checkout main             # come back
```

Both were rejected wholesale — `legacy-v1` on UI/UX and backend structure. Treat
them as reference for *what the integrations proved*, never as precedent for how
to build. The facts worth keeping are already in `docs/`.

## Database

`docker compose up -d` starts Postgres on 5433.

⚠️ **The existing volume still contains the previous build's schema and real
data** — 135 products, four months of imported noon settlements, and real
orders. It was deliberately not destroyed. A fresh build should either use a new
database name or drop the old schema explicitly — decide it, don't collide with
it by accident.
