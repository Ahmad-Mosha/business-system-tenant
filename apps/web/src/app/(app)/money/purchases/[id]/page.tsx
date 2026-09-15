import { CheckCircle2, Info } from 'lucide-react';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Amount } from '@/components/amount';
import { Page, PageHeader } from '@/components/page';
import { PaidChip } from '@/components/paid-chip';
import { PaySupplier } from '@/components/pay-supplier';
import { PostInvoiceButton } from '@/components/post-invoice-button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getPurchase, getSupplier } from '@/lib/api';
import { money } from '@/lib/format';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';
import { getTranslations } from 'next-intl/server';
import { num, strong } from '@/i18n/rich';
import { getFormat } from '@/i18n/get-format';

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [f, t] = await Promise.all([getFormat(), getTranslations('money.invoice')]);
  await requireAdmin();
  const { id } = await params;
  const invoice = await getPurchase(id).catch(() => null);
  if (!invoice) notFound();

  const isCredit = invoice.status === 'POSTED' && invoice.payment === 'CREDIT';
  const supplier = isCredit ? await getSupplier(invoice.supplierId).catch(() => null) : null;

  const draft = invoice.status === 'DRAFT';
  const remaining = Number(invoice.landedTotal) - Number(invoice.settledAmount);
  const canPay = isCredit && invoice.paidStatus !== 'PAID' && remaining > 0.005;
  // Shipping/customs allocation is off in the builder; older invoices may
  // still carry extra costs, so those rows show only when there are any.
  const hasExtras = Number(invoice.extraCosts) > 0;

  return (
    <Page>
      <PageHeader
        back={{ href: '/money/purchases', label: t('back') }}
        title={invoice.invoiceNo ? t('title', { ref: invoice.invoiceNo }) : t('titleNoRef')}
        meta={<PaidChip status={invoice.paidStatus} />}
        description={t.rich('description', {
          supplier: invoice.supplier.name,
          date: f.date(invoice.invoiceDate),
          payment: invoice.payment,
          strong,
        })}
        actions={
          draft ? (
            <PostInvoiceButton id={invoice.id} total={invoice.landedTotal} />
          ) : canPay && supplier ? (
            <PaySupplier
              supplierId={invoice.supplierId}
              owed={supplier.balance}
              invoiceId={invoice.id}
              defaultAmount={remaining.toFixed(2)}
              hint={t('remainingHint', { amount: money(remaining) })}
              trigger={<Button>{t('recordPayment')}</Button>}
            />
          ) : undefined
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="min-w-0 pb-0">
          <CardHeader>
            <CardTitle>{t('lines')}</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.product')}</TableHead>
                <TableHead className="w-[80px] text-end">{t('columns.qty')}</TableHead>
                <TableHead className="w-[130px] text-end">{t('columns.unitCost')}</TableHead>
                {hasExtras ? <TableHead className="w-[130px] text-end">{t('columns.landedUnit')}</TableHead> : null}
                <TableHead className="w-[140px] text-end">{t('columns.lineTotal')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="max-w-0 truncate font-medium">
                    <bdi>{l.label}</bdi>
                  </TableCell>
                  <TableCell className="num text-end">{l.quantity}</TableCell>
                  <TableCell className="num text-end">{money(l.unitCost)}</TableCell>
                  {hasExtras ? (
                    <TableCell className="num text-end text-muted-foreground">
                      {l.landedUnitCost ? money(l.landedUnitCost) : '—'}
                    </TableCell>
                  ) : null}
                  <TableCell className="num text-end font-medium">{money(l.lineTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <aside className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('totals')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-[13px]">
              <Row label={t('goods')} value={money(invoice.goodsTotal)} />
              {hasExtras ? (
                <Row label={t('extras', { allocation: invoice.allocation })} value={money(invoice.extraCosts)} />
              ) : null}
              <div className="mt-1 flex items-baseline justify-between gap-3 border-t pt-3">
                <span className="font-medium">{t('intoStock')}</span>
                <Amount value={invoice.landedTotal} className="text-2xl font-semibold tracking-tight" />
              </div>
              {!draft && invoice.payment === 'CREDIT' ? (
                <>
                  <Row label={t('paidSoFar')} value={money(invoice.settledAmount)} />
                  <Row
                    label={t('stillOwed')}
                    value={money(remaining)}
                    strong
                    className={remaining > 0.005 ? 'text-warning' : 'text-success'}
                  />
                </>
              ) : null}
            </CardContent>
          </Card>

          <Alert variant={!draft && (invoice.payment === 'CASH' || invoice.paidStatus === 'PAID') ? 'success' : 'default'}>
            {!draft && (invoice.payment === 'CASH' || invoice.paidStatus === 'PAID') ? <CheckCircle2 /> : <Info />}
            <AlertDescription>
              {draft
                ? t.rich('draftNote', { amount: money(invoice.landedTotal), num })
                : invoice.payment === 'CASH'
                  ? t.rich('cashNote', { date: f.date(invoice.postedAt), amount: money(invoice.landedTotal), num })
                  : invoice.paidStatus === 'PAID'
                    ? t('paidNote', { date: f.date(invoice.postedAt) })
                    : t.rich('owedNote', {
                        date: f.date(invoice.postedAt),
                        amount: money(remaining),
                        supplier: invoice.supplier.name,
                        num,
                        strong,
                      })}
            </AlertDescription>
          </Alert>
        </aside>
      </div>
    </Page>
  );
}

function Row({
  label,
  value,
  strong,
  className,
}: {
  label: ReactNode;
  value: string;
  strong?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3', strong && 'font-medium')}>
      <span className={cn(!strong && 'text-muted-foreground')}>{label}</span>
      <span className={cn('num', className)}>{value}</span>
    </div>
  );
}
