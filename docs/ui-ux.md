# UI/UX direction

An operations tool is read all day by the same few people, so density and
trust win over decoration. The principles every screen follows:

- **Master-detail, not page hopping.** A dense list, a detail beside or behind
  it, filters that survive the trip. The fix for the "excessive scrolling" an
  earlier version was rejected for.
- **A filter bar above the table, not a form beside it.** Each control shows
  its current value in itself.
- **Structure over containers.** Weight and tonal shift define sections, not
  nested boxes.
- **Status is a mark and a word,** never a loud coloured pill.
- **Figures are right-aligned and tabular,** so columns of money line up.
- **Every number opens to the records behind it.** Totals with no way in are
  exactly what the business could not trust before.
- **Fulfilment and payment are shown separately.** "Delivered" never implies
  "paid" — that is the normal state of a cash-on-delivery order.

---

## Design system

Built on **shadcn/ui, style `radix-lyra`** — preset `b6XGy1Otr6`: neutral base,
teal theme, radius 0, Lucide icons, bold menu accent. Components live in
`apps/web/src/components/ui` and are owned code; add more with
`npx shadcn add <name>` from `apps/web` (then point any `from "cn"` import at
`@/lib/utils` — the registry leaves it untransformed).

Arabic and English, RTL and LTR: see [i18n.md](./i18n.md) — every screen
takes its words from `src/messages`, its dates from the formatter, and its
direction from logical classes.

### Colour

Tokens only, in `apps/web/src/app/globals.css` — light is the product, dark
exists behind the theme toggle.

| Role | Use |
|---|---|
| Ground | A softly tinted `sheet` for the working area, white cards and fields raised on it, the `canvas` frame (sidebar) a step deeper. Dark mode is a layered deep slate, not black |
| Primary (teal) | Primary actions and charts. The current selection (pressed toggles, active filters, checked choice cards) uses `highlight` — the same teal in light, a brighter one in dark where primary is too dim as text |
| Semantic | `success`, `warning`, `destructive` (+ `-subtle` fills) — state only, never identity. Dark enough for 12px text on white |

**No gradients, glows or decorative tiles** — they read as template design.
Colour goes only on the mark that carries meaning: an arrow, an amount, a status
dot. Never `color-mix(in oklch, …)`: Chrome drops the hue and greys turn brown;
mix `in srgb`.

Statuses go through `ToneBadge` (`neutral`, `muted`, `progress`, `success`,
`warning`, `danger`) — a coloured mark and a plain word, no box, one mapping
per domain status, never ad-hoc colours.

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

The content sits on an inset sheet beside a collapsible, 13rem sidebar (modules
fold open). `Page` → `PageHeader` (title, description, actions, optional back)
→ `MetricGrid` (one strip of figures with hairline dividers) → `FilterBar`
(URL-synced) → `TablePanel` with `TablePagination`. The header carries the
search-and-jump palette (Ctrl/⌘ K, `components/layout/command-menu.tsx`):
screens, create actions, and live results for orders, products and customers.
List screens use `<Page fill>`: on desktop the table scrolls inside its panel
and the filters and pagination never leave the screen; under `lg` the page
scrolls. Forms are cards with a sticky summary column; small
records use `FormDialog`.

- Figures are read-only and compact (20px max) — a corner link drills into the
  records behind one, a small coloured mark flags state, and trends appear
  only where real history exists.
- Tables: 44px rows, muted header, row-link overlay on the first cell; the
  dropdown chevrons of in-row menus show only on the hovered row.
- Every list has an empty state that says why it's empty and what to do. A
  failed outside service (Bosta) says so in plain words with a retry — never a
  raw error, never a list of zeros.
- A list worked from a phone gets a card layout under `md` (Orders): number,
  name and total on top, the in-row menus underneath.
- The one filter a list is mostly used by can be `segments` in the `FilterBar`
  (all options on show, with counts) — Inventory's stock level.

### Money and stock rows

Ledger, Treasury, the Money overview and a product's stock history share one
row (`components/money/ledger-entry.tsx`): a direction tile, the entry and what's
behind it (linked to its order or invoice), then its time and note under it;
days get a heading row.

- Ledger entries are never signed — each moves a positive amount between two
  accounts. A sign exists only from one account's side (`effectOn`, the API's
  `naturalBalance` rule). With no account chosen, the ledger is read from the
  treasury (الخزينة); a movement that never touched it shows plain.
- Green in / red out only for accounts that hold money or stock (`ASSET`). For
  what's owed, earned, spent or put in, entries *grew* or *shrank* the balance,
  without colour — owing more is not green news.
- Account names are chips that open that account's ledger; the account the
  amounts are read from wears the selection colour.
- Stock states: out (≤ 0), low (≤ 5, the API's `low_stock` line), in stock —
  `lib/stock.ts`. A product has no photo, so lists show its category's icon.
- Things recorded from a date alone (vouchers, invoices) are stored at midnight
  UTC; `dateTime` and `timeOf` print them without a time.

### Charts

shadcn's chart (`components/ui/chart.tsx`, Recharts v3); charts live in
`components/money/charts.tsx`. The rules they keep:

- **Fed by an API aggregate, never by a page of rows.** Totals come from SQL
  (`GET /finance/cash-flow` buckets money per day, week or month); a list
  screen's rows stop at its page size.
- **The window is in the URL** — `PeriodTabs` (7 / 30 / 90 days, 12 months), so
  a view can be shared and the page stays a server component.
- **Only honest comparisons.** A trend or "vs before" appears only when the
  earlier window is entirely inside the books.
- Plain drawing: thin lines, flat light fills, dashed hairline grids — no
  gradient fills.
- Colour: sales are teal, costs a quiet grey, red only for a value below zero.
  The profit trend draws running totals, which read far better than
  day-by-day figures that swing with every large payment.
