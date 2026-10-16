import { FilePen, FileText, HandCoins, Plus, ReceiptText, Wallet } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Amount } from '@/components/amount';
import { FilterBar } from '@/components/filter-bar';
import { QuickViews, SummaryMetric, SummaryStrip } from '@/components/list-page';
import { Page, PageHeader } from '@/components/page';
import { PaidChip } from '@/components/paid-chip';
import { TableCount, TableEmpty, TablePanel } from '@/components/table-panel';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFormat } from '@/i18n/get-format';
import { getSalesInvoices, type SalesInvoiceRow } from '@/lib/api';
import { money } from '@/lib/format';
import { salesDue, salesState } from '@/lib/sales';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';

/**
 * The views an owner asks for: what's still a draft, who hasn't paid, what's
 * settled. Cancelled invoices live in their own view, out of "All".
 */
const VIEWS = {
  draft: (i: SalesInvoiceRow) => i.status === 'DRAFT',
  due: (i: SalesInvoiceRow) => salesDue(i) > 0.005,
  paid: (i: SalesInvoiceRow) => i.status === 'POSTED' && salesDue(i) <= 0.005,
  cancelled: (i: SalesInvoiceRow) => i.status === 'VOID',
} as const;
type View = keyof typeof VIEWS;

export default async function SalesInvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [f, t, tr] = await Promise.all([getFormat(), getTranslations('sales'), getTranslations()]);
  await requireAdmin();
  const params = await searchParams;
  const view = (params.view && params.view in VIEWS ? params.view : undefined) as View | undefined;
  const search = params.search?.trim().toLowerCase();

  const everything = await getSalesInvoices(true);
  const live = everything.filter((i) => i.status !== 'VOID');
  const posted = live.filter((i) => i.status === 'POSTED');
  const drafts = live.filter((i) => i.status === 'DRAFT');
  const sold = posted.reduce((n, i) => n + Number(i.total), 0);
  const collected = posted.reduce((n, i) => n + Number(i.paidAmount), 0);
  const owing = posted.filter((i) => salesDue(i) > 0.005);
  const owed = owing.reduce((n, i) => n + salesDue(i), 0);
  const draftValue = drafts.reduce((n, i) => n + Number(i.total), 0);

  const matches = (i: SalesInvoiceRow) =>
    !search || i.customerName.toLowerCase().includes(search) || (i.invoiceNumber ?? '').toLowerCase().includes(search);
  const searched = everything.filter(matches);
  const shown = searched.filter(view ? VIEWS[view] : (i) => i.status !== 'VOID');
  const href = (v?: View) => {
    const q = new URLSearchParams();
    if (v) q.set('view', v);
    if (params.search) q.set('search', params.search);
    return q.size ? `/sales?${q}` : '/sales';
  };

  const newInvoice = (
    <Button asChild>
      <Link href="/sales/new">
        <Plus />
        {t('new')}
      </Link>
    </Button>
  );

  return (
    <Page>
      <PageHeader title={t('title')} description={t('description')} actions={newInvoice} />

      <SummaryStrip label={t('title')}>
        <SummaryMetric
          label={t('sold')}
          icon={ReceiptText}
          value={<Amount value={sold} />}
          hint={t('postedCount', { count: posted.length })}
          sensitive
        />
        <SummaryMetric
          label={t('owed')}
          icon={HandCoins}
          value={<Amount value={owed} />}
          hint={owed > 0 ? tr('nouns.invoices', { count: owing.length }) : t('nothingOwed')}
          href={owed > 0 ? '/sales?view=due' : undefined}
          attention={owed > 0}
          sensitive
        />
        <SummaryMetric
          label={t('collected')}
          icon={Wallet}
          value={<Amount value={collected} />}
          hint={t('collectedHint')}
          sensitive
        />
        <SummaryMetric
          label={t('drafts')}
          icon={FilePen}
          value={f.count(drafts.length)}
          hint={drafts.length ? t('draftValueOf', { amount: money(draftValue) }) : t('draftsHint')}
          href={drafts.length ? '/sales?view=draft' : undefined}
        />
      </SummaryStrip>

      <div className="flex flex-col gap-3">
        <QuickViews
          label={t('views.label')}
          views={[
            { key: 'all', label: tr('common.all'), count: f.count(searched.filter((i) => i.status !== 'VOID').length), href: href(), current: !view },
            ...(Object.keys(VIEWS) as View[]).map((v) => ({
              key: v,
              label: t(`views.${v}`),
              count: f.count(searched.filter(VIEWS[v]).length),
              href: href(v),
              current: view === v,
            })),
          ]}
        />
        <FilterBar search={{ param: 'search', placeholder: t('search') }} filters={[]} />
      </div>

      <TablePanel minWidth="52rem" footer={<TableCount>{tr('nouns.invoices', { count: shown.length })}</TableCount>}>
        {shown.length === 0 ? (
          everything.length === 0 ? (
            <TableEmpty icon={FileText} title={t('empty')} description={t('emptyHint')} action={newInvoice} />
          ) : (
            <TableEmpty
              icon={FileText}
              title={t('noMatch')}
              action={
                <Button variant="outline" asChild>
                  <Link href="/sales">{tr('filters.resetFilters')}</Link>
                </Button>
              }
            />
          )
        ) : (
          <>
            <ul className="divide-y md:hidden">
              {shown.map((i) => (
                <li key={i.id} className="relative flex items-start justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <InvoiceLink invoice={i} draftLabel={t('draftNumber')} />
                    <p className="mt-1 truncate font-medium"><bdi>{i.customerName}</bdi></p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{f.date(i.invoiceDate)} · {tr('nouns.lines', { count: i.lineCount })}</p>
                  </div>
                  <div className="shrink-0 text-end">
                    <Total invoice={i} egp={tr('common.egp')} />
                    <div className="mt-1.5 flex justify-end"><PaidChip status={salesState(i)} /></div>
                    {salesDue(i) > 0.005 ? <p className="num mt-1 text-xs text-warning">{t('dueAmount', { amount: money(salesDue(i)) })}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
            <Table className="hidden md:table [&_td]:h-[4.25rem]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[16%]">{t('columns.invoice')}</TableHead>
                  <TableHead>{t('columns.customer')}</TableHead>
                  <TableHead className="w-[15%]">{t('columns.status')}</TableHead>
                  <TableHead className="w-[17%] text-end">{t('columns.total')}</TableHead>
                  <TableHead className="w-[17%] text-end">{t('columns.remaining')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((i) => (
                  <TableRow key={i.id} className={cn('relative', i.status === 'VOID' && 'text-muted-foreground')}>
                    <TableCell>
                      <InvoiceLink invoice={i} draftLabel={t('draftNumber')} />
                      <p className="mt-1 text-xs text-muted-foreground">{f.date(i.invoiceDate)}</p>
                    </TableCell>
                    <TableCell className="max-w-0">
                      <p className="truncate font-medium"><bdi>{i.customerName}</bdi></p>
                      <p className="mt-1 text-xs text-muted-foreground">{tr('nouns.lines', { count: i.lineCount })}</p>
                    </TableCell>
                    <TableCell><PaidChip status={salesState(i)} /></TableCell>
                    <TableCell className="text-end" data-sensitive><Total invoice={i} egp={tr('common.egp')} /></TableCell>
                    <TableCell className="num text-end" data-sensitive>
                      {salesDue(i) > 0.005 ? (
                        <span className="font-semibold text-warning">{money(salesDue(i))}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </TablePanel>
    </Page>
  );
}

function InvoiceLink({ invoice: i, draftLabel }: { invoice: SalesInvoiceRow; draftLabel: string }) {
  return (
    <Link
      href={`/sales/${i.id}`}
      className={cn(
        'after:absolute after:inset-0 hover:text-highlight hover:underline hover:underline-offset-4',
        i.invoiceNumber ? 'num font-semibold' : 'font-medium text-muted-foreground',
      )}
    >
      {i.invoiceNumber ?? draftLabel}
    </Link>
  );
}

function Total({ invoice: i, egp }: { invoice: SalesInvoiceRow; egp: string }) {
  return (
    <span className={cn('num text-[15px] font-semibold', i.status === 'VOID' && 'font-normal text-muted-foreground line-through')}>
      {money(i.total)} <span className="text-xs font-normal text-muted-foreground no-underline">{egp}</span>
    </span>
  );
}
