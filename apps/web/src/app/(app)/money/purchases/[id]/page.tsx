import { Ban, CheckCircle2, ChevronLeft, Info, Package, Pencil, Trash2, Truck, Wallet } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { cancelPurchase, deleteDraftInvoice } from '@/app/(app)/money/actions';
import { CancelAction } from '@/components/cancel-action';
import { ConfirmAction } from '@/components/confirm-action';
import { Amount } from '@/components/amount';
import { Page, PageHeader } from '@/components/page';
import { PaidChip } from '@/components/paid-chip';
import { PaySupplier } from '@/components/pay-supplier';
import { PostInvoiceButton } from '@/components/post-invoice-button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getPurchase, getSupplier } from '@/lib/api';
import { money, unitMoney } from '@/lib/format';
import { blockedBy } from '@/lib/problem';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';
import { num, strong } from '@/i18n/rich';
import { getFormat } from '@/i18n/get-format';

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [f, t, tc, tr] = await Promise.all([getFormat(), getTranslations('money.invoice'), getTranslations('corrections.invoice'), getTranslations()]);
  await requireAdmin();
  const { id } = await params;
  const invoice = await getPurchase(id).catch(() => null);
  if (!invoice) notFound();

  const isCredit = invoice.status === 'POSTED' && invoice.payment === 'CREDIT';
  const supplier = isCredit ? await getSupplier(invoice.supplierId).catch(() => null) : null;

  const draft = invoice.status === 'DRAFT';
  const voided = invoice.status === 'VOID';
  const remaining = Number(invoice.payableTotal) - Number(invoice.settledAmount);
  const canPay = isCredit && invoice.paidStatus !== 'PAID' && remaining > 0.005;
  // Landed cost is part of inventory value, distinct from the supplier balance.
  const hasExtras = Number(invoice.extraCosts) > 0;
  const units = invoice.lines.reduce((n, l) => n + l.quantity, 0);

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
            <>
              <ConfirmAction
                trigger={
                  <Button variant="outline" className="text-destructive hover:bg-destructive-subtle hover:text-destructive">
                    <Trash2 />
                    {t('deleteDraft')}
                  </Button>
                }
                title={t('deleteDraftTitle')}
                description={t('deleteDraftDescription')}
                confirmLabel={t('deleteDraft')}
                destructive
                action={deleteDraftInvoice.bind(null, invoice.id)}
              />
              <Button variant="outline" asChild>
                <Link href={`/money/purchases/${invoice.id}/edit`}>
                  <Pencil />
                  {t('editDraft')}
                </Link>
              </Button>
              <PostInvoiceButton id={invoice.id} total={invoice.landedTotal} />
            </>
          ) : invoice.status === 'POSTED' ? (
            <>
              <CancelAction
                trigger={
                  <Button variant="outline" className="text-destructive hover:bg-destructive-subtle hover:text-destructive">
                    <Ban />
                    {tc('cancel')}
                  </Button>
                }
                title={tc('cancelTitle')}
                description={tc(invoice.payment === 'CASH' ? 'cancelHintCash' : 'cancelHintCredit')}
                confirmLabel={tc('cancelConfirm')}
                success={tc('cancelledToast')}
                action={cancelPurchase.bind(null, invoice.id, false)}
                blocked={blockedBy('invoice.cancelBlocked', invoice.blocked?.cancel)}
              />
              <CancelAction
                trigger={
                  <Button variant="outline">
                    <Pencil />
                    {tc('edit')}
                  </Button>
                }
                title={tc('editTitle')}
                description={tc('editHint')}
                confirmLabel={tc('editConfirm')}
                success={tc('cancelledToast')}
                action={cancelPurchase.bind(null, invoice.id, true)}
                blocked={blockedBy('invoice.cancelBlocked', invoice.blocked?.cancel)}
                reasonLabel={tc('editReason')}
                dismissLabel={tr('common.cancel')}
              >
                <ol className="grid list-decimal gap-1 ps-5 text-[13px] text-muted-foreground marker:text-foreground">
                  <li>{tc('editStep1')}</li>
                  <li>{tc('editStep2')}</li>
                  <li>{tc('editStep3')}</li>
                </ol>
              </CancelAction>
              {canPay && supplier ? (
                <PaySupplier
                  supplierId={invoice.supplierId}
                  owed={supplier.balance}
                  invoiceId={invoice.id}
                  defaultAmount={remaining.toFixed(2)}
                  hint={t('remainingHint', { amount: money(remaining) })}
                  trigger={<Button>{t('recordPayment')}</Button>}
                />
              ) : null}
            </>
          ) : undefined
        }
      />

      {voided ? (
        <Alert>
          <Ban />
          <AlertDescription>
            <p>
              {tc('banner', {
                date: f.date(invoice.voidedAt ?? invoice.updatedAt),
                name: invoice.voidedBy ?? '—',
                reason: invoice.voidReason ?? '',
              })}
            </p>
            {invoice.replacedById ? (
              <p>
                {tc('reentered')}{' '}
                <Link href={`/money/purchases/${invoice.replacedById}`} className="font-medium underline underline-offset-2">
                  {tc('openCorrection')}
                </Link>
              </p>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      {invoice.beforeOpening && !voided ? (
        <Alert>
          <Info />
          <AlertDescription>{t('beforeOpening')}</AlertDescription>
        </Alert>
      ) : null}
      {draft && invoice.replacesId ? (
        <Alert>
          <Info />
          <AlertDescription>
            <p>{tc('correctionOf')}</p>
            <Link href={`/money/purchases/${invoice.replacesId}`} className="font-medium underline underline-offset-2">
              {tc('openCancelled')}
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="min-w-0 gap-0 pb-0">
          <CardHeader className="items-center pb-4">
            <CardTitle className="flex items-center gap-2.5">
              <Package className="size-4 text-muted-foreground" aria-hidden />
              {t('lines')}
            </CardTitle>
            <CardAction>
              <Badge variant="secondary" className="rounded-md px-2.5 py-1">{tr('nouns.units', { count: units })}</Badge>
            </CardAction>
          </CardHeader>
          <div className="hidden sm:block">
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
                  <TableRow key={l.id} className="hover:bg-transparent">
                    <TableCell className="min-w-40 py-3.5 whitespace-normal">
                      <p className="line-clamp-2 leading-snug font-medium" title={l.label}>
                        <bdi>{l.label}</bdi>
                      </p>
                    </TableCell>
                    <TableCell className="num text-end">{f.count(l.quantity)}</TableCell>
                    <TableCell className="num text-end">{unitMoney(l.unitCost)}</TableCell>
                    {hasExtras ? (
                      <TableCell className="num text-end text-muted-foreground">
                        {l.landedUnitCost ? unitMoney(l.landedUnitCost) : '—'}
                      </TableCell>
                    ) : null}
                    <TableCell className="num text-end font-semibold">{money(l.lineTotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="divide-y border-t sm:hidden">
            {invoice.lines.map((l) => (
              <li key={l.id} className="grid gap-3 px-5 py-4">
                <p className="leading-snug font-medium"><bdi>{l.label}</bdi></p>
                <dl className="grid grid-cols-3 gap-3 text-sm">
                  <div><dt className="text-xs text-muted-foreground">{t('columns.qty')}</dt><dd className="num mt-1">{f.count(l.quantity)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">{t('columns.unitCost')}</dt><dd className="num mt-1">{unitMoney(l.unitCost)}</dd></div>
                  <div className="text-end"><dt className="text-xs text-muted-foreground">{t('columns.lineTotal')}</dt><dd className="num mt-1 font-semibold">{money(l.lineTotal)}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
          {/* The bill under the lines it adds up: goods, extra costs, and what went into stock. */}
          <div className="flex justify-end border-t bg-muted/25 px-5 py-5 md:px-6">
            <div className="grid w-full gap-2 text-sm sm:w-80">
              <Row label={t('goods')} value={money(invoice.goodsTotal)} />
              {hasExtras ? <Row label={t('extras', { allocation: invoice.allocation })} value={money(invoice.extraCosts)} /> : null}
              {hasExtras && invoice.extraCostsPaidSeparately ? <p className="text-xs text-muted-foreground">{t('separateCosts')}</p> : null}
              <div className="mt-1 flex items-baseline justify-between gap-4 border-t pt-3">
                <span className="font-medium">{t('intoStock')}</span>
                <span className="flex items-baseline gap-1.5">
                  <Amount value={invoice.landedTotal} className={cn('text-2xl font-semibold tracking-tight', voided && 'text-muted-foreground line-through')} />
                  <span className="text-xs text-muted-foreground">{tr('common.egp')}</span>
                </span>
              </div>
            </div>
          </div>
        </Card>

        <aside className="grid min-w-0 gap-5 max-xl:row-start-1 xl:col-start-2">
          {isCredit ? (
            // A credit invoice: how much of what the supplier billed is paid, at a glance.
            <Card data-sensitive-scope>
              <CardHeader>
                <CardTitle className="flex items-center gap-2.5">
                  <Wallet className="size-4 text-muted-foreground" aria-hidden />
                  {tr('money.supplier.payments')}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-muted-foreground">{t('stillOwed')}</span>
                  <span className={cn('num text-2xl font-semibold tracking-tight', remaining > 0.005 ? 'text-warning' : 'text-success')}>
                    {remaining > 0.005 ? money(remaining) : tr('sales.payments.settled')}
                  </span>
                </div>
                <Progress value={Number(invoice.payableTotal) > 0 ? (Number(invoice.settledAmount) / Number(invoice.payableTotal)) * 100 : 0} aria-label={t('paidSoFar')} />
                <p className="num text-xs text-muted-foreground">
                  {t('paidOfTotal', { paid: money(invoice.settledAmount), total: money(invoice.payableTotal) })}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Card className="gap-0 py-0">
            <Link href={`/money/suppliers/${invoice.supplier.id}`} className="group flex items-center gap-3.5 px-5 py-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary" aria-hidden>
                <Truck className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted-foreground">{tr('money.purchases.columns.supplier')}</span>
                <span className="block truncate font-semibold group-hover:text-highlight group-hover:underline group-hover:underline-offset-4"><bdi>{invoice.supplier.name}</bdi></span>
                {invoice.supplier.phone ? <span className="num block text-sm text-muted-foreground"><bdi>{invoice.supplier.phone}</bdi></span> : null}
              </span>
              <ChevronLeft className="size-4 text-muted-foreground ltr:rotate-180" aria-hidden />
            </Link>
          </Card>

          {voided ? null : <Alert variant={!draft && (invoice.payment === 'CASH' || invoice.paidStatus === 'PAID') ? 'success' : 'default'}>
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
          </Alert>}
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
