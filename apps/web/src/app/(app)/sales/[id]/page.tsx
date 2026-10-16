import { Ban, ChevronLeft, Info, Package, Pencil, Send, StickyNote, Store, Trash2, Undo2, Wallet } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { deleteSalesDraft, postSalesInvoice, reverseSalesPayment } from '@/app/(app)/sales/actions';
import { Amount } from '@/components/amount';
import { ConfirmAction } from '@/components/confirm-action';
import { Page, PageHeader } from '@/components/page';
import { PaidChip } from '@/components/paid-chip';
import { ProblemNotice } from '@/components/problem-notice';
import { PostSalesDialog, RecordSalesPayment, VoidSalesInvoice } from '@/components/sales-invoice-actions';
import { ToneBadge } from '@/components/tone-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFormat } from '@/i18n/get-format';
import { num, strong } from '@/i18n/rich';
import { isSystemMemo } from '@/lib/money';
import { getSalesInvoice } from '@/lib/api';
import { money, unitMoney } from '@/lib/format';
import { salesState } from '@/lib/sales';
import { blockedBy } from '@/lib/problem';
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
  const remaining = Number(invoice.total) - Number(invoice.paidAmount);
  const units = invoice.lines.reduce((n, l) => n + l.quantity, 0);
  // What would stop posting it right now, from the API's own rules.
  const postBlocked = draft ? blockedBy('sales.postBlocked', invoice.blocked?.post) : null;
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
        meta={<PaidChip status={salesState(invoice)} />}
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
                  <Button>
                    <Send />
                    {tr('sales.post.post')}
                  </Button>
                }
                total={Number(invoice.total)}
                customer={invoice.customer.name}
                items={tr('nouns.units', { count: units })}
                onPost={postSalesInvoice.bind(null, invoice.id)}
                blocked={postBlocked}
              />
            </>
          ) : posted ? (
            <>
              <VoidSalesInvoice id={invoice.id} number={invoice.invoiceNumber ?? ''} blocked={blockedBy('sales.voidBlocked', invoice.blocked?.void)} />
              {remaining > 0.005 ? <RecordSalesPayment id={invoice.id} remaining={remaining.toFixed(2)} customer={invoice.customer.name} /> : null}
            </>
          ) : undefined
        }
      />

      {postBlocked ? (
        <ProblemNotice problem={postBlocked} />
      ) : draft ? (
        <Alert>
          <Info />
          <AlertDescription>{t('draftNote')}</AlertDescription>
        </Alert>
      ) : null}
      {invoice.beforeOpening && invoice.status !== 'VOID' ? (
        <Alert>
          <Info />
          <AlertDescription>{t('beforeOpening')}</AlertDescription>
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

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 gap-5">
          <Card className="gap-0 pb-0">
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
                    <TableHead className="w-[120px] text-end">{t('columns.unitPrice')}</TableHead>
                    <TableHead className="w-[120px] text-end">{t('columns.cost')}</TableHead>
                    <TableHead className="w-[130px] text-end">{t('columns.lineTotal')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.lines.map((l) => (
                    <TableRow key={l.id} className="hover:bg-transparent">
                      <TableCell className="min-w-40 py-3.5 whitespace-normal">
                        <p className="line-clamp-2 leading-snug font-medium" title={l.label}>
                          <bdi>{l.label}</bdi>
                        </p>
                        {draft ? (
                          <p className={cn('num mt-0.5 text-xs', l.quantity > l.onHand ? 'text-destructive' : 'text-muted-foreground')}>
                            {t('stockNow', { count: l.onHand })}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="num text-end">{f.count(l.quantity)}</TableCell>
                      <TableCell className="num text-end">{unitMoney(l.unitPrice)}</TableCell>
                      <TableCell className="num text-end text-muted-foreground" data-sensitive>
                        {costOf(l) !== null ? unitMoney(costOf(l)) : '—'}
                      </TableCell>
                      <TableCell className="num text-end font-semibold">{money(l.lineTotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y border-t sm:hidden">
              {invoice.lines.map((l) => (
                <li key={l.id} className="grid gap-3 px-5 py-4">
                  <div>
                    <p className="leading-snug font-medium"><bdi>{l.label}</bdi></p>
                    {draft ? (
                      <p className={cn('num mt-0.5 text-xs', l.quantity > l.onHand ? 'text-destructive' : 'text-muted-foreground')}>
                        {t('stockNow', { count: l.onHand })}
                      </p>
                    ) : null}
                  </div>
                  <dl className="grid grid-cols-3 gap-3 text-sm">
                    <div><dt className="text-xs text-muted-foreground">{t('columns.qty')}</dt><dd className="num mt-1">{f.count(l.quantity)}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">{t('columns.unitPrice')}</dt><dd className="num mt-1">{unitMoney(l.unitPrice)}</dd></div>
                    <div className="text-end"><dt className="text-xs text-muted-foreground">{t('columns.lineTotal')}</dt><dd className="num mt-1 font-semibold">{money(l.lineTotal)}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
            {/* The bill under the lines it adds up. */}
            <div className="flex justify-end border-t bg-muted/25 px-5 py-5 md:px-6">
              <dl className="grid w-full gap-2 text-sm sm:w-72">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{tr('sales.builder.subtotal', { items: tr('nouns.units', { count: units }) })}</dt>
                  <dd className="num">{money(invoice.goodsTotal)}</dd>
                </div>
                {Number(invoice.discount) > 0 ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{tr('sales.builder.discount')}</dt>
                    <dd className="num">{money(-Number(invoice.discount))}</dd>
                  </div>
                ) : null}
                <div className="mt-1 flex items-baseline justify-between gap-4 border-t pt-3">
                  <dt className="font-medium">{tr('sales.builder.total')}</dt>
                  <dd className="flex items-baseline gap-1.5">
                    <Amount value={invoice.total} className={cn('text-2xl font-semibold tracking-tight', invoice.status === 'VOID' && 'text-muted-foreground line-through')} />
                    <span className="text-xs text-muted-foreground">{tr('common.egp')}</span>
                  </dd>
                </div>
              </dl>
            </div>
          </Card>

          {invoice.notes ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2.5">
                  <StickyNote className="size-4 text-muted-foreground" aria-hidden />
                  {tr('sales.builder.notes')}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-7 whitespace-pre-line">
                <bdi>{invoice.notes}</bdi>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <aside className="grid min-w-0 gap-5 max-xl:row-start-1 xl:col-start-2">
          {posted ? (
            <Card className="gap-0 pb-0">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2.5">
                  <Wallet className="size-4 text-muted-foreground" aria-hidden />
                  {tp('title')}
                </CardTitle>
              </CardHeader>
              {/* How much of it has come in, at a glance, then each payment. */}
              <CardContent className="grid gap-3 pb-5" data-sensitive-scope>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-muted-foreground">{tp('remaining')}</span>
                  <span className={cn('num text-2xl font-semibold tracking-tight', remaining > 0.005 ? 'text-warning' : 'text-success')}>
                    {remaining > 0.005 ? money(remaining) : tp('settled')}
                  </span>
                </div>
                <Progress value={Number(invoice.total) > 0 ? (Number(invoice.paidAmount) / Number(invoice.total)) * 100 : 0} aria-label={tp('paid')} />
                <p className="num text-xs text-muted-foreground">
                  {tp('paidOf', { paid: money(invoice.paidAmount), total: money(invoice.total) })}
                </p>
              </CardContent>
              {invoice.payments.length ? (
                <ul className="divide-y border-t text-[13px]">
                  {invoice.payments.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className={cn('truncate', p.reversed && 'text-muted-foreground line-through')}>
                          <bdi>{p.memo?.startsWith('Paid with') ? tp('atPosting') : !p.memo || isSystemMemo(p.memo) ? tp('payment') : p.memo}</bdi>
                        </p>
                        <p className="text-xs text-muted-foreground">{f.date(p.occurredAt)}</p>
                      </div>
                      <span className={cn('num font-medium', p.reversed && 'text-muted-foreground line-through')}>{money(p.amount)}</span>
                      {p.reversed ? (
                        <ToneBadge tone="muted">{tp('reversedBadge')}</ToneBadge>
                      ) : (
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
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="border-t px-5 py-4 text-[13px] text-muted-foreground">{tp('empty')}</p>
              )}
            </Card>
          ) : null}

          <Card className="gap-0 py-0">
            <Link href={`/customers/${invoice.customer.id}`} className="group flex items-center gap-3.5 px-5 py-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary" aria-hidden>
                <Store className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted-foreground">{tr('sales.columns.customer')}</span>
                <span className="block truncate font-semibold group-hover:text-highlight group-hover:underline group-hover:underline-offset-4"><bdi>{invoice.customer.name}</bdi></span>
                {invoice.customer.phone ? <span className="num block text-sm text-muted-foreground"><bdi>{invoice.customer.phone}</bdi></span> : null}
              </span>
              <ChevronLeft className="size-4 text-muted-foreground ltr:rotate-180" aria-hidden />
            </Link>
          </Card>

          {invoice.status !== 'VOID' ? (
            <Card size="sm" data-sensitive-scope>
              <CardContent className="grid gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-muted-foreground">{tr('sales.builder.profit')}</span>
                  {costKnown ? (
                    <span className={cn('num text-lg font-semibold', profit < 0 ? 'text-destructive' : 'text-success')}>{money(profit)}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {costKnown
                    ? tr.rich(draft ? 'sales.builder.profitHint' : 'sales.detail.profitHintPosted', { margin: Number(invoice.total) > 0 ? `${((profit / Number(invoice.total)) * 100).toFixed(1)}%` : '—', num })
                    : tr('sales.builder.profitUnknown')}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </Page>
  );
}
