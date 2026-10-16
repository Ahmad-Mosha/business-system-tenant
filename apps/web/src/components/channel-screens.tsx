import { ArrowDown, ArrowUp, ArrowUpDown, BarChart3, ChevronLeft, Landmark, Percent, ShoppingBag, Upload, Wallet } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Amount } from '@/components/amount';
import { FilterBar } from '@/components/filter-bar';
import { ImportForm } from '@/components/import-form';
import { SummaryMetric, SummaryStrip } from '@/components/list-page';
import { OpeningBalanceForm } from '@/components/opening-balance-form';
import { Page, PageHeader } from '@/components/page';
import { PeriodTabs } from '@/components/period-tabs';
import { TableCount, TableEmpty, TablePanel } from '@/components/table-panel';
import { ToneBadge } from '@/components/tone-badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getFormat } from '@/i18n/get-format';
import { b, strong } from '@/i18n/rich';
import {
  channelPath,
  getChannelAccount,
  getChannelImports,
  getChannelPeriods,
  getChannelProducts,
  getChannelRange,
  getChannelStatement,
  getChannelUnattributed,
  type ChannelProduct,
  type ChannelStatement,
  type Marketplace,
  UNATTRIBUTED_TYPES,
} from '@/lib/channels';
import { money, moneyWhole } from '@/lib/format';
import { cn, isOneOf } from '@/lib/utils';

/** Months offered as tabs; older ones open from the month table. */
const TAB_MONTHS = 6;

type Params = Record<string, string | undefined>;

/**
 * One marketplace at a glance: the period's figures, the statement behind
 * them, its best products, month by month, and the balance it all runs from.
 */
