import { Contact, HandCoins, ReceiptText, Store } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Amount } from '@/components/amount';
import { CustomerForm } from '@/components/customer-form';
import { FilterBar } from '@/components/filter-bar';
import { QuickViews, SummaryMetric, SummaryStrip } from '@/components/list-page';
import { Page, PageHeader } from '@/components/page';
import { TableCount, TableEmpty, TablePanel } from '@/components/table-panel';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFormat } from '@/i18n/get-format';
import { getCustomers, type CustomerRow } from '@/lib/api';
import { money } from '@/lib/format';
import { requireAdmin } from '@/lib/session';

const owes = (c: CustomerRow) => Number(c.balance) > 0.005;
const VIEWS = ['owing', 'settled', 'archived'] as const;
type View = (typeof VIEWS)[number];

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [f, t, tr] = await Promise.all([getFormat(), getTranslations('customers'), getTranslations()]);
  await requireAdmin();
  const params = await searchParams;
  // `status=archived` is the old link to the archive; it still lands there.
  const view = (VIEWS as readonly string[]).includes(params.view ?? '')
    ? (params.view as View)
    : params.status === 'archived' ? 'archived' : undefined;
  const search = params.search?.trim().toLowerCase();

  const [active, archived] = await Promise.all([getCustomers(), getCustomers(true)]);
  const owing = active.filter(owes);
  const owed = owing.reduce((n, c) => n + Number(c.balance), 0);
  const sold = active.reduce((n, c) => n + Number(c.sold ?? 0), 0);

  const matches = (c: CustomerRow) =>
    !search || c.name.toLowerCase().includes(search) || (c.phone ?? '').includes(search) || (c.note ?? '').toLowerCase().includes(search);
  const pools: Record<'all' | View, CustomerRow[]> = {
    all: active.filter(matches),
    owing: owing.filter(matches),
    settled: active.filter((c) => !owes(c)).filter(matches),
    archived: archived.filter(matches),
  };
  // Who owes most first; otherwise by name.
  const shown = [...pools[view ?? 'all']].sort((a, b) => Number(b.balance) - Number(a.balance) || a.name.localeCompare(b.name));
  const href = (v?: View) => {
    const q = new URLSearchParams();
    if (v) q.set('view', v);
    if (params.search) q.set('search', params.search);
    return q.size ? `/customers?${q}` : '/customers';
  };

  return (
    <Page>
      <PageHeader title={t('title')} description={t('description')} actions={<CustomerForm />} />

      <SummaryStrip label={t('title')}>
        <SummaryMetric label={t('total')} icon={Store} value={f.count(active.length)} hint={t('activeHint')} />
        <SummaryMetric
          label={t('owedTotal')}
          icon={HandCoins}
          value={<Amount value={owed} />}
          hint={owed > 0 ? t('across', { customers: tr('nouns.customers', { count: owing.length }) }) : t('nobodyOwes')}
          href={owed > 0 ? '/customers?view=owing' : undefined}
          attention={owed > 0}
          sensitive
        />
        <SummaryMetric label={t('soldTotal')} icon={ReceiptText} value={<Amount value={sold} />} hint={t('soldHint')} sensitive />
      </SummaryStrip>

      <div className="flex flex-col gap-3">
        <QuickViews
          label={t('views.label')}
          views={[
            { key: 'all', label: tr('common.all'), count: f.count(pools.all.length), href: href(), current: !view },
            ...VIEWS.map((v) => ({ key: v, label: t(`views.${v}`), count: f.count(pools[v].length), href: href(v), current: view === v })),
          ]}
        />
        <FilterBar search={{ param: 'search', placeholder: t('search') }} filters={[]} />
      </div>

      <TablePanel minWidth="50rem" footer={<TableCount>{tr('nouns.customers', { count: shown.length })}</TableCount>}>
        {shown.length === 0 ? (
          active.length + archived.length === 0 ? (
            <TableEmpty icon={Contact} title={t('empty')} description={t('emptyHint')} action={<CustomerForm />} />
          ) : (
            <TableEmpty
              icon={Contact}
              title={view === 'archived' && !search ? t('archivedEmpty') : t('noMatch')}
              action={
                <Button variant="outline" asChild>
                  <Link href="/customers">{tr('filters.resetFilters')}</Link>
                </Button>
              }
            />
          )
        ) : (
          <>
            <ul className="divide-y md:hidden">
              {shown.map((c) => (
                <li key={c.id} className="relative flex items-start justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <CustomerLink customer={c} />
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[c.phone, c.note].filter(Boolean).map((part, i) => <span key={i}>{i ? ' · ' : ''}<bdi>{part}</bdi></span>)}
                    </p>
                  </div>
                  <div className="shrink-0 text-end" data-sensitive>
                    <Balance customer={c} settled={t('settled')} />
                    <p className="mt-1 text-xs text-muted-foreground">{t('soldAmount', { amount: money(c.sold ?? 0) })}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Table className="hidden md:table [&_td]:h-[4.25rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.customer')}</TableHead>
                  <TableHead className="w-[16%]">{t('columns.phone')}</TableHead>
                  <TableHead className="w-[17%]">{t('columns.lastInvoice')}</TableHead>
                  <TableHead className="w-[16%] text-end">{t('columns.sold')}</TableHead>
                  <TableHead className="w-[16%] text-end">{t('columns.balance')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((c) => (
                  <TableRow key={c.id} className="relative">
                    <TableCell className="max-w-0">
                      <CustomerLink customer={c} />
                      {c.note ? <p className="mt-1 truncate text-xs text-muted-foreground"><bdi>{c.note}</bdi></p> : null}
                    </TableCell>
                    <TableCell className="num text-muted-foreground"><bdi>{c.phone ?? '—'}</bdi></TableCell>
                    <TableCell>
                      {c.lastInvoiceAt ? (
                        <>
                          <p>{f.date(c.lastInvoiceAt)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{tr('nouns.invoices', { count: c.invoiceCount ?? 0 })}</p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">{t('noInvoicesYet')}</span>
                      )}
                    </TableCell>
                    <TableCell className="num text-end" data-sensitive>{Number(c.sold ?? 0) > 0 ? money(c.sold ?? 0) : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-end" data-sensitive><Balance customer={c} settled={t('settled')} /></TableCell>
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

function CustomerLink({ customer: c }: { customer: CustomerRow }) {
  return (
    <Link
      href={`/customers/${c.id}`}
      className="block truncate font-semibold after:absolute after:inset-0 hover:text-highlight hover:underline hover:underline-offset-4 focus-visible:underline focus-visible:outline-none"
    >
      <bdi>{c.name}</bdi>
    </Link>
  );
}

function Balance({ customer: c, settled }: { customer: CustomerRow; settled: string }) {
  return owes(c) ? (
    <span className="num font-semibold text-warning">{money(c.balance)}</span>
  ) : (
    <span className="text-sm text-muted-foreground">{settled}</span>
  );
}
