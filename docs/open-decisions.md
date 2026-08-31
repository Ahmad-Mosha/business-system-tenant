# Open decisions

Questions that are **not answered** and must not be guessed. Each one changes
the data model or the numbers the business will act on.

Ordered by what blocks what. Anything in Tier 1 should be settled with the
owner before the corresponding code is written.

---

## Tier 1 — blocks the foundation

### 1. Costing method
When the same product is bought at different costs across shipments, what is
the cost of a unit when it sells?

- Weighted average cost
- FIFO
- Per-batch / per-lot cost

**Blocks:** stock value, gross profit, every profit figure, and the shape of
the stock ledger (per-batch costing requires batches to be modelled from the
start; average cost does not).

**Known:** cost genuinely varies between purchases. The product stays one
product. The owner has said this is a decision to be made deliberately, not
assumed.

### 2. Landed cost allocation
Shipping, customs and clearance must reach the unit cost. Allocated how?

- Evenly per unit
- Proportionally by value
- By weight
- Another rule

**Owner's example:** 100 pieces, 5,000 EGP shipping.

**Blocks:** the same things as #1, plus the shape of the goods-receipt flow.

### 3. Stock locations
Own warehouse and noon's warehouse are confirmed to be different places. Is
stock tracked per location from the start?

- Does every movement carry a location?
- Is moving goods to noon its own transfer event?
- Which location does a noon sale deplete?

**Blocks:** the stock ledger's shape. Adding location later means rewriting
every stock query.

### 4. Order lifecycle
The state list has never been agreed. The owner's explicit instruction is to
**design it and review it with him before implementing**.

Needs to cover: the states themselves, which transitions are legal, which are
reversible, and how each of the five order sources enters the lifecycle.

**Blocks:** orders entirely. Getting this wrong is what broke the previous
attempt.

### 5. What event moves stock, per source
Confirmed for manual/social: stock leaves at order creation and dispatch.

Not confirmed for:
- noon — sale is only learned about later, from a settlement report
- Amazon — same problem, and no report has been seen yet
- Easy Orders — order arrives by webhook in real time

**The hard part:** a noon report describes sales that already happened, possibly
weeks ago, and possibly from noon's own stock. Replaying them naively against
current stock double-counts against any physical count taken since.

---

## Tier 2 — blocks money and analytics

### 6. Financial definitions
For **this** business, precisely:

- **Cash** — what counts? Money in hand only, or does it include what noon owes?
  (Evidence says noon's balance is a receivable, not cash — but the rule needs
  to be stated.)
- **Stock value** — at what cost basis, and does it include goods sitting at noon?
- **Gross profit** — revenue minus what, exactly? Cost of goods only, or also
  channel fees, shipping, ads?
- **Net profit** — minus which further costs?
- **Margin** — on which of the above?

**Blocks:** the entire financial section and all analytics. Numbers the owner
cannot trust are worse than no numbers.

### 7. Permitted manual financial transactions
Which money movements can a human enter directly, and which must only ever be
produced by a real event (a sale, a purchase, a payout)?

**Why it matters:** every manual entry is a hole in the audit trail. The set
should be as small as the business can tolerate.

### 8. Audit requirements
Does every financial and stock change need a recorded actor and timestamp,
retained indefinitely? Assume yes unless told otherwise — but confirm the
retention and visibility expectations.

---

## Tier 3 — needed before the relevant feature

### 9. Returns
- What condition makes a returned item resaleable vs. damaged?
- Who decides?
- What happens when a **paid** order is returned — refund, credit, what?
- Who bears the return shipping cost?

### 10. Duplicate product merge
Three noon products were found duplicated under different Partner SKUs, one
using an older `CCC-0014` convention. Are they genuinely the same item, or real
variants? This is a business answer, not a technical one, and it needs a merge
path either way.

### 11. Bosta ↔ order status mapping
Which Bosta shipment states map to which internal order states, and which are
merely informational?

### 12. Settlement ↔ order reconciliation
How a noon payout is matched back to the orders it pays for, given payouts lag
sales by about a week and arrive in batches. Must not assume delivery = paid.

### 13. Supplier and purchasing scope
Are suppliers, purchase invoices, and payment terms tracked in the system at
all, or is a purchase just a stock-in with a cost? Currently undefined.

### 14. Bundles and kits
Do they exist? If so, how is stock counted for a bundle whose components are
also sold individually?

### 15. Design as variant or attribute
Size and colour are confirmed variants. Design was mentioned but not
classified.

---

## Tier 4 — future, do not build now

### 16. Partner profit sharing
Three partners, each with a different percentage of profits. Confirmed as
coming, explicitly deferred. Depends entirely on the profit definitions in #6.

### 17. Minimum stock and reorder alerts
No thresholds exist today. Possible later once rules are defined.

### 18. Multi-tenancy boundaries
The architecture should be multi-tenant-ready, but the boundaries need naming:
what is isolated per tenant, whether channel credentials are per tenant, and
whether imported report files are retained per tenant as history.

SaaS and subscriptions are **not** Phase 1.

### 19. Amazon
Selling is live, but no reports have been supplied and no evidence has been
gathered. Ask for a real export before designing anything Amazon-specific — the
noon work shows how much the actual file format dictates.
