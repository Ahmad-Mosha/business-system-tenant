import { ArrowUpRight, Wallet } from 'lucide-react';
import Link from 'next/link';
import { Amount } from '@/components/amount';
import { BreakdownBar, CashAreaChart, Sparkline } from '@/components/charts';
import { Delta, MetricCard, MetricGrid } from '@/components/metric-card';
import { MoneyAnchorForm } from '@/components/money-anchor-form';
import { Page, PageHeader } from '@/components/page';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getAccountLedger,
  getCashSeries,
  getFinanceOverview,
  getMoneyAccounts,
  getPeriodSummary,
} from '@/lib/api';
import { date, money, signedTone } from '@/lib/format';
import { accountByCode, groupAccounts, kindLabel } from '@/lib/money';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';

export default async function MoneyOverviewPage() {
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

  const [accounts, recent, series, summary] = await Promise.all([
    getMoneyAccounts(),
    getAccountLedger('CASH', 12),
    getCashSeries(90),
    getPeriodSummary(),
  ]);

  const bal = (code: string) => accountByCode(accounts, code)?.balance ?? '0';
  const groups = groupAccounts(accounts);
  const values = series.map((p) => Number(p.balance));

  // A real 30-day change, from the recorded series — shown only when there is
  // a non-zero starting point to compare against.
  const then = values.length > 30 ? values[values.length - 31] : null;
  const now = values.length ? values[values.length - 1] : null;
  const change = then && now !== null ? ((now - then) / Math.abs(then)) * 100 : null;

  const rev = Number(summary.revenue);
  const segments = [
    { label: 'Cost of goods', value: Number(summary.cogs), tone: 'cost' as const },
    { label: 'Channel fees', value: Number(summary.channelFees), tone: 'cost' as const },
    { label: 'Shipping', value: Number(summary.shipping), tone: 'cost' as const },
    { label: 'Other', value: Number(summary.otherExpense), tone: 'cost' as const },
    { label: 'Net profit', value: Number(summary.netProfit), tone: 'profit' as const },
  ].filter((s) => Math.abs(s.value) > 0.005);
  const margin = rev > 0 ? (Number(summary.grossProfit) / rev) * 100 : null;
  const chequesPending = Number(bal('CHEQUES_PENDING'));

  return (
    <Page>
      <PageHeader
        title="Money"
        description="Every figure here is built from recorded events — open any of them to see which."
        actions={
          <Button variant="outline" asChild>
            <Link href="/money/ledger">
              Full ledger
              <ArrowUpRight />
            </Link>
          </Button>
        }
      />

      <MetricGrid>
        <MetricCard
          label="Cash on hand"
          value={<Amount value={bal('CASH')} />}
          badge={change !== null ? <Delta value={change} /> : undefined}
          link={{ href: '/money/ledger?code=CASH', label: 'Open in the ledger' }}
          hint={change !== null ? 'vs 30 days ago' : 'الخزينة'}
        >
          <Sparkline points={values} />
        </MetricCard>
        <MetricCard
          label="noon owes us"
          value={<Amount value={bal('NOON_RECEIVABLE')} />}
          link={{ href: '/money/ledger?code=NOON_RECEIVABLE', label: 'Open in the ledger' }}
          hint="Sold, not yet paid out"
        />
        <MetricCard
          label="Bosta is holding"
          value={<Amount value={bal('BOSTA_COD')} />}
          link={{ href: '/money/ledger?code=BOSTA_COD', label: 'Open in the ledger' }}
          hint="Cash collected, not transferred"
        />
        <MetricCard
          label="Cheques pending"
          value={<Amount value={chequesPending} />}
          tone={chequesPending > 0 ? 'warning' : 'default'}
          link={{ href: '/money/treasury', label: 'Open Treasury' }}
          hint={chequesPending > 0 ? 'Not cleared yet' : 'Nothing waiting to clear'}
        />
        <MetricCard
          label="Stock value"
          value={<Amount value={overview.stockValue} />}
          link={{ href: '/inventory', label: 'Open Inventory' }}
          hint="Everything on hand, at cost"
        />
      </MetricGrid>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Cash — last 90 days</CardTitle>
            <CardDescription>The till balance at the end of each day.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <CashAreaChart series={series} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>This month</CardTitle>
            <CardDescription>Where the revenue went.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            {rev === 0 && segments.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-muted-foreground">
                No sales or costs recorded this month yet.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Revenue</p>
                    <Amount value={summary.revenue} className="text-xl font-semibold tracking-tight" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Gross profit{margin !== null ? ` · ${margin.toFixed(1)}%` : ''}
                    </p>
                    <Amount
                      value={summary.grossProfit}
                      className={cn(
                        'text-xl font-semibold tracking-tight',
                        Number(summary.grossProfit) < 0 && 'text-destructive',
                      )}
                    />
                  </div>
                </div>
                <BreakdownBar revenue={rev} segments={segments} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="pb-0 xl:col-span-2">
          <CardHeader>
            <CardTitle>Recent cash movements</CardTitle>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/money/treasury">
                  Treasury
                  <ArrowUpRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          {recent.length === 0 ? (
            <p className="border-t p-10 text-center text-[13px] text-muted-foreground">No cash movements yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Movement</TableHead>
                  <TableHead className="w-[140px] text-right">Amount</TableHead>
                  <TableHead className="hidden w-[140px] text-right sm:table-cell">Balance</TableHead>
                  <TableHead className="w-[110px] text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="max-w-0 truncate">
                      <span className="font-medium">{kindLabel(e.kind)}</span>
                      {e.memo ? <span className="text-muted-foreground"> · {e.memo}</span> : null}
                    </TableCell>
                    <TableCell className={cn('num text-right font-medium', signedTone(e.effect))}>
                      {Number(e.effect) > 0 ? '+' : ''}
                      {money(e.effect)}
                    </TableCell>
                    <TableCell className="num hidden text-right text-muted-foreground sm:table-cell">
                      {money(e.runningBalance)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{date(e.occurredAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
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
    </Page>
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
