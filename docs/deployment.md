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

Three services, one Postgres:

| Service | Built from | Talks to |
|---|---|---|
| `api` | `apps/api/Dockerfile` — NestJS, `npm run build` | `db` over the compose network |
| `web` | `apps/web/Dockerfile` — Next.js standalone output | `api` over the compose network, never from the browser |
| `db` | `postgres:17-alpine` | — |
| `caddy` | reverse proxy, automatic HTTPS | `api` and `web` |

Nothing is exposed to the host except Caddy on 80/443 — `api` and `web` are
only reachable from inside the compose network, by service name.

**Schema:** the API runs with TypeORM's `synchronize: true` — the schema
applies itself on boot, there is no separate migration step to run. (A
deliberate simplification while the schema is still moving; see the comment
next to it in `app.module.ts` if this needs revisiting once real data has
accumulated.)

**Auth:** the two named accounts (`admin@admin.com`, `moderator@moderator.com`)
seed themselves on first boot into an empty user table. Their passwords come
from `ADMIN_SEED_PASSWORD` / `MODERATOR_SEED_PASSWORD` — **set real values in
production**, or the known dev defaults (`admin123`, `moderator123`) go live
on the public internet. The API logs an error on boot if it's missing.

## How

```bash
git clone <repo> && cd dashboard
cp .env.prod.example .env   # fill in every value — see the file for what each is
docker compose -f docker-compose.prod.yml up -d --build
```

That's the whole deploy. No separate migrate command, no manual seed step —
both happen automatically on the API's first boot.

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
