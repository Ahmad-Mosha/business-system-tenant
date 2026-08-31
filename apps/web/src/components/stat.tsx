import { Children, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A headline figure. Deliberately not a Card: a grid of bordered cells reads as
 * one object, where five stacked cards would read as five competing ones.
 */
export function Stat({
  label,
  value,
  hint,
  emphasis = false,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 p-5">
      <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </p>
      <div className="space-y-1">
        <p
          className={cn(
            'text-2xl font-semibold tracking-[-0.025em] tabular-nums',
            emphasis && 'text-[28px]',
          )}
        >
          {value}
        </p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

/**
 * Hairline grid wrapper. The dividers come from the container's background
 * showing through 1px gaps, so cells stay perfectly aligned at any count.
 */
export function StatGrid({ children }: { children: ReactNode }) {
  // Column count follows the number of cells, so a page with three stats does
  // not render a fourth empty one.
  const count = Children.toArray(children).filter(Boolean).length;
  const columns =
    count % 4 === 0 ? 'lg:grid-cols-4' : count % 3 === 0 ? 'lg:grid-cols-3' : 'lg:grid-cols-2';

  return (
    <div
      className={cn(
        'grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2',
        columns,
      )}
    >
      {children}
    </div>
  );
}

/** Cell wrapper — supplies the surface each Stat sits on. */
export function StatCell({ children }: { children: ReactNode }) {
  return <div className="bg-background">{children}</div>;
}
