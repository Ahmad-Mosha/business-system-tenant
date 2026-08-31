# Prime Market — documentation

Everything a build needs to know about **the business** and **the systems it
connects to**. There is deliberately nothing here about how any previous
version was implemented — the code is being rebuilt from scratch, and none of
the prior structure should be treated as precedent.

What is here is the expensive part: facts about the business that came from the
owner, and facts about noon / Bosta / Easy Orders / the legacy Mega system that
were derived from real data and real API calls. Re-deriving any of it costs
hours.

## Read in this order

| # | File | What it gives you |
|---|---|---|
| 1 | [BRIEF.md](BRIEF.md) | What Prime Market is, who works in it, what actually hurts today |
| 2 | [business-rules.md](business-rules.md) | The rules the system must obey, marked confirmed vs. open |
| 3 | [open-decisions.md](open-decisions.md) | What must be decided before or during the build — do not guess these |
| 4 | [evidence/](evidence/) | Hard facts about each external system, with the data behind them |
| 5 | [business-answers-ar.md](business-answers-ar.md) | The owner's own answers, verbatim, in Arabic — source of truth |

## Data

| File | What it is |
|---|---|
| [data/mega-products.json](data/mega-products.json) | **The real product catalogue** — 135 products, Arabic names, quantities, unit costs. See [evidence/mega-inventory.md](evidence/mega-inventory.md) before using it. |
| `files/*.xlsx` (repo root) | The raw Mega exports the JSON came from. They are **screenshots**, not spreadsheets — see the same doc. |

## Evidence

| File | Covers |
|---|---|
| [evidence/noon-settlement-report.md](evidence/noon-settlement-report.md) | What the noon CSVs contain and don't, reconciled against noon's own portal |
| [evidence/channel-identifiers.md](evidence/channel-identifiers.md) | How each sales channel identifies a product — the constraint that shapes the catalogue |
| [evidence/integrations.md](evidence/integrations.md) | Bosta, Easy Orders, noon: live status, credentials, and the traps |
| [evidence/mega-inventory.md](evidence/mega-inventory.md) | Where the 135 products came from and how accurate they are |

## Ground rules for whoever builds this

1. **Inventory and product identity come first.** The previous attempt started
   the order cycle before the catalogue existed, and everything downstream had
   to be corrected. Orders, money, and analytics all reference products — build
   the thing being referenced first.
2. **Never invent a business rule.** If it is not in these docs, it is not
   decided. [open-decisions.md](open-decisions.md) lists the known gaps; ask,
   don't assume. This applies especially to accounting (costing method, profit
   definitions).
3. **Anything touching stock or money must be traceable.** The owner's core
   need is trusting the numbers — every movement should be explainable after
   the fact.
4. **Imports and webhooks must be safe to repeat.** Reports overlap and
   webhooks redeliver. Processing the same data twice must not double-count.
5. **Selling price is never a product attribute.** It comes from the order,
   because it differs per channel. Cost belongs to the product; price does not.
6. **Keep product names in Arabic**, exactly as the business writes them.
7. **Multi-tenant readiness in the architecture, but no SaaS features now.**
   The single priority is Prime Market working properly.

## How the owner works

- Architecture and approach agreed **before** code.
- Small commits, one-line messages, pushed every step — never batched.
- Claims backed by real evidence: query the real database, call the real API.
  "Should work" is not verification.
- Short, direct answers. No essays.
- UI: monochrome, semantic colour only (success / warning / destructive). No
  brand colours, no decorative hues.
- **UI/UX is a first-class part of this project, not a skin.** The previous
  version was rejected on design: oversized forms, excessive scrolling, poor
  density, weak organisation. Design direction should be settled before
  screens get built on top of it.
