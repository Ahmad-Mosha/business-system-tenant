import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
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
import { isOneOf } from '@/lib/utils';
import { b, num } from '@/i18n/rich';

/** The fee lines of noon's statement, in its order (`enums.noonFee`). */
const FEE_LINES = [
  'referralFee',
  'fulfilmentFee',
  'advertisingFee',
  'advertisingSubsidy',
  'shippingCredits',
  'otherOrderFees',
] as const;

/** Settlement lines no product owns (`enums.noonTransaction`); anything else shows noon's own type. */
const TRANSACTIONS = ['payment', 'order', 'order_update', 'statement_fee', 'balance_transfer'] as const;

/**
 * The full picture for one date range. Shared by the all-time overview and a
 * single month, so both read identically and compare line for line.
 */
export async function StatementView({ from, to }: { from: string; to: string }) {
  const [statement, products, unattributed, t, tr] = await Promise.all([
    getStatement(from, to),
    getProducts(from, to),
    getUnattributed(from, to),
    getTranslations('noon.statement'),
    getTranslations(),
  ]);

  const unitsSold = products.reduce((n, p) => n + p.unitsSold, 0);
  const feeRate = Number(statement.netProceeds)
    ? (Math.abs(Number(statement.fees)) / Number(statement.netProceeds)) * 100
    : 0;

  return (
    <>
      <MetricGrid>
        <MetricCard
          label={tr('charts.netProceeds')}
          value={<Amount value={statement.netProceeds} />}
          hint={
            products.length
              ? t('netHint', {
                  units: tr('nouns.units', { count: unitsSold }),
                  products: tr('nouns.products', { count: products.length }),
                })
              : t('netHintNone')
          }
        />
        <MetricCard
          label={t('fees')}
          value={<Amount value={statement.fees} />}
          hint={t('feesHint', { rate: `${feeRate.toFixed(1)}%` })}
        />
        <MetricCard
          label={t('cashToBank')}
          value={<Amount value={statement.payouts} />}
          hint={t('cashHint')}
        />
        <MetricCard
          label={t('owedByNoon')}
          value={statement.closingBalance === null ? '—' : <Amount value={statement.closingBalance} />}
          tone={statement.closingBalance === null ? 'warning' : 'default'}
          hint={
            statement.closingBalance === null ? (
              <Link href="/months" className="underline underline-offset-2">
                {t('setOpening')}
              </Link>
            ) : (
              t('closingHint')
            )
          }
        />
      </MetricGrid>

      {statement.openingBalance !== null ? (
        <p className="-mt-3 text-xs text-muted-foreground">
          {t.rich('openedAt', {
            opening: money(statement.openingBalance),
            movement: money(statement.movement),
            lines: tr('nouns.settlementLines', { count: statement.rows }),
            b,
          })}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('feesWent')}</CardTitle>
            <CardDescription>{t.rich('feesWentHint', { total: money(statement.fees), num })}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid">
              {FEE_LINES.map((line) => (
                <div key={line} className="flex items-center justify-between gap-4 border-b py-2 text-[13px] last:border-b-0">
                  <dt className="text-muted-foreground">{tr(`enums.noonFee.${line}`)}</dt>
                  <dd className="num font-medium">{money(statement[line])}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('notAttributable')}</CardTitle>
            <CardDescription>{t('notAttributableHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            {unattributed.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-muted-foreground">{t('nonePeriod')}</p>
            ) : (
              <dl className="grid">
                {unattributed.map((row) => (
                  <div
                    key={row.transactionType}
                    className="flex items-center justify-between gap-4 border-b py-2 text-[13px] last:border-b-0"
                  >
                    <dt className="text-muted-foreground">
                      {isOneOf(TRANSACTIONS, row.transactionType)
                        ? tr(`enums.noonTransaction.${row.transactionType}`)
                        : row.transactionType}
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
          <CardTitle>{t('best')}</CardTitle>
          <CardDescription>{t('bestHint')}</CardDescription>
        </CardHeader>
        {products.length === 0 ? (
          <p className="border-t p-10 text-center text-[13px] text-muted-foreground">{t('noProducts')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>{tr('inventory.columns.product')}</TableHead>
                <TableHead className="w-[100px] text-end">{t('units')}</TableHead>
                <TableHead className="w-[140px] text-end">{t('net')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.slice(0, 6).map((p, i) => (
                <TableRow key={p.productId}>
                  <TableCell className="num text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="max-w-0 truncate font-medium">
                    <bdi>{p.name}</bdi>
                  </TableCell>
                  <TableCell className="num text-end text-muted-foreground">{p.unitsSold}</TableCell>
                  <TableCell className="num text-end font-medium">{moneyWhole(p.net)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
