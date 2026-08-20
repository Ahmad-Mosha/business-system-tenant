import { NoDataYet } from '@/components/empty-state';
import { PageBody, PageHeader, SectionHeading } from '@/components/page-header';
import { Stat, StatCell, StatGrid } from '@/components/stat';
import { getDataRange, getProducts, getStatement, getUnattributed } from '@/lib/api';
import { date, money, moneyWhole } from '@/lib/format';

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

export default async function OverviewPage() {
  const range = await getDataRange();
  if (!range) {
    return (
      <>
        <PageHeader title="Overview" description="noon settlement performance" />
        <PageBody>
          <NoDataYet />
        </PageBody>
      </>
    );
  }

  const [statement, products, unattributed] = await Promise.all([
    getStatement(range.from, range.to),
    getProducts(range.from, range.to),
    getUnattributed(range.from, range.to),
  ]);

  const unitsSold = products.reduce((n, p) => n + p.unitsSold, 0);
  const unitsReturned = products.reduce((n, p) => n + p.unitsReturned, 0);
  const withoutCost = products.filter((p) => p.unitCost === null).length;

  return (
    <>
      <PageHeader
        title="Overview"
        description={`noon settlement · ${date(range.from)} – ${date(range.to)}`}
      />

      <PageBody>
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
                hint={`${((Math.abs(Number(statement.fees)) / Number(statement.netProceeds)) * 100).toFixed(1)}% of proceeds`}
              />
            </StatCell>
            <StatCell>
              <Stat
                label="Paid out"
                value={money(statement.payouts)}
                hint="transferred to our bank"
              />
            </StatCell>
            <StatCell>
              <Stat
                label="Net movement"
                value={money(statement.movement)}
                hint={`${statement.rows} settlement lines`}
                emphasis
              />
            </StatCell>
          </StatGrid>
          <p className="mt-3 text-xs text-muted-foreground">
            Closing balance is not shown because noon&rsquo;s opening balance is not
            present in the export. Net movement is what these lines add up to.
          </p>
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

        {(withoutCost > 0 || unitsReturned > 0) && (
          <section className="rounded-xl border border-border bg-muted/40 px-5 py-4">
            <h2 className="text-sm font-medium">Needs attention</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              {withoutCost > 0 && (
                <li>
                  <span className="font-medium text-foreground tabular-nums">{withoutCost}</span>{' '}
                  of {products.length} products have no cost recorded, so profit cannot be
                  calculated. No marketplace report contains cost.
                </li>
              )}
              {unitsReturned > 0 && (
                <li>
                  <span className="font-medium text-foreground tabular-nums">{unitsReturned}</span>{' '}
                  returned {unitsReturned === 1 ? 'unit' : 'units'} in this period.
                </li>
              )}
            </ul>
          </section>
        )}
      </PageBody>
    </>
  );
}
