import { AlertTriangle, Pencil } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Amount } from '@/components/amount';
import { OrderActions } from '@/components/order-actions';
import { PaymentBadge, sourceLabel, StatusBadge } from '@/components/order-status';
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
import { dateTime, money } from '@/lib/format';
import { requireSession } from '@/lib/session';

/** Mirrors OrdersService.EDITABLE — once it ships, the goods have left. */
const EDITABLE = ['NEW', 'ASSIGNED', 'CONFIRMED'];

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSession();
  const { id } = await params;

  const order = await getOrder(id).catch(() => null);
  if (!order) notFound();

  const isAdmin = user.role === 'ADMIN';
  const assignees = isAdmin ? await getAssignees() : [];
  const unmapped = order.items.filter((i) => !i.variantId).length;
  const editable = EDITABLE.includes(order.status);
  const units = order.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <Page>
      <PageHeader
        back={{ href: '/orders', label: 'Back to orders' }}
        title={<span className="num">{order.orderNumber}</span>}
        meta={
          <>
            <StatusBadge status={order.status} />
            <PaymentBadge status={order.paymentStatus} />
          </>
        }
        description={`${sourceLabel(order.source)} order · placed ${dateTime(order.placedAt)}`}
        actions={
          editable ? (
            <Button variant="outline" asChild>
              <Link href={`/orders/${order.id}/edit`}>
                <Pencil />
                Edit order
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
                <CardTitle>Customer</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-3">
                  <Detail label="Name">
                    <bdi>{order.customerName}</bdi>
                  </Detail>
                  <Detail label="Phone">
                    <a href={`tel:${order.customerPhone}`} className="num hover:underline">
                      {order.customerPhone}
                    </a>
                  </Detail>
                  <Detail label="Payment method">{order.paymentMethod}</Detail>
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Delivery</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-3">
                  <Detail label="Governorate">
                    {order.governorate ? <bdi>{order.governorate}</bdi> : null}
                  </Detail>
                  <Detail label="Address">
                    {order.address ? <bdi>{order.address}</bdi> : null}
                  </Detail>
                  <Detail label="Bosta tracking">
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
              <CardTitle>Items</CardTitle>
              <CardAction>
                <Badge variant="secondary" className="num">
                  {units} {units === 1 ? 'unit' : 'units'}
                </Badge>
              </CardAction>
            </CardHeader>
            {unmapped > 0 ? (
              <CardContent>
                <Alert variant="warning">
                  <AlertTriangle />
                  <AlertDescription>
                    {unmapped} {unmapped === 1 ? 'line isn’t' : 'lines aren’t'} linked to inventory,
                    so {unmapped === 1 ? 'it doesn’t' : 'they don’t'} move stock.
                  </AlertDescription>
                </Alert>
              </CardContent>
            ) : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-[70px] text-right">Qty</TableHead>
                  <TableHead className="w-[120px] text-right">Unit price</TableHead>
                  <TableHead className="w-[120px] text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="max-w-0 whitespace-normal">
                      <bdi className="font-medium">{i.title}</bdi>
                      {!i.variantId ? (
                        <span className="ms-2 text-xs text-warning">not in inventory</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="num text-right">{i.quantity}</TableCell>
                    <TableCell className="num text-right text-muted-foreground">
                      {money(i.unitPrice)}
                    </TableCell>
                    <TableCell className="num text-right font-medium">{money(i.lineTotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {order.notes ? (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent className="text-[13px] whitespace-pre-line">
                <bdi>{order.notes}</bdi>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative grid gap-4 before:absolute before:inset-y-1.5 before:left-[3px] before:w-px before:bg-border">
                {order.events.map((e, i) => (
                  <li key={e.id} className="relative flex items-baseline gap-3 ps-5">
                    <span
                      aria-hidden
                      className={
                        i === order.events.length - 1
                          ? 'absolute top-1.5 left-0 size-[7px] bg-primary'
                          : 'absolute top-1.5 left-0 size-[7px] border border-muted-foreground/50 bg-card'
                      }
                    />
                    <span className="min-w-0 flex-1 text-[13px]">{describe(e)}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {e.actorName ?? 'Integration'} · {dateTime(e.createdAt)}
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
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-[13px]">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="num">{money(order.subtotal)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Shipping</span>
                <span className="num">{money(order.shippingCost)}</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-3 border-t pt-3">
                <span className="font-medium">Total</span>
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
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-[13px] break-words">
        {children || <span className="text-muted-foreground/60">Not set</span>}
      </dd>
    </div>
  );
}

function describe(e: { type: string; fromValue: string | null; toValue: string | null }): string {
  switch (e.type) {
    case 'CREATED':
      return `Created from ${e.toValue === 'EASYORDERS' ? 'the website' : 'social'}`;
    case 'EDITED':
      return 'Order edited';
    case 'ASSIGNED':
      return e.toValue === 'unassigned' ? 'Unassigned' : 'Assigned to a moderator';
    case 'STATUS_CHANGED':
      return `Status ${e.fromValue} → ${e.toValue}`;
    case 'PAYMENT_CHANGED':
      return `Payment ${e.fromValue} → ${e.toValue}`;
    default:
      return e.toValue ? `Updated to ${e.toValue}` : 'Updated';
  }
}
