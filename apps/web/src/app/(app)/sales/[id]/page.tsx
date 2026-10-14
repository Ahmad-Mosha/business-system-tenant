import { AlertTriangle, Ban, Info, Pencil, Send, Trash2, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { deleteSalesDraft, postSalesInvoice, reverseSalesPayment } from '@/app/(app)/sales/actions';
import { Amount } from '@/components/amount';
import { ConfirmAction } from '@/components/confirm-action';
import { Page, PageHeader } from '@/components/page';
import { PaidChip } from '@/components/paid-chip';
import { PostSalesDialog, RecordSalesPayment, VoidSalesInvoice } from '@/components/sales-invoice-actions';
import { ToneBadge } from '@/components/tone-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFormat } from '@/i18n/get-format';
import { num, strong } from '@/i18n/rich';
import { isSystemMemo } from '@/lib/money';
import { getSalesInvoice } from '@/lib/api';
import { money, unitMoney } from '@/lib/format';
import { SALES_TONE, salesPaidStatus } from '@/lib/sales';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';

export default async function SalesInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const [f, t, tp, tr] = await Promise.all([getFormat(), getTranslations('sales.detail'), getTranslations('sales.payments'), getTranslations()]);
  await requireAdmin();
  const { id } = await params;
  const invoice = await getSalesInvoice(id).catch(() => null);
  if (!invoice) notFound();

  const draft = invoice.status === 'DRAFT';
  const posted = invoice.status === 'POSTED';
  const paidStatus = salesPaidStatus(invoice);
  const remaining = Number(invoice.total) - Number(invoice.paidAmount);
  const units = invoice.lines.reduce((n, l) => n + l.quantity, 0);
  const short = draft && invoice.lines.some((l) => l.quantity > l.onHand);
  // A draft is valued at today's cost; a posted invoice at the cost frozen when it was posted.
  const costOf = (l: (typeof invoice.lines)[number]) => (draft ? l.currentCost : l.unitCost);
  const costKnown = invoice.lines.every((l) => costOf(l) !== null);
  const cost = invoice.lines.reduce((n, l) => n + l.quantity * Number(costOf(l) ?? 0), 0);
  const profit = Number(invoice.total) - cost;

  return (
    <Page>
      <PageHeader
        back={{ href: '/sales', label: t('back') }}
        title={invoice.invoiceNumber ? t('title', { number: invoice.invoiceNumber }) : t('titleDraft')}
        meta={
          <>
            <ToneBadge tone={SALES_TONE[invoice.status]}>{tr(`enums.salesStatus.${invoice.status}`)}</ToneBadge>
            {paidStatus ? <PaidChip status={paidStatus} /> : null}
          </>
        }
        description={t.rich('description', { customer: invoice.customer.name, date: f.date(invoice.invoiceDate), strong })}
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
                action={deleteSalesDraft.bind(null, invoice.id)}
              />
              <Button asChild variant="outline">
                <Link href={`/sales/${invoice.id}/edit`}>
                  <Pencil />
                  {t('editDraft')}
                </Link>
              </Button>
              <PostSalesDialog
                trigger={
                  <Button disabled={short}>
                    <Send />
                    {tr('sales.post.post')}
                  </Button>
                }
                total={Number(invoice.total)}
                customer={invoice.customer.name}
                items={tr('nouns.units', { count: units })}
                onPost={postSalesInvoice.bind(null, invoice.id)}
              />
            </>
          ) : posted ? (
            <>
              <VoidSalesInvoice id={invoice.id} number={invoice.invoiceNumber ?? ''} paid={invoice.paidAmount} />
              {remaining > 0.005 ? <RecordSalesPayment id={invoice.id} remaining={remaining.toFixed(2)} customer={invoice.customer.name} /> : null}
            </>
          ) : undefined
        }
      />

      {short ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>{tr('sales.post.shortHint')}</AlertDescription>
        </Alert>
      ) : draft ? (
        <Alert>
          <Info />
          <AlertDescription>{t('draftNote')}</AlertDescription>
        </Alert>
      ) : null}
      {invoice.status === 'VOID' ? (
        <Alert>
          <Ban />
          <AlertDescription>
            {tr('sales.void.banner', { date: f.date(invoice.voidedAt ?? invoice.updatedAt), name: invoice.voidedBy ?? '—', reason: invoice.voidReason ?? '' })}
          </AlertDescription>
        </Alert>
      ) : null}

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
                <TableHead className="w-[120px] text-end">{t('columns.unitPrice')}</TableHead>
                <TableHead className="w-[120px] text-end">{t('columns.cost')}</TableHead>
                <TableHead className="w-[130px] text-end">{t('columns.lineTotal')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="min-w-40 whitespace-normal">
                    <p className="line-clamp-2 leading-snug font-medium" title={l.label}>
                      <bdi>{l.label}</bdi>
                    </p>
                    {draft ? (
                      <p className={cn('num text-xs', l.quantity > l.onHand ? 'text-destructive' : 'text-muted-foreground')}>
                        {t('stockNow', { count: l.onHand })}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="num text-end">{f.count(l.quantity)}</TableCell>
                  <TableCell className="num text-end">{unitMoney(l.unitPrice)}</TableCell>
                  <TableCell className="num text-end text-muted-foreground" data-sensitive>
                    {costOf(l) !== null ? unitMoney(costOf(l)) : '—'}
                  </TableCell>
                  <TableCell className="num text-end font-medium">{money(l.lineTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <aside className="grid gap-6 lg:sticky lg:top-0">
          <Card>
            <CardHeader>
              <CardTitle>{t('totals')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2.5 text-[13px]">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">{tr('sales.builder.subtotal', { items: tr('nouns.units', { count: units }) })}</span>
                <span className="num">{money(invoice.goodsTotal)}</span>
              </div>
              {Number(invoice.discount) > 0 ? (
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-muted-foreground">{tr('sales.builder.discount')}</span>
                  <span className="num">{money(-Number(invoice.discount))}</span>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between gap-3 border-t pt-3">
                <span className="font-medium">{tr('sales.builder.total')}</span>
                <Amount value={invoice.total} className="text-[26px] font-semibold tracking-tight" />
              </div>
              {posted ? (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-muted-foreground">{tp('paid')}</span>
                    <span className="num">{money(invoice.paidAmount)}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{tp('remaining')}</span>
                    <span className={cn('num font-semibold', remaining > 0.005 ? 'text-warning' : 'text-success')}>
                      {remaining > 0.005 ? money(remaining) : tp('settled')}
                    </span>
                  </div>
                </>
              ) : null}
              {invoice.status !== 'VOID' ? (
                <div className="mt-1 rounded-lg bg-muted/50 px-3 py-2.5" data-sensitive-scope>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-muted-foreground">{tr('sales.builder.profit')}</span>
                    {costKnown ? (
                      <span className={cn('num font-semibold', profit < 0 ? 'text-destructive' : 'text-success')}>{money(profit)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {costKnown
                      ? tr.rich(draft ? 'sales.builder.profitHint' : 'sales.detail.profitHintPosted', { margin: Number(invoice.total) > 0 ? `${((profit / Number(invoice.total)) * 100).toFixed(1)}%` : '—', num })
                      : tr('sales.builder.profitUnknown')}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
          {!draft ? (
            <Card size="sm" className="pb-0">
              <CardHeader>
                <CardTitle>{tp('title')}</CardTitle>
              </CardHeader>
              {invoice.payments.length ? (
                <ul className="divide-y border-t text-[13px]">
                  {invoice.payments.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className={cn('truncate', p.reversed && 'text-muted-foreground line-through')}>
                          <bdi>{p.memo?.startsWith('Paid with') ? tp('atPosting') : !p.memo || isSystemMemo(p.memo) ? tp('payment') : p.memo}</bdi>
                        </p>
                        <p className="text-xs text-muted-foreground">{f.date(p.occurredAt)}</p>
                      </div>
                      <span className={cn('num font-medium', p.reversed && 'text-muted-foreground line-through')}>{money(p.amount)}</span>
                      {p.reversed ? (
                        <ToneBadge tone="muted">{tp('reversedBadge')}</ToneBadge>
                      ) : posted ? (
                        <ConfirmAction
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label={tp('reverse')} title={tp('reverse')}>
                              <Undo2 />
                            </Button>
                          }
                          title={tp('reverseTitle')}
                          description={tp('reverseDescription', { amount: money(p.amount) })}
                          confirmLabel={tp('reverse')}
                          success={tp('reversed')}
                          destructive
                          action={reverseSalesPayment.bind(null, invoice.id, p.id)}
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <CardContent className="pb-4 text-[13px] text-muted-foreground">{tp('empty')}</CardContent>
              )}
            </Card>
          ) : null}
          {invoice.notes ? (
            <Card size="sm">
              <CardHeader>
                <CardTitle>{tr('sales.builder.notes')}</CardTitle>
              </CardHeader>
              <CardContent className="text-[13px] whitespace-pre-line">
                <bdi>{invoice.notes}</bdi>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </Page>
  );
}
