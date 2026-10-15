import { HandCoins, PackagePlus, Truck, Users } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Amount } from '@/components/amount';
import { FilterBar } from '@/components/filter-bar';
import { QuickViews, SummaryMetric, SummaryStrip } from '@/components/list-page';
import { Page, PageHeader } from '@/components/page';
import { SupplierForm } from '@/components/supplier-form';
import { TableCount, TableEmpty, TablePanel } from '@/components/table-panel';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFormat } from '@/i18n/get-format';
import { getSuppliers, type SupplierRow } from '@/lib/api';
import { money } from '@/lib/format';
import { requireAdmin } from '@/lib/session';

const owed = (s: SupplierRow) => Number(s.balance) > 0.005;
const VIEWS = ['owed', 'settled', 'archived'] as const;
type View = (typeof VIEWS)[number];

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [f, t, tr] = await Promise.all([getFormat(), getTranslations('money.suppliers'), getTranslations()]);
  await requireAdmin();
  const params = await searchParams;
  // `status=archived` is the old link to the archive; it still lands there.
  const view = (VIEWS as readonly string[]).includes(params.view ?? '')
    ? (params.view as View)
    : params.status === 'archived' ? 'archived' : undefined;
  const search = params.search?.trim().toLowerCase();

  const [active, archived] = await Promise.all([getSuppliers(), getSuppliers(true)]);
  const owedTo = active.filter(owed);
  const total = owedTo.reduce((n, s) => n + Number(s.balance), 0);
  const bought = active.reduce((n, s) => n + Number(s.bought ?? 0), 0);

  const matches = (s: SupplierRow) =>
    !search || s.name.toLowerCase().includes(search) || (s.phone ?? '').includes(search) || (s.note ?? '').toLowerCase().includes(search);
  const pools: Record<'all' | View, SupplierRow[]> = {
    all: active.filter(matches),
    owed: owedTo.filter(matches),
    settled: active.filter((s) => !owed(s)).filter(matches),
    archived: archived.filter(matches),
  };
  // Whoever we owe most first, then whoever we buy most from, then by name.
  const shown = [...pools[view ?? 'all']].sort(
    (a, b) => Number(b.balance) - Number(a.balance) || Number(b.bought ?? 0) - Number(a.bought ?? 0) || a.name.localeCompare(b.name),
  );
  const href = (v?: View) => {
    const q = new URLSearchParams();
    if (v) q.set('view', v);
    if (params.search) q.set('search', params.search);
    return q.size ? `/money/suppliers?${q}` : '/money/suppliers';
  };

  return (
    <Page>
      <PageHeader title={tr('nav.items.suppliers')} description={t('description')} actions={<SupplierForm />} />

      <SummaryStrip label={tr('nav.items.suppliers')}>
        <SummaryMetric label={tr('nav.items.suppliers')} icon={Truck} value={f.count(active.length)} hint={t('active')} />
        <SummaryMetric
          label={t('owedTotal')}
          icon={HandCoins}
          value={<Amount value={total} />}
          hint={total > 0 ? t('across', { suppliers: tr('nouns.suppliers', { count: owedTo.length }) }) : t('nobodyOwed')}
          href={total > 0 ? '/money/suppliers?view=owed' : undefined}
          attention={total > 0}
          sensitive
        />
        <SummaryMetric label={t('boughtTotal')} icon={PackagePlus} value={<Amount value={bought} />} hint={t('boughtHint')} sensitive />
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

      <TablePanel minWidth="50rem" footer={<TableCount>{tr('nouns.suppliers', { count: shown.length })}</TableCount>}>
        {shown.length === 0 ? (
          active.length + archived.length === 0 ? (
            <TableEmpty icon={Users} title={t('empty')} description={t('emptyHint')} action={<SupplierForm />} />
          ) : (
            <TableEmpty
              icon={Users}
              title={view === 'archived' && !search ? t('archivedEmpty') : t('noMatch')}
              action={
                <Button variant="outline" asChild>
                  <Link href="/money/suppliers">{tr('filters.resetFilters')}</Link>
                </Button>
              }
            />
          )
        ) : (
          <>
            <ul className="divide-y md:hidden">
              {shown.map((s) => (
                <li key={s.id} className="relative flex items-start justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <SupplierLink supplier={s} />
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[s.phone, s.note].filter(Boolean).map((part, i) => <span key={i}>{i ? ' · ' : ''}<bdi>{part}</bdi></span>)}
                    </p>
                  </div>
                  <div className="shrink-0 text-end" data-sensitive>
                    <Balance supplier={s} settled={t('settled')} />
                    <p className="mt-1 text-xs text-muted-foreground">{t('boughtAmount', { amount: money(s.bought ?? 0) })}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Table className="hidden md:table [&_td]:h-[4.25rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.supplier')}</TableHead>
                  <TableHead className="w-[16%]">{t('columns.phone')}</TableHead>
                  <TableHead className="w-[17%]">{t('columns.lastInvoice')}</TableHead>
                  <TableHead className="w-[16%] text-end">{t('columns.bought')}</TableHead>
                  <TableHead className="w-[16%] text-end">{t('columns.balance')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((s) => (
                  <TableRow key={s.id} className="relative">
                    <TableCell className="max-w-0">
                      <SupplierLink supplier={s} />
                      {s.note ? <p className="mt-1 truncate text-xs text-muted-foreground"><bdi>{s.note}</bdi></p> : null}
                    </TableCell>
                    <TableCell className="num text-muted-foreground"><bdi>{s.phone ?? '—'}</bdi></TableCell>
                    <TableCell>
                      {s.lastInvoiceAt ? (
                        <>
                          <p>{f.date(s.lastInvoiceAt)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{tr('nouns.invoices', { count: s.invoiceCount ?? 0 })}</p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">{t('noInvoicesYet')}</span>
                      )}
                    </TableCell>
                    <TableCell className="num text-end" data-sensitive>{Number(s.bought ?? 0) > 0 ? money(s.bought ?? 0) : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-end" data-sensitive><Balance supplier={s} settled={t('settled')} /></TableCell>
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

function SupplierLink({ supplier: s }: { supplier: SupplierRow }) {
  return (
    <Link
      href={`/money/suppliers/${s.id}`}
      className="block truncate font-semibold after:absolute after:inset-0 hover:text-highlight hover:underline hover:underline-offset-4 focus-visible:underline focus-visible:outline-none"
    >
      <bdi>{s.name}</bdi>
    </Link>
  );
}

function Balance({ supplier: s, settled }: { supplier: SupplierRow; settled: string }) {
  return owed(s) ? (
    <span className="num font-semibold text-warning">{money(s.balance)}</span>
  ) : (
    <span className="text-sm text-muted-foreground">{settled}</span>
  );
}
