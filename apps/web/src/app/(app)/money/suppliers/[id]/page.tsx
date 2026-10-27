import { Archive, ArchiveRestore, ClipboardList, HandCoins, PackagePlus, Trash2, Undo2, Wallet } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { deleteSupplier, reverseSupplierPayment, setSupplierActive } from '@/app/(app)/money/actions';
import { CancelAction } from '@/components/forms/cancel-action';
import { CancelledToggle, toggleCancelledHref } from '@/components/layout/cancelled-toggle';
import { ConfirmAction } from '@/components/forms/confirm-action';
import { SupplierForm } from '@/components/money/supplier-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { bdi } from '@/i18n/rich';
import { Amount } from '@/components/display/amount';
import { SummaryMetric, SummaryStrip } from '@/components/layout/list-page';
import { Page, PageHeader } from '@/components/layout/page';
import { PaidChip } from '@/components/display/paid-chip';
import { PaySupplier } from '@/components/money/pay-supplier';
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
import { isSystemMemo, purchaseDue } from '@/lib/money';
import { blockedBy } from '@/lib/problem';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';
import { getFormat } from '@/i18n/get-format';

export default async function SupplierDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [f, t, tr, tc] = await Promise.all([getFormat(), getTranslations('money.supplier'), getTranslations(), getTranslations('corrections')]);
  await requireAdmin();
  const { id } = await params;
  const query = await searchParams;
  const showCancelled = query.cancelled === '1';
  const supplier = await getSupplier(id, showCancelled).catch(() => null);
  if (!supplier) notFound();

  const posted = supplier.invoices.filter((i) => i.status === 'POSTED');
  // What they billed — the same figure as the suppliers list; costs paid to someone else aren't theirs.
  const purchased = posted.reduce((n, i) => n + Number(i.payableTotal), 0);
  // Live payments only: a reversed one and its reversal cancel out.
  const livePayments = supplier.payments.filter((p) => !p.reversesId && !p.cancelledAt);
  const paid = livePayments.reduce((n, p) => n + Number(p.amount), 0);
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
        actions={
          <>
            <SupplierForm supplier={supplier} />
            {supplier.active ? (
              <ConfirmAction
                trigger={
                  <Button variant="outline">
                    <Archive />
                    {t('archive')}
                  </Button>
                }
                title={t.rich('archiveTitle', { name: supplier.name, bdi })}
                description={t('archiveDescription')}
                confirmLabel={t('archiveConfirm')}
                success={t('archived')}
                action={setSupplierActive.bind(null, supplier.id, false)}
                blocked={blockedBy('supplier.archiveBlocked', supplier.blocked?.archive)}
                blockedTitle={<bdi>{supplier.name}</bdi>}
              />
            ) : (
              <ConfirmAction
                trigger={
                  <Button variant="outline">
                    <ArchiveRestore />
                    {t('restore')}
                  </Button>
                }
                title={t('restore')}
                description={t('archivedBanner')}
                confirmLabel={t('restore')}
                success={t('restored')}
                action={setSupplierActive.bind(null, supplier.id, true)}
              />
            )}
            {(
              <ConfirmAction
                trigger={
                  <Button variant="outline" className="text-destructive hover:bg-destructive-subtle hover:text-destructive">
                    <Trash2 />
                    {t('delete')}
                  </Button>
                }
                title={t.rich('deleteTitle', { name: supplier.name, bdi })}
                description={t('deleteDescription')}
                confirmLabel={t('deleteConfirm')}
                destructive
                action={deleteSupplier.bind(null, supplier.id)}
                blocked={blockedBy('supplier.deleteBlocked', supplier.blocked?.delete)}
                blockedTitle={<bdi>{supplier.name}</bdi>}
              />
            )}
            {supplier.active ? <PaySupplier supplierId={supplier.id} owed={supplier.balance} /> : null}
          </>
        }
      />

      {!supplier.active ? (
        <Alert>
          <Archive />
          <AlertDescription>{t('archivedBanner')}</AlertDescription>
        </Alert>
      ) : null}

      <SummaryStrip label={supplier.name}>
        <SummaryMetric
          label={t('owed')}
          icon={HandCoins}
          value={<Amount value={supplier.balance} />}
          hint={owed > 0 ? t('owedSome') : t('settled')}
          attention={owed > 0}
          sensitive
        />
        <SummaryMetric label={t('bought')} icon={PackagePlus} value={<Amount value={purchased} />} hint={t('postedInvoices', { count: posted.length })} sensitive />
        <SummaryMetric label={t('paid')} icon={Wallet} value={<Amount value={paid} />} hint={tr('nouns.payments', { count: livePayments.length })} sensitive />
      </SummaryStrip>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card className="min-w-0 pb-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <ClipboardList className="size-4 text-muted-foreground" aria-hidden />
              {t('invoices')}
            </CardTitle>
          </CardHeader>
          {supplier.invoices.length === 0 ? (
            <p className="border-t p-10 text-center text-[13px] text-muted-foreground">{t('noInvoices')}</p>
          ) : (
            <Table className="[&_td]:h-16">
              <TableHeader>
                <TableRow>
                  <TableHead>{tr('money.purchases.columns.invoice')}</TableHead>
                  <TableHead className="w-[22%]">{tr('money.purchases.columns.status')}</TableHead>
                  <TableHead className="w-[20%] text-end">{tr('money.purchases.columns.total')}</TableHead>
                  <TableHead className="w-[20%] text-end">{tr('sales.columns.remaining')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplier.invoices.map((i) => (
                  <TableRow key={i.id} className={cn('relative', i.status === 'VOID' && 'text-muted-foreground')}>
                    <TableCell>
                      <Link
                        href={`/money/purchases/${i.id}`}
                        className={cn(
                          'after:absolute after:inset-0 hover:text-highlight hover:underline hover:underline-offset-4 focus-visible:underline focus-visible:outline-none',
                          i.invoiceNo ? 'font-semibold' : 'text-muted-foreground',
                        )}
                      >
                        {i.invoiceNo ? <bdi>{i.invoiceNo}</bdi> : tr('money.purchases.noRef')}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {f.date(i.invoiceDate)} · {tr(`enums.purchasePayment.${i.payment}`)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <PaidChip status={i.paidStatus} />
                    </TableCell>
                    <TableCell className={cn('num text-end font-medium', i.status === 'VOID' && 'font-normal line-through')} data-sensitive>
                      {money(i.landedTotal)}
                    </TableCell>
                    <TableCell className="num text-end" data-sensitive>
                      {purchaseDue(i) > 0.005 ? <span className="font-semibold text-warning">{money(purchaseDue(i))}</span> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="pb-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <Wallet className="size-4 text-muted-foreground" aria-hidden />
              {t('payments')}
            </CardTitle>
            <CardDescription>{t('paymentsHint')}</CardDescription>
          </CardHeader>
          {supplier.payments.length === 0 ? (
            <p className="border-t p-10 text-center text-[13px] text-muted-foreground">{t('noPayments')}</p>
          ) : (
            <Table>
              <TableBody>
                {supplier.payments.filter((p) => !p.reversesId).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="h-auto max-w-0 py-2.5">
                      <p className={cn('truncate', p.cancelledAt && 'text-muted-foreground line-through')}>
                        <bdi>{p.memo && !isSystemMemo(p.memo) ? p.memo : t('payment')}</bdi>
                      </p>
                      <p className="text-xs text-muted-foreground">{f.dateTime(p.occurredAt)}</p>
                      {p.cancelledAt ? (
                        <p className="truncate text-xs text-destructive/80">
                          {p.cancelledBy
                            ? tc('cancelledBy', { name: p.cancelledBy, date: f.date(p.cancelledAt) })
                            : tc('cancelledOn', { date: f.date(p.cancelledAt) })}
                          {p.cancelReason ? <> — <bdi>{p.cancelReason}</bdi></> : null}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="w-[130px] text-end">
                      <Amount
                        value={-Number(p.amount)}
                        className={cn('font-medium', p.cancelledAt ? 'text-muted-foreground line-through' : 'text-destructive')}
                      />
                    </TableCell>
                    <TableCell className="w-10 pe-2">
                      {!p.cancelledAt ? (
                        <CancelAction
                          trigger={
                            <Button variant="outline" size="icon-sm" aria-label={tc('payment.reverse')} title={tc('payment.reverse')} className="text-destructive hover:bg-destructive-subtle hover:text-destructive">
                              <Undo2 />
                            </Button>
                          }
                          title={tc('payment.reverseTitle')}
                          description={tc('payment.reverseHint', { amount: money(p.amount) })}
                          confirmLabel={tc('payment.reverse')}
                          success={tc('payment.reversed')}
                          action={reverseSupplierPayment.bind(null, supplier.id, p.id)}
                        />
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="flex justify-end border-t px-4 py-1.5">
            <CancelledToggle shown={showCancelled} href={toggleCancelledHref(`/money/suppliers/${supplier.id}`, query, showCancelled)} />
          </div>
        </Card>
      </div>
    </Page>
  );
}
