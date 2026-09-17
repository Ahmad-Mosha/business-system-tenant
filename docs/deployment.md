# Deployment

The API needs a **fixed public HTTPS address**. Easy Orders can only deliver
webhooks to one, and the throwaway tunnel previously registered in their
dashboard is dead. Every session spent re-establishing a tunnel is effort spent
against a problem that a deployment solves permanently.

## Where

**Oracle Cloud Always Free** was the original recommendation — free with no
expiry, 2 OCPU / 12 GB of ARM Ampere. Still true, and still the better option
if signup succeeds in your region.

**AWS EC2 is running this instead**, deliberately, as of 2026-08-31. Worth
knowing: the 12-month free tier only applies to accounts opened before 15 July
2025 — a newer account gets temporary credits that run out and then bill. If
that turns out to matter, Oracle or Google Cloud's `e2-micro` (always free, but
1 GB RAM is tight) are the fallbacks.

Everything below is stack-agnostic — the same Docker Compose file runs on any
of the three.

## What actually exists to deploy

| Service | Built from | Talks to |
|---|---|---|
| `api` | `apps/api/Dockerfile` — NestJS, `npm run build` | the database in `DATABASE_URL` (Neon) |
| `web` | `apps/web/Dockerfile` — Next.js standalone output | `api` over the compose network, never from the browser |
| `caddy` | reverse proxy, automatic HTTPS | `api` and `web` |
| `db` | `postgres:17-alpine` | — **not used by `api` any more**; kept running as a rollback copy of the pre-Neon data |

Nothing is exposed to the host except Caddy on 80/443 — `api` and `web` are
only reachable from inside the compose network, by service name.

**Database:** managed Postgres on **Neon** (separate Prod and Dev projects),
set as a full connection string in `DATABASE_URL`. `docker-compose.prod.yml`
passes it through unchanged. Use Neon's **direct** endpoint (hostname without
`-pooler`) with `sslmode=require` — the pooled endpoint has no default
`search_path` and rejects the startup option that would set one, which breaks
this app's raw SQL.

**Schema:** TypeORM migrations in `apps/api/src/database/migrations/`, applied
automatically on API boot (`migrationsRun: true`) — still no separate migrate
command at deploy time. To add one, change the entity, then generate against a
database that has the current schema:
```bash
DATABASE_URL=... npm run migration:generate -w @prime/api -- src/database/migrations/DescribeTheChange
```
Review the generated SQL before committing — this is a money schema.

`order_number_seq` is migration-owned and synchronized forward to the highest
existing `PM-<number>` whenever its integrity migration first runs. Order
numbers have a database unique index. A restored database therefore cannot
restart at `PM-1000` or create a duplicate human-facing number.

**Auth:** the two named accounts (`admin@admin.com`, `moderator@moderator.com`)
seed themselves on first boot into an empty user table. Their passwords come
from `ADMIN_SEED_PASSWORD` / `MODERATOR_SEED_PASSWORD`. An empty production
database refuses to boot unless both are at least 12 characters and differ
from the known development defaults. `JWT_SECRET` is always required in
production and must contain at least 32 characters. These checks stop the API
instead of allowing an insecure fallback. Seed passwords are only read while
the user table is empty; changing them does not reset existing accounts.

## How

```bash
git clone <repo> && cd dashboard
cp .env.prod.example .env   # fill in every value — see the file for what each is
docker compose -f docker-compose.prod.yml up -d --build
```

That's the whole deploy. No separate migrate command, no manual seed step —
both happen automatically on the API's boot.

**Updating the live box** (no CI/CD — nothing deploys on merge):
```bash
ssh -i ~/Downloads/prime-key.pem ec2-user@prime-market.duckdns.org
cd ~/dashboard && git pull && docker compose -f docker-compose.prod.yml up -d --build api web
```

Before any release containing a database migration, create a fresh custom-format
backup from the direct Neon connection and verify that PostgreSQL can read its
catalog. Keep the backup outside the server being updated:

```bash
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" > prime-market-before-deploy.dump
pg_restore --list prime-market-before-deploy.dump > /dev/null
```

For the order-number integrity migration, run this read-only preflight first. It
must return no rows; if it finds a duplicate, stop and reconcile it explicitly.
The migration itself raises an error and rolls back without changing any order:

```sql
SELECT order_number, count(*)
FROM customer_order
GROUP BY order_number
HAVING count(*) > 1;
```
Rebuild `api` and `web` together — they're developed as a pair on `main`, and
an old web against a new API (or the reverse) is an untested combination. A
t3.micro takes several minutes to build.

SSH is restricted to one IP in the security group. If it times out, the IP has
changed: EC2 → the instance → Security → the security group → Edit inbound
rules → port 22 source → **My IP** → Save.

Point the domain's A record at the instance **before** bringing the stack up —
Caddy requests the certificate on first boot and fails the ACME challenge
otherwise. Ports 80 and 443 need to be open both in the cloud provider's
security group/firewall *and* the instance's own firewall if it ships with one
enabled (Oracle images do, by default, which is the usual reason a
security-group-correct setup still times out).

**The webhook URL** is `https://<domain>/api/integrations/easyorders/webhook`
— Caddy proxies everything under `/api/*` straight to the API, path intact
(see `Caddyfile`), so any new API route reachable from outside needs no change
here.

## On AWS EC2, concretely

The wizard fields, for a `t3.micro` (free-tier, 1 GiB RAM):

| Field | Value |
|---|---|
| AMI | Amazon Linux 2023, 64-bit (x86) |
| Instance type | `t3.micro` |
| Key pair | create one, download the `.pem`, `chmod 400` it locally |
| Security group — SSH | source **My IP**, not Anywhere — the console's own warning is right |
| Security group — HTTP / HTTPS | both checked, source Anywhere — Caddy needs 80 for the ACME challenge and 443 to serve |
| Storage | **20 GiB** gp3, not the 8 GiB default — free tier covers up to 30 GB, and 8 is tight once Docker images, the Postgres volume and logs share it |
| Advanced details → User data | paste `deploy/ec2-user-data.sh` — installs Docker, the compose plugin, and a 2 GB swapfile (1 GiB of real RAM is not enough to build three services without one) |
| Advanced details → Termination protection | enable — this is the production box |

## The domain

Any registrar works. For a free option, DuckDNS plus Caddy's automatic HTTPS
gets a real Let's Encrypt certificate on a `*.duckdns.org` subdomain — enough
for Easy Orders to deliver to.

Once the domain is live, register both Easy Orders webhooks (order created +
order status update) against that URL, then copy the secret Easy Orders
generates into `EASYORDERS_WEBHOOK_SECRET` on the box and `up -d api`. Full
procedure: [evidence/integrations.md](evidence/integrations.md) → Easy Orders.
