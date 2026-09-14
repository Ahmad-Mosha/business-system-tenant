import {
  ArrowDown,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BookText,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { Fragment } from 'react';
import { Amount } from '@/components/amount';
import { FilterBar } from '@/components/filter-bar';
import { Page, PageHeader } from '@/components/page';
import { TableEmpty, TablePagination, TablePanel } from '@/components/table-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getLedger, getMoneyAccounts, type AccountBalance, type LedgerRow } from '@/lib/api';
import { dayLabel, timeOf } from '@/lib/format';
import { effectOn, entryMemo, kindLabel, sourceHref } from '@/lib/money';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 30;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** With no account chosen, the ledger is read from the treasury — the money itself. */
const TREASURY = 'CASH';

/** Whether an entry raised the account's balance, lowered it, or never touched it. */
type Direction = 'up' | 'down' | 'none';

/** How a direction reads: its icon and label, the amount's colour, the icon tile's. */
type Mark = { icon: LucideIcon; label: string; tone: string; tile: string };

const QUIET = 'bg-muted text-muted-foreground';
const UNTOUCHED: Mark = { icon: ArrowLeftRight, label: 'Between other accounts', tone: '', tile: QUIET };

/** An account that holds money or stock: its entries are money in and money out. */
const MONEY: Record<Direction, Mark> = {
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
const BALANCE: Record<Direction, Mark> = {
  up: { icon: ArrowUp, label: 'Grew', tone: '', tile: QUIET },
  down: { icon: ArrowDown, label: 'Shrank', tone: '', tile: QUIET },
  none: UNTOUCHED,
};

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const code = params.code;
  const from = params.from && ISO.test(params.from) ? params.from : undefined;
  const to = params.to && ISO.test(params.to) ? params.to : undefined;
  const page = Math.max(Number(params.page) || 1, 1);

  const keep = new URLSearchParams();
  if (code) keep.set('code', code);
  if (from) keep.set('from', from);
  if (to) keep.set('to', to);

  const query = new URLSearchParams(keep);
  query.set('limit', String(PAGE_SIZE));
  query.set('offset', String((page - 1) * PAGE_SIZE));

  const [accounts, { entries, total }] = await Promise.all([
    getMoneyAccounts(),
    getLedger(query.toString()),
  ]);
  const account = accounts.find((a) => a.code === code);
  // The account every amount is signed against.
  const lens = account ?? accounts.find((a) => a.code === TREASURY);
  const marks = lens?.kind === 'ASSET' ? MONEY : BALANCE;
  const english = new Map(accounts.map((a) => [a.code, a.nameEn]));

  const pageHref = (p: number) => {
    const next = new URLSearchParams(keep);
    if (p > 1) next.set('page', String(p));
    const qs = next.toString();
    return qs ? `/money/ledger?${qs}` : '/money/ledger';
  };
  const accountHref = (c: string) => {
    const next = new URLSearchParams(keep);
    next.set('code', c);
    return `/money/ledger?${next}`;
  };

  // Newest first, so one day's entries always sit together.
  const days: Array<{ key: string; label: string; entries: LedgerRow[] }> = [];
  for (const e of entries) {
    const key = new Date(e.occurredAt).toDateString();
    const day = days.at(-1);
    if (day?.key === key) day.entries.push(e);
    else days.push({ key, label: dayLabel(e.occurredAt), entries: [e] });
  }

  return (
    <Page fill>
      <PageHeader
        title="Ledger"
        description={
          account ? (
            <>
              Every movement in and out of <span className="text-foreground">{account.nameEn}</span>{' '}
              <bdi>({account.nameAr})</bdi>, newest first.
            </>
          ) : (
            'Every movement of value, newest first — signed by what it did to the treasury.'
          )
        }
      />

      <FilterBar
        filters={[
          {
            kind: 'select',
            param: 'code',
            all: 'All accounts',
            options: accounts.map((a) => ({ value: a.code, label: a.nameEn, hint: a.nameAr })),
          },
          { kind: 'dates', from: 'from', to: 'to' },
        ]}
      />

      <TablePanel
        minWidth="50rem"
        toolbar={lens ? <Lens account={lens} marks={marks} all={!account} /> : undefined}
        footer={
          <TablePagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            count={entries.length}
            noun="entries"
            href={pageHref}
          />
        }
      >
        {entries.length === 0 ? (
          <TableEmpty
            icon={BookText}
            title="Nothing recorded for this view"
            description={keep.size ? 'Try another account or date range.' : 'Entries appear as money moves.'}
            action={
              keep.size ? (
                <Button variant="outline" asChild>
                  <Link href="/money/ledger">Reset filters</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entry</TableHead>
                <TableHead className="w-[340px]">From → to</TableHead>
                <TableHead className="w-[160px] text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map((day) => (
                <Fragment key={day.key}>
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={3}
                      className="h-8 bg-muted/40 text-xs font-medium text-muted-foreground"
                    >
                      {day.label}
                    </TableCell>
                  </TableRow>
                  {day.entries.map((e) => {
                    const effect = lens ? effectOn(e, lens) : null;
                    const mark = marks[effect === null ? 'none' : effect > 0 ? 'up' : 'down'];
                    const href = sourceHref(e);
                    const time = timeOf(e.occurredAt);
                    const memo = entryMemo(e);
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="h-14 max-w-0">
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              title={mark.label}
                              className={cn('flex size-8 shrink-0 items-center justify-center', mark.tile)}
                            >
                              <mark.icon className="size-4" />
                            </span>
                            <div className="min-w-0">
                              <div className="flex min-w-0 items-center gap-2">
                                {href ? (
                                  <Link
                                    href={href}
                                    className="truncate font-medium underline-offset-2 hover:underline"
                                  >
                                    {kindLabel(e.kind)}
                                  </Link>
                                ) : (
                                  <span className="truncate font-medium">{kindLabel(e.kind)}</span>
                                )}
                                {e.reversesId ? <Badge variant="outline">Reversal</Badge> : null}
                              </div>
                              {time || memo ? (
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                  {time ? <span className="num">{time}</span> : null}
                                  {time && memo ? ' · ' : null}
                                  {memo ? <bdi>{memo}</bdi> : null}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-1.5">
                            <AccountChip
                              name={e.creditAr}
                              title={english.get(e.creditCode)}
                              href={accountHref(e.creditCode)}
                              lens={e.creditCode === lens?.code}
                            />
                            <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                            <AccountChip
                              name={e.debitAr}
                              title={english.get(e.debitCode)}
                              href={accountHref(e.debitCode)}
                              lens={e.debitCode === lens?.code}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Amount
                            value={effect ?? e.amount}
                            signed={effect !== null}
                            className={cn(
                              'text-sm font-semibold',
                              effect === null ? 'text-muted-foreground' : mark.tone,
                            )}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </TablePanel>
    </Page>
  );
}

/**
 * An account as the ledger names it — a chip, so the two ends of a movement
 * read as places rather than words, and a link to that account's own ledger.
 * The account the amounts are signed against wears the selection colour.
 */
function AccountChip({
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
    'inline-flex h-6 min-w-0 items-center border px-2 font-medium transition-colors',
    lens
      ? 'border-highlight/30 bg-highlight/10 text-highlight'
      : 'border-border bg-muted/50 text-foreground',
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

/** Which account the amounts are signed against, how to read them, and where it stands now. */
function Lens({
  account,
  marks,
  all,
}: {
  account: AccountBalance;
  marks: Record<Direction, Mark>;
  all: boolean;
}) {
  // Filtered to one account, every entry touches it.
  const shown: Direction[] = all ? ['up', 'down', 'none'] : ['up', 'down'];
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-2">
        Seen from
        <AccountChip name={account.nameAr} title={account.nameEn} lens />
      </span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {shown.map((d) => {
          const mark = marks[d];
          return (
            <span key={d} className="inline-flex items-center gap-1">
              <mark.icon className={cn('size-3.5', mark.tone)} />
              {mark.label}
            </span>
          );
        })}
      </span>
      <span className="ms-auto flex items-baseline gap-2">
        Balance now
        <Amount
          value={account.balance}
          className={cn(
            'text-[13px] font-semibold text-foreground',
            Number(account.balance) < 0 && 'text-destructive',
          )}
        />
      </span>
    </div>
  );
}
