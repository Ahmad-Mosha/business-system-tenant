# Production readiness — 2026-09-17

This is the active implementation checklist. `handoff.md` describes the deployed
baseline; older architecture proposals are not the implementation.

## Current business decisions

- Manual/social and Easy Orders business profit is selling amount minus shipping.
  Keep this business measure distinct from accounting gross margin and cash.
- Amazon/noon supply their own financial figures. Deeper integrations are deferred.
- Expenses need explicit records and categories that owners can create during entry.
- Purchase shipping, customs and other extra costs belong in landed stock cost.
  Support by-value and per-unit allocation; retain the existing AVCO policy.
- Own warehouse and noon warehouse must have separate balances and traceable transfers.
- A return records its reason and condition. Only sellable received goods re-enter
  available stock. Financial reversal and actual cash refund are distinct events.

## Prioritized work and evidence

1. **Transaction integrity — implemented.** Serialize order edits, assignments,
   payments, status changes, invoice posting/deletion, supplier payments, cheque
   settlement and ledger reversals. All order stock writers use ordered variant
   locks shared with purchases and stock adjustments. Aggregate repeated order
   lines before checking availability; reactivation must check availability too.
   Paid/refunded order totals cannot change until payment is reversed.
2. **Returns and refunds — implemented.** Full received returns require a reason
   and explicit sellability decision. Returns add a RETURN movement; unsellable
   receipts add an equal DAMAGE movement, preserving available stock. Paid
   cancellation/return reverses sales into CUSTOMER_REFUNDS, keeping cash until
   REFUND_DUE → REFUNDED. Received returns cannot reopen; dispatched orders cannot
   be cancelled and only admins cancel. Partial returns/refunds remain future work.
   Existing historical returns are not silently recosted or refunded.
3. **Inventory locations — implemented.** Movements carry WAREHOUSE or NOON;
   transfers are atomic, conserved pairs. Manual sales/availability use WAREHOUSE.
   Inventory shows both balances; adjustments select a location; history shows
   location balances. Old pooled movements remain WAREHOUSE: reconcile actual
   noon stock explicitly, because old data cannot establish its location.
   Multi-variant inventory valuation now sums each variant's actual cost.
   Archiving cannot hide remaining stock, open orders, channel listings or draft
   purchases. Inactive variants reject new operational writes; a later sellable
   customer return reactivates its product so restored stock remains visible.
4. **Purchasing — implemented.** By-value/per-unit landed costs are exposed with
   a live estimate. Largest-remainder allocation conserves every cent without
   negative shares; AVCO and movement costs retain 4 decimals. Costs paid separately
   credit CASH and count as settled, so supplier debt includes only what is owed.
   Supplier creation works inline even with no existing suppliers. Create-and-post
   is one database transaction; failed posting cannot leave duplicate hidden drafts.
   Manual cost corrections are locked, require a reason, create an audit
   movement, and post a balanced inventory revaluation. Generic stock changes
   cannot be labelled as purchases; bought stock goes through purchase invoices.
5. **Expenses — implemented.** Dedicated paid-expense records with inline custom
   categories, date/category/search filters, a ledger link and reasoned voids.
   Requests are idempotent and voids retain/reverse the original. Categories are
   independent of accounting accounts; purchases stay in landed cost, not expenses.
6. **Business profit — implemented.** Paid manual/social and Easy Orders snapshot
   their order shipping on the sale ledger entry. The dashboard reports selling
   amount minus that shipping and returns/reversals carry the original snapshot,
   so later order edits cannot change history. Operating expenses stay separate.
   Legacy entries with no shipping snapshot are excluded and counted for explicit
   reconciliation rather than assigned a guessed value. Cairo dates drive buckets.
7. **Daily operations UX — bulk assignment implemented.** Admins can select all
   visible orders or individual rows, then assign or unassign them together.
   Selection resets when the filter or page changes, so hidden orders are never
   included. The server validates the full set and active moderator before one
   atomic write and records an audit event for each changed order. Assignee
   filtering, feedback, Arabic RTL and English were checked at desktop widths.
8. **Production auth bootstrap — implemented.** Production startup requires a
   session signing secret of at least 32 characters. A new empty production
   database requires explicit initial admin and moderator passwords of at least
   12 characters and rejects the known development defaults. Account seeding is
   serialized across API processes; existing user databases do not depend on
   seed-password environment variables. Local development retains its defaults.
9. **Order-number integrity — implemented.** The sequence is owned by a
   transactional migration and advances to at least the highest existing
   `PM-<number>` after a restore. A database unique index prevents duplicates
   across manual and Easy Orders ingestion. Existing orders are never rewritten;
   a historical duplicate aborts and rolls back the migration for reconciliation.
10. **Easy Orders ingestion integrity — implemented.** Raw deliveries are stored
    first and serialized per external order. Concurrent identical or changed
    redeliveries process once; failed fingerprints remain retryable. Statuses
    arriving before their order fail visibly for retry. Quantities, dates and
    amounts are validated before writes, and late paid events cannot replace a
    return/refund payment state.
11. **Pagination integrity — implemented.** Orders and ledger entries preserve
    their filtered totals when an old URL points beyond the last page. All
    paginated operation screens return the user to the final valid page instead
    of showing a false empty state or an invalid item range.
12. **Shipment access — implemented.** Admins can inspect the full Bosta account
    board. Moderators receive only tracking records linked to their assigned
    orders, and direct live-refresh requests enforce the same boundary without
    revealing whether another customer's tracking number exists.

Further audit findings to resolve as the associated flow is changed:
- Bosta collection reconciliation and historical marketplace stock posting remain
  deferred; delivery must never imply cash received.

## Verification

`npm test`, `npm test -w @prime/web`, `npm run typecheck`, both workspace builds,
and web lint. Database concurrency tests run only with `TEST_DATABASE_URL` pointing
at a disposable **local** database whose name ends in `_test`; they never use the
application's `DATABASE_URL`. Run the API tests with that environment variable to
exercise migrations and actual row locks. Fixtures are retained only in that
isolated test database.
