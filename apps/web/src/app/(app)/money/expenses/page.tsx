import { CalendarDays, CalendarRange, History, Receipt } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ExpenseForm, VoidExpense } from '@/components/money/expense-form';
import { Amount } from '@/components/display/amount';
import { FilterBar } from '@/components/layout/filter-bar';
import { SummaryMetric, SummaryStrip } from '@/components/layout/list-page';
import { Page, PageHeader } from '@/components/layout/page';
import { TableEmpty, TablePagination, TablePanel } from '@/components/layout/table-panel';
import { CancelledToggle, toggleCancelledHref } from '@/components/layout/cancelled-toggle';
import { ToneBadge } from '@/components/display/tone-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { getExpenseCategories, getExpenses } from '@/lib/api';
import { monthStart, today } from '@/lib/format';
import { requireAdmin } from '@/lib/session';
import { getFormat } from '@/i18n/get-format';

/** `YYYY-MM-DD` shifted by whole days — Cairo dates in, Cairo dates out. */
const shift = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const q = new URLSearchParams();
  for (const key of ['category', 'search', 'from', 'to', 'page', 'cancelled']) if (params[key]) q.set(key, params[key]);
  const showCancelled = params.cancelled === '1';

  // The three periods an owner asks about, each one click from its expenses.
  const now = today();
  const thisMonth = { from: monthStart(), to: now };
  const lastMonth = { from: `${shift(thisMonth.from, -1).slice(0, 7)}-01`, to: shift(thisMonth.from, -1) };
  const thisYear = { from: `${now.slice(0, 4)}-01-01`, to: now };
  const period = (p: { from: string; to: string }) => `from=${p.from}&to=${p.to}`;

  const [data, month, previous, year, categories, t, tc, tr, f] = await Promise.all([
    getExpenses(q.toString()),
    getExpenses(period(thisMonth)),
    getExpenses(period(lastMonth)),
    getExpenses(period(thisYear)),
    getExpenseCategories(),
    getTranslations('expenses'),
    getTranslations('corrections'),
    getTranslations(),
    getFormat(),
  ]);
  const pageHref = (page: number) => {
    const next = new URLSearchParams(q);
    if (page > 1) next.set('page', String(page));
    else next.delete('page');
    const query = next.toString();
    return query ? `/money/expenses?${query}` : '/money/expenses';
  };
  const lastPage = Math.max(Math.ceil(data.total / 50), 1);
  if (data.page > lastPage) redirect(pageHref(lastPage));
  const change = Number(previous.totalAmount) > 0 ? (Number(month.totalAmount) / Number(previous.totalAmount) - 1) * 100 : null;

  return (
    <Page>
      <PageHeader title={t('title')} description={t('description')} actions={<ExpenseForm categories={categories} />} />

      <SummaryStrip label={t('title')}>
        <SummaryMetric
          label={t('periods.thisMonth')}
          icon={CalendarDays}
          value={<Amount value={month.totalAmount} />}
          hint={change === null ? tr('nouns.expenses', { count: month.total }) : t('periods.vsLast', { change: `${change > 0 ? '+' : ''}${change.toFixed(0)}%` })}
          href={`/money/expenses?${period(thisMonth)}`}
          sensitive
        />
        <SummaryMetric
          label={t('periods.lastMonth')}
          icon={History}
          value={<Amount value={previous.totalAmount} />}
          hint={tr('nouns.expenses', { count: previous.total })}
          href={`/money/expenses?${period(lastMonth)}`}
          sensitive
        />
        <SummaryMetric
          label={t('periods.thisYear')}
          icon={CalendarRange}
          value={<Amount value={year.totalAmount} />}
          hint={tr('nouns.expenses', { count: year.total })}
          href={`/money/expenses?${period(thisYear)}`}
          sensitive
        />
      </SummaryStrip>

      <FilterBar
        search={{ param: 'search', placeholder: t('search') }}
        filters={[
          { kind: 'select', param: 'category', all: t('allCategories'), options: categories.map((c) => ({ value: c.id, label: c.name })) },
          { kind: 'dates', from: 'from', to: 'to' },
        ]}
      />

      <TablePanel
        minWidth="48rem"
        toolbar={
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3.5">
            <p className="text-sm font-medium">{t('total')}</p>
            <p className="flex items-baseline gap-2" data-sensitive>
              <Amount value={data.totalAmount} className="text-lg font-semibold" />
              <span className="text-xs text-muted-foreground">{tr('common.egp')} · {tr('nouns.expenses', { count: data.total })}</span>
            </p>
          </div>
        }
        footer={
          <>
            <TablePagination page={data.page} pageSize={50} total={data.total} count={data.expenses.length} noun="expenses" href={pageHref} />
            {data.cancelled > 0 || showCancelled ? <CancelledToggle shown={showCancelled} href={toggleCancelledHref('/money/expenses', params, showCancelled)} /> : null}
          </>
        }
      >
        {!data.expenses.length ? (
          <TableEmpty icon={Receipt} title={t('empty')} description={t('emptyHint')} />
        ) : (
          <>
          <ul className="divide-y md:hidden">
            {data.expenses.map((e) => {
              const voided = !!e.voidedAt;
              return (
                <li key={e.id} className={cn('grid gap-2 px-5 py-4', voided && 'text-muted-foreground')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={cn('font-medium', voided && 'line-through')}><bdi>{e.category}</bdi></p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{f.date(e.spentOn)}</p>
                    </div>
                    <span className="shrink-0" data-sensitive><Amount value={e.amount} className={cn('font-semibold', voided && 'font-normal line-through')} /></span>
                  </div>
                  {e.note ? <p className={cn('text-sm', voided && 'line-through')}><bdi>{e.note}</bdi></p> : null}
                  {voided ? (
                    <p className="text-xs text-destructive/80">
                      {e.voidedBy ? tc('cancelledBy', { name: e.voidedBy, date: f.date(e.voidedAt!) }) : tc('cancelledOn', { date: f.date(e.voidedAt!) })}
                      {e.voidReason ? <> — <bdi>{e.voidReason}</bdi></> : null}
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <ExpenseForm categories={categories} expense={{ id: e.id, category: e.category, amount: e.amount, spentOn: e.spentOn, note: e.note }} />
                      <VoidExpense id={e.id} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <Table className="hidden md:table [&_td]:h-16">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[15%]">{t('date')}</TableHead>
                <TableHead className="w-[18%]">{t('category')}</TableHead>
                <TableHead>{t('columns.note')}</TableHead>
                <TableHead className="w-[15%] text-end">{t('columns.amount')}</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.expenses.map((e) => {
                // A voided expense stays for the record, but reads as cancelled: greyed, struck through, with who, when and why.
                const voided = !!e.voidedAt;
                return (
                  <TableRow key={e.id} id={e.id} className={cn(voided && 'text-muted-foreground')}>
                    <TableCell>{f.date(e.spentOn)}</TableCell>
                    <TableCell>
                      <p className={cn('font-medium', voided && 'line-through')}><bdi>{e.category}</bdi></p>
                      {voided ? (
                        <ToneBadge tone="danger" className="mt-1">{e.replacedById ? tc('corrected') : t('voided')}</ToneBadge>
                      ) : e.replacesId ? (
                        <p className="mt-1 text-xs text-muted-foreground">{tc('correction')}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-80 whitespace-normal">
                      <bdi className={cn(voided && 'line-through', !e.note && 'text-muted-foreground')}>{e.note ?? '—'}</bdi>
                      {voided ? (
                        <p className="mt-0.5 text-xs text-destructive/80">
                          {e.voidedBy ? tc('cancelledBy', { name: e.voidedBy, date: f.date(e.voidedAt!) }) : tc('cancelledOn', { date: f.date(e.voidedAt!) })}
                          {e.voidReason ? <> — <bdi>{e.voidReason}</bdi></> : null}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-end" data-sensitive>
                      <Amount value={e.amount} className={cn('font-semibold', voided && 'font-normal text-muted-foreground line-through')} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Link className="px-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" href={`/money/ledger?sourceType=expense&sourceId=${e.id}`}>
                          {t('trace')}
                        </Link>
                        {!voided ? (
                          <>
                            <ExpenseForm categories={categories} expense={{ id: e.id, category: e.category, amount: e.amount, spentOn: e.spentOn, note: e.note }} />
                            <VoidExpense id={e.id} />
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </>
        )}
      </TablePanel>
    </Page>
  );
}
