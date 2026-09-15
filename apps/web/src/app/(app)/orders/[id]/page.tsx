import { AlertTriangle, Pencil } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Amount } from '@/components/amount';
import { OrderActions } from '@/components/order-actions';
import {
  ALL_ORDER_STATUSES,
  ALL_PAYMENT_STATUSES,
  EDITABLE_STATUSES,
  PaymentBadge,
  StatusBadge,
} from '@/components/order-status';
import { Page, PageHeader } from '@/components/page';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { requireSession } from '@/lib/session';
import { isOneOf } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { getFormat } from '@/i18n/get-format';

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const [f, t, te, tn] = await Promise.all([
    getFormat(),
    getTranslations('orders'),
    getTranslations('enums'),
    getTranslations('nouns'),
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
  const editable = EDITABLE_STATUSES.includes(order.status);
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
          editable ? (
            <Button variant="outline" asChild>
              <Link href={`/orders/${order.id}/edit`}>
                <Pencil />
                {t('detail.edit')}
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 gap-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('detail.customer')}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-3">
                  <Detail label={t('detail.name')}>
                    <bdi>{order.customerName}</bdi>
                  </Detail>
                  <Detail label={t('detail.phone')}>
                    <a href={`tel:${order.customerPhone}`} className="num hover:underline">
                      <bdi>{order.customerPhone}</bdi>
                    </a>
                  </Detail>
                  <Detail label={t('detail.paymentMethod')}>
                    {te(`paymentMethod.${order.paymentMethod}`)}
                  </Detail>
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t('detail.delivery')}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-3">
                  <Detail label={t('detail.governorate')}>
                    {order.governorate ? <bdi>{order.governorate}</bdi> : null}
                  </Detail>
                  <Detail label={t('detail.address')}>
                    {order.address ? <bdi>{order.address}</bdi> : null}
                  </Detail>
                  <Detail label={t('detail.tracking')}>
                    {order.trackingNumber ? (
                      <span className="num">{order.trackingNumber}</span>
                    ) : null}
                  </Detail>
                </dl>
              </CardContent>
            </Card>
          </div>

          <Card className="pb-0">
            <CardHeader>
              <CardTitle>{t('detail.items')}</CardTitle>
              <CardAction>
                <Badge variant="secondary">{tn('units', { count: units })}</Badge>
              </CardAction>
            </CardHeader>
            {unmapped > 0 ? (
              <CardContent>
                <Alert variant="warning">
                  <AlertTriangle />
                  <AlertDescription>{t('unmapped', { count: unmapped })}</AlertDescription>
                </Alert>
              </CardContent>
            ) : null}
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
                  <TableRow key={i.id}>
                    <TableCell className="max-w-0 whitespace-normal">
                      <bdi className="font-medium">{i.title}</bdi>
                      {!i.variantId ? (
                        <span className="ms-2 text-xs text-warning">{t('detail.notInInventory')}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="num text-end">{i.quantity}</TableCell>
                    <TableCell className="num text-end text-muted-foreground">
                      {money(i.unitPrice)}
                    </TableCell>
                    <TableCell className="num text-end font-medium">{money(i.lineTotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {order.notes ? (
            <Card>
              <CardHeader>
                <CardTitle>{t('detail.notes')}</CardTitle>
              </CardHeader>
              <CardContent className="text-[13px] whitespace-pre-line">
                <bdi>{order.notes}</bdi>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>{t('detail.history')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative grid gap-4 before:absolute before:inset-y-1.5 before:start-[3px] before:w-px before:bg-border">
                {order.events.map((e, i) => (
                  <li key={e.id} className="relative flex items-baseline gap-3 ps-5">
                    <span
                      aria-hidden
                      // Events arrive newest first — the top one is where the order is now.
                      className={
                        i === 0
                          ? 'absolute top-1.5 start-0 size-[7px] bg-primary'
                          : 'absolute top-1.5 start-0 size-[7px] border border-muted-foreground/50 bg-card'
                      }
                    />
                    <span className="min-w-0 flex-1 text-[13px]"><EventLine e={e} /></span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      <bdi>{e.actorName ?? t('detail.system')}</bdi> · {f.dateTime(e.createdAt)}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <aside className="grid gap-6 lg:sticky lg:top-0">
          <OrderActions
            orderId={order.id}
            status={order.status}
            paymentStatus={order.paymentStatus}
            assignedToId={order.assignedTo?.id ?? null}
            assignedToName={order.assignedTo?.name ?? null}
            assignees={assignees.map((a) => ({ id: a.id, name: a.name }))}
            canAssign={isAdmin}
          />

          <Card>
            <CardHeader>
              <CardTitle>{t('detail.summary')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-[13px]">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{t('detail.subtotal')}</span>
                <span className="num">{money(order.subtotal)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{t('detail.shipping')}</span>
                <span className="num">{money(order.shippingCost)}</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-3 border-t pt-3">
                <span className="font-medium">{t('detail.total')}</span>
                <Amount value={order.total} className="text-2xl font-semibold tracking-tight" />
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </Page>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  const t = useTranslations('common');
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-[13px] break-words">
        {children || <span className="text-muted-foreground/60">{t('notSet')}</span>}
      </dd>
    </div>
  );
}

/** One line of the order's history. Enum values read as words, not CONFIRMED. */
function EventLine({ e }: { e: { type: string; fromValue: string | null; toValue: string | null } }) {
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
    default:
      return e.toValue ? t('updatedTo', { value: e.toValue }) : t('updated');
  }
}
