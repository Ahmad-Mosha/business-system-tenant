import {
  ArrowDown,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpRight,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { useFormat } from '@/i18n/use-format';
import { TableCell, TableRow } from '@/components/ui/table';
import type { LedgerRow } from '@/lib/api';
import { entryMemo, isEntryKind, sourceHref } from '@/lib/money';
import { cn } from '@/lib/utils';

/** Whether an entry raised an account's balance, lowered it, or never touched it. */
export type Direction = 'up' | 'down' | 'none';

export const directionOf = (effect: number | null): Direction =>
  effect === null ? 'none' : effect > 0 ? 'up' : 'down';

/** How a direction reads: its icon, its name (a `ledger.*` message), the amount's colour, the tile's. */
export type Mark = {
  icon: LucideIcon;
  label: 'in' | 'out' | 'untouched' | 'grew' | 'shrank';
  tone: string;
  tile: string;
};

const QUIET = 'bg-muted text-muted-foreground';
const UNTOUCHED: Mark = { icon: ArrowLeftRight, label: 'untouched', tone: '', tile: QUIET };

/** An account that holds money or stock: its entries are money in and money out. */
export const MONEY: Record<Direction, Mark> = {
  up: { icon: ArrowDownLeft, label: 'in', tone: 'text-success', tile: 'bg-muted text-success' },
  down: {
    icon: ArrowUpRight,
    label: 'out',
    tone: 'text-destructive',
    tile: 'bg-muted text-destructive',
  },
  none: UNTOUCHED,
};

/**
 * What's owed, earned, spent or put in: an entry grows or shrinks the balance.
 * "In" would contradict the arrow — paying a supplier moves value *to* what we
 * owe, and what we owe goes down. No colour either: owing more isn't green news.
 */
export const BALANCE: Record<Direction, Mark> = {
  up: { icon: ArrowUp, label: 'grew', tone: '', tile: QUIET },
  down: { icon: ArrowDown, label: 'shrank', tone: '', tile: QUIET },
  none: UNTOUCHED,
};

/**
 * The first cell of a ledger row: which way it went, what it was — linked to
 * the order or invoice behind it when there is one — then when, and any note.
 * A cancelled entry reads as cancelled — struck through, with who cancelled it,
 * when and why — and a correction says it is one.
 */
export function EntryCell({ entry, mark, when }: { entry: LedgerRow; mark: Mark; when?: string }) {
  const t = useTranslations();
  const f = useFormat();
  const cancelled = !!entry.cancelledAt;
  const href = sourceHref(entry);
  const memo = entryMemo(entry);
  const label = isEntryKind(entry.kind) ? t(`enums.entryKind.${entry.kind}`) : entry.kind;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        title={t(`ledger.${mark.label}`)}
        className={cn('flex size-7 shrink-0 items-center justify-center rounded-md', mark.tile)}
      >
        <mark.icon className="size-3.5 rtl:-scale-x-100" />
      </span>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          {href ? (
            <Link href={href} className={cn('truncate font-medium underline-offset-2 hover:underline', cancelled && 'text-muted-foreground line-through')}>
              {label}
            </Link>
          ) : (
            <span className={cn('truncate font-medium', cancelled && 'text-muted-foreground line-through')}>{label}</span>
          )}
          {entry.reversesId ? <Badge variant="outline">{t('ledger.reversal')}</Badge> : null}
          {cancelled ? <Badge variant="outline" className="text-destructive">{t('corrections.cancelled')}</Badge> : null}
          {entry.replacesId ? <Badge variant="outline">{t('corrections.correction')}</Badge> : null}
        </div>
        {when || memo ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {when ? <span className="num">{when}</span> : null}
            {when && memo ? ' · ' : null}
            {memo ? <bdi>{memo}</bdi> : null}
          </p>
        ) : null}
        {cancelled ? (
          <p className="mt-0.5 truncate text-xs text-destructive/80">
            {entry.cancelledBy
              ? t('corrections.cancelledBy', { name: entry.cancelledBy, date: f.date(entry.cancelledAt!) })
              : t('corrections.cancelledOn', { date: f.date(entry.cancelledAt!) })}
            {entry.cancelReason ? (
              <>
                {' — '}
                <bdi>{entry.cancelReason}</bdi>
              </>
            ) : null}
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
  const t = useTranslations('ledger');
  const className = cn(
    'inline-flex h-6 min-w-0 items-center border px-2 text-[13px] font-medium transition-colors',
    lens ? 'border-highlight/30 bg-highlight/10 text-highlight' : 'border-border bg-muted/50 text-foreground',
    href && (lens ? 'hover:bg-highlight/15' : 'hover:border-foreground/20 hover:bg-muted'),
  );
  const label = <bdi className="truncate">{name}</bdi>;
  return href ? (
    <Link href={href} title={title ? t('openAccount', { account: title }) : undefined} className={className}>
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
