# Production readiness — 2026-09-16

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
4. **Purchasing — implemented.** By-value/per-unit landed costs are exposed with
   a live estimate. Largest-remainder allocation conserves every cent without
   negative shares; AVCO and movement costs retain 4 decimals. Costs paid separately
   credit CASH and count as settled, so supplier debt includes only what is owed.
   Supplier creation works inline even with no existing suppliers. Create-and-post
   is one database transaction; failed posting cannot leave duplicate hidden drafts.
   Manual cost corrections are locked and create an audit movement.
5. **Expenses and business profit.** Fixed voucher accounts are not custom expense
   categories. Replace the obsolete COGS gate with the confirmed business measure,
   with clear channel scope and no double-counted shipping.
6. **Daily operations UX.** Bulk assignment with visible-page selection, clear
   selection scope, authorization and atomic server writes. Check English/Arabic,
   normal laptop and wide desktop layouts, states and feedback.

Further audit findings to resolve as the associated flow is changed:
- Easy Orders failed delivery fingerprints currently prevent automatic retry;
  concurrent deliveries can hit uniqueness errors. Late paid notifications can
  overwrite a refund. Validate payload quantities and amounts.
- Order numbers are generated from a runtime-created sequence without a unique
  constraint; restored databases can start below existing numbers.
- Product cost edits bypass valuation history. Stock removal reasons allow
  inconsistent direction; manual purchase uses the old average as receipt cost.
- Several list totals rely on a window count and show zero on an empty later page.
- Bosta collection reconciliation and historical marketplace stock posting remain
  deferred; delivery must never imply cash received.

## Verification

`npm test`, `npm test -w @prime/web`, `npm run typecheck`, both workspace builds,
and web lint. Database concurrency tests run only with `TEST_DATABASE_URL` pointing
at a disposable **local** database whose name ends in `_test`; they never use the
application's `DATABASE_URL`. Run the API tests with that environment variable to
exercise migrations and actual row locks. Fixtures are retained only in that
isolated test database.
