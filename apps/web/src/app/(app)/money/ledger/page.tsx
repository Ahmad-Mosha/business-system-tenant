import { ArrowRight, BookText } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Fragment } from 'react';
import { Amount } from '@/components/amount';
import { FilterBar } from '@/components/filter-bar';
import {
  AccountChip,
  BALANCE,
  DayRow,
  directionOf,
  EntryCell,
  MONEY,
  type Direction,
  type Mark,
} from '@/components/ledger-entry';
import { Page, PageHeader } from '@/components/page';
import { TableEmpty, TablePagination, TablePanel } from '@/components/table-panel';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getLedger, getMoneyAccounts, type AccountBalance } from '@/lib/api';

import { effectOn } from '@/lib/money';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';
import { getFormat } from '@/i18n/get-format';

const PAGE_SIZE = 30;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** With no account chosen, the ledger is read from the treasury — the money itself. */
const TREASURY = 'CASH';

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const f = await getFormat();
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
        minWidth="22rem"
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
                <TableHead className="hidden w-[340px] md:table-cell">From → to</TableHead>
                <TableHead className="w-[160px] text-end">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {f.byDay(entries).map((day) => (
                <Fragment key={day.key}>
                  <DayRow label={day.label} span={3} />
                  {day.rows.map((e) => {
                    const effect = lens ? effectOn(e, lens) : null;
                    const mark = marks[directionOf(effect)];
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="h-14 max-w-0">
                          <EntryCell entry={e} mark={mark} when={f.time(e.occurredAt)} />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <AccountChip
                              name={e.creditAr}
                              title={english.get(e.creditCode)}
                              href={accountHref(e.creditCode)}
                              lens={e.creditCode === lens?.code}
                            />
                            <ArrowRight className="size-3.5 shrink-0 text-muted-foreground rtl:rotate-180" />
                            <AccountChip
                              name={e.debitAr}
                              title={english.get(e.debitCode)}
                              href={accountHref(e.debitCode)}
                              lens={e.debitCode === lens?.code}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-end">
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
  const t = useTranslations('ledger');
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
              <mark.icon className={cn('size-3.5 rtl:-scale-x-100', mark.tone)} />
              {t(mark.label)}
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
