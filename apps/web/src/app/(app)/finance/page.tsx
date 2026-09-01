import { CapitalForm } from '@/components/capital-form';
import { CashAnchorForm } from '@/components/cash-anchor-form';
import { PageBody, PageHeader, SectionHeading } from '@/components/page-header';
import { getFinanceHistory, getFinanceOverview } from '@/lib/api';
import { dateTime, money, moneyWhole } from '@/lib/format';
import { requireAdmin } from '@/lib/session';

const REASON_LABEL: Record<string, string> = {
  OPENING_BALANCE: 'Opening balance',
  CASH_DEPOSIT: 'Owner added cash',
  CAPITAL_WITHDRAWAL: 'Owner withdrew cash',
  CHEQUE_DEPOSIT: 'Cheque received',
  CHEQUE_CLEAR: 'Cheque cleared',
  PAYMENT_IN: 'Money in',
  PAYMENT_OUT: 'Money out',
  PURCHASE: 'Stock purchased',
  SUPPLIER_PAYMENT: 'Paid a supplier',
  NOON_PAYOUT: 'noon payout',
  ORDER_SALE: 'Order paid',
  BOSTA_PAYOUT: 'Bosta payout',
  ADJUSTMENT: 'Correction',
};

export default async function FinancePage() {
  await requireAdmin();
  const [overview, history] = await Promise.all([getFinanceOverview(), getFinanceHistory()]);
  const anchored = overview.openingAsOf !== null;

  return (
    <>
      <PageHeader title="Finance" />
      <PageBody>
        {anchored ? (
          <section className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
            <MiniStat label="Cash" value={moneyWhole(overview.cash)} />
            <MiniStat label="Stock value" value={moneyWhole(overview.stockValue)} />
            <MiniStat label="Total assets" value={moneyWhole(overview.totalAssets)} />
          </section>
        ) : (
          <section className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
            Set an opening cash balance below to start tracking cash.
          </section>
        )}

        <section className="max-w-xl">
          <SectionHeading title="Opening balance" hint={anchored ? 'anchored' : 'not set'} />
          <div className="rounded-xl border border-border p-5">
            <p className="mb-4 text-sm text-muted-foreground">
              What cash was, before this ledger started tracking it. Everything after is added
              automatically — purchases, noon payouts, paid orders — or recorded by hand below.
            </p>
            <CashAnchorForm openingBalance={overview.openingBalance} openingAsOf={overview.openingAsOf} />
          </div>
        </section>

        <section className="max-w-2xl">
          <SectionHeading title="Add or withdraw cash" />
          <div className="rounded-xl border border-border p-5">
            <CapitalForm />
          </div>
        </section>

        <section>
          <SectionHeading title="History" />
          {history.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-5 py-14 text-center text-sm text-muted-foreground">
              No cash movements yet.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-xl border border-border">
              {history.map((tx, i) => (
                <li
                  key={tx.id}
                  className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm ${i > 0 ? 'border-t border-border' : ''}`}
                >
                  <span
                    className={`w-28 shrink-0 text-right font-medium tabular-nums ${Number(tx.amount) > 0 ? 'text-success' : 'text-muted-foreground'}`}
                  >
                    {Number(tx.amount) > 0 ? '+' : ''}
                    {money(tx.amount)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {REASON_LABEL[tx.reason] ?? tx.reason}
                    {tx.note ? <span className="text-muted-foreground"> · {tx.note}</span> : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{dateTime(tx.occurredAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </PageBody>
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background px-4 py-3">
      <p className="text-[10.5px] font-medium tracking-[0.06em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
