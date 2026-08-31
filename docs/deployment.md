# Deployment

The API needs a **fixed public HTTPS address**. Easy Orders can only deliver
webhooks to one, and the throwaway tunnel currently registered in their
dashboard is dead. Every session spent re-establishing a tunnel is effort spent
against a problem that a deployment solves permanently.

## Where

**Oracle Cloud Always Free.** Free with no expiry, runs Docker natively, and
after the June 2026 reduction still gives 2 OCPU / 12 GB of ARM Ampere — far
more than this needs.

Two things to know before signing up:

- **Idle instances are reclaimed.** Oracle evaluates Always Free compute over a
  rolling 7-day window and can take back an instance that looks idle. Adding a
  card and switching the account to Pay As You Go stops the reclaim and still
  costs nothing inside the free limits.
- **Signup approval is regionally unreliable.** If the account is refused,
  Google Cloud's always-free `e2-micro` is the fallback, though 1 GB of RAM is
  tight with Postgres alongside the API.

**AWS EC2 is not a free option here.** The 12-month free tier only applies to
accounts opened before 15 July 2025; newer accounts get credits that run out and
then bill.

Everything is ARM-compatible — Postgres, Node and Caddy all publish arm64
images.

## How

```bash
git clone <repo> && cd dashboard
export DOMAIN=prime.example.com POSTGRES_PASSWORD=... JWT_SECRET=$(openssl rand -hex 32)
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec api node dist/db/migrate.js
```

Caddy gets and renews the certificate on its own — point the domain's A record
at the instance first, and open ports 80 and 443 in the Oracle security list
*and* in the instance firewall (Oracle images ship with iptables closed, which
is the usual reason a correct setup still times out).

## The domain

Any registrar works. For a free option, DuckDNS plus Caddy's DNS challenge gets
a real Let's Encrypt certificate on a `*.duckdns.org` subdomain — enough for
Easy Orders to deliver to.

Once the domain is live, the Easy Orders dashboard needs two things: the webhook
URL re-pointed at it, and the **order status update** webhook registered
alongside the existing order-created one. Without the second, payment status on
website orders goes stale silently.
