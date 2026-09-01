import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { MoneyAnchorForm } from '@/components/money-anchor-form';
import { MetricCard, MetricRow, PageCard, Panel, Screen, Scroller } from '@/components/shell';
import { getAccountLedger, getFinanceOverview, getMoneyAccounts } from '@/lib/api';
import { date, money, moneyWhole } from '@/lib/format';
import { accountByCode, groupAccounts, kindLabel } from '@/lib/money';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';

export default async function MoneyOverviewPage() {
  await requireAdmin();
  const [overview, accounts, recent] = await Promise.all([
    getFinanceOverview(),
    getMoneyAccounts(),
    getAccountLedger('CASH', 12),
  ]);

  const anchored = overview.openingAsOf !== null;
  const bal = (code: string) => accountByCode(accounts, code)?.balance ?? '0';
  const groups = groupAccounts(accounts);

  return (
    <Screen>
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <PageCard
          title="Money"
          description="Cash, what we're owed, and what the business is worth — every figure built from recorded events."
        />

        {!anchored ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-5 py-6">
            <h2 className="text-sm font-medium">Start the ledger</h2>
            <p className="mt-1 mb-4 max-w-prose text-[13px] text-muted-foreground">
              Enter the cash the business holds right now. Everything after is recorded automatically
              or entered in Treasury — this figure is the starting point.
            </p>
            <MoneyAnchorForm openingBalance={overview.openingBalance} openingAsOf={overview.openingAsOf} />
          </div>
        ) : (
          <MetricRow>
            <MetricCard label="Cash on hand" value={money(bal('CASH'))} hint="الخزينة" />
            <MetricCard
              label="noon owes us"
              value={moneyWhole(bal('NOON_RECEIVABLE'))}
              hint="not yet paid out"
            />
            <MetricCard
              label="Bosta holding"
              value={moneyWhole(bal('BOSTA_COD'))}
              hint="COD not transferred"
            />
            <MetricCard
              label="Cheques pending"
              value={moneyWhole(bal('CHEQUES_PENDING'))}
              hint="not yet cleared"
              tone={Number(bal('CHEQUES_PENDING')) > 0 ? 'warning' : 'default'}
            />
            <MetricCard label="Stock value" value={moneyWhole(overview.stockValue)} hint="at cost" />
          </MetricRow>
        )}

        {anchored && (
          <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
            <Panel>
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <h2 className="text-[13px] font-semibold">Recent activity</h2>
                <Link
                  href="/money/ledger"
                  className="inline-flex items-center gap-0.5 text-[12px] text-muted-foreground hover:text-foreground"
                >
                  Full ledger <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
              <Scroller>
                {recent.length === 0 ? (
                  <p className="p-10 text-center text-sm text-muted-foreground">
                    No cash movements yet.
                  </p>
                ) : (
                  <ul>
                    {recent.map((e, i) => (
                      <li
                        key={e.id}
                        className={cn(
                          'flex items-center gap-4 px-4 py-2.5 text-[13px]',
                          i > 0 && 'border-t border-border/60',
                        )}
                      >
                        <span
                          className={cn(
                            'w-28 shrink-0 text-right font-medium tabular-nums',
                            Number(e.effect) >= 0 ? 'text-success' : 'text-foreground',
                          )}
                        >
                          {Number(e.effect) >= 0 ? '+' : ''}
                          {money(e.effect)}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {kindLabel(e.kind)}
                          {e.memo ? <span className="text-muted-foreground"> · {e.memo}</span> : null}
                        </span>
                        <span className="hidden shrink-0 text-right tabular-nums text-muted-foreground sm:block">
                          {money(e.runningBalance)}
                        </span>
                        <span className="w-20 shrink-0 text-right text-[11px] text-muted-foreground">
                          {date(e.occurredAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Scroller>
            </Panel>

            <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs lg:w-[320px]">
              <div className="border-b border-border px-4 py-2.5">
                <h2 className="text-[13px] font-semibold">The books</h2>
              </div>
              <Scroller className="px-4 py-3">
                <AccountList title="What we hold" rows={groups.held} />
                <AccountList title="What we owe" rows={groups.owe} />
                <AccountList title="Capital" rows={groups.capital} />
                <AccountList title="Revenue & costs" rows={groups.performance} muted />
              </Scroller>
            </aside>
          </div>
        )}
      </div>
    </Screen>
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
            <span
              className={cn(
                'shrink-0 tabular-nums',
                muted ? 'text-muted-foreground' : 'font-medium',
              )}
            >
              {money(a.balance)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
