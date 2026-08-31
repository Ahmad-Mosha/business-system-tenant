import { AlertTriangle, X } from 'lucide-react';
import Link from 'next/link';
import { OrderActions } from '@/components/order-actions';
import { SourceLabel, StatusBadge, PaymentBadge } from '@/components/order-status';
import { Scroller } from '@/components/shell';
import { getAssignees, getOrder } from '@/lib/api';
import { dateTime, money } from '@/lib/format';
import type { SessionUser } from '@/lib/session';

/**
 * Everything about one order, in the detail pane beside the list. The pane is
 * fixed height: the identity line and the actions are pinned, and only the
 * middle scrolls — so the total and the next move are never scrolled away.
 */
export async function OrderDetail({
  id,
  user,
  closeHref,
}: {
  id: string;
  user: SessionUser;
  closeHref: string;
}) {
  const order = await getOrder(id).catch(() => null);
  if (!order) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        That order could not be loaded. It may have been removed.
      </p>
    );
  }

  const isAdmin = user.role === 'ADMIN';
  const assignees = isAdmin ? await getAssignees() : [];
  const unmapped = order.items.filter((i) => !i.variantId).length;

  return (
    <>
      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate text-[15px] font-semibold tabular-nums">{order.orderNumber}</h2>
          <div className="flex shrink-0 items-center gap-1.5">
            <StatusBadge status={order.status} />
            <PaymentBadge status={order.paymentStatus} />
            <Link
              href={closeHref}
              scroll={false}
              aria-label="Close order details"
              className="-me-1 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <X className="size-4" />
            </Link>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          <SourceLabel source={order.source} /> · {dateTime(order.placedAt)}
        </p>
      </div>

      <Scroller>
        <Block title="Customer">
          <dl className="text-[13px]">
            <Row label="Name" value={order.customerName} />
            <Row label="Phone" value={order.customerPhone} />
            <Row label="Governorate" value={order.governorate} />
            <Row label="Address" value={order.address} />
            <Row label="Payment" value={order.paymentMethod} />
            {order.trackingNumber ? <Row label="Tracking" value={order.trackingNumber} /> : null}
            {order.externalId ? <Row label="Website ref" value={order.externalId} /> : null}
            {order.notes ? <Row label="Notes" value={order.notes} /> : null}
          </dl>
        </Block>

        <Block title="Items" hint={`${order.items.length}`}>
          {unmapped > 0 && (
            <p className="mb-2 flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning-subtle px-2.5 py-2 text-[11px] text-warning">
              <AlertTriangle className="mt-px size-3.5 shrink-0" strokeWidth={2} />
              {unmapped} {unmapped === 1 ? 'line is' : 'lines are'} not matched to inventory, so{' '}
              {unmapped === 1 ? 'it does' : 'they do'} not affect stock.
            </p>
          )}
          <ul className="text-[13px]">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-baseline gap-2 py-1.5">
                <span className="w-7 shrink-0 tabular-nums text-muted-foreground">
                  ×{item.quantity}
                </span>
                <span className="min-w-0 flex-1">
                  {item.title}
                  {!item.variantId && (
                    <span className="ms-1.5 text-[11px] text-warning">unmatched</span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums">{money(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 border-t border-border pt-2 text-[13px] text-muted-foreground">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="tabular-nums">{money(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping</span>
              <span className="tabular-nums">{money(order.shippingCost)}</span>
            </div>
          </div>
        </Block>

        <Block title="History">
          <ul className="text-[13px]">
            {order.events.map((e) => (
              <li key={e.id} className="py-1.5">
                <p>{describe(e)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {e.actorName ?? 'Integration'} · {dateTime(e.createdAt)}
                  {e.note ? ` · ${e.note}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </Block>
      </Scroller>

      <OrderActions
        orderId={order.id}
        status={order.status}
        paymentStatus={order.paymentStatus}
        assignedToId={order.assignedTo?.id ?? null}
        assignees={assignees.map((a) => ({ id: a.id, name: a.name }))}
        canAssign={isAdmin}
        total={order.total}
      />
    </>
  );
}

function Block({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border px-4 py-3 last:border-b-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-medium tracking-[0.07em] text-muted-foreground uppercase">
          {title}
        </h3>
        {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-3 py-1">
      <dt className="w-[88px] shrink-0 text-muted-foreground">{label}</dt>
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
