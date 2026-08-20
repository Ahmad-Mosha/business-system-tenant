import Link from 'next/link';
import { SectionHeading } from '@/components/page-header';
import { Stat, StatCell, StatGrid } from '@/components/stat';
import { getProducts, getStatement, getUnattributed } from '@/lib/api';
import { money, moneyWhole } from '@/lib/format';

/** noon's own wording, so figures can be checked against the portal directly. */
const FEE_LINES = [
  { key: 'referralFee', label: 'Referral fee' },
  { key: 'fulfilmentFee', label: 'Fulfilment & logistics' },
  { key: 'advertisingFee', label: 'Advertising' },
  { key: 'advertisingSubsidy', label: 'Advertising subsidy' },
  { key: 'shippingCredits', label: 'Shipping credits' },
  { key: 'otherOrderFees', label: 'Other order fees' },
] as const;

const TRANSACTION_LABELS: Record<string, string> = {
  payment: 'Payouts to our bank',
  order: 'Shipping-only order lines',
  order_update: 'Post-sale adjustments',
  statement_fee: 'Advertising & statement fees',
  balance_transfer: 'Balance transfers',
};

/**
 * The full picture for one date range. Shared by the all-time overview and by
 * a single month, so both read identically and can be compared line for line.
 */
export async function StatementView({ from, to }: { from: string; to: string }) {
  const [statement, products, unattributed] = await Promise.all([
    getStatement(from, to),
    getProducts(from, to),
    getUnattributed(from, to),
  ]);

  const unitsSold = products.reduce((n, p) => n + p.unitsSold, 0);
  const feeRate = Number(statement.netProceeds)
    ? (Math.abs(Number(statement.fees)) / Number(statement.netProceeds)) * 100
    : 0;

  return (
    <>
      <section>
        <StatGrid>
          <StatCell>
            <Stat
              label="Net proceeds"
              value={money(statement.netProceeds)}
              hint={`${unitsSold} units across ${products.length} products`}
            />
          </StatCell>
          <StatCell>
            <Stat
              label="Fees"
              value={money(statement.fees)}
              hint={`${feeRate.toFixed(1)}% of proceeds`}
            />
          </StatCell>
          <StatCell>
            <Stat
              label="Cash to bank"
              value={money(statement.payouts)}
              hint="actually transferred"
            />
          </StatCell>
          <StatCell>
            <Stat
              label="Owed by noon"
              value={
                statement.closingBalance === null ? '—' : money(statement.closingBalance)
              }
              hint={
                statement.closingBalance === null ? (
                  <Link href="/months" className="underline underline-offset-2">
                    set an opening balance
                  </Link>
                ) : (
                  'balance at period end'
                )
              }
              emphasis
            />
          </StatCell>
        </StatGrid>

        {statement.openingBalance !== null && (
          <p className="mt-3 text-xs text-muted-foreground">
            Opened at {money(statement.openingBalance)}, moved{' '}
            {money(statement.movement)} across {statement.rows} settlement lines.
          </p>
        )}
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <SectionHeading title="Where the fees went" hint={money(statement.fees)} />
          <dl className="overflow-hidden rounded-xl border border-border">
            {FEE_LINES.map((line, i) => (
              <div
                key={line.key}
                className={`flex items-center justify-between gap-4 px-4 py-3 text-sm ${
                  i > 0 ? 'border-t border-border' : ''
                }`}
              >
                <dt className="text-muted-foreground">{line.label}</dt>
                <dd className="font-medium tabular-nums">{money(statement[line.key])}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <SectionHeading
            title="Not attributable to a product"
            hint="payouts, advertising, shipping"
          />
          <dl className="overflow-hidden rounded-xl border border-border">
            {unattributed.map((row, i) => (
              <div
                key={row.transactionType}
                className={`flex items-center justify-between gap-4 px-4 py-3 text-sm ${
                  i > 0 ? 'border-t border-border' : ''
                }`}
              >
                <dt className="min-w-0">
                  <span className="text-muted-foreground">
                    {TRANSACTION_LABELS[row.transactionType] ?? row.transactionType}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground/60">{row.rows}</span>
                </dt>
                <dd className="shrink-0 font-medium tabular-nums">{money(row.total)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section>
        <SectionHeading title="Best performing" hint="by net after fees" />
        <ul className="overflow-hidden rounded-xl border border-border">
          {products.slice(0, 6).map((p, i) => (
            <li
              key={p.productId}
              className={`flex items-center gap-4 px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}
            >
              <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground/60">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {p.unitsSold} units
              </span>
              <span className="w-24 shrink-0 text-right text-sm font-medium tabular-nums">
                {moneyWhole(p.net)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
