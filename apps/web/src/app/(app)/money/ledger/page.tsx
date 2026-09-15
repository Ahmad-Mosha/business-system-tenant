import { ArrowRight, BookText } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
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

import { accountName, effectOn } from '@/lib/money';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';
import { strong } from '@/i18n/rich';
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
  const [f, t, tr, locale] = await Promise.all([
    getFormat(),
    getTranslations('money.ledger'),
    getTranslations(),
    getLocale(),
  ]);
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
  const names = new Map(accounts.map((a) => [a.code, accountName(a, locale)]));
  // The other language's name, for a filter hint — people know accounts by either.
  const other = (a: AccountBalance) => (a.nameAr === accountName(a, locale) ? a.nameEn : a.nameAr);

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
        title={tr('nav.items.ledger')}
        description={
          account
            ? t.rich('accountDescription', { account: accountName(account, locale), strong })
            : t('allDescription')
        }
      />

      <FilterBar
        filters={[
          {
            kind: 'select',
            param: 'code',
            all: t('allAccounts'),
            options: accounts.map((a) => ({ value: a.code, label: accountName(a, locale), hint: other(a) })),
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
            title={t('empty')}
            description={keep.size ? t('emptyFiltered') : t('emptyAll')}
            action={
              keep.size ? (
                <Button variant="outline" asChild>
                  <Link href="/money/ledger">{tr('filters.resetFilters')}</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.entry')}</TableHead>
                <TableHead className="hidden w-[340px] md:table-cell">{t('columns.fromTo')}</TableHead>
                <TableHead className="w-[160px] text-end">{tr('money.treasury.columns.amount')}</TableHead>
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
                              name={names.get(e.creditCode) ?? e.creditAr}
                              title={names.get(e.creditCode)}
                              href={accountHref(e.creditCode)}
                              lens={e.creditCode === lens?.code}
                            />
                            <ArrowRight className="size-3.5 shrink-0 text-muted-foreground rtl:rotate-180" />
                            <AccountChip
                              name={names.get(e.debitCode) ?? e.debitAr}
                              title={names.get(e.debitCode)}
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
  const t = useTranslations();
  const locale = useLocale();
  // Filtered to one account, every entry touches it.
  const shown: Direction[] = all ? ['up', 'down', 'none'] : ['up', 'down'];
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-2">
        {t('money.ledger.seenFrom')}
        <AccountChip name={accountName(account, locale)} lens />
      </span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {shown.map((d) => {
          const mark = marks[d];
          return (
            <span key={d} className="inline-flex items-center gap-1">
              <mark.icon className={cn('size-3.5 rtl:-scale-x-100', mark.tone)} />
              {t(`ledger.${mark.label}`)}
            </span>
          );
        })}
      </span>
      <span className="ms-auto flex items-baseline gap-2">
        {t('money.ledger.balanceNow')}
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
