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

## Colour

Monochrome ground, one accent, semantic colour for state only.

| Role | Use |
|---|---|
| Ground | Cool-tinted off-white surfaces, near-white cards — the reference's palette, kept |
| Primary action | Near-black. Buttons, active nav |
| Accent | The reference's teal — **reserved** for focus rings, the active nav rail, and the current selection. Never decorative |
| Semantic | Success, warning, destructive. Applied to state, never to identity or category |

No brand hues, no category colours, no gradients. Colour that appears in the
interface means something happened.

---

## Type

The reference specifies Geist and Geist Mono. Both are kept — and one thing it
missed has to be fixed:

**Every product name in this system is Arabic.** Geist has no Arabic coverage,
so Arabic text would silently fall back to whatever the operating system
supplies, which is exactly how the previous build's Arabic looked wrong. An
Arabic face is paired explicitly and the two are metric-matched at the sizes
used in tables.

Numbers use tabular figures everywhere. Table body sits at 13px, not 16 —
density is the point.

---

## Density

The previous build was rejected on spacing and size. Concretely:

- Table rows 36px, not 56.
- Inputs 34px, not 48.
- Forms in two columns inside a side sheet, with a sticky summary — not a
  full-page stack.
- Generous space **between** functional blocks, tight space **within** a row.
- A screen's primary work should be visible without scrolling on a laptop.

---

## Where screens get built

With the phase they belong to, never as a separate "frontend phase". A phase is
not finished until its screen is usable.
