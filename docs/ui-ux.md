# UI/UX direction

The reference in [`ui-ux/`](../ui-ux) is a **starting direction, not a
specification**. It is AI-generated, its data is invented, and several of its
screens show features this business does not have. What follows is what gets
kept, what gets dropped, and what the reference is missing.

The design system is settled **once, before the first screen**. Every screen
after that is assembled from it.

---

## What the reference gets right — keep

**Master-detail, not page navigation.** The inventory screen is the strongest
thing in the folder: a dense list on the left, a detail panel on the right, no
page load and no lost filters. This becomes the pattern for the whole
application — inventory, orders, shipments, settlements. It is the direct fix
for the previous build's rejected "excessive scrolling".

**A filter bar above the table, not a form beside it.** Channel, location,
stock level as inline dropdowns that show their current value in the control
itself.

**Structure over containers.** Weight and tonal shift define sections instead
of nested boxes. The reference calls this avoiding "container fatigue" and it
is correct.

**Status as a chip with a border, not a coloured pill.** Subtle tinted fill,
1px border, uppercase label. Readable at a glance, quiet in bulk.

**Right-aligned figures, monospaced.** Money and counts in tabular figures so
columns line up. Non-negotiable in a system whose whole job is numbers.

---

## What gets dropped

| In the reference | Why it goes |
|---|---|
| Product photo / media panel | There are no product images in this business, and none are planned |
| "Reserved / Pending" stock | Reserved stock is confirmed **not** a concept here — stock leaves on dispatch |
| "Sync with Bosta", "Sync Inventory" buttons | noon has no API — it is a CSV upload. Amazon is unknown. A sync button that cannot sync is a lie in the interface |
| "Fulfillment Target 84%", "Critical Pulse" | Invented metrics with no definition in this business |
| `$` amounts, DXB/AUH/KSA locations, "Warehouse B" | Egyptian business, EGP, one warehouse plus noon |
| Coloured channel logo circles | Decorative. Channel is a text label with a monochrome mark |
| Full-page "Manual Order Entry" | Oversized inputs, three stacked sections, heavy scrolling — the exact complaint about the previous build |

---

## What the reference is missing

These are required workflows with no screen in the folder:

1. **The unmapped queue.** Every import produces rows that match no product —
   8 to 78 per real noon file. They need a screen where a human maps them, and
   an import is not "done" until it has been looked at.
2. **Statement reconciliation.** Our figures next to noon's own Account
   Summary, with the difference shown. This is the screen that replaces 8 hours
   a day.
3. **Movement history.** Every number must open to the events that produced it.
   The reference shows totals with no way in.
4. **Delivered-but-unpaid.** Fulfilment and payment are separate axes and the
   interface has to show both without implying one from the other.

---

## Design system (since the 2026-09 redesign)

Built on **shadcn/ui, style `radix-lyra`** — preset `b6XGy1Otr6`: neutral base,
teal theme, radius 0, Lucide icons, bold menu accent. Components live in
`apps/web/src/components/ui` and are owned code; add more with
`npx shadcn add <name>` from `apps/web` (then point any `from "cn"` import at
`@/lib/utils` — the registry leaves it untransformed).

### Colour

Tokens only, in `apps/web/src/app/globals.css` — light is the product, dark
exists behind the theme toggle.

| Role | Use |
|---|---|
| Ground | White background and cards, `sidebar` a step off-white |
| Primary (teal) | Primary actions, the current selection (active nav mark, pressed toggles, active filters, checked choice cards), charts |
| Semantic | `success`, `warning`, `destructive` (+ `-subtle` fills) — state only, never identity. Dark enough for 12px text on white |

Status chips go through `ToneBadge` (`neutral`, `muted`, `progress`, `success`,
`warning`, `danger`) — one mapping per domain status, never ad-hoc colours.

### Type

- **DM Sans** for text, **Space Grotesk** for headings (`h1–h3` by default).
- **Figures use the `num` utility** — Space Grotesk with tabular digits. DM
  Sans ships without `tnum`, so money columns in it would not align.
- **IBM Plex Sans Arabic** for every Arabic name. The font stacks name the
  families directly (`"DM Sans", "IBM Plex Sans Arabic", …`) because each
  next/font variable carries an Arial fallback that covers Arabic and would
  otherwise win. Arabic inside English gets `<bdi>`; Arabic inputs `dir="auto"`.
- Scale: 24px page titles, 14px card titles, 13px table body and copy, 12px
  labels and controls.

### Page anatomy

`Page` → `PageHeader` (title, description, actions, optional back) →
`MetricGrid` of `MetricCard`s → `FilterBar` (URL-synced) → `TablePanel` with
`TablePagination`. List screens use `<Page fill>`: on desktop the table scrolls
inside its panel and the filters and pagination never leave the screen; under
`lg` the page scrolls. Forms are cards with a sticky summary column; small
records use `FormDialog`.

- Metric cards are read-only — a corner link drills into the records behind a
  figure, and trends appear only where real history exists.
- Tables: 44px rows, muted header, row-link overlay on the first cell.
- Every list has an empty state that says why it's empty and what to do.

---

## Where screens get built

With the phase they belong to, never as a separate "frontend phase". A phase is
not finished until its screen is usable.
