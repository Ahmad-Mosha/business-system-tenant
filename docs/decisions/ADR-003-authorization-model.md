# ADR-003: Permissions as data, with a separate row scope

**Status:** Accepted · 2026-08-18

## Context

Two roles exist today (Admin, Moderator) and more will be invented. The requirement is
not "support two roles" but "add a role without auditing the whole codebase, and never
leak financial data to the wrong person".

## Decision

Permission-based access control, enforced in the application layer, with **scope modelled
separately from action**.

- `permission` = `resource:action`, a **row in the database**, not a code branch.
- `role` = a named bundle of permissions. Admin and Moderator are seed data.
- **scope** answers *which rows*: `ALL` or `ASSIGNED`. It lives on the grant, so the
  same permission means different reach for different roles.
- When two roles grant the same permission, the broader scope wins.

Rejected: role checks in controllers (`if (user.role === 'admin')`), which scatter
authorization across the codebase; and a full policy engine, which has real operational
cost and no requirement yet justifying it.

## The part that matters

**Scope is applied as a `WHERE` clause, resolved next to the query it constrains** - not
by filtering rows after loading them. A moderator's request cannot pull another
moderator's orders into memory even briefly.

`AuthContext.requireScope()` throws when the permission is absent rather than returning
a default. A guard has already checked, but the service asking again is the safety net
that lives beside the query. Defaulting here would silently widen access the first time
a route was wired up wrong.

Every route is private unless marked `@Public`, so a forgotten decorator fails closed.

The UI receives the user's grants and renders accordingly. That is ergonomics. The API
re-checks on every request; that is the access decision.

## Rate limiting, and a mistake worth recording

Credential endpoints are throttled on **IP and email together**.

The first implementation applied a global per-IP limit to every route. Running the app
exposed the flaw immediately: server-rendered pages reach the API from the web server's
address, so every user shared one bucket and normal browsing exhausted it. Worse, in
production one busy client could have denied service to everyone.

Keying on email alone is also wrong - an attacker could lock a known account out of its
own login by deliberately failing against it. IP and email together bound both a
brute-force run against one account and a burst from one source, without either denying
service to somebody else. Verified: eleven failed attempts against one address are
blocked while a different address signs in normally.

## What would change it

Per-customer or per-supplier delegated access, or genuinely attribute-based rules -
then a policy engine behind the same `AuthContext` interface.