export async function ChannelOverview({ channel, params }: { channel: Marketplace; params: Params }) {
  const [f, t, tr] = await Promise.all([getFormat(), getTranslations('channel'), getTranslations()]);
  const name = t(`name.${channel}`);
  const range = await getChannelRange(channel);
  if (!range) return <NothingYet channel={channel} />;

  const periods = await getChannelPeriods(channel);
  const period = periods.find((p) => p.month === params.month);
  const window = period ? { from: period.from, to: period.to } : range;
  const [statement, products, unattributed, account] = await Promise.all([
    getChannelStatement(channel, window.from, window.to),
    getChannelProducts(channel, window.from, window.to),
    getChannelUnattributed(channel, window.from, window.to),
    getChannelAccount(channel),
  ]);
  const rate = statement.incomeTotal > 0 ? `${((Math.abs(statement.feesTotal) / statement.incomeTotal) * 100).toFixed(1)}%` : '—';
  const base = channelPath(channel);
  const monthHref = (month: string) => (month === 'all' ? base : `${base}?month=${month}`);
  const recent = [...periods].reverse().slice(0, TAB_MONTHS);

  return (
    <Page>
      <PageHeader
        title={name}
        description={t('overview.description', {
          channel: name,
          range: tr('common.dateRange', { from: f.date(window.from), to: f.date(window.to) }),
        })}
        actions={
          <Button variant="outline" asChild>
            <Link href={channelPath(channel, 'imports')}>
              <Upload />
              {t('overview.upload')}
            </Link>
          </Button>
        }
      />

      {periods.length > 1 ? (
        <PeriodTabs
          value={period?.month ?? 'all'}
          options={[{ value: 'all', label: t('overview.allTime') }, ...recent.map((p) => ({ value: p.month, label: f.month(p.month) }))]}
          href={monthHref}
        />
      ) : null}

      <SummaryStrip label={name}>
        <SummaryMetric
          label={t('metrics.sales')}
          icon={ShoppingBag}
          value={<Amount value={statement.incomeTotal} />}
          hint={t('metrics.salesHint', { units: statement.unitsSold, returned: statement.unitsReturned })}
          sensitive
        />
        <SummaryMetric
          label={t('metrics.fees', { channel: name })}
          icon={Percent}
          value={<Amount value={statement.feesTotal} />}
          hint={t('metrics.feesHint', { rate })}
          sensitive
        />
        <SummaryMetric
          label={t('metrics.paid')}
          icon={Landmark}
          value={<Amount value={-statement.payouts} />}
          hint={t('metrics.paidHint', { channel: name })}
          sensitive
        />
        <SummaryMetric
          label={t('metrics.owed', { channel: name })}
          icon={Wallet}
          value={statement.closing === null ? '—' : <Amount value={statement.closing} />}
          hint={
            statement.closing === null
              ? t('metrics.owedUnknown')
              : statement.held > 0.005
                ? t('metrics.owedHeld', { amount: money(statement.held), date: f.date(statement.heldUntil) })
                : t('metrics.owedHint')
          }
          href={statement.closing === null ? '#opening' : undefined}
          attention={statement.closing === null}
          sensitive
        />
      </SummaryStrip>

      <section className="grid overflow-hidden rounded-2xl border bg-card lg:grid-cols-2 max-lg:[&>*+*]:border-t lg:[&>*+*]:border-s [&>*]:min-w-0" data-sensitive-scope>
        <div className="px-6 py-6 md:px-8">
          <h2 className="text-base font-semibold">{t('statement.title')}</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{t('statement.hint', { channel: name })}</p>
          <StatementLines channel={channel} statement={statement} />
        </div>
        <div className="grid content-start gap-8 px-6 py-6 md:px-8 [&>*]:min-w-0">
          <BestSellers channel={channel} products={products} month={period?.month} />
          <div>
            <h2 className="text-base font-semibold">{t('unattributed.title')}</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{t('unattributed.hint')}</p>
            {unattributed.length === 0 ? (
              <p className="mt-4 text-[13px] text-muted-foreground">{t('unattributed.none')}</p>
            ) : (
              <dl className="mt-3 grid text-sm">
                {unattributed.map((u) => (
                  <div key={u.type} className="flex items-baseline justify-between gap-4 border-b py-2 last:border-b-0">
                    <dt className="text-muted-foreground">
                      {isOneOf(UNATTRIBUTED_TYPES, u.type) ? t(`unattributed.types.${u.type}`) : u.type}
                      <span className="num ms-2 text-xs opacity-70">{u.rows}</span>
                    </dt>
                    <dd><Amount value={u.total} className="font-medium" /></dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </section>

      {periods.length ? (
        <TablePanel minWidth="46rem">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">{t('months.title')}</h2>
            <p className="text-xs text-muted-foreground">{t('months.hint')}</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('months.month')}</TableHead>
                <TableHead className="text-end">{t('months.units')}</TableHead>
                <TableHead className="w-[22%] text-end">{t('months.sales')}</TableHead>
                <TableHead className="text-end">{t('months.fees')}</TableHead>
                <TableHead className="text-end">{t('months.paid')}</TableHead>
                <TableHead className="text-end">{t('months.movement')}</TableHead>
                <TableHead className="text-end">{t('months.owed')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody data-sensitive-scope>
              {[...periods].reverse().map((p) => {
                const top = Math.max(...periods.map((x) => x.income), 1);
                const current = p.month === period?.month;
                return (
                  <TableRow key={p.month} className={cn('relative', current && 'bg-muted/50')}>
                    <TableCell className="font-medium">
                      <Link href={monthHref(p.month)} scroll={false} aria-current={current ? 'true' : undefined} className="after:absolute after:inset-0 hover:underline">
                        {f.month(p.month)}
                      </Link>
                    </TableCell>
                    <TableCell className="num text-end">{p.unitsSold}</TableCell>
                    <TableCell className="text-end">
                      <span className="num font-medium">{moneyWhole(p.income)}</span>
                      <span className="mt-1 ms-auto block h-1 max-w-28 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full rounded-full bg-primary/70 ms-auto" style={{ width: `${Math.max((p.income / top) * 100, 0)}%` }} />
                      </span>
                    </TableCell>
                    <TableCell className="num text-end text-muted-foreground">{moneyWhole(p.fees)}</TableCell>
                    <TableCell className="num text-end text-muted-foreground">{moneyWhole(-p.payouts)}</TableCell>
                    <TableCell className={cn('num text-end font-medium', p.movement < 0 && 'text-muted-foreground')}>{moneyWhole(p.movement)}</TableCell>
                    <TableCell className="num text-end font-medium">
                      {p.closing === null ? <span className="text-muted-foreground">—</span> : moneyWhole(p.closing)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TablePanel>
      ) : null}

      <section id="opening" className="max-w-3xl scroll-mt-20 rounded-2xl border bg-card px-6 py-6 md:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">{t('opening.title')}</h2>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted-foreground">{t.rich('opening.hint', { channel: name, strong })}</p>
          </div>
          <ToneBadge tone={account.openingAsOf ? 'success' : 'warning'}>
            {account.openingAsOf ? t('opening.set') : t('opening.notSet')}
          </ToneBadge>
        </div>
        <div className="mt-5">
          <OpeningBalanceForm channel={channel} openingBalance={account.openingAsOf ? account.openingBalance : ''} openingAsOf={account.openingAsOf} />
        </div>
      </section>
    </Page>
  );
}

/**
 * The marketplace's report as an accountant writes it: what customers paid,
 * each charge taken off, what was left, what was transferred, and what that
 * added to the balance it owes us.
 */
async function StatementLines({ channel, statement: s }: { channel: Marketplace; statement: ChannelStatement }) {
  const [f, t] = await Promise.all([getFormat(), getTranslations('channel')]);
  const name = t(`name.${channel}`);
  const rows: Array<{ key: string; label: string; value: number; kind?: 'less' | 'sub' | 'final' }> = [
    ...s.income.map((l) => ({ key: l.key, label: t(`lines.${l.key}`), value: l.amount, kind: l.amount < 0 ? ('less' as const) : undefined })),
    ...s.fees.map((l) => ({ key: l.key, label: t(`lines.${l.key}`), value: l.amount, kind: 'less' as const })),
    { key: 'net', label: t('statement.net'), value: s.net, kind: 'sub' },
    { key: 'paid', label: t('statement.paid'), value: s.payouts, kind: 'less' },
    { key: 'movement', label: t('statement.movement', { channel: name }), value: s.movement, kind: 'final' },
  ];
  return (
    <>
      <dl className="mt-5 grid text-sm">
        {rows.map((r) => (
          <div
            key={r.key}
            className={cn(
              'flex items-baseline justify-between gap-4 py-2',
              r.kind === 'sub' && 'mt-1 border-t pt-3',
              r.kind === 'final' && 'mt-2 border-t-2 border-foreground/20 pt-3.5',
            )}
          >
            <dt className={cn(r.kind === 'sub' || r.kind === 'final' ? 'font-semibold' : r.kind === 'less' ? 'ps-4 text-muted-foreground' : 'font-medium')}>
              {r.label}
            </dt>
            <dd>
              <Amount
                value={r.value}
                signed={r.kind === 'final'}
                className={cn(
                  r.kind === 'final' ? 'text-lg font-semibold' : r.kind === 'sub' ? 'font-semibold' : r.kind === 'less' ? 'text-muted-foreground' : 'font-medium',
                )}
              />
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        {s.opening === null || s.closing === null
          ? t('statement.noBalance', { channel: name })
          : t.rich('statement.balance', { channel: name, opening: money(s.opening), closing: money(s.closing), b })}
      </p>
      {s.held > 0.005 ? (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {t.rich('statement.held', { amount: money(s.held), date: f.date(s.heldUntil), b })}
        </p>
      ) : null}
    </>
  );
}

async function BestSellers({ channel, products, month }: { channel: Marketplace; products: ChannelProduct[]; month?: string }) {
  const t = await getTranslations('channel');
  const name = t(`name.${channel}`);
  const top = [...products].sort((a, b) => b.net - a.net).slice(0, 6);
  const all = `${channelPath(channel, 'products')}${month ? `?period=${month}` : ''}`;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-base font-semibold">{t('best.title')}</h2>
        <Link href={all} className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
          {t('best.all')}
          <ChevronLeft className="size-3.5 ltr:rotate-180" aria-hidden />
        </Link>
      </div>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{t('best.hint', { channel: name })}</p>
      {top.length === 0 ? (
        <p className="mt-4 text-[13px] text-muted-foreground">{t('best.none')}</p>
      ) : (
        <ol className="mt-3 text-sm">
          {top.map((p, i) => (
            <li key={p.productId} className="flex items-baseline gap-3 border-b py-2 last:border-b-0">
              <span className="num w-4 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
              <Link href={`/inventory/${p.productId}`} className="min-w-0 flex-1 truncate font-medium hover:underline" title={p.name}>
                <bdi>{p.name}</bdi>
              </Link>
              <span className="num shrink-0 text-xs text-muted-foreground">×{p.unitsSold}</span>
              <span className="num w-24 shrink-0 text-end font-medium">{moneyWhole(p.net)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Before the first report: what to download, where, and the button to upload it. */
async function NothingYet({ channel }: { channel: Marketplace }) {
  const t = await getTranslations('channel');
  const name = t(`name.${channel}`);
  return (
    <Page width="narrow">
      <PageHeader title={name} />
      <Empty className="border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Upload />
          </EmptyMedia>
          <EmptyTitle>{t('overview.emptyTitle', { channel: name })}</EmptyTitle>
          <EmptyDescription>{t('overview.emptyHint', { channel })}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href={channelPath(channel, 'imports')}>
              <Upload />
              {t('overview.upload')}
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    </Page>
  );
}

/** Sortable columns; the API returns best-first by what was left. */
const SORTS: Record<string, (p: ChannelProduct) => number> = {
  units: (p) => p.unitsSold,
  returned: (p) => p.unitsReturned,
  sales: (p) => p.sales,
  fees: (p) => p.fees,
  net: (p) => p.net,
  profit: (p) => (p.grossProfit === null ? -Infinity : p.grossProfit),
};

/** Every product the marketplace sold, filterable by month, returns and missing cost. */
export async function ChannelProducts({ channel, params }: { channel: Marketplace; params: Params }) {
  const [f, t, tr] = await Promise.all([getFormat(), getTranslations('channel'), getTranslations()]);
  const name = t(`name.${channel}`);
  const path = channelPath(channel, 'products');
  const { period, q, returns, cost } = params;
  const sort = params.sort && SORTS[params.sort] ? params.sort : null;
  const asc = params.dir === 'asc';

  const [range, periods] = await Promise.all([getChannelRange(channel), getChannelPeriods(channel)]);
  if (!range) return <NothingYet channel={channel} />;
  const selected = periods.find((p) => p.month === period);
  const window = selected ? { from: selected.from, to: selected.to } : range;
  let products = await getChannelProducts(channel, window.from, window.to);

  // A few hundred rows at most: filtering here beats a round trip per keystroke.
  if (q) products = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  if (returns === '1') products = products.filter((p) => p.unitsReturned > 0);
  if (cost === 'missing') products = products.filter((p) => p.unitCost === null);
  if (sort) products = [...products].sort((a, b) => (asc ? SORTS[sort](a) - SORTS[sort](b) : SORTS[sort](b) - SORTS[sort](a)));
  const filtered = Boolean(period || q || returns || cost);

  /** A header link that sorts by this column: high to low, then low to high, then off. */
  const sortHref = (key: string) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== 'sort' && k !== 'dir') next.set(k, v);
    if (sort !== key) next.set('sort', key);
    else if (!asc) {
      next.set('sort', key);
      next.set('dir', 'asc');
    }
    const qs = next.toString();
    return qs ? `${path}?${qs}` : path;
  };
  const sortHead = (key: string, label: string) => {
    const Icon = sort !== key ? ArrowUpDown : asc ? ArrowUp : ArrowDown;
    return (
      <TableHead key={key} className="text-end">
        <Link href={sortHref(key)} scroll={false} className={cn('inline-flex items-center gap-1 hover:text-foreground', sort === key && 'text-foreground')}>
          {label}
          <Icon className={cn('size-3', sort !== key && 'opacity-40')} />
        </Link>
      </TableHead>
    );
  };

  return (
    <Page fill>
      <PageHeader
        title={tr(`nav.items.${channel === 'noon' ? 'products' : 'amazonProducts'}`)}
        description={selected ? t('products.descriptionMonth', { channel: name, month: f.month(selected.month) }) : t('products.description', { channel: name })}
      />
      <FilterBar
        search={{ param: 'q', placeholder: tr('inventory.search') }}
        filters={[
          { kind: 'select', param: 'period', all: t('overview.allTime'), options: [...periods].reverse().map((p) => ({ value: p.month, label: f.month(p.month) })) },
          { kind: 'toggle', param: 'returns', value: '1', label: t('products.hasReturns') },
          { kind: 'toggle', param: 'cost', value: 'missing', label: t('products.missingCost') },
        ]}
      />
      <TablePanel minWidth="54rem" footer={<TableCount>{tr('nouns.products', { count: products.length })}</TableCount>}>
        {products.length === 0 ? (
          <TableEmpty
            icon={BarChart3}
            title={filtered ? t('products.noMatch') : t('products.none', { channel: name })}
            description={filtered ? undefined : t('products.noneHint', { channel: name })}
            action={filtered ? (
              <Button variant="outline" asChild>
                <Link href={path}>{tr('filters.resetFilters')}</Link>
              </Button>
            ) : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[36%] min-w-[220px]">{t('products.product')}</TableHead>
                {sortHead('units', t('products.units'))}
                {sortHead('returned', t('products.returned'))}
                {sortHead('sales', t('products.sales'))}
                {sortHead('fees', t('products.fees'))}
                {sortHead('net', t('products.net'))}
                {sortHead('profit', t('products.profit'))}
              </TableRow>
            </TableHeader>
            <TableBody data-sensitive-scope>
              {products.map((p) => (
                <TableRow key={p.productId} className="relative">
                  <TableCell className="max-w-0">
                    <Link href={`/inventory/${p.productId}`} className="block truncate font-medium after:absolute after:inset-0 hover:underline" title={p.name}>
                      <bdi>{p.name}</bdi>
                    </Link>
                  </TableCell>
                  <TableCell className="num text-end">{p.unitsSold}</TableCell>
                  <TableCell className="num text-end">
                    {p.unitsReturned > 0 ? <span className="text-warning">{p.unitsReturned}</span> : <span className="text-muted-foreground/50">—</span>}
                  </TableCell>
                  <TableCell className="num text-end">{moneyWhole(p.sales)}</TableCell>
                  <TableCell className="num text-end text-muted-foreground">{moneyWhole(p.fees)}</TableCell>
                  <TableCell className="num text-end font-medium">{moneyWhole(p.net)}</TableCell>
                  <TableCell className="num text-end">
                    {p.grossProfit === null ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="relative z-10 cursor-default text-muted-foreground/50">—</span>
                        </TooltipTrigger>
                        <TooltipContent>{t('products.noCost')}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className={cn(p.grossProfit < 0 && 'text-destructive')}>{money(p.grossProfit)}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TablePanel>
    </Page>
  );
}

/** Upload a report, see what it did, and every report uploaded so far. */
export async function ChannelUploads({ channel }: { channel: Marketplace }) {
  const [f, t, tr] = await Promise.all([getFormat(), getTranslations('channel'), getTranslations()]);
  const imports = await getChannelImports(channel);
  const released = channel === 'amazon';

  return (
    <Page>
      <PageHeader title={tr(`nav.items.${channel === 'noon' ? 'imports' : 'amazonImports'}`)} description={t('uploads.description', { channel })} />

      <section className="max-w-3xl rounded-2xl border bg-card px-6 py-6 md:px-8">
        <h2 className="text-base font-semibold">{t('uploads.upload')}</h2>
        <p className="mt-0.5 mb-5 text-[13px] text-muted-foreground">{t('uploads.uploadHint', { channel })}</p>
        <ImportForm channel={channel} />
      </section>

      <TablePanel minWidth="52rem" footer={<TableCount>{tr('nouns.imports', { count: imports.length })}</TableCount>}>
        {imports.length === 0 ? (
          <TableEmpty icon={Upload} title={t('uploads.empty')} description={t('uploads.emptyHint')} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">{t('uploads.columns.file')}</TableHead>
                <TableHead>{t('uploads.columns.period')}</TableHead>
                <TableHead className="text-end">{t('uploads.columns.rows')}</TableHead>
                <TableHead className="text-end">{t('uploads.columns.new')}</TableHead>
                <TableHead className="text-end">{t('uploads.columns.skipped')}</TableHead>
                {released ? <TableHead className="text-end">{t('uploads.columns.updated')}</TableHead> : null}
                <TableHead className="text-end">{t('uploads.columns.unmapped')}</TableHead>
                <TableHead className="text-end">{t('uploads.columns.imported')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {imports.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="max-w-0">
                    <span className="block truncate font-medium" title={i.filename}><bdi>{i.filename}</bdi></span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{tr('common.dateRange', { from: f.date(i.periodStart), to: f.date(i.periodEnd) })}</TableCell>
                  <TableCell className="num text-end">{i.rowsInFile}</TableCell>
                  <TableCell className="num text-end font-medium">{i.rowsInserted}</TableCell>
                  <TableCell className="num text-end text-muted-foreground">{i.rowsSkipped || '—'}</TableCell>
                  {released ? <TableCell className="num text-end text-muted-foreground">{i.rowsUpdated || '—'}</TableCell> : null}
                  <TableCell className="num text-end">
                    {i.unmappedListings ? <span className="text-warning">{i.unmappedListings}</span> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-end text-muted-foreground">{f.dateTime(i.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TablePanel>
    </Page>
  );
}
