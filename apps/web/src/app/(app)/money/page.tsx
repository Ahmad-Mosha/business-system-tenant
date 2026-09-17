import { ArrowUpRight, Wallet } from 'lucide-react';
import Link from 'next/link';
import { Amount } from '@/components/amount';
import {
  BarList,
  CashBalanceChart,
  CashFlowChart,
  Sparkline,
  type BarItem,
  type Bucket,
} from '@/components/charts';
import { Delta, MetricCard, MetricGrid } from '@/components/metric-card';
import { MoneyAnchorForm } from '@/components/money-anchor-form';
import { Page, PageHeader } from '@/components/page';
import { PeriodTabs } from '@/components/period-tabs';
import { ProfitSection } from '@/components/profit-breakdown';
import { Button } from '@/components/ui/button';
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
  getCashSeries,
  getBusinessProfit,
  getFinanceOverview,
  getMoneyAccounts,
  getPeriodSummary,
  type CashFlow,
} from '@/lib/api';
import { daysAgo, money, today } from '@/lib/format';
import { accountByCode, accountName, CASH_IN, CASH_OUT, groupAccounts } from '@/lib/money';
import { requireAdmin } from '@/lib/session';
import { cn, isOneOf } from '@/lib/utils';
import { useLocale } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { getFormat } from '@/i18n/get-format';

