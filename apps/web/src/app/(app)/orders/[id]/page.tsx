import { AlertTriangle, Clock3, MessageCircle, Package, Pencil, Phone, StickyNote, UserRound } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { Amount } from '@/components/amount';
import { OrderActions } from '@/components/order-actions';
import {
  ALL_ORDER_STATUSES,
  ALL_PAYMENT_STATUSES,
  PaymentBadge,
  StatusBadge,
} from '@/components/order-status';
import { Page, PageHeader } from '@/components/page';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getAssignees, getOrder } from '@/lib/api';
import { money } from '@/lib/format';
import { whatsappHref } from '@/lib/phone';
import { BlockedDialog } from '@/components/blocked-dialog';
import { requireSession } from '@/lib/session';
import { isOneOf } from '@/lib/utils';
import { getFormat } from '@/i18n/get-format';

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const [f, t, te, tn, tc] = await Promise.all([
    getFormat(),
    getTranslations('orders'),
    getTranslations('enums'),
    getTranslations('nouns'),
    getTranslations('common'),
  ]);
  const user = await requireSession();
  const { id } = await params;

  const isAdmin = user.role === 'ADMIN';
  const [order, assignees] = await Promise.all([
    getOrder(id).catch(() => null),
    isAdmin ? getAssignees() : [],
  ]);
  if (!order) notFound();

  const unmapped = order.items.filter((i) => !i.variantId).length;
  // Why its items and prices can't change right now — the API's own rule (status, then payment).
  const editBlocked = order.blocked?.edit?.length ? order.blocked.edit[0] : null;
  const units = order.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <Page>
      <PageHeader
        back={{ href: '/orders', label: t('back') }}
        title={<span className="num">{order.orderNumber}</span>}
        meta={
          <>
            <StatusBadge status={order.status} />
            <PaymentBadge status={order.paymentStatus} />
          </>
        }
        description={t('detail.description', {
          source: te(`orderSource.${order.source}`),
          date: f.dateTime(order.placedAt),
        })}
        actions={
          editBlocked ? (
            // Still offered: it explains why the order can't be edited now, instead of vanishing.
            <BlockedDialog
              trigger={
                <Button variant="outline">
                  <Pencil />
                  {t('detail.edit')}
                </Button>
              }
              title={<span className="num">{order.orderNumber}</span>}
              problem={editBlocked}
            />
          ) : (
            <Button variant="outline" asChild>
              <Link href={`/orders/${order.id}/edit`}>
                <Pencil />
                {t('detail.edit')}
              </Link>
            </Button>
          )
        }
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 gap-5">
          <Card className="gap-0 pb-0">
            <CardHeader className="items-center pb-4">
              <h2 className="flex items-center gap-2.5 text-base font-semibold">
                <Package className="size-4 text-muted-foreground" aria-hidden />
                {t('detail.items')}
              </h2>
              <CardAction>
                <Badge variant="secondary" className="rounded-md px-2.5 py-1">{tn('units', { count: units })}</Badge>
              </CardAction>
            </CardHeader>
            {unmapped > 0 ? (
              <CardContent className="pb-4">
                <Alert variant="warning">
                  <AlertTriangle />
                  <AlertDescription>{t('unmapped', { count: unmapped })}</AlertDescription>
                </Alert>
              </CardContent>
            ) : null}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('columns.item')}</TableHead>
                    <TableHead className="w-[70px] text-end">{t('columns.qty')}</TableHead>
                    <TableHead className="w-[120px] text-end">{t('columns.unitPrice')}</TableHead>
                    <TableHead className="w-[120px] text-end">{t('columns.total')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((i) => (
                    <TableRow key={i.id} className="hover:bg-transparent">
                      <TableCell className="max-w-0 py-4 whitespace-normal">
                        <bdi className="text-sm font-medium leading-relaxed">{i.title}</bdi>
                        {!i.variantId ? (
                          <span className="mt-1 block text-xs text-warning">{t('detail.notInInventory')}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="num text-end">{i.quantity}</TableCell>
                      <TableCell className="num text-end text-muted-foreground">{money(i.unitPrice)}</TableCell>
                      <TableCell className="num text-end font-semibold">{money(i.lineTotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y border-t sm:hidden">
              {order.items.map((i) => (
                <li key={i.id} className="grid gap-3 px-5 py-4">
                  <div>
                    <bdi className="text-sm font-medium leading-relaxed">{i.title}</bdi>
                    {!i.variantId ? <p className="mt-1 text-xs text-warning">{t('detail.notInInventory')}</p> : null}
                  </div>
                  <dl className="grid grid-cols-3 gap-3 text-sm">
                    <div><dt className="text-xs text-muted-foreground">{t('columns.qty')}</dt><dd className="num mt-1">{i.quantity}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">{t('columns.unitPrice')}</dt><dd className="num mt-1">{money(i.unitPrice)}</dd></div>
                    <div className="text-end"><dt className="text-xs text-muted-foreground">{t('columns.total')}</dt><dd className="num mt-1 font-semibold">{money(i.lineTotal)}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
            {/* The bill under what it bills for: lines, then subtotal,
                shipping and total, with how it's being paid beside them. */}
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 border-t bg-muted/25 px-5 py-5 md:px-6">
              <div className="grid gap-1.5">
                <p className="text-xs text-muted-foreground">{t('detail.paymentMethod')}</p>
                <p className="flex items-center gap-3 text-sm font-medium">
                  {te(`paymentMethod.${order.paymentMethod}`)}
                  <PaymentBadge status={order.paymentStatus} />
                </p>
              </div>
              <dl className="grid w-full max-w-72 gap-2 text-sm sm:w-72">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{t('detail.subtotal')}</dt>
                  <dd className="num">{money(order.subtotal)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{t('detail.shipping')}</dt>
                  <dd className="num">{money(order.shippingCost)}</dd>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-4 border-t pt-3">
                  <dt className="font-medium">{t('detail.total')}</dt>
                  <dd className="flex items-baseline gap-1.5">
                    <Amount value={order.total} className="text-2xl font-semibold tracking-tight" />
                    <span className="text-xs text-muted-foreground">{tc('egp')}</span>
                  </dd>
                </div>
              </dl>
            </div>
          </Card>

          {order.notes ? (
            <Card>
              <CardHeader>
                <h2 className="flex items-center gap-2.5 text-base font-semibold">
                  <StickyNote className="size-4 text-muted-foreground" aria-hidden />
                  {t('detail.notes')}
                </h2>
              </CardHeader>
              <CardContent className="text-sm leading-7 whitespace-pre-line break-words">
                <bdi>{order.notes}</bdi>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <h2 className="flex items-center gap-2.5 text-base font-semibold">
                <Clock3 className="size-4 text-muted-foreground" aria-hidden />
                {t('detail.history')}
              </h2>
              <p className="text-xs text-muted-foreground">{t('detailPreview.historyHint')}</p>
            </CardHeader>
            <CardContent>
              <ol className="relative grid gap-5 before:absolute before:inset-y-2 before:start-[4px] before:w-px before:bg-border">
                {order.events.map((e, i) => (
                  <li key={e.id} className="relative grid gap-1.5 ps-6">
                    <span
                      aria-hidden
                      // This marks the latest recorded event, not an inferred workflow step.
                      className={i === 0
                        ? 'absolute top-1.5 start-0 size-[9px] rounded-full bg-primary ring-4 ring-primary/8'
                        : 'absolute top-1.5 start-0 size-[9px] rounded-full border border-muted-foreground/50 bg-card'}
                    />
                    <div className="min-w-0 text-sm leading-relaxed break-words"><EventLine e={e} /></div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <bdi>{e.actorName ?? t('detail.system')}</bdi>
                      <span aria-hidden>·</span>
                      <time dateTime={e.createdAt}>{f.dateTime(e.createdAt)}</time>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        {/* First on a phone: the moves, then who to call and where it goes. */}
        <aside className="grid min-w-0 gap-5 max-xl:row-start-1 xl:col-start-2">
          <OrderActions
            orderId={order.id}
            status={order.status}
            paymentStatus={order.paymentStatus}
            assignedToId={order.assignedTo?.id ?? null}
            assignedToName={order.assignedTo?.name ?? null}
            assignees={assignees.map((a) => ({ id: a.id, name: a.name }))}
            canAssign={isAdmin}
          />
          <Card className="gap-0 py-0">
            <div className="flex items-start gap-3.5 px-5 py-5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary" aria-hidden>
                <UserRound className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">{t('detail.customer')}</p>
                <h2 className="mt-0.5 text-lg font-semibold leading-relaxed break-words"><bdi>{order.customerName}</bdi></h2>
                <p className="num text-sm text-muted-foreground"><bdi>{order.customerPhone}</bdi></p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 px-5 pb-5">
              <Button variant="outline" asChild>
                <a href={`tel:${order.customerPhone}`}><Phone />{t('detail.call')}</a>
              </Button>
              <Button variant="outline" asChild>
                <a href={whatsappHref(order.customerPhone)} target="_blank" rel="noreferrer"><MessageCircle />{t('detail.whatsapp')}</a>
              </Button>
            </div>
            <dl className="grid gap-4 border-t px-5 py-5 sm:grid-cols-2 xl:grid-cols-1">
              <Detail label={t('detail.governorate')}>
                {order.governorate ? <bdi>{order.governorate}</bdi> : null}
              </Detail>
              <Detail label={t('detail.address')}>
                {order.address ? <bdi>{order.address}</bdi> : null}
              </Detail>
              <Detail label={t('detail.tracking')}>
                {order.trackingNumber ? <span className="num">{order.trackingNumber}</span> : null}
              </Detail>
            </dl>
          </Card>
        </aside>
      </div>
    </Page>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  const t = useTranslations('common');
  return (
    <div className="grid gap-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm leading-relaxed break-words">
        {children || <span className="text-muted-foreground">{t('notSet')}</span>}
      </dd>
    </div>
  );
}

/** One line of the order's history. Enum values read as words, not CONFIRMED. */
function EventLine({ e }: { e: { type: string; fromValue: string | null; toValue: string | null; note?: string | null } }) {
  const t = useTranslations('orders.history');
  const te = useTranslations('enums');
  const status = (v: string | null) =>
    !v ? '—' : isOneOf(ALL_ORDER_STATUSES, v) ? te(`orderStatus.${v}`) : v;
  const payment = (v: string | null) =>
    !v ? '—' : isOneOf(ALL_PAYMENT_STATUSES, v) ? te(`paymentStatus.${v}`) : v;
  switch (e.type) {
    case 'CREATED':
      return t('created', { source: e.toValue ?? '' });
    case 'EDITED':
      return t('edited');
    case 'ASSIGNED':
      return e.toValue === 'unassigned' ? t('unassigned') : t('assigned');
    case 'STATUS_CHANGED':
      return t('status', { from: status(e.fromValue), to: status(e.toValue) });
    case 'PAYMENT_CHANGED':
      return t('payment', { from: payment(e.fromValue), to: payment(e.toValue) });
    case 'NOTE':
      return <><bdi>{e.note}</bdi>{e.toValue === 'RESTOCK' || e.toValue === 'WRITE_OFF' ? <span className="ms-2 text-muted-foreground">{t(e.toValue === 'RESTOCK' ? 'restocked' : 'writtenOff')}</span> : null}</>;
    default:
      return e.toValue ? t('updatedTo', { value: e.toValue }) : t('updated');
  }
}
