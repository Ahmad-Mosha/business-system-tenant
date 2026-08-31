# Business rules

Every rule below traces to the owner's own answers
([business-answers-ar.md](business-answers-ar.md)) or to verified data.

- **[Confirmed]** — stated by the business, or proven by real data. Build to it.
- **[Open]** — genuinely undecided. **Do not guess.** See
  [open-decisions.md](open-decisions.md).

---

## 1. Products

**[Confirmed] A product is one internal entity, identified by our own id.**
Channel identifiers are never the identity. The same product can sell on noon,
Amazon, Easy Orders and social at the same time, and each of those will call it
something different. The internal product is the thing all of them point at.
Evidence for why no external scheme can be reused:
[evidence/channel-identifiers.md](evidence/channel-identifiers.md).

**[Confirmed] A product carries a name and a category. Names stay in Arabic**,
exactly as the business writes them.

Categories are a fixed list of four:

| Category | Arabic |
|---|---|
| Cosmetics | مستحضرات تجميل |
| Home | منزلي |
| Electronics | إلكترونيات |
| TV Shop | تي في شوب |

Note: the real catalogue extracted from Mega only populates **Cosmetics (58)**
and **Home (77)**. Electronics and TV Shop are part of the business vocabulary
but have no products in the starting data.

**[Confirmed] Selling price is not a product attribute.** It differs per
channel and per order, so it belongs to the order line. A product has *cost*,
not *price*.

**[Confirmed] Sizes and colours exist, and each must hold its own stock.**
A product may have variants; each variant is counted separately, and one can run
out while another remains. Prices are roughly uniform across a product's
variants, and cost may differ.

**[Open]** Whether *design* is a variant or a plain attribute.
**[Open]** Bundles / kits — whether they exist and how they would be counted.

---

## 2. Inventory

**[Confirmed] Stock is counted in pieces.** No weight, no length, no
selling-by-carton.

**[Confirmed] There is more than one stock location.** The company's own
warehouse is primary. Goods are also sometimes stored **at noon**, and noon's
warehouse is explicitly *not* the same as ours. The system must be able to
answer not just "how many" but "how many, where".

**[Confirmed] Goods leave stock when the order is created and sent to
shipping.** There is no reserved / allocated state today — the owner was
explicit that "reserved stock" is not a concept in this business.

**[Confirmed] Cancelled and returned orders put stock back.** A reversal must
be recorded as its own event, not by editing the original.

**[Confirmed] Damage and loss happen and must be recorded.** Goods get broken
or go missing, and the system must capture that as a distinct kind of stock
movement.

**[Confirmed] Stock history must be traceable.** Any correction is a new
movement, never an edit of a past number. The owner's core problem is trusting
figures, which requires being able to ask "why is it this number?" and get an
answer.

**[Confirmed] Only Admin adjusts stock.** Moderators do not.

**[Confirmed] No expiry dates.** Products have no shelf life; no batch-expiry
tracking is needed.

**[Confirmed] No minimum-stock levels or reorder alerts today.** Possible later,
once rules exist. Do not invent thresholds.

**[Open]** Stock-take / physical count policy: frequency, scope, and what
happens when the count disagrees with the system.
**[Open]** What happens to damaged goods — discarded, returned to supplier, or
sold off.

---

## 3. Purchasing and cost

**[Confirmed] Goods are bought from the local market and imported from
abroad**, from multiple suppliers that change over time.

**[Confirmed] Receiving goods records quantity and purchase cost.**

**[Confirmed] Purchase cost varies between shipments** for the same product. It
remains **one product** — different cost does not create a new product.

**[Confirmed] Landed cost matters.** Costs beyond the goods themselves —
shipping, customs, clearance — must end up reflected in what a unit actually
cost. The owner's example: a shipment of 100 pieces with 5,000 EGP of shipping
needs that 5,000 fairly distributed across the goods.

**[Open] — the single most consequential accounting decision.** How unit cost is
computed when purchase costs differ: weighted average, FIFO, or per-batch cost.
**[Open]** How landed costs are allocated: per unit, by value, by weight, or
another rule.

Both are required before profit can be calculated at all, and both are
explicitly the business's call, not a technical default.

**[Open]** Supplier records, purchase invoices, payment terms, returns to
supplier, and supplier-direct-to-customer shipping. None are defined.

---

## 4. Orders

**[Confirmed] Orders arrive from five sources**: noon, Amazon, the Easy Orders
website, social media, and manual entry.