/** The windows the overview can cover, and how finely each one is bucketed. */
const RANGES = [
  { value: '7d', days: 7, bucket: 'day' },
  { value: '30d', days: 30, bucket: 'day' },
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
  const [f, t, tr, locale] = await Promise.all([
    getFormat(),
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

  const [accounts, days, flow, previous, summary, businessProfit] = await Promise.all([
    getMoneyAccounts(),
    getCashSeries(range.days),
    getCashFlow(from, to, range.bucket),
    getCashFlow(before.from, before.to, 'month'),
    getPeriodSummary(from, to),
    getBusinessProfit(from, to, range.bucket),
  ]);

  // Before the opening balance there were no books, not a zero balance — so
  // the chart and the change start where the books do.
  const opened = overview.openingAsOf;
  const series = days.filter((p) => p.date >= opened);
  const sinceOpening = series.length < days.length;
  const cash = accountByCode(accounts, 'CASH')?.balance ?? '0';
  const balances = series.map((p) => Number(p.balance));
  const moved = balances.length > 1 ? balances[balances.length - 1] - balances[0] : null;
  const rangeLabel = t(`ranges.${range.value}`);
  const last = t('lastRange', { range: rangeLabel });
  const balanceSpan = sinceOpening ? t('sinceBooks', { date: f.date(opened) }) : last;
  const moneyIn = sum(flow.series, 'in');
  const moneyOut = sum(flow.series, 'out');
  const net = moneyIn - moneyOut;
  // A window that starts before the books did holds only part of its days —
  // "+8,700% vs the 90 days before" would be comparing against nothing.
  const comparable = before.from >= opened;
  const inChange = comparable ? change(moneyIn, sum(previous.series, 'in')) : null;
  const outChange = comparable ? change(moneyOut, sum(previous.series, 'out')) : null;
  const ledgerFor = (code: string) => `/money/ledger?code=${code}&from=${from}&to=${to}`;

  const sources = (direction: 'in' | 'out'): BarItem[] =>
    flow.sources
      .filter((s) => s.direction === direction)
      .map((s) => ({
        key: s.code,
        label:
          direction === 'in'
            ? isOneOf(CASH_IN, s.code)
              ? tr(`enums.cashIn.${s.code}`)
              : accountName(s, locale)
            : isOneOf(CASH_OUT, s.code)
              ? tr(`enums.cashOut.${s.code}`)
              : accountName(s, locale),
        value: Number(s.amount),
        fill: direction === 'in' ? 'var(--success)' : 'var(--destructive)',
        href: ledgerFor(s.code),
      }));

  const costs: BarItem[] = [
    { key: 'SALES', label: t('overview.salesRevenue'), value: Number(summary.revenue), fill: 'var(--chart-4)' },
    { key: 'CHANNEL_FEES', label: tr('enums.cashOut.CHANNEL_FEES'), value: Number(summary.channelFees), fill: 'var(--muted-foreground)' },
    { key: 'SHIPPING', label: tr('enums.cashOut.SHIPPING'), value: Number(summary.shipping), fill: 'var(--muted-foreground)' },
    { key: 'OTHER_EXPENSE', label: t('overview.otherExpenses'), value: Number(summary.otherExpense), fill: 'var(--muted-foreground)' },
  ]
    .filter((c) => Math.abs(c.value) > 0.005)
    .map((c) => ({ ...c, href: ledgerFor(c.key) }));

  const groups = groupAccounts(accounts);

  return (
    <Page>
      <PageHeader
        title={t('title')}
        description={t('overview.description')}
        actions={
          <PeriodTabs
            value={range.value}
            options={RANGES.map((r) => ({ value: r.value, label: t(`ranges.${r.value}`) }))}
            href={(v) => (v === DEFAULT_RANGE ? '/money' : `/money?range=${v}`)}
          />
        }
      />

      <MetricGrid>
        <MetricCard
          label={tr('charts.cashOnHand')}
          value={<Amount value={cash} className={cn(Number(cash) < 0 && 'text-destructive')} />}
          link={{ href: '/money/treasury', label: t('overview.openTreasury') }}
          hint={
            moved === null ? (
              tr('nav.items.treasury')
            ) : (
              <>
                <Amount
                  value={moved}
                  signed
                  className={cn(moved > 0 && 'text-success', moved < 0 && 'text-destructive')}
                />{' '}
                {sinceOpening ? t('sinceDate', { date: f.date(opened) }) : t('overRange', { range: rangeLabel })}
              </>
            )
          }
        >
          <Sparkline points={balances} />
        </MetricCard>
        <MetricCard
          label={tr('charts.moneyIn')}
          value={<Amount value={moneyIn} />}
          badge={inChange !== null ? <Delta value={inChange} /> : undefined}
          hint={t(inChange !== null ? 'vsBefore' : 'inLast', { range: rangeLabel })}
        />
        <MetricCard
          label={tr('charts.moneyOut')}
          value={<Amount value={moneyOut} />}
          badge={outChange !== null ? <Delta value={outChange} invert /> : undefined}
          hint={t(outChange !== null ? 'vsBefore' : 'inLast', { range: rangeLabel })}
        />
        <MetricCard
          label={t('overview.netFlow')}
          value={
            <Amount
              value={net}
              signed
              className={cn(net > 0 && 'text-success', net < 0 && 'text-destructive')}
            />
          }
          hint={net >= 0 ? t('overview.netPositive') : t('overview.netNegative')}
        />
        <MetricCard
          label={tr('inventory.stockValue')}
          value={<Amount value={overview.stockValue} />}
          link={{ href: '/inventory', label: t('overview.openInventory') }}
          hint={t('overview.stockHint')}
        />
      </MetricGrid>

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{tr('charts.cashOnHand')}</CardTitle>
            <CardDescription>{t('overview.balanceHint', { span: balanceSpan })}</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/money/treasury">
                  {tr('nav.items.treasury')}
                  <ArrowUpRight className="rtl:-scale-x-100" />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-5">
            <CashBalanceChart series={series} className="h-64" />
            <div className="border-t pt-4">
              <h3 className="mb-1 text-sm font-medium">{t('overview.profitTitle')}</h3>
              <p className="mb-3 text-xs text-muted-foreground">{t('overview.profitHint', { span: last })}</p>
              <ProfitSection report={businessProfit} bucket={range.bucket} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('overview.books')}</CardTitle>
            <CardDescription>{t('overview.booksHint')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <AccountList title={t('overview.held')} rows={groups.held} />
            <AccountList title={t('overview.owe')} rows={groups.owe} />
            <AccountList title={t('overview.capital')} rows={groups.capital} />
            <AccountList title={t('overview.performance')} rows={groups.performance} muted />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('overview.inOut')}</CardTitle>
          <CardDescription>{t('overview.inOutHint', { bucket: range.bucket, span: last })}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <Legend swatch="bg-success" label={tr('ledger.in')} value={moneyIn} />
            <Legend swatch="bg-destructive" label={tr('ledger.out')} value={-moneyOut} />
          </div>
          <CashFlowChart series={flow.series} bucket={range.bucket} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t('overview.cameFrom')}</CardTitle>
            <CardDescription>{t('overview.cameFromHint', { span: last })}</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList items={sources('in')} empty={t('overview.nothingIn')} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('overview.wentTo')}</CardTitle>
            <CardDescription>{t('overview.wentToHint', { span: last })}</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList items={sources('out')} empty={t('overview.nothingOut')} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader>
            <CardTitle>{t('overview.performance')}</CardTitle>
            <CardDescription>{t('overview.performanceHint', { span: last })}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <BarList items={costs} empty={t('overview.noCosts')} />
            <p className="border-t pt-3 text-xs text-muted-foreground">{t('overview.expensesSeparate')}</p>
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}

/** A chart's series key with its total — the legend and the headline in one. */
function Legend({ swatch, label, value }: { swatch: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn('size-2 shrink-0', swatch)} />
      {label}
      <Amount value={value} signed className="text-[13px] font-semibold text-foreground" />
    </span>
  );
}

function AccountList({
  title,
  rows,
  muted,
}: {
  title: string;
  rows: Array<{ code: string; nameEn: string; nameAr: string; balance: string }>;
  muted?: boolean;
}) {
  const locale = useLocale();
  if (rows.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 font-sans text-xs font-medium text-muted-foreground">{title}</h3>
      <ul className="grid gap-1">
        {rows.map((a) => (
          <li key={a.code}>
            <Link
              href={`/money/ledger?code=${a.code}`}
              className="-mx-2 flex items-baseline justify-between gap-3 px-2 py-1 text-[13px] hover:bg-muted"
            >
              <span className={cn('truncate', muted && 'text-muted-foreground')}>{accountName(a, locale)}</span>
              <span className={cn('num shrink-0', muted ? 'text-muted-foreground' : 'font-medium')}>
                {money(a.balance)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
