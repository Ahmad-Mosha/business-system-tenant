import {
  ArrowDown,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpRight,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import type { LedgerRow } from '@/lib/api';
import { entryMemo, kindLabel, sourceHref } from '@/lib/money';
import { cn } from '@/lib/utils';

/** Whether an entry raised an account's balance, lowered it, or never touched it. */
export type Direction = 'up' | 'down' | 'none';

export const directionOf = (effect: number | null): Direction =>
  effect === null ? 'none' : effect > 0 ? 'up' : 'down';

/** How a direction reads: its icon and label, the amount's colour, the icon tile's. */
export type Mark = { icon: LucideIcon; label: string; tone: string; tile: string };

const QUIET = 'bg-muted text-muted-foreground';
const UNTOUCHED: Mark = { icon: ArrowLeftRight, label: 'Between other accounts', tone: '', tile: QUIET };

/** An account that holds money or stock: its entries are money in and money out. */
export const MONEY: Record<Direction, Mark> = {
  up: { icon: ArrowDownLeft, label: 'In', tone: 'text-success', tile: 'bg-success-subtle text-success' },
  down: {
    icon: ArrowUpRight,
    label: 'Out',
    tone: 'text-destructive',
    tile: 'bg-destructive-subtle text-destructive',
  },
  none: UNTOUCHED,
};

/**
 * What's owed, earned, spent or put in: an entry grows or shrinks the balance.
 * "In" would contradict the arrow — paying a supplier moves value *to* what we
 * owe, and what we owe goes down. No colour either: owing more isn't green news.
 */
export const BALANCE: Record<Direction, Mark> = {
  up: { icon: ArrowUp, label: 'Grew', tone: '', tile: QUIET },
  down: { icon: ArrowDown, label: 'Shrank', tone: '', tile: QUIET },
  none: UNTOUCHED,
};

/**
 * The first cell of a ledger row: which way it went, what it was — linked to
 * the order or invoice behind it when there is one — then when, and any note.
 */
export function EntryCell({ entry, mark, when }: { entry: LedgerRow; mark: Mark; when?: string }) {
  const href = sourceHref(entry);
  const memo = entryMemo(entry);
  const label = kindLabel(entry.kind);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        title={mark.label}
        className={cn('flex size-8 shrink-0 items-center justify-center', mark.tile)}
      >
        <mark.icon className="size-4 rtl:-scale-x-100" />
      </span>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          {href ? (
            <Link href={href} className="truncate font-medium underline-offset-2 hover:underline">
              {label}
            </Link>
          ) : (
            <span className="truncate font-medium">{label}</span>
          )}
          {entry.reversesId ? <Badge variant="outline">Reversal</Badge> : null}
        </div>
        {when || memo ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {when ? <span className="num">{when}</span> : null}
            {when && memo ? ' · ' : null}
            {memo ? <bdi>{memo}</bdi> : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * An account as the ledger names it — a chip, so the two ends of a movement
 * read as places rather than words, and a link to that account's own ledger.
 * `lens` marks the account the amounts are signed against.
 */
export function AccountChip({
  name,
  title,
  href,
  lens,
}: {
  name: string;
  title?: string;
  href?: string;
  lens?: boolean;
}) {
  const className = cn(
    'inline-flex h-6 min-w-0 items-center border px-2 text-[13px] font-medium transition-colors',
    lens ? 'border-highlight/30 bg-highlight/10 text-highlight' : 'border-border bg-muted/50 text-foreground',
    href && (lens ? 'hover:bg-highlight/15' : 'hover:border-foreground/20 hover:bg-muted'),
  );
  const label = <bdi className="truncate">{name}</bdi>;
  return href ? (
    <Link href={href} title={title ? `${title} — open its ledger` : undefined} className={className}>
      {label}
    </Link>
  ) : (
    <span title={title} className={className}>
      {label}
    </span>
  );
}

/** A day's heading inside a ledger table. */
export function DayRow({ label, span }: { label: string; span: number }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={span} className="h-8 bg-muted/40 text-xs font-medium text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  );
}
