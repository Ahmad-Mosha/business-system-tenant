import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The shell primitives.
 *
 * One rule holds the whole interface together: **the page never scrolls, only
 * panes do**. `Screen` is a fixed-height frame; everything inside it is either
 * `shrink-0` chrome or a `Scroller`. Nothing important can leave the viewport,
 * which is the structural fix for the previous build's rejected scrolling.
 */
export function Screen({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-h-0 flex-col overflow-hidden">{children}</div>;
}

/**
 * The one band of chrome a screen gets. It carries the title, the filters and
 * the primary action on a single 48px line — replacing a page header, a stat
 * band and a toolbar that together cost 265px before any data appeared.
 *
 * `figures` are inline numbers, right-aligned before the actions.
 */
export function ContextBar({
  title,
  meta,
  figures,
  actions,
  children,
}: {
  title: ReactNode;
  meta?: ReactNode;
  figures?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex h-[var(--bar-h)] shrink-0 items-center gap-3 border-b border-border px-4">
      <div className="flex min-w-0 shrink-0 items-baseline gap-2">
        <h1 className="truncate text-[15px] font-semibold tracking-[-0.015em]">{title}</h1>
        {meta ? <span className="truncate text-xs text-muted-foreground">{meta}</span> : null}
      </div>
      {children ? (
        <div className="flex min-w-0 flex-1 items-center gap-1.5">{children}</div>
      ) : (
        <div className="flex-1" />
      )}
      {figures ? <div className="flex shrink-0 items-center gap-5">{figures}</div> : null}
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </header>
  );
}

/**
 * An inline headline number for the ContextBar. The stat band this replaces
 * spent 85px of every screen to say four short numbers.
 */
export function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: 'default' | 'warning' | 'destructive' | 'success';
}) {
  return (
    <div className="flex flex-col items-end leading-none">
      <span className="text-[10px] font-medium tracking-[0.07em] text-muted-foreground uppercase">
        {label}
      </span>
      <span
        className={cn(
          'mt-1 text-[13px] font-semibold tabular-nums',
          tone === 'warning' && 'text-warning',
          tone === 'destructive' && 'text-destructive',
          tone === 'success' && 'text-success',
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** The master-detail row. Both children manage their own overflow. */
export function Split({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 flex-1">{children}</div>;
}

/** The list side: takes the remaining width, never pushes the detail off. */
export function ListPane({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>;
}

/**
 * The detail side. Fixed width so the list's column layout never shifts when
 * the selection changes — a list that reflows on every click is unreadable.
 */
export function DetailPane({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        'flex w-[var(--detail-w)] shrink-0 flex-col overflow-hidden border-l border-border',
        className,
      )}
    >
      {children}
    </aside>
  );
}

/** The only element allowed to scroll. */
export function Scroller({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto', className)}>{children}</div>;
}

/** The footer line: counts, pagination, whatever answers "how much is here". */
export function StatusStrip({ children }: { children: ReactNode }) {
  return (
    <footer className="flex h-[var(--strip-h)] shrink-0 items-center justify-between gap-4 border-t border-border px-4 text-[11px] text-muted-foreground">
      {children}
    </footer>
  );
}

/**
 * The page's title card: what this screen is, and its primary action. A screen
 * gets one, at the top of its content — replacing headline figures crammed into
 * the chrome, which read as decoration rather than something you could act on.
 */
export function PageCard({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border px-5 py-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-[-0.02em]">{title}</h1>
        {description ? (
          <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** A bordered card that fills the remaining height and clips its own overflow. */
export function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border">
      {children}
    </div>
  );
}

/**
 * The panel's footer: what you are looking at, and how to move. Pagination is
 * how a list stays on one screen — the alternative is a page that grows without
 * limit and buries everything below it.
 */
export function Pagination({
  from,
  to,
  total,
  noun,
  prevHref,
  nextHref,
}: {
  from: number;
  to: number;
  total: number;
  noun: string;
  prevHref: string | null;
  nextHref: string | null;
}) {
  const step =
    'inline-flex size-8 items-center justify-center rounded-md border border-border transition-colors';
  return (
    <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border px-4 py-2.5">
      <p className="text-[13px] text-muted-foreground">
        {total === 0 ? (
          `No ${noun}`
        ) : (
          <>
            Showing <span className="tabular-nums text-foreground">{from}</span> to{' '}
            <span className="tabular-nums text-foreground">{to}</span> of{' '}
            <span className="tabular-nums text-foreground">{total}</span> {noun}
          </>
        )}
      </p>
      <div className="flex items-center gap-1.5">
        <Step href={prevHref} label={`Previous page of ${noun}`} className={step}>
          <ChevronLeft className="size-4" />
        </Step>
        <Step href={nextHref} label={`Next page of ${noun}`} className={step}>
          <ChevronRight className="size-4" />
        </Step>
      </div>
    </div>
  );
}

function Step({
  href,
  label,
  className,
  children,
}: {
  href: string | null;
  label: string;
  className: string;
  children: ReactNode;
}) {
  if (!href) {
    return (
      <span aria-disabled className={cn(className, 'cursor-not-allowed text-muted-foreground/30')}>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      scroll={false}
      aria-label={label}
      className={cn(
        className,
        'text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
      )}
    >
      {children}
    </Link>
  );
}

/** A headline figure as a card. Read-only — a figure, not a control. */
export function MetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'default' | 'warning' | 'destructive' | 'success';
}) {
  return (
    <div className="rounded-xl border border-border px-4 py-3">
      <p className="text-[11px] font-medium tracking-[0.07em] text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          'mt-1.5 text-[22px] leading-none font-semibold tabular-nums',
          tone === 'warning' && 'text-warning',
          tone === 'destructive' && 'text-destructive',
          tone === 'success' && 'text-success',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** The metric row. Equal columns so the cards read as one band, not five objects. */
export function MetricRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}
