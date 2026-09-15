import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Amount } from '@/components/amount';
import { MetricCard, MetricGrid } from '@/components/metric-card';
import { Page, PageHeader } from '@/components/page';
import { PaidChip } from '@/components/paid-chip';
import { PaySupplier } from '@/components/pay-supplier';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getSupplier } from '@/lib/api';
import { money } from '@/lib/format';
import { isSystemMemo } from '@/lib/money';
import { requireAdmin } from '@/lib/session';
import { getTranslations } from 'next-intl/server';
import { getFormat } from '@/i18n/get-format';

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [f, t, tr] = await Promise.all([getFormat(), getTranslations('money.supplier'), getTranslations()]);
  await requireAdmin();
  const { id } = await params;
  const supplier = await getSupplier(id).catch(() => null);
  if (!supplier) notFound();

  const posted = supplier.invoices.filter((i) => i.status === 'POSTED');
  const purchased = posted.reduce((n, i) => n + Number(i.landedTotal), 0);
  const paid = supplier.payments.reduce((n, p) => n + Number(p.amount), 0);
  const owed = Number(supplier.balance);

  return (
    <Page>
      <PageHeader
        back={{ href: '/money/suppliers', label: t('back') }}
        title={<bdi>{supplier.name}</bdi>}
        description={
          supplier.phone || supplier.note ? (
            <bdi>{[supplier.phone, supplier.note].filter(Boolean).join(' · ')}</bdi>
          ) : (
            t('fallback')
          )
        }
        actions={<PaySupplier supplierId={supplier.id} owed={supplier.balance} />}
      />

      <MetricGrid>
        <MetricCard
          label={t('owed')}
          value={<Amount value={supplier.balance} />}
          tone={owed > 0 ? 'warning' : 'default'}
          hint={owed > 0 ? t('owedSome') : t('settled')}
        />
        <MetricCard
          label={t('bought')}
          value={<Amount value={purchased} />}
          hint={t('postedInvoices', { count: posted.length })}
        />
        <MetricCard
          label={t('paid')}
          value={<Amount value={paid} />}
          hint={tr('nouns.payments', { count: supplier.payments.length })}
        />
      </MetricGrid>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card className="min-w-0 pb-0">
          <CardHeader>
            <CardTitle>{t('invoices')}</CardTitle>
          </CardHeader>
          {supplier.invoices.length === 0 ? (
            <p className="border-t p-10 text-center text-[13px] text-muted-foreground">{t('noInvoices')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr('money.purchases.columns.invoice')}</TableHead>
                  <TableHead className="w-[120px]">{tr('money.purchases.columns.date')}</TableHead>
                  <TableHead className="w-[130px]">{tr('money.purchases.columns.status')}</TableHead>
                  <TableHead className="w-[140px] text-end">{tr('money.purchases.columns.total')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplier.invoices.map((i) => (
                  <TableRow key={i.id} className="relative">
                    <TableCell>
                      <Link
                        href={`/money/purchases/${i.id}`}
                        className="font-medium after:absolute after:inset-0 hover:underline focus-visible:underline focus-visible:outline-none"
                      >
                        {i.invoiceNo ?? tr('money.purchases.noRef')}
                      </Link>
                      <span className="ms-2 text-xs text-muted-foreground">
                        {tr(`enums.purchasePayment.${i.payment}`)}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{f.date(i.invoiceDate)}</TableCell>
                    <TableCell>
                      <PaidChip status={i.paidStatus} />
                    </TableCell>
                    <TableCell className="num text-end font-medium">{money(i.landedTotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="pb-0">
          <CardHeader>
            <CardTitle>{t('payments')}</CardTitle>
            <CardDescription>{t('paymentsHint')}</CardDescription>
          </CardHeader>
          {supplier.payments.length === 0 ? (
            <p className="border-t p-10 text-center text-[13px] text-muted-foreground">{t('noPayments')}</p>
          ) : (
            <Table>
              <TableBody>
                {supplier.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="h-auto max-w-0 py-2.5">
                      <p className="truncate">
                        <bdi>{p.memo && !isSystemMemo(p.memo) ? p.memo : t('payment')}</bdi>
                      </p>
                      <p className="text-xs text-muted-foreground">{f.dateTime(p.occurredAt)}</p>
                    </TableCell>
                    <TableCell className="w-[130px] text-end">
                      <Amount value={-Number(p.amount)} className="font-medium text-destructive" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </Page>
  );
}
