# Commerce Operations Platform

An operations system for a multi-channel retail business: orders, catalog, inventory,
marketplace reconciliation and the financial picture behind them.

Built one vertical slice at a time. See [`docs/architecture.md`](docs/architecture.md) for
what exists today and [`docs/discovery/`](docs/discovery/) for the analysis behind the
design decisions.

## Running it locally

Requires Node 20+, pnpm 10, and Docker.

```bash
cp .env.example .env      # then fill in the SEED_* values
pnpm install
pnpm db:up                # starts Postgres on port 5433
pnpm db:migrate
pnpm db:seed
pnpm dev                  # API on :4000, web on :3000
```

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Tests run against a separate `commerce_ops_test` database and truncate it freely.

## Secrets

Never commit `.env`. Configuration is validated at boot: a missing or malformed value
stops the process rather than starting a half-configured server.
