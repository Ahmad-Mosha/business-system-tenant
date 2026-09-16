import { Receipt } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ExpenseForm, VoidExpense } from '@/components/expense-form';
import { Amount } from '@/components/amount';
import { FilterBar } from '@/components/filter-bar';
import { MetricCard, MetricGrid } from '@/components/metric-card';
import { Page, PageHeader } from '@/components/page';
import { TableEmpty, TablePagination, TablePanel } from '@/components/table-panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getExpenseCategories, getExpenses } from '@/lib/api';
import { requireAdmin } from '@/lib/session';
import { getFormat } from '@/i18n/get-format';

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const q = new URLSearchParams();
  for (const key of ['category', 'search', 'from', 'to', 'page']) if (params[key]) q.set(key, params[key]);
  const [data, categories, t, f] = await Promise.all([getExpenses(q.toString()), getExpenseCategories(), getTranslations('expenses'), getFormat()]);
  return <Page fill>
    <PageHeader title={t('title')} description={t('description')} actions={<ExpenseForm categories={categories} />} />
    <MetricGrid><MetricCard label={t('total')} value={<Amount value={data.totalAmount} />} hint={t('totalHint')} /></MetricGrid>
    <FilterBar search={{ param: 'search', placeholder: t('search') }} filters={[{ kind: 'select', param: 'category', all: t('allCategories'), options: categories.map((c) => ({ value: c.id, label: c.name })) }, { kind: 'dates', from: 'from', to: 'to' }]} />
    <TablePanel minWidth="48rem" footer={<TablePagination page={data.page} pageSize={50} total={data.total} count={data.expenses.length} noun="expenses" href={(page) => { const next = new URLSearchParams(q); next.set('page', String(page)); return `/money/expenses?${next}`; }} />}>
      {!data.expenses.length ? <TableEmpty icon={Receipt} title={t('empty')} description={t('emptyHint')} /> : <Table><TableHeader><TableRow>
        <TableHead>{t('date')}</TableHead><TableHead>{t('category')}</TableHead><TableHead>{t('note')}</TableHead><TableHead className="text-end">{t('amount')}</TableHead><TableHead>{t('status')}</TableHead><TableHead />
      </TableRow></TableHeader><TableBody>{data.expenses.map((e) => <TableRow key={e.id} id={e.id}>
        <TableCell>{f.date(e.spentOn)}</TableCell><TableCell><bdi>{e.category}</bdi></TableCell><TableCell className="max-w-80 whitespace-normal"><bdi>{e.note ?? '—'}</bdi>{e.voidReason ? <p className="text-xs text-muted-foreground"><bdi>{e.voidReason}</bdi></p> : null}</TableCell>
        <TableCell className="text-end"><Amount value={e.amount} /></TableCell><TableCell>{t(e.voidedAt ? 'voided' : 'recorded')}</TableCell>
        <TableCell><div className="flex items-center justify-end gap-3"><Link className="text-xs underline" href={`/money/ledger?sourceType=expense&sourceId=${e.id}`}>{t('trace')}</Link>{!e.voidedAt ? <VoidExpense id={e.id} /> : null}</div></TableCell>
      </TableRow>)}</TableBody></Table>}
    </TablePanel>
  </Page>;
}
