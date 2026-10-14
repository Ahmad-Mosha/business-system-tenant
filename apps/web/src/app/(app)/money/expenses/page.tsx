import { Receipt } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ExpenseForm, VoidExpense } from '@/components/expense-form';
import { Amount } from '@/components/amount';
import { FilterBar } from '@/components/filter-bar';
import { MetricCard, MetricGrid } from '@/components/metric-card';
import { Page, PageHeader } from '@/components/page';
import { TableEmpty, TablePagination, TablePanel } from '@/components/table-panel';
import { CancelledToggle, toggleCancelledHref } from '@/components/cancelled-toggle';
import { ToneBadge } from '@/components/tone-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { getExpenseCategories, getExpenses } from '@/lib/api';
import { requireAdmin } from '@/lib/session';
import { getFormat } from '@/i18n/get-format';

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const q = new URLSearchParams();
  for (const key of ['category', 'search', 'from', 'to', 'page', 'cancelled']) if (params[key]) q.set(key, params[key]);
  const showCancelled = params.cancelled === '1';
  const [data, categories, t, tc, f] = await Promise.all([getExpenses(q.toString()), getExpenseCategories(), getTranslations('expenses'), getTranslations('corrections'), getFormat()]);
  const pageHref = (page: number) => {
    const next = new URLSearchParams(q);
    if (page > 1) next.set('page', String(page));
    else next.delete('page');
    const query = next.toString();
    return query ? `/money/expenses?${query}` : '/money/expenses';
  };
  const lastPage = Math.max(Math.ceil(data.total / 50), 1);
  if (data.page > lastPage) redirect(pageHref(lastPage));

  return <Page fill>
    <PageHeader title={t('title')} description={t('description')} actions={<ExpenseForm categories={categories} />} />
    <MetricGrid><MetricCard label={t('total')} value={<Amount value={data.totalAmount} />} hint={t('totalHint')} /></MetricGrid>
    <FilterBar search={{ param: 'search', placeholder: t('search') }} filters={[{ kind: 'select', param: 'category', all: t('allCategories'), options: categories.map((c) => ({ value: c.id, label: c.name })) }, { kind: 'dates', from: 'from', to: 'to' }]} />
    <TablePanel minWidth="48rem" footer={<>
      <TablePagination page={data.page} pageSize={50} total={data.total} count={data.expenses.length} noun="expenses" href={pageHref} />
      {data.cancelled > 0 || showCancelled ? <CancelledToggle shown={showCancelled} href={toggleCancelledHref('/money/expenses', params, showCancelled)} /> : null}
    </>}>
      {!data.expenses.length ? <TableEmpty icon={Receipt} title={t('empty')} description={t('emptyHint')} /> : <Table><TableHeader><TableRow>
        <TableHead>{t('date')}</TableHead><TableHead>{t('category')}</TableHead><TableHead>{t('note')}</TableHead><TableHead className="text-end">{t('amount')}</TableHead><TableHead>{t('status')}</TableHead><TableHead />
      </TableRow></TableHeader><TableBody>{data.expenses.map((e) => {
        // A voided expense stays for the record, but reads as cancelled: greyed, its amount struck through, and the reason under it.
        const voided = !!e.voidedAt;
        return <TableRow key={e.id} id={e.id} className={cn(voided && 'text-muted-foreground')}>
        <TableCell>{f.date(e.spentOn)}</TableCell><TableCell><bdi className={cn(voided && 'line-through')}>{e.category}</bdi></TableCell><TableCell className="max-w-80 whitespace-normal"><bdi className={cn(voided && 'line-through')}>{e.note ?? '—'}</bdi>
          {e.replacesId ? <p className="mt-0.5 text-xs text-muted-foreground">{tc('correction')}</p> : null}
          {voided ? <p className="mt-0.5 text-xs text-destructive/80">
            {e.voidedBy ? tc('cancelledBy', { name: e.voidedBy, date: f.date(e.voidedAt!) }) : tc('cancelledOn', { date: f.date(e.voidedAt!) })}
            {e.voidReason ? <> — <bdi>{e.voidReason}</bdi></> : null}
          </p> : null}</TableCell>
        <TableCell className="text-end"><Amount value={e.amount} className={cn(voided && 'text-muted-foreground line-through')} /></TableCell><TableCell>{voided ? <ToneBadge tone="danger">{e.replacedById ? tc('corrected') : t('voided')}</ToneBadge> : <ToneBadge tone="success">{t('recorded')}</ToneBadge>}</TableCell>
        <TableCell><div className="flex items-center justify-end gap-3"><Link className="text-xs underline" href={`/money/ledger?sourceType=expense&sourceId=${e.id}`}>{t('trace')}</Link>{!e.voidedAt ? <><ExpenseForm categories={categories} expense={{ id: e.id, category: e.category, amount: e.amount, spentOn: e.spentOn, note: e.note }} /><VoidExpense id={e.id} /></> : null}</div></TableCell>
      </TableRow>;
      })}</TableBody></Table>}
    </TablePanel>
  </Page>;
}
