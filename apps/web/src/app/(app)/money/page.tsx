import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronLeft, FileClock, FileText, Landmark, Minus, PackagePlus, PiggyBank, Scale, Store, TrendingUp, TriangleAlert, Truck, Undo2, Wallet, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Amount } from '@/components/amount';
import { BarList, CashFlowChart, OUT_FILL, ProfitTrendChart, type BarItem, type Bucket } from '@/components/charts';
import { SummaryMetric, SummaryStrip } from '@/components/list-page';
import { MoneyAnchorForm } from '@/components/money-anchor-form';
import { Page, PageHeader } from '@/components/page';
import { PeriodTabs } from '@/components/period-tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  getCashFlow,
  getFinanceOverview,
  getPerformance,
  getMoneyAccounts,
  getOrderSummary,
  getPurchases,
  getSalesInvoices,
  type CashFlow,
} from '@/lib/api';
import { daysAgo, money, today } from '@/lib/format';
import { accountByCode, accountName, groupAccounts, purchaseDue } from '@/lib/money';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';
import { getLocale, getTranslations } from 'next-intl/server';

/** The windows the overview can cover, and how finely each one is bucketed. */
const RANGES = [
  { value: '7d', days: 7, bucket: 'day' },
  // A month reads best as weeks — thirty thin daily bars were mostly empty.
  { value: '30d', days: 30, bucket: 'week' },
  { value: '90d', days: 90, bucket: 'week' },
  { value: '12m', days: 365, bucket: 'month' },
] as const satisfies ReadonlyArray<{ value: string; days: number; bucket: Bucket }>;

const DEFAULT_RANGE = '30d';

const sum = (series: CashFlow['series'], key: 'in' | 'out') =>
  series.reduce((n, p) => n + Number(p[key]), 0);

/** Change against the window before, in percent — only when there was something to compare with. */
const change = (now: number, before: number) => (before > 0 ? ((now - before) / before) * 100 : null);

