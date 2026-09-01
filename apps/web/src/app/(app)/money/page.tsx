import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { BreakdownBar, CashAreaChart, Sparkline } from '@/components/charts';
import { MoneyAnchorForm } from '@/components/money-anchor-form';
import { ContextBar, Screen } from '@/components/shell';
import {
  getCashSeries,
  getFinanceOverview,
  getAccountLedger,
  getMoneyAccounts,
  getPeriodSummary,
} from '@/lib/api';
import { date, money, moneyParts, signedTone } from '@/lib/format';
import { accountByCode, groupAccounts, kindLabel } from '@/lib/money';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';

export default async function MoneyOverviewPage() {
  await requireAdmin();
  const overview = await getFinanceOverview();
  const anchored = overview.openingAsOf !== null;

  if (!anchored) {
    return (
      <Screen>
        <ContextBar title="Money" />
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <section className="max-w-xl rounded-xl border border-dashed border-border bg-card px-5 py-6">
            <h2 className="text-sm font-medium">Start the ledger</h2>
            <p className="mt-1 mb-4 text-[13px] text-muted-foreground">
              Enter the cash the business holds right now. Everything after is recorded automatically
              or entered in Treasury — this figure is the starting point.
            </p>
            <MoneyAnchorForm openingBalance={overview.openingBalance} openingAsOf={overview.openingAsOf} />
          </section>
        </div>
      </Screen>
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
  const spark = series.map((p) => Number(p.balance));

  const rev = Number(summary.revenue);
  const seg = [
    { label: 'Cost of goods', value: Number(summary.cogs), tone: 'cost' as const },
    { label: 'Channel fees', value: Number(summary.channelFees), tone: 'cost' as const },
    { label: 'Shipping', value: Number(summary.shipping), tone: 'cost' as const },
    { label: 'Other', value: Number(summary.otherExpense), tone: 'cost' as const },
    { label: 'Net profit', value: Number(summary.netProfit), tone: 'profit' as const },
  ].filter((s) => Math.abs(s.value) > 0.005);
  const margin = rev > 0 ? (Number(summary.grossProfit) / rev) * 100 : null;

  return (
    <Screen>
      <ContextBar
        title="Money"
        meta="every figure built from recorded events"
      />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Verdict href="/money/ledger?code=CASH" label="Cash on hand" value={bal('CASH')} sub="الخزينة">
            <Sparkline points={spark} />
          </Verdict>
          <Verdict href="/money/ledger?code=NOON_RECEIVABLE" label="noon owes us" value={bal('NOON_RECEIVABLE')} sub="not yet paid out" />
          <Verdict href="/money/ledger?code=BOSTA_COD" label="Bosta holding" value={bal('BOSTA_COD')} sub="COD not transferred" />
          <Verdict
            href="/money/treasury"
            label="Cheques pending"
            value={bal('CHEQUES_PENDING')}
            sub="not yet cleared"
            warn={Number(bal('CHEQUES_PENDING')) > 0}
          />
          <Verdict href="/inventory" label="Stock value" value={overview.stockValue} sub="at cost" />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card lg:col-span-2">
            <div className="flex items-baseline justify-between border-b border-border px-4 py-2.5">
              <h2 className="text-[13px] font-semibold">Cash — last 90 days</h2>
              <span className="text-[12px] text-muted-foreground">now {money(bal('CASH'))}</span>
            </div>
            <div className="h-[200px] px-2 py-2">
              <CashAreaChart series={series} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-2.5">
              <h2 className="text-[13px] font-semibold">This month</h2>
            </div>
            <div className="space-y-4 px-4 py-4">
              {rev === 0 && seg.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-muted-foreground">
                  No sales or costs recorded this month yet.
                </p>
              ) : (
                <>
                  <div className="space-y-1">
                    <Row label="Revenue" value={money(summary.revenue)} strong />
                    <Row
                      label={`Gross profit${margin !== null ? ` · ${margin.toFixed(1)}%` : ''}`}
                      value={money(summary.grossProfit)}
                      negative={Number(summary.grossProfit) < 0}
                    />
                  </div>
                  <BreakdownBar revenue={rev} segments={seg} />
                </>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <h2 className="text-[13px] font-semibold">Recent activity</h2>
              <Link
                href="/money/ledger"
                className="inline-flex items-center gap-0.5 text-[12px] text-muted-foreground hover:text-foreground"
              >
                Full ledger <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="p-10 text-center text-sm text-muted-foreground">No cash movements yet.</p>
            ) : (
              <ul>
                {recent.map((e, i) => (
                  <li
                    key={e.id}
                    className={cn('flex items-center gap-4 px-4 py-2.5 text-[13px]', i > 0 && 'border-t border-border/60')}
                  >
                    <span
                      className={cn(
                        'w-28 shrink-0 text-right font-medium tabular-nums',
                        signedTone(e.effect),
                      )}
                    >
                      {Number(e.effect) > 0 ? '+' : ''}
                      {money(e.effect)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {kindLabel(e.kind)}
                      {e.memo ? <span className="text-muted-foreground"> · {e.memo}</span> : null}
                    </span>
                    <span className="hidden shrink-0 tabular-nums text-muted-foreground sm:block">
                      {money(e.runningBalance)}
                    </span>
                    <span className="w-20 shrink-0 text-right text-[11px] text-muted-foreground">
                      {date(e.occurredAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-2.5">
              <h2 className="text-[13px] font-semibold">The books</h2>
            </div>
            <div className="px-4 py-3">
              <AccountList title="What we hold" rows={groups.held} />
              <AccountList title="What we owe" rows={groups.owe} />
              <AccountList title="Capital" rows={groups.capital} />
              <AccountList title="Revenue & costs" rows={groups.performance} muted />
            </div>
          </div>
        </section>
      </div>
    </Screen>
  );
}

function Verdict({
  href,
  label,
  value,
  sub,
  warn,
  children,
}: {
  href: string;
  label: string;
  value: string;
  sub: string;
  warn?: boolean;
  children?: React.ReactNode;
}) {
  const p = moneyParts(value);
  return (
    <Link
      href={href}
      className="group rounded-xl border border-border bg-card px-4 py-3 shadow-xs transition-colors hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <p className="text-[11px] font-medium tracking-[0.07em] text-muted-foreground uppercase">{label}</p>
      <p className={cn('mt-1.5 text-[22px] leading-none font-semibold tabular-nums', warn && 'text-warning')}>
        {p.sign}
        {p.whole}
        <span className="text-[0.62em] font-medium text-muted-foreground">{p.frac}</span>
      </p>
      {children ? <div className="mt-2">{children}</div> : <p className="mt-1.5 text-[11px] text-muted-foreground">{sub}</p>}
    </Link>
  );
}

function Row({
  label,
  value,
  strong,
  negative,
}: {
  label: string;
  value: string;
  strong?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={cn('text-[12px]', strong ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
      <span className={cn('tabular-nums font-medium', negative && 'text-destructive')}>{value}</span>
    </div>
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
    <div className="mb-4 last:mb-0">
      <p className="mb-1.5 text-[10.5px] font-medium tracking-[0.07em] text-muted-foreground uppercase">
        {title}
      </p>
      <ul className="space-y-0.5">
        {rows.map((a) => (
          <li key={a.code} className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className={cn('truncate', muted && 'text-muted-foreground')}>{a.nameEn}</span>
            <span className={cn('shrink-0 tabular-nums', muted ? 'text-muted-foreground' : 'font-medium')}>
              {money(a.balance)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
