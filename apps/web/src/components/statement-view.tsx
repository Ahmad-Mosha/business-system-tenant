import Link from 'next/link';
import { Amount } from '@/components/amount';
import { MetricCard, MetricGrid } from '@/components/metric-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
 * The full picture for one date range. Shared by the all-time overview and a
 * single month, so both read identically and compare line for line.
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
      <MetricGrid>
        <MetricCard
          label="Net proceeds"
          value={<Amount value={statement.netProceeds} />}
          hint={`${unitsSold} units across ${products.length} products`}
        />
        <MetricCard
          label="Fees"
          value={<Amount value={statement.fees} />}
          hint={`${feeRate.toFixed(1)}% of proceeds`}
        />
        <MetricCard
          label="Cash to bank"
          value={<Amount value={statement.payouts} />}
          hint="Actually transferred"
        />
        <MetricCard
          label="Owed by noon"
          value={statement.closingBalance === null ? '—' : <Amount value={statement.closingBalance} />}
          tone={statement.closingBalance === null ? 'warning' : 'default'}
          hint={
            statement.closingBalance === null ? (
              <Link href="/months" className="underline underline-offset-2">
                Set an opening balance to see this
              </Link>
            ) : (
              'Balance at the end of the period'
            )
          }
        />
      </MetricGrid>

      {statement.openingBalance !== null ? (
        <p className="-mt-3 text-xs text-muted-foreground">
          Opened at <span className="num text-foreground">{money(statement.openingBalance)}</span>, moved{' '}
          <span className="num text-foreground">{money(statement.movement)}</span> across{' '}
          <span className="num">{statement.rows}</span> settlement lines.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Where the fees went</CardTitle>
            <CardDescription>
              <span className="num">{money(statement.fees)}</span> in total, in noon’s own words.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid">
              {FEE_LINES.map((line) => (
                <div key={line.key} className="flex items-center justify-between gap-4 border-b py-2 text-[13px] last:border-b-0">
                  <dt className="text-muted-foreground">{line.label}</dt>
                  <dd className="num font-medium">{money(statement[line.key])}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Not attributable to a product</CardTitle>
            <CardDescription>Payouts, advertising and shipping lines.</CardDescription>
          </CardHeader>
          <CardContent>
            {unattributed.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-muted-foreground">None in this period.</p>
            ) : (
              <dl className="grid">
                {unattributed.map((row) => (
                  <div
                    key={row.transactionType}
                    className="flex items-center justify-between gap-4 border-b py-2 text-[13px] last:border-b-0"
                  >
                    <dt className="text-muted-foreground">
                      {TRANSACTION_LABELS[row.transactionType] ?? row.transactionType}
                      <span className="num ms-2 text-xs opacity-70">{row.rows}</span>
                    </dt>
                    <dd className="num font-medium">{money(row.total)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="pb-0">
        <CardHeader>
          <CardTitle>Best performing</CardTitle>
          <CardDescription>By net, after noon’s fees.</CardDescription>
        </CardHeader>
        {products.length === 0 ? (
          <p className="border-t p-10 text-center text-[13px] text-muted-foreground">No products sold in this period.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="w-[100px] text-right">Units</TableHead>
                <TableHead className="w-[140px] text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.slice(0, 6).map((p, i) => (
                <TableRow key={p.productId}>
                  <TableCell className="num text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="max-w-0 truncate font-medium">
                    <bdi>{p.name}</bdi>
                  </TableCell>
                  <TableCell className="num text-right text-muted-foreground">{p.unitsSold}</TableCell>
                  <TableCell className="num text-right font-medium">{moneyWhole(p.net)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
