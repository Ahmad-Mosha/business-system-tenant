import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Pencil } from 'lucide-react';
import { OrderActions } from '@/components/order-actions';
import { PaymentBadge, SourceLabel, StatusBadge } from '@/components/order-status';
import { Screen } from '@/components/shell';
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

  return (
    <Screen>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-5">
        <Link
          href="/orders"
          aria-label="Back to orders"
          className="-ms-2 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ArrowLeft className="size-4.5" />
        </Link>
        <h1 className="text-lg font-semibold tracking-[-0.02em] tabular-nums">
          {order.orderNumber}
        </h1>
        <StatusBadge status={order.status} />
        <PaymentBadge status={order.paymentStatus} />
        <span className="text-xs text-muted-foreground">
          <SourceLabel source={order.source} /> · placed {dateTime(order.placedAt)}
        </span>
        {editable && (
          <Link
            href={`/orders/${order.id}/edit`}
            className="ms-auto inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-4 text-[13px] font-medium transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Pencil className="size-3.5" />
            Edit order
          </Link>
        )}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px] items-start gap-4 overflow-y-auto p-4">
        <div className="grid content-start gap-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Customer">
              <dl className="text-[13px]">
                <Row label="Name" value={order.customerName} />
                <Row label="Phone" value={order.customerPhone} />
                <Row label="Payment" value={order.paymentMethod} />
              </dl>
            </Card>
            <Card title="Shipping">
              <dl className="text-[13px]">
                <Row label="Governorate" value={order.governorate} />
                <Row label="Address" value={order.address} />
                <Row label="Tracking" value={order.trackingNumber} />
              </dl>
            </Card>
          </div>

          <Card title="Items" hint={`${order.items.length}`}>
            {unmapped > 0 && (
              <p className="mb-2 flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning-subtle px-2.5 py-2 text-[11px] text-warning">
                <AlertTriangle className="mt-px size-3.5 shrink-0" strokeWidth={2} />
                {unmapped} {unmapped === 1 ? 'line is' : 'lines are'} not matched to inventory, so{' '}
                {unmapped === 1 ? 'it does' : 'they do'} not affect stock.
              </p>
            )}
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
                    <th className="px-3 py-2 text-left font-medium">Item</th>
                    <th className="w-[70px] px-3 py-2 text-right font-medium">Qty</th>
                    <th className="w-[110px] px-3 py-2 text-right font-medium">Unit Price</th>
                    <th className="w-[110px] px-3 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((i) => (
                    <tr key={i.id} className="border-b border-border/60 last:border-b-0">
                      <td className="px-3 py-2">
                        {i.title}
                        {!i.variantId && (
                          <span className="ms-1.5 text-[11px] text-warning">unmatched</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{i.quantity}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {money(i.unitPrice)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {money(i.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {order.notes && (
              <p className="mt-3 text-[13px]">
                <span className="text-muted-foreground">Notes: </span>
                {order.notes}
              </p>
            )}
          </Card>

          <Card title="History">
            <ul className="text-[13px]">
              {order.events.map((e) => (
                <li key={e.id} className="flex items-baseline gap-3 py-1">
                  <span className="min-w-0 flex-1">{describe(e)}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {e.actorName ?? 'Integration'} · {dateTime(e.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <aside className="grid content-start gap-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <h2 className="text-[15px] font-semibold">Order Summary</h2>
            <div className="mt-4 space-y-2 border-t border-border pt-4 text-[13px]">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{money(order.subtotal)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Shipping</span>
                <span className="tabular-nums">{money(order.shippingCost)}</span>
              </div>
            </div>
            <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-border pt-4">
              <span className="text-[15px] font-semibold">Total</span>
              <span className="text-2xl font-semibold tracking-[-0.02em] tabular-nums">
                {money(order.total)}
              </span>
            </div>
          </div>

          <OrderActions
            orderId={order.id}
            status={order.status}
            paymentStatus={order.paymentStatus}
            assignedToId={order.assignedTo?.id ?? null}
            assignees={assignees.map((a) => ({ id: a.id, name: a.name }))}
            canAssign={isAdmin}
          />
        </aside>
      </div>
    </Screen>
  );
}

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-[14px] font-semibold tracking-[-0.01em]">{title}</h2>
        {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-3 py-1">
      <dt className="w-[100px] shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">
        {value || <span className="text-muted-foreground/40">—</span>}
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
