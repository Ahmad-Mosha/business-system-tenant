import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import Link from 'next/link';
import { Children, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type MetricTone = 'default' | 'success' | 'warning' | 'destructive';

const TONE_TEXT: Record<MetricTone, string> = {
  default: 'text-muted-foreground',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
};

/**
 * A headline figure, built the way an owner scans one: what it is, how much,
 * and whether it needs them. The number stays in the foreground colour —
 * state is carried by the context line under it (tinted, with a marker), so a
 * screen of figures never turns into a wall of colour.
 *
 * Read-only by design. `link` adds a small drill-down to the records behind
 * the figure; the card itself is not a button or a filter.
 */
export function MetricCard({
  label,
  value,
  hint,
  tone = 'default',
  badge,
  link,
  children,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: MetricTone;
  /** A trend (<Delta/>) — it leads the hint line: "+4.2% vs 30 days ago". */
  badge?: ReactNode;
  link?: { href: string; label: string };
  /** A visual under the figure — sparkline, progress bar. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Card size="sm" className={cn('@container/metric gap-0 px-3.5', className)}>
      <div className="flex min-h-5 items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {link ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-xs" asChild className="-mt-1 -mr-1.5 shrink-0">
                <Link href={link.href} aria-label={link.label}>
                  <ArrowUpRight />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{link.label}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      {/* Never truncated — a clipped amount is a wrong amount. The size steps
          down with the card instead. */}
      <div className="num mt-1.5 text-lg leading-none font-semibold tracking-tight whitespace-nowrap @[11rem]/metric:text-xl @[15rem]/metric:text-2xl">
        {value}
      </div>
      {children ? <div className="mt-2">{children}</div> : null}
      {hint || badge ? (
        <div className={cn('mt-2 flex items-center gap-1.5 text-xs', TONE_TEXT[tone])}>
          {badge}
          {tone !== 'default' && !badge ? (
            <span aria-hidden className="size-1.5 shrink-0 bg-current" />
          ) : null}
          <span className="line-clamp-2">{hint}</span>
        </div>
      ) : null}
    </Card>
  );
}

/**
 * A period-over-period change, as a badge. Only ever fed real history — no
 * figure in this system gets a trend it doesn't have data for.
 */
export function Delta({ value, suffix = '%' }: { value: number; suffix?: string }) {
  const flat = Math.abs(value) < 0.05;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <Badge variant={flat ? 'outline' : value > 0 ? 'success' : 'destructive'} className="num">
      <Icon />
      {value > 0 ? '+' : ''}
      {value.toFixed(1)}
      {suffix}
    </Badge>
  );
}

/**
 * The metric row. Columns follow how many cards are passed and how wide the
 * content area actually is (a container query, not the viewport — the sidebar
 * can be open or collapsed), so five figures never wrap one onto its own line.
 */
export function MetricGrid({ children }: { children: ReactNode }) {
  const count = Children.toArray(children).filter(Boolean).length;
  const cols =
    count >= 5
      ? '@2xl:grid-cols-3 @5xl:grid-cols-5'
      : count === 4
        ? '@4xl:grid-cols-4'
        : count === 3
          ? '@2xl:grid-cols-3'
          : '';
  // Two up even on a phone — stacked one per row, a moderator scrolls past
  // several screens of figures before reaching their orders.
  return (
    <div className="@container">
      <div className={cn('grid grid-cols-2 gap-3 @md:gap-4', cols)}>{children}</div>
    </div>
  );
}
