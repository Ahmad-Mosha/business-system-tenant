import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import Link from 'next/link';
import { Children, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type MetricTone = 'default' | 'success' | 'warning' | 'destructive';

const TONE_MARK: Record<MetricTone, string> = {
  default: '',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
};

/**
 * A headline figure, built the way an owner scans one: what it is, how much,
 * and whether it needs them. The number and its context stay neutral; state
 * is one small coloured mark beside the context line, so a row of figures that
 * all need attention still reads calm.
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
    // A cell of MetricGrid's strip: it draws its top and left hairlines, and
    // the strip clips the outer ones, so the dividers stay 1px at any count.
    <div className={cn('@container/metric flex min-w-0 flex-col border-t border-s px-4 py-3', className)}>
      <div className="flex min-h-5 items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {link ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-xs" asChild className="-mt-1 -me-1.5 shrink-0">
                <Link href={link.href} aria-label={link.label}>
                  <ArrowUpRight className="rtl:-scale-x-100" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{link.label}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      {/* Never truncated — a clipped amount is a wrong amount. The size steps
          down with the card instead. */}
      <div className="num mt-1 text-base leading-none font-semibold tracking-tight whitespace-nowrap @[10rem]/metric:text-lg @[13rem]/metric:text-xl">
        {value}
      </div>
      {children ? <div className="mt-2">{children}</div> : null}
      {hint || badge ? (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {badge}
          {tone !== 'default' && !badge ? (
            <span aria-hidden className={cn('size-1.5 shrink-0', TONE_MARK[tone])} />
          ) : null}
          <span className="line-clamp-2">{hint}</span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * A period-over-period change, as a badge. Only ever fed real history — no
 * figure in this system gets a trend it doesn't have data for. `invert` is for
 * figures where more is worse, like money out: up reads red.
 */
export function Delta({
  value,
  suffix = '%',
  invert = false,
}: {
  value: number;
  suffix?: string;
  invert?: boolean;
}) {
  const flat = Math.abs(value) < 0.05;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  const good = invert ? value < 0 : value > 0;
  return (
    <Badge variant={flat ? 'outline' : good ? 'success' : 'destructive'} className="num">
      <Icon />
      {value > 0 ? '+' : ''}
      {value.toFixed(1)}
      {suffix}
    </Badge>
  );
}

/**
 * The figures of a screen as one strip: a single frame with hairline dividers,
 * not a row of separate boxes competing with each other. Columns follow how
 * many figures there are and how wide the content area actually is (a
 * container query — the sidebar can be open or collapsed). Two up even on a
 * phone, so a moderator isn't scrolling past figures to reach their orders.
 */
export function MetricGrid({ children }: { children: ReactNode }) {
  const count = Children.toArray(children).filter(Boolean).length;
  const cols =
    count >= 5
      ? '@2xl:grid-cols-3 @5xl:grid-cols-5'
      : count === 4
        ? '@3xl:grid-cols-4'
        : count === 3
          ? '@2xl:grid-cols-3'
          : '';
  return (
    <div className="@container">
      <div
        className={cn(
          'overflow-hidden bg-card ring-1 ring-foreground/10',
          // Two figures across the whole row would be mostly empty frame.
          count <= 2 && '@3xl:w-1/2',
        )}
      >
        <div className={cn('-mt-px -ms-px grid grid-cols-2', cols)}>{children}</div>
      </div>
    </div>
  );
}
