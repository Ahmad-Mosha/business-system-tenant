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
  getFinanceOverview,
  getMoneyAccounts,
  getPeriodSummary,
  type CashFlow,
} from '@/lib/api';
import { daysAgo, isoDate, money } from '@/lib/format';
import { accountByCode, flowLabel, groupAccounts } from '@/lib/money';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';
import { getFormat } from '@/i18n/get-format';

/** The windows the overview can cover, and how finely each one is bucketed. */
const RANGES = [
  { value: '7d', label: '7 days', days: 7, bucket: 'day' },
  { value: '30d', label: '30 days', days: 30, bucket: 'day' },
  { value: '90d', label: '90 days', days: 90, bucket: 'week' },
  { value: '12m', label: '12 months', days: 365, bucket: 'month' },
] as const satisfies ReadonlyArray<{ value: string; label: string; days: number; bucket: Bucket }>;

const DEFAULT_RANGE = '30d';

const sum = (series: CashFlow['series'], key: 'in' | 'out') =>
  series.reduce((n, p) => n + Number(p[key]), 0);

/** Change against the window before, in percent — only when there was something to compare with. */
const change = (now: number, before: number) => (before > 0 ? ((now - before) / before) * 100 : null);

const span = (label: string) => `the last ${label}`;

export default async function MoneyOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const f = await getFormat();
  await requireAdmin();
  const overview = await getFinanceOverview();

  if (overview.openingAsOf === null) {
    return (
      <Page width="narrow">
        <PageHeader title="Money" description="Every figure here is built from recorded events." />
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Wallet />
            </EmptyMedia>
            <EmptyTitle>Start the ledger</EmptyTitle>
            <EmptyDescription>
              Enter the cash the business holds right now. Everything after is recorded
              automatically or entered in Treasury — this figure is the starting point.
            </EmptyDescription>
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
  const to = isoDate(new Date());
  const from = daysAgo(range.days - 1);
  // The same length of time just before, for "vs the previous 30 days".
  const before = { from: daysAgo(range.days * 2 - 1), to: daysAgo(range.days) };

  const [accounts, days, flow, previous, summary] = await Promise.all([
    getMoneyAccounts(),
    getCashSeries(range.days),
    getCashFlow(from, to, range.bucket),
    getCashFlow(before.from, before.to, 'month'),
    getPeriodSummary(from, to),
  ]);

  // Before the opening balance there were no books, not a zero balance — so
  // the chart and the change start where the books do.
  const opened = overview.openingAsOf;
  const series = days.filter((p) => p.date >= opened);
  const sinceOpening = series.length < days.length;
  const cash = accountByCode(accounts, 'CASH')?.balance ?? '0';
  const balances = series.map((p) => Number(p.balance));
  const moved = balances.length > 1 ? balances[balances.length - 1] - balances[0] : null;
  const balanceSpan = sinceOpening ? `since the books began on ${f.date(opened)}` : span(range.label);
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
        label: flowLabel(direction, s.code, s.nameEn),
        value: Number(s.amount),
        fill: direction === 'in' ? 'var(--success)' : 'var(--destructive)',
        href: ledgerFor(s.code),
      }));

  const costs: BarItem[] = [
    { key: 'SALES', label: 'Sales revenue', value: Number(summary.revenue), fill: 'var(--chart-4)' },
    { key: 'CHANNEL_FEES', label: 'Fees and ads', value: Number(summary.channelFees), fill: 'var(--muted-foreground)' },
    { key: 'SHIPPING', label: 'Shipping', value: Number(summary.shipping), fill: 'var(--muted-foreground)' },
    { key: 'OTHER_EXPENSE', label: 'Other expenses', value: Number(summary.otherExpense), fill: 'var(--muted-foreground)' },
  ]
    .filter((c) => Math.abs(c.value) > 0.005)
    .map((c) => ({ ...c, href: ledgerFor(c.key) }));

  const groups = groupAccounts(accounts);

  return (
    <Page>
      <PageHeader
        title="Money"
        description="Where the money is, which way it's moving, and why — built from recorded events only."
        actions={
          <PeriodTabs
            value={range.value}
            options={RANGES}
            href={(v) => (v === DEFAULT_RANGE ? '/money' : `/money?range=${v}`)}
          />
        }
      />

      <MetricGrid>
        <MetricCard
          label="Cash on hand"
          value={<Amount value={cash} className={cn(Number(cash) < 0 && 'text-destructive')} />}
          link={{ href: '/money/treasury', label: 'Open Treasury' }}
          hint={
            moved === null ? (
              'الخزينة'
            ) : (
              <>
                <Amount
                  value={moved}
                  signed
                  className={cn(moved > 0 && 'text-success', moved < 0 && 'text-destructive')}
                />{' '}
                {sinceOpening ? `since ${f.date(opened)}` : `over ${range.label}`}
              </>
            )
          }
        >
          <Sparkline points={balances} />
        </MetricCard>
        <MetricCard
          label="Money in"
          value={<Amount value={moneyIn} />}
          badge={inChange !== null ? <Delta value={inChange} /> : undefined}
          hint={inChange !== null ? `vs the ${range.label} before` : `In ${span(range.label)}`}
        />
        <MetricCard
          label="Money out"
          value={<Amount value={moneyOut} />}
          badge={outChange !== null ? <Delta value={outChange} invert /> : undefined}
          hint={outChange !== null ? `vs the ${range.label} before` : `In ${span(range.label)}`}
        />
        <MetricCard
          label="Net cash flow"
          value={
            <Amount
              value={net}
              signed
              className={cn(net > 0 && 'text-success', net < 0 && 'text-destructive')}
            />
          }
          hint={net >= 0 ? 'More came in than went out' : 'More went out than came in'}
        />
        <MetricCard
          label="Stock value"
          value={<Amount value={overview.stockValue} />}
          link={{ href: '/inventory', label: 'Open Inventory' }}
          hint="Everything on hand, at cost"
        />
      </MetricGrid>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Stretches to The books beside it, and the chart takes the height. */}
        <Card className="flex flex-col xl:col-span-2">
          <CardHeader>
            <CardTitle>Cash on hand</CardTitle>
            <CardDescription>The treasury’s balance at the end of each day, {balanceSpan}.</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/money/treasury">
                  Treasury
                  <ArrowUpRight className="rtl:-scale-x-100" />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex-1">
            <CashBalanceChart series={series} className="h-full min-h-72" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>The books</CardTitle>
            <CardDescription>Every account’s balance, right now.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <AccountList title="What we hold" rows={groups.held} />
            <AccountList title="What we owe" rows={groups.owe} />
            <AccountList title="Capital" rows={groups.capital} />
            <AccountList title="Revenue and costs" rows={groups.performance} muted />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Money in and out</CardTitle>
          <CardDescription>
            Per {range.bucket}, {span(range.label)}. The opening balance isn’t counted — it’s where the books began.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <Legend swatch="bg-success" label="In" value={moneyIn} />
            <Legend swatch="bg-destructive" label="Out" value={-moneyOut} />
          </div>
          <CashFlowChart series={flow.series} bucket={range.bucket} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Where it came from</CardTitle>
            <CardDescription>Money into the treasury, {span(range.label)}. Open a bar for its entries.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList items={sources('in')} empty="Nothing came in." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Where it went</CardTitle>
            <CardDescription>Money out of the treasury, {span(range.label)}. Open a bar for its entries.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList items={sources('out')} empty="Nothing went out." />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader>
            <CardTitle>Revenue and costs</CardTitle>
            <CardDescription>As the books recorded them, {span(range.label)}.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <BarList items={costs} empty="No sales or costs recorded." />
            {/* Nothing posts cost of goods sold yet, so a profit figure here would
                be revenue minus fees — flattering and wrong. */}
            <p className="border-t pt-3 text-xs text-muted-foreground">
              Cost of goods sold isn’t posted to the books yet, so there’s no profit figure here.
            </p>
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
              <span className={cn('truncate', muted && 'text-muted-foreground')}>{a.nameEn}</span>
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
