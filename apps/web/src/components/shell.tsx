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
