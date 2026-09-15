# The web app — how it's put together

`apps/web`: Next.js 16 (App Router), React 19, Tailwind 4, shadcn/ui, next-intl.
Server components by default; the browser only gets code for what's
interactive.

## Where things live

| Path | What it is |
|---|---|
| `app/(app)/<module>/page.tsx` | A screen. A server component: checks who's signed in (`requireSession` / `requireAdmin`), reads its data, renders. |
| `app/(app)/<module>/actions.ts` | That module's writes, as server actions (`'use server'`): call the API, refresh the pages that show it, return a result a form can show. |
| `app/(app)/layout.tsx` | The signed-in shell — sidebar and header. `loading.tsx`, `error.tsx` and `not-found.tsx` beside it cover every screen. |
| `components/` | Parts of screens. `'use client'` only when interactive — forms, menus, charts, the live shipments board. |
| `components/ui/` | shadcn primitives: owned code, migrated for RTL. A look changes here, not per screen. |
| `lib/api.ts` | Every read, and the API's types. A failed read throws; the screen's error boundary shows it. |
| `lib/api-request.ts` | Every write's call to the API. Answers `{ ok, data }` or `{ ok: false, message }`, in the reader's language. |
| `lib/session.ts` | Who's signed in, and the page guards. |
| `lib/format.ts`, `lib/money.ts`, `lib/stock.ts`, `lib/categories.ts`, `lib/nav.ts` | Pure helpers: money and Cairo dates, how ledger entries read, stock states, categories, the sidebar and who sees what. |
| `i18n/`, `messages/` | Words, formatting, direction — `docs/i18n.md`. |

## How data moves

- **Reading:** page (server) → `lib/api.ts` → API → render. Every call is
  `no-store` — an operations screen must never show a stale figure — and
  identical calls in one render are made once.
- **Writing:** form (client) → server action → `apiRequest` → API →
  `revalidatePath` → the page renders again with fresh data. Nothing is kept in
  browser state that the server already knows.
- **Filters and paging** live in the URL, so a view is shareable and the list
  stays a server component.

## Business rules

They live in the API. The web mirrors one only so it never offers what the API
would refuse — the next order statuses, which orders can be edited, stock that
isn't there — and the code says so where it does.

## Conventions

- Screens are built from the layout kit: `Page`, `PageHeader`, `MetricGrid`,
  `TablePanel` (with `TableEmpty`), `FilterBar` (`docs/ui-ux.md`).
- Figures go through `Amount` / `money()`; dates through `getFormat()` /
  `useFormat()`.
- No text in code, logical CSS only — lint enforces the first (`docs/i18n.md`).
- Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Roles, and what comes next

Today there are two roles, ADMIN and MODERATOR, applied in exactly two places:
`navFor(role)` decides what the sidebar shows, and `requireAdmin()` guards a
screen. A future plan or subscription check fits the same two seams — a field
on the signed-in user, a filter in `navFor`, a guard like `requireAdmin` — with
the API enforcing it independently, as it does for roles.