export default async function MoneyOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [t, tr, locale] = await Promise.all([
    getTranslations('money'),
    getTranslations(),
    getLocale(),
  ]);
  await requireAdmin();
  const overview = await getFinanceOverview();

  if (overview.openingAsOf === null) {
    return (
      <Page width="narrow">
        <PageHeader title={t('title')} description={t('start.description')} />
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Wallet />
            </EmptyMedia>
            <EmptyTitle>{t('start.title')}</EmptyTitle>
            <EmptyDescription>{t('start.hint')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="max-w-md">
            <MoneyAnchorForm openingBalance={overview.openingBalance} openingAsOf={overview.openingAsOf} />
          </EmptyContent>
        </Empty>
      </Page>
    );
  }

  const params = await searchParams;
  const range = RANGES.find((r) => r.value === params.range) ?? RANGES.find((r) => r.value === DEFAULT_RANGE)!;
  const to = today();
  const from = daysAgo(range.days - 1);
  // The same length of time just before, for "vs the previous 30 days".
  const before = { from: daysAgo(range.days * 2 - 1), to: daysAgo(range.days) };

  const [accounts, flow, previous, pnl, pnlBefore, orders, sales, purchases] = await Promise.all([
    getMoneyAccounts(),
    getCashFlow(from, to, range.bucket),
    getCashFlow(before.from, before.to, 'month'),
    getPerformance(from, to, 12),
    getPerformance(before.from, before.to),
    getOrderSummary(),
    getSalesInvoices(),
    getPurchases(),
  ]);

  const balance = (code: string) => Number(accountByCode(accounts, code)?.balance ?? 0);
  const cash = balance('CASH');
  const rangeLabel = t(`ranges.${range.value}`);
  const span = t('lastRange', { range: rangeLabel });
  const compared = t('vsBefore', { range: rangeLabel });
  // A window that starts before the books did holds only part of its days —
  // "+8,700% vs the 90 days before" would be comparing against nothing.
  const comparable = before.from >= overview.openingAsOf;
  const moneyIn = sum(flow.series, 'in');
  const moneyOut = sum(flow.series, 'out');
  const net = moneyIn - moneyOut;
  const inChange = comparable ? change(moneyIn, sum(previous.series, 'in')) : null;
  const outChange = comparable ? change(moneyOut, sum(previous.series, 'out')) : null;

  const revenue = Number(pnl.revenue);
  const gross = Number(pnl.grossProfit);
  const netProfit = Number(pnl.netProfit);
  const margin = (v: number) => (revenue > 0 ? `${((v / revenue) * 100).toFixed(1)}%` : '—');
  const revenueChange = comparable ? change(revenue, Number(pnlBefore.revenue)) : null;
  const profitChange = comparable && Number(pnlBefore.netProfit) > 0 ? change(netProfit, Number(pnlBefore.netProfit)) : null;

  // Who owes the business, and whom it owes — every line opens the records behind it.
  const salesDue = sales.filter((i) => i.status === 'POSTED' && Number(i.total) - Number(i.paidAmount) > 0.005).length;
  const purchasesDue = purchases.filter((i) => purchaseDue(i) > 0.005).length;
  const owedToYou: Row[] = [
    { key: 'noon', icon: Store, label: t('home.noon'), detail: t('home.noonDetail'), amount: balance('NOON_RECEIVABLE'), href: '/' },
    { key: 'customers', icon: FileText, label: t('home.customers'), detail: t('home.customersDetail', { count: salesDue }), amount: balance('CUSTOMER_RECEIVABLE'), href: '/sales?view=due' },
    {
      key: 'cod',
      icon: Truck,
      label: t('home.cod'),
      detail: t('home.codDetail', { count: orders.deliveredUnpaid }),
      amount: Number(orders.deliveredUnpaidAmount),
      href: '/orders?status=DELIVERED&paymentStatus=UNPAID',
    },
    { key: 'bosta', icon: Truck, label: t('home.bosta'), detail: t('home.bostaDetail'), amount: balance('BOSTA_COD'), href: '/shipments' },
    { key: 'cheques', icon: FileClock, label: t('home.cheques'), detail: t('home.chequesDetail'), amount: balance('CHEQUES_PENDING'), href: '/money/treasury' },
    { key: 'amazon', icon: Store, label: t('home.amazon'), detail: t('home.amazonDetail'), amount: balance('AMAZON_RECEIVABLE'), href: '/money/ledger?code=AMAZON_RECEIVABLE' },
  ].filter((r) => Math.abs(r.amount) > 0.005);
  const youOwe: Row[] = [
    { key: 'suppliers', icon: PackagePlus, label: t('home.suppliers'), detail: t('home.suppliersDetail', { count: purchasesDue }), amount: balance('SUPPLIER_PAYABLE'), href: '/money/purchases?view=due' },
    { key: 'refunds', icon: Undo2, label: t('home.refunds'), detail: t('home.refundsDetail'), amount: balance('CUSTOMER_REFUNDS'), href: '/orders?paymentStatus=REFUND_DUE' },
  ].filter((r) => Math.abs(r.amount) > 0.005);
  const totalOf = (rows: Row[]) => rows.reduce((n, r) => n + r.amount, 0);

  // The statement, top to bottom: what was sold, what it cost, what's left.
  const estimate = pnl.channels.some((c) => c.cogsBasis === 'estimate' && Number(c.cogs) > 0) || pnl.uncostedUnits > 0;
  const ladder: Step[] = [
    { key: 'revenue', label: t('pnl.revenue'), value: revenue, kind: 'total' },
    { key: 'cogs', label: t('pnl.cogs'), value: -Number(pnl.cogs), note: estimate ? t('pnl.estimated') : undefined },
    { key: 'gross', label: t('pnl.grossProfit'), value: gross, kind: 'subtotal' },
    { key: 'fees', label: t('pnl.fees'), value: -Number(pnl.fees) },
    { key: 'shipping', label: t('pnl.shipping'), value: -Number(pnl.shipping) },
    { key: 'expenses', label: t('pnl.expenses'), value: -Number(pnl.expenses), href: `/money/expenses?from=${from}&to=${to}` },
    { key: 'tax', label: t('pnl.taxes'), value: null, note: t('pnl.notYet') },
    { key: 'net', label: t('pnl.netProfit'), value: netProfit, kind: 'result' },
  ];

  const channelRows = [
    ...pnl.channels,
    // Not connected yet: shown so the table already has its place.
    { key: 'amazon' as const, revenue: null, cogs: null, cogsBasis: 'estimate' as const, directCosts: null, contribution: null, units: 0, uncostedUnits: 0, count: 0 },
  ].sort((a, b) => Number(b.revenue ?? -1) - Number(a.revenue ?? -1));

  const expenseItems: BarItem[] = pnl.expenseCategories.map((c) => ({
    key: c.name ?? 'vouchers',
    label: c.name ?? t('pnl.vouchers'),
    value: Number(c.amount),
    fill: OUT_FILL,
    href: c.name ? `/money/expenses?from=${from}&to=${to}` : '/money/treasury',
  }));

  const groups = groupAccounts(accounts);
  const held = groups.held.map((a) => ({ key: a.code, label: accountName(a, locale), balance: a.balance, href: `/money/ledger?code=${a.code}` }));
  held.push({ key: 'STOCK', label: tr('inventory.stockValue'), balance: overview.stockValue, href: '/inventory' });
  const rows = (list: typeof groups.owe) =>
    list.map((a) => ({ key: a.code, label: accountName(a, locale), balance: a.balance, href: `/money/ledger?code=${a.code}` }));

  return (
    <Page>
      <PageHeader
        title={t('title')}
        description={t('home.description')}
        actions={
          <PeriodTabs
            value={range.value}
            options={RANGES.map((r) => ({ value: r.value, label: t(`ranges.${r.value}`) }))}
            href={(v) => (v === DEFAULT_RANGE ? '/money' : `/money?range=${v}`)}
          />
        }
      />

      {/* The headline: what the period earned, and the cash there is today. */}
      <SummaryStrip label={t('pnl.title')}>
        <SummaryMetric
          label={t('pnl.revenue')}
          icon={TrendingUp}
          value={<Amount value={revenue} />}
          hint={revenueChange !== null ? <Change value={revenueChange} note={compared} /> : span}
          sensitive
        />
        <SummaryMetric
          label={t('pnl.grossProfit')}
          icon={PiggyBank}
          value={<Amount value={gross} className={cn(gross < 0 && 'text-destructive')} />}
          hint={t('pnl.margin', { margin: margin(gross) })}
          sensitive
        />
        <SummaryMetric
          label={t('pnl.netProfit')}
          icon={Scale}
          value={<Amount value={netProfit} className={cn(netProfit < 0 ? 'text-destructive' : 'text-success')} />}
          hint={profitChange !== null ? <Change value={profitChange} note={compared} /> : t('pnl.margin', { margin: margin(netProfit) })}
          attention={netProfit < 0}
          sensitive
        />
        <SummaryMetric
          label={tr('charts.cashOnHand')}
          icon={Landmark}
          value={<Amount value={cash} className={cn(cash < 0 && 'text-destructive')} />}
          hint={t('home.cashHint')}
          href="/money/treasury"
          sensitive
        />
      </SummaryStrip>

      {pnl.uncostedUnits > 0 ? (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertDescription>
            {t.rich('pnl.uncosted', { count: pnl.uncostedUnits, b: (c) => <b className="font-semibold">{c}</b> })}{' '}
            <Link href="/products" className="font-medium underline underline-offset-4">{t('pnl.uncostedFix')}</Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card data-sensitive-scope>
          <CardHeader>
            <CardTitle>{t('pnl.statement')}</CardTitle>
            <CardDescription>{span}</CardDescription>
          </CardHeader>
          <CardContent>
            <Ladder steps={ladder} revenue={revenue} />
          </CardContent>
        </Card>
        <Card data-sensitive-scope>
          <CardHeader>
            <CardTitle>{t('pnl.trend')}</CardTitle>
            <CardDescription>{t('pnl.trendHint')}</CardDescription>
            <CardAction className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <Key color="var(--primary)" label={t('pnl.revenue')} />
              <Key color={OUT_FILL} label={t('pnl.costs')} />
              <Key color="var(--foreground)" label={t('pnl.netProfit')} line />
            </CardAction>
          </CardHeader>
          <CardContent>
            <ProfitTrendChart series={pnl.trend} />
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 pb-0" data-sensitive-scope>
        <CardHeader className="pb-4">
          <CardTitle>{t('pnl.channelsTitle')}</CardTitle>
          <CardDescription>{t('pnl.channelsHint', { span })}</CardDescription>
        </CardHeader>
        <ChannelTable rows={channelRows} revenue={revenue} />
      </Card>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Balances title={t('home.owedToYou')} total={totalOf(owedToYou)} rows={owedToYou} empty={t('home.owedNone')} />
        <Balances title={t('home.youOwe')} total={totalOf(youOwe)} rows={youOwe} empty={t('home.oweNone')} owing />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card data-sensitive-scope>
          <CardHeader>
            <CardTitle>{t('pnl.expenseBreakdown')}</CardTitle>
            <CardDescription>{span}</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList items={expenseItems} empty={t('pnl.noExpenses')} />
          </CardContent>
        </Card>
        <Card className="gap-0 py-0" data-sensitive-scope>
          <div className="px-5 pt-5">
            <h2 className="text-base font-semibold">{t('pnl.cash')}</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{t('pnl.cashHint', { span })}</p>
          </div>
          <div className="mt-4 grid border-y sm:grid-cols-3 [&>*+*]:border-t sm:[&>*+*]:border-t-0 sm:[&>*+*]:border-s">
            <FlowStat label={tr('charts.moneyIn')} value={<Amount value={moneyIn} />}>
              {inChange !== null ? <Change value={inChange} note={compared} /> : t('inLast', { range: rangeLabel })}
            </FlowStat>
            <FlowStat label={tr('charts.moneyOut')} value={<Amount value={moneyOut} />}>
              {outChange !== null ? <Change value={outChange} invert note={compared} /> : t('inLast', { range: rangeLabel })}
            </FlowStat>
            <FlowStat label={t('overview.netFlow')} value={<Amount value={net} signed className={cn(net < 0 && 'text-destructive')} />}>
              {net >= 0 ? t('overview.netPositive') : t('overview.netNegative')}
            </FlowStat>
          </div>
          <div className="px-5 pt-5 pb-3">
            <CashFlowChart series={flow.series} bucket={range.bucket} />
          </div>
        </Card>
      </div>

      {/* For the accountant: every account's balance, folded away. */}
      <details className="group rounded-xl border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-sm font-semibold">{t('overview.books')}</span>
            <span className="block text-xs text-muted-foreground">{t('overview.booksHint')}</span>
          </span>
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="grid gap-x-8 gap-y-5 border-t px-5 py-5 md:grid-cols-2 xl:grid-cols-4" data-sensitive-scope>
          <AccountList title={t('overview.held')} rows={held} />
          <AccountList title={t('overview.owe')} rows={rows(groups.owe)} />
          <AccountList title={t('overview.capital')} rows={rows(groups.capital)} />
          <AccountList title={t('overview.performance')} rows={rows(groups.performance)} muted />
        </div>
      </details>
    </Page>
  );
}

interface Row {
  key: string;
  icon: LucideIcon;
  label: string;
  detail: string;
  amount: number;
  href: string;
}

interface Step {
  key: string;
  label: string;
  /** Signed as it reads in the statement; null for a line not calculated yet. */
  value: number | null;
  kind?: 'total' | 'subtotal' | 'result';
  note?: string;
  href?: string;
}

/**
 * The profit and loss as a statement anyone can follow: sales at the top, each
 * cost taken off in turn with a bar sized against sales, the subtotals ruled
 * off, and the result in bold. A line we can't calculate yet still has its
 * place, marked as such — never a made-up figure.
 */
function Ladder({ steps, revenue }: { steps: Step[]; revenue: number }) {
  return (
    <ol className="grid">
      {steps.map((s) => {
        const ruled = s.kind === 'subtotal' || s.kind === 'result';
        const share = s.value === null || revenue <= 0 ? 0 : Math.min(Math.abs(s.value) / revenue, 1);
        const label = (
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn('truncate', ruled ? 'font-semibold' : s.kind === 'total' ? 'font-medium' : 'text-muted-foreground')}>{s.label}</span>
            {s.note ? <span className="shrink-0 rounded-full bg-muted px-2 py-px text-[10.5px] font-medium text-muted-foreground">{s.note}</span> : null}
          </span>
        );
        return (
          <li key={s.key} className={cn('grid gap-1.5 py-2.5', ruled && 'border-t', s.kind === 'result' && 'mt-1 border-t-2 border-foreground/15 pt-3.5')}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              {s.href ? <Link href={s.href} className="min-w-0 hover:underline hover:underline-offset-4">{label}</Link> : label}
              {s.value === null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <Amount
                  value={s.value}
                  signed={!s.kind}
                  className={cn(
                    'shrink-0',
                    s.kind === 'result' ? cn('text-xl font-semibold tracking-tight', s.value < 0 ? 'text-destructive' : 'text-success') : ruled || s.kind === 'total' ? 'font-semibold' : 'text-muted-foreground',
                  )}
                />
              )}
            </div>
            {s.value !== null && s.kind !== 'result' ? (
              <span className="block h-1 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${Math.max(share * 100, s.value ? 1.5 : 0)}%`, background: s.kind ? 'var(--primary)' : OUT_FILL }}
                />
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Each channel's sales, what they cost, and what they leave — Amazon waits in its row until it's connected. */
async function ChannelTable({
  rows,
  revenue,
}: {
  rows: Array<{
    key: 'noon' | 'website' | 'social' | 'wholesale' | 'amazon';
    revenue: string | null;
    cogs: string | null;
    cogsBasis: 'actual' | 'estimate';
    directCosts: string | null;
    contribution: string | null;
    count: number;
    uncostedUnits: number;
  }>;
  revenue: number;
}) {
  const t = await getTranslations('money.pnl');
  return (
    <div className="overflow-x-auto border-t">
      <table className="w-full min-w-[44rem] text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground [&>th]:h-9 [&>th]:px-3 [&>th]:font-medium [&>th:first-child]:ps-5 [&>th:last-child]:pe-5">
            <th className="text-start">{t('channel')}</th>
            <th className="text-end">{t('revenue')}</th>
            <th className="w-[18%] text-start">{t('share')}</th>
            <th className="text-end">{t('cogs')}</th>
            <th className="text-end">{t('directCosts')}</th>
            <th className="text-end">{t('contribution')}</th>
          </tr>
        </thead>
        <tbody className="divide-y border-t">
          {rows.map((c) => {
            const sold = c.revenue === null ? null : Number(c.revenue);
            const left = c.contribution === null ? null : Number(c.contribution);
            const share = sold && revenue > 0 ? sold / revenue : 0;
            return (
              <tr key={c.key} className="[&>td]:h-16 [&>td]:px-3 [&>td:first-child]:ps-5 [&>td:last-child]:pe-5">
                <td>
                  <p className="font-medium">{t(`channels.${c.key}`)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {sold === null ? t('notConnected') : c.count ? t(`counts.${c.key === 'wholesale' ? 'invoices' : 'orders'}`, { count: c.count }) : t('noSales')}
                  </p>
                </td>
                <td className="num text-end font-semibold">{sold === null ? <span className="font-normal text-muted-foreground">—</span> : money(sold)}</td>
                <td>
                  {sold === null ? null : (
                    <div className="flex items-center gap-2">
                      <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${share * 100}%` }} />
                      </span>
                      <span className="num w-10 text-end text-xs text-muted-foreground">{`${Math.round(share * 100)}%`}</span>
                    </div>
                  )}
                </td>
                <td className="text-end">
                  {c.cogs === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <>
                      <span className="num">{money(c.cogs)}</span>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {c.uncostedUnits > 0 ? <span className="text-warning">{t('uncostedShort', { count: c.uncostedUnits })}</span> : t(c.cogsBasis === 'actual' ? 'actual' : 'estimated')}
                      </p>
                    </>
                  )}
                </td>
                <td className="num text-end text-muted-foreground">{c.directCosts === null ? '—' : money(c.directCosts)}</td>
                <td className="text-end">
                  {left === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <>
                      <span className={cn('num font-semibold', left < 0 && 'text-destructive')}>{money(left)}</span>
                      <p className="num mt-0.5 text-[11px] text-muted-foreground">{sold ? `${((left / sold) * 100).toFixed(1)}%` : '—'}</p>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** One side of the books in plain words: its total, then each line, each opening its records. */
function Balances({ title, total, rows, empty, owing = false }: { title: string; total: number; rows: Row[]; empty: string; owing?: boolean }) {
  return (
    <Card className="gap-0 py-0" data-sensitive-scope>
      <div className="flex items-baseline justify-between gap-3 px-5 py-4">
        <h2 className="text-base font-semibold">{title}</h2>
        <Amount value={total} className={cn('text-xl font-semibold tracking-tight', owing && total > 0.005 && 'text-warning')} />
      </div>
      {rows.length ? (
        <ul className="divide-y border-t">
          {rows.map((r) => (
            <li key={r.key}>
              <Link href={r.href} className="group flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-muted/40">
                <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/60 text-muted-foreground">
                  <r.icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium group-hover:text-highlight">{r.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.detail}</span>
                </span>
                <span className="num shrink-0 font-semibold">{money(r.amount)}</span>
                <ChevronLeft className="size-4 shrink-0 text-muted-foreground ltr:rotate-180" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t px-5 py-6 text-sm text-muted-foreground">{empty}</p>
      )}
    </Card>
  );
}

/** One of the figures under the balance: what it is, how much, and against what. */
function FlowStat({ label, value, children }: { label: string; value: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="px-(--card-spacing) py-4 [--card-spacing:--spacing(4)]">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1.5 text-xl font-semibold tracking-[-0.02em]">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{children}</p>
    </div>
  );
}

/**
 * A change against the period before, as words with a small arrow — not a
 * coloured pill. `invert` is for figures where less is better (money out).
 */
function Change({ value, invert = false, note }: { value: number; invert?: boolean; note: string }) {
  const flat = Math.abs(value) < 0.05;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  const good = invert ? value < 0 : value > 0;
  return (
    <>
      <span className={cn('inline-flex items-center gap-0.5 font-medium', !flat && (good ? 'text-success' : 'text-destructive'))}>
        <Icon className="size-3.5" />
        <bdi className="num">{`${Math.abs(value).toFixed(1)}%`}</bdi>
      </span>{' '}
      {note}
    </>
  );
}

function AccountList({
  title,
  rows,
  muted,
}: {
  title: string;
  rows: Array<{ key: string; label: string; balance: string; href: string }>;
  muted?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <section>
      <h3 className="mb-1 border-b pb-2 font-sans text-xs font-medium text-muted-foreground">{title}</h3>
      <ul className="grid">
        {rows.map((a) => (
          <li key={a.key}>
            <Link
              href={a.href}
              className="-mx-2 flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-muted/60"
            >
              <span className={cn('truncate', muted && 'text-muted-foreground')}>{a.label}</span>
              <span className={cn('num shrink-0', muted ? 'text-muted-foreground' : 'font-medium')}>{money(a.balance)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A chart's key: a swatch (or a short line, for a line series) and its name. */
function Key({ color, label, line = false }: { color: string; label: string; line?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={line ? 'h-0.5 w-3 rounded-full' : 'size-2 rounded-[2px]'} style={{ background: color }} />
      {label}
    </span>
  );
}