**[Confirmed] Marketplace orders are never keyed in one by one.** noon and
Amazon data enters by report import or API, and must automatically map to the
internal product, move stock, record the sale, and update the financials.

**[Confirmed] Social media orders are created manually by a moderator**, and
are assigned to whoever created them. This replaces today's Google Sheets.

**[Confirmed] An order can end by being cancelled or returned, and that must
flow through to both stock and money.**

**[Confirmed] Only Admin can cancel an order.**

**[Confirmed] Moderators see only their assigned orders.** This must be
enforced server-side, in the query — not merely hidden in the interface.

**[Open] The order lifecycle itself.** The state list has never been agreed.
The owner's instruction is to **design the lifecycle and review it with him
before implementing it**. The failure to fix this early is what broke the
previous attempt.

**[Open]** Order confirmation flow, unreachable customers, when an order is
considered dead, common cancellation reasons, and whether/how an order may be
edited after creation.

---

## 5. Shipping and collection

**[Confirmed] Bosta is the only courier.** Integration exists and works — see
[evidence/integrations.md](evidence/integrations.md). "FlexShip" is a Bosta
feature, not a second courier.

**[Confirmed] The system records the shipment tracking number.**

**[Confirmed] Moderators track shipping status for their own orders** so they
can talk to customers.

**[Confirmed] A refused delivery returns the goods to stock.**

**[Confirmed, load-bearing] Delivery and payment are two different events.**
An order can be delivered and still not paid — this is the normal COD case, and
it has been observed in real Bosta data. Never model "delivered" as implying
"money received". Cash arrives later, via settlement, and must be reconciled
separately.

**[Open]** When exactly an order is handed to Bosta, what happens when a
shipment is delayed, and the operational detail of reconciling Bosta's
transfers against orders.

---

## 6. Returns

**[Confirmed] Returned goods come back into stock**, subject to their
condition.

**[Confirmed] The reason for a return must be recorded.** Return rate and
reasons are currently unknown — the owner wants the system to start collecting
them so they can be analysed.

**[Open]** Who decides whether a returned item is resaleable, what makes it
damaged instead, what happens when a paid order is returned, and who bears
return shipping.

---

## 7. Money

**[Confirmed] The system needs a financial section** covering, at minimum:
cash, stock value, and the effect of sales, purchases and other operations on
both.

**[Confirmed] Cash can be added and reduced manually** — the owner can inject
funds or record money going out.

**[Confirmed] Buying stock converts cash into inventory.** Cash decreases, stock
value increases.

**[Confirmed] Money arriving is its own event**, separate from delivery (see
§5).

**[Confirmed] noon's closing balance is a receivable, not cash.** It is money
noon owes, not money in hand. noon holds roughly one to two weeks of proceeds
and pays out about a week in arrears. Treating that balance as cash overstates
the business's position. See
[evidence/noon-settlement-report.md](evidence/noon-settlement-report.md).

**[Confirmed] Tax is out of scope.** An external accountant handles it with the
owner. It is not part of daily operations or moderator work.

**[Confirmed] There are no fixed monthly overheads today** (no rent, utilities
or similar). Salaries may become an expense later as the team grows. Do not
model overheads speculatively.

**[Open]** The exact definitions, for this business, of **cash**, **stock
value**, **gross profit**, **net profit**, and **margin** — including which
costs belong in which. Analytics cannot be trusted until these are pinned down.
**[Open]** Which manual financial transaction types are permitted.
**[Open]** Whether a bank account is tracked in the system at all.

---

## 8. Roles and permissions

| Capability | Admin | Moderator |
|---|---|---|
| See all orders | ✅ | ❌ — only orders assigned to them |
| Create a manual (social) order | ✅ | ✅ — auto-assigned to them |
| Track shipping on their orders | ✅ | ✅ |
| Cancel an order | ✅ | ❌ |
| See money, profit, financials | ✅ | ❌ |
| Adjust stock | ✅ | ❌ |

**[Open]** Who may change prices. Detailed permissions on individual inventory
operations still need to be pinned down.

---

## 9. Analytics

**[Confirmed] Analytics is the final layer, but the data model must support it
from day one.** It must never be built on hard-coded numbers — only on real
recorded events.

The questions it has to answer: what sells, on which channel, what makes money,
what loses money, what gets returned, and where the operational problems are.

Blocked until the profit definitions in §7 are settled.
