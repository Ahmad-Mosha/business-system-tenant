# Prime Market

Internal operations platform for an Egyptian multi-channel reseller — inventory,
orders, cash and profit across noon, Amazon, the Easy Orders website, and
social/manual sales.

**Read [`docs/`](docs/README.md) before writing code.** The business facts in it
were expensive to derive; the open decisions in it must not be guessed.

| | |
|---|---|
| What it is | [docs/BRIEF.md](docs/BRIEF.md) |
| How it is designed | [docs/architecture.md](docs/architecture.md) |
| What gets built, in what order | [docs/roadmap.md](docs/roadmap.md) |
| Interface direction | [docs/ui-ux.md](docs/ui-ux.md) |
| Deploying it | [docs/deployment.md](docs/deployment.md) |

## Running it

```bash
cp .env.example .env      # then fill in JWT_SECRET
npm install
npm run db:up             # Postgres 17 on 5434
npm run migrate
npm run seed              # creates the tenant and the first admin
npm run dev               # API on :3001, docs at /docs
```

Open **http://localhost:3001/docs**, log in through `POST /api/auth/login`, paste
the token into **Authorize**, and every endpoint is usable from that page.

## Layout

```
apps/api           NestJS API — the whole backend
  src/db           schema, migrations, tenant resolution
  src/auth         login, token, role guard
  drizzle/         migration SQL, applied in order
docs/              business, architecture, roadmap, evidence
```

## Two version notes

- **NestJS 12 is ESM-only.** The API is `"type": "module"` and relative imports
  carry a `.js` extension. This is not optional.
- **TypeScript is pinned to 6.** TypeScript 7.0 ships `tsc` without the
  programmatic compiler API the Nest CLI needs; the CLI refuses to start on it.
  It is expected back in 7.1 — upgrade then, not before.

## Database

`docker compose up -d` starts Postgres on **5434**.

The previous build's database is a separate volume (`dashboard_pgdata`) and is
left alone — it holds four months of imported noon settlements used to validate
the new import. A dump is kept outside the repo at
`../prime-market-legacy-dump.sql.gz`.

## Previous versions

| Tag | What it holds |
|---|---|
| `legacy-v1` | Complete previous system — NestJS + Next.js, noon import, Bosta, Easy Orders, inventory, orders, cash |
| `pre-reset` | The build before that |

Both were rejected wholesale, on UI/UX and backend structure. Reference for what
the integrations proved, never precedent for how to build.
