# ADR-004: Provider adapters and the ingestion boundary

**Status:** Accepted · 2026-08-18 · **Not yet implemented** - recorded before building
so the first adapter does not set an accidental precedent.

## Context

Orders will arrive from EasyOrders, Amazon and noon; shipments from Bosta; financial
data as API responses and as files. Each provider has its own identifiers, statuses,
payload shapes and failure modes. The requirement is that the domain never learns which
provider a record came from, or by what transport.

## Decision

### The canonical unit is a typed business document, not a row or a file

Every source maps onto a small closed set: `SalesDocument`, `CreditNote`, `FeeDocument`,
`PayoutStatement`, `OrderEvent`, `StockSnapshot`. An adapter's only job is
`source → one or more of these`.

This came out of analysing real noon exports: a single file contained sales invoices,
credit notes and fee invoices mixed together, distinguishable only by three columns. A
generic "row importer" would have pushed that mess into the domain. A per-file schema
would have been the wrong abstraction in the other direction.

### Webhook is a trigger; the API is the authoritative state

```
verify secret (constant-time) → persist raw inbound event → return 200 immediately
  → queue → fetch authoritative record → map → resolve → upsert idempotently → audit
```

Re-fetching rather than trusting the delivered payload defends against replay and
forgery, yields current rather than emitted state, and gives webhook-driven and
sweep-driven ingestion one code path.

EasyOrders authenticates webhooks with a **shared secret in a header, not an HMAC
signature**. It proves only that the caller knows a token: no payload integrity, no
replay protection. That is precisely why the payload is treated as a trigger.

### Never trust webhooks alone

Every webhook-driven source also runs a scheduled sweep that re-pulls a recent window
and reports anything the provider has that we do not. Webhooks get lost, arrive out of
order, and get silently disabled. EasyOrders does not document its retry behaviour at
all, so at-least-once cannot be assumed.

### Unknown values fail into a work queue

An unrecognised status, an unmapped SKU, an uncategorisable fee line: none may be
guessed, defaulted, or dropped. Each becomes a typed item for a human. This is the rule
that separates "automated" from "quietly wrong".

### Idempotency keys are in the schema, not in service code

`orders (organization_id, source, external_id)` is already a unique index. A duplicate
delivery is rejected by the database, not by a check somebody might forget to write.

## Trade-off accepted

Re-fetching costs an extra API call per event. At tens of orders a day against a
40 requests/minute limit, that is irrelevant, and it buys correctness that the shared
secret cannot provide.
