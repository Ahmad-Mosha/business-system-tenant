import { CalendarRange, ClipboardList, FilePen, HandCoins, Plus } from 'lucide-react';
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
import { getPurchases, type PurchaseInvoiceRow } from '@/lib/api';
import { money, monthStart } from '@/lib/format';
import { purchaseDue } from '@/lib/money';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';

/** The same views as sales invoices: drafts, what we still owe, what's settled, and the cancelled. */
const VIEWS = {
  draft: (i: PurchaseInvoiceRow) => i.status === 'DRAFT',
  due: (i: PurchaseInvoiceRow) => purchaseDue(i) > 0.005,
  paid: (i: PurchaseInvoiceRow) => i.status === 'POSTED' && purchaseDue(i) <= 0.005,
  cancelled: (i: PurchaseInvoiceRow) => i.status === 'VOID',
} as const;
type View = keyof typeof VIEWS;

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [f, t, tr] = await Promise.all([getFormat(), getTranslations('money.purchases'), getTranslations()]);
  await requireAdmin();
  const params = await searchParams;
  const view = (params.view && params.view in VIEWS ? params.view : params.cancelled === '1' ? 'cancelled' : undefined) as View | undefined;
  const search = params.search?.trim().toLowerCase();
  const everything = await getPurchases(true);

  const since = monthStart();
  const posted = everything.filter((i) => i.status === 'POSTED');
  const monthTotal = posted.filter((i) => String(i.invoiceDate).slice(0, 10) >= since).reduce((n, i) => n + Number(i.landedTotal), 0);
  const drafts = everything.filter((i) => i.status === 'DRAFT');
  // The same derivation supplier balances use, so the two can't disagree.
  const owing = posted.filter((i) => purchaseDue(i) > 0.005);
  const owed = owing.reduce((n, i) => n + purchaseDue(i), 0);

  const matches = (i: PurchaseInvoiceRow) =>
    !search || i.supplierName.toLowerCase().includes(search) || (i.invoiceNo ?? '').toLowerCase().includes(search);
  const searched = everything.filter(matches);
  const shown = searched.filter(view ? VIEWS[view] : (i) => i.status !== 'VOID');
  const href = (v?: View) => {
    const q = new URLSearchParams();
    if (v) q.set('view', v);
    if (params.search) q.set('search', params.search);
    return q.size ? `/money/purchases?${q}` : '/money/purchases';
  };

  const newInvoice = (
    <Button asChild>
      <Link href="/money/purchases/new">
        <Plus />
        {t('newInvoice')}
      </Link>
    </Button>
  );

  return (
    <Page>
      <PageHeader title={tr('nav.items.purchases')} description={t('description')} actions={newInvoice} />

      <SummaryStrip label={tr('nav.items.purchases')}>
        <SummaryMetric label={t('boughtThisMonth')} icon={CalendarRange} value={<Amount value={monthTotal} />} hint={t('boughtHint')} sensitive />
        <SummaryMetric
          label={t('owed')}
          icon={HandCoins}
          value={<Amount value={owed} />}
          hint={owed > 0.005 ? tr('nouns.invoices', { count: owing.length }) : t('owedNone')}
          href={owed > 0.005 ? '/money/purchases?view=due' : undefined}
          attention={owed > 0.005}
          sensitive
        />
        <SummaryMetric
          label={t('drafts')}
          icon={FilePen}
          value={f.count(drafts.length)}
          hint={drafts.length ? t('draftsSome') : t('draftsNone')}
          href={drafts.length ? '/money/purchases?view=draft' : undefined}
          attention={drafts.length > 0}
          hintAttention={false}
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
            <TableEmpty icon={ClipboardList} title={t('empty')} description={t('emptyHint')} action={newInvoice} />
          ) : (
            <TableEmpty
              icon={ClipboardList}
              title={t('noMatch')}
              action={
                <Button variant="outline" asChild>
                  <Link href="/money/purchases">{tr('filters.resetFilters')}</Link>
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
                    <InvoiceLink invoice={i} noRef={t('noRef')} />
                    <p className="mt-1 truncate font-medium"><bdi>{i.supplierName}</bdi></p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {f.date(i.invoiceDate)} · {tr(`enums.purchasePayment.${i.payment}`)}
                    </p>
                  </div>
                  <div className="shrink-0 text-end" data-sensitive>
                    <Total invoice={i} egp={tr('common.egp')} />
                    <div className="mt-1.5 flex justify-end"><PaidChip status={i.paidStatus} /></div>
                    {purchaseDue(i) > 0.005 ? <p className="num mt-1 text-xs text-warning">{tr('sales.dueAmount', { amount: money(purchaseDue(i)) })}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
            <Table className="hidden md:table [&_td]:h-[4.25rem]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[17%]">{t('columns.invoice')}</TableHead>
                  <TableHead>{t('columns.supplier')}</TableHead>
                  <TableHead className="w-[15%]">{t('columns.status')}</TableHead>
                  <TableHead className="w-[17%] text-end">{t('columns.total')}</TableHead>
                  <TableHead className="w-[17%] text-end">{tr('sales.columns.remaining')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((i) => (
                  <TableRow key={i.id} className={cn('relative', i.status === 'VOID' && 'text-muted-foreground')}>
                    <TableCell>
                      <InvoiceLink invoice={i} noRef={t('noRef')} />
                      <p className="mt-1 text-xs text-muted-foreground">{f.date(i.invoiceDate)}</p>
                    </TableCell>
                    <TableCell className="max-w-0">
                      <p className="truncate font-medium"><bdi>{i.supplierName}</bdi></p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {tr('nouns.lines', { count: i.lineCount })} · {tr(`enums.purchasePayment.${i.payment}`)}
                      </p>
                    </TableCell>
                    <TableCell><PaidChip status={i.paidStatus} /></TableCell>
                    <TableCell className="text-end" data-sensitive><Total invoice={i} egp={tr('common.egp')} /></TableCell>
                    <TableCell className="num text-end" data-sensitive>
                      {purchaseDue(i) > 0.005 ? (
                        <span className="font-semibold text-warning">{money(purchaseDue(i))}</span>
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

function InvoiceLink({ invoice: i, noRef }: { invoice: PurchaseInvoiceRow; noRef: string }) {
  return (
    <Link
      href={`/money/purchases/${i.id}`}
      className={cn(
        'after:absolute after:inset-0 hover:text-highlight hover:underline hover:underline-offset-4',
        i.invoiceNo ? 'font-semibold' : 'font-medium text-muted-foreground',
      )}
    >
      {i.invoiceNo ? <bdi>{i.invoiceNo}</bdi> : noRef}
    </Link>
  );
}

function Total({ invoice: i, egp }: { invoice: PurchaseInvoiceRow; egp: string }) {
  return (
    <span className={cn('num text-[15px] font-semibold', i.status === 'VOID' && 'font-normal text-muted-foreground line-through')}>
      {money(i.landedTotal)} <span className="text-xs font-normal text-muted-foreground">{egp}</span>
    </span>
  );
}
