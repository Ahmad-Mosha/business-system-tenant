import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { OrderWorkflow } from '@/components/order-workflow';
import { PageBody, PageHeader, SectionHeading } from '@/components/page-header';
import { SourceLabel } from '@/components/order-status';
import { getAssignees, getOrder } from '@/lib/api';
import { dateTime, money } from '@/lib/format';
import { requireSession } from '@/lib/session';

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();

  const order = await getOrder(id).catch(() => null);
  if (!order) notFound();

  // Only an admin can reassign, so only an admin needs the list.
  const assignees = user.role === 'ADMIN' ? await getAssignees() : [];
  const unmapped = order.items.filter((i) => !i.variantId).length;

  return (
    <>
      <PageHeader
        title={order.orderNumber}
        actions={
          <>
            <p className="text-xs text-muted-foreground">
              <SourceLabel source={order.source} /> · placed {dateTime(order.placedAt)}
            </p>
            <Link
              href="/orders"
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <ArrowLeft className="size-4" />
              All orders
            </Link>
          </>
        }
      />

      <PageBody>
        <OrderWorkflow
          orderId={order.id}
          status={order.status}
          paymentStatus={order.paymentStatus}
          assignedToId={order.assignedTo?.id ?? null}
          assignees={assignees.map((a) => ({ id: a.id, name: a.name, role: a.role }))}
          canAssign={user.role === 'ADMIN'}
        />

        <section className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-8">
            <div>
              <SectionHeading
                title="Items"
                hint={`${order.items.length} ${order.items.length === 1 ? 'line' : 'lines'}`}
              />
              {unmapped > 0 && (
                <p className="mb-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-subtle px-3 py-2 text-xs text-warning">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
                  {unmapped} {unmapped === 1 ? 'line is' : 'lines are'} not matched to a product in
                  inventory, so {unmapped === 1 ? 'it' : 'they'} will not affect stock. Add the
                  product and link its channel listing to fix this.
                </p>
              )}
              <ul className="overflow-hidden rounded-xl border border-border">
                {order.items.map((item, i) => (
                  <li
                    key={item.id}
                    className={`flex items-start gap-4 px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}
                  >
                    <span className="mt-0.5 w-8 shrink-0 text-sm tabular-nums text-muted-foreground">
                      ×{item.quantity}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{item.title}</p>
                      {!item.variantId && (
                        <p className="mt-0.5 text-[11px] text-warning">not in inventory</p>
                      )}
                    </div>
                    <span className="shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                      {money(item.unitPrice)}
                    </span>
                    <span className="w-24 shrink-0 text-right text-sm font-medium tabular-nums">
                      {money(item.lineTotal)}
                    </span>
                  </li>
                ))}
                <li className="flex items-center justify-between gap-4 border-t border-border bg-muted/40 px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    Subtotal {money(order.subtotal)} · shipping {money(order.shippingCost)}
                  </span>
                  <span className="text-base font-semibold tabular-nums">{money(order.total)}</span>
                </li>
              </ul>
            </div>

            <div>
              <SectionHeading title="History" />
              <ul className="overflow-hidden rounded-xl border border-border">
                {order.events.map((e, i) => (
                  <li
                    key={e.id}
                    className={`flex items-baseline gap-3 px-4 py-2.5 text-sm ${i > 0 ? 'border-t border-border' : ''}`}
                  >
                    <span className="min-w-0 flex-1">
                      {describe(e)}
                      {e.note ? (
                        <span className="block text-xs text-muted-foreground">{e.note}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {e.actorName ?? 'Integration'} · {dateTime(e.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <SectionHeading title="Customer" />
            <dl className="overflow-hidden rounded-xl border border-border text-sm">
              <Row label="Name" value={order.customerName} />
              <Row label="Phone" value={order.customerPhone} />
              <Row label="Governorate" value={order.governorate} />
              <Row label="Address" value={order.address} />
              <Row label="Payment method" value={order.paymentMethod} />
              {order.externalId ? <Row label="Website order" value={order.externalId} /> : null}
              {order.externalStatus ? (
                <Row label="Website status" value={order.externalStatus} />
              ) : null}
              {order.notes ? <Row label="Notes" value={order.notes} /> : null}
            </dl>
          </div>
        </section>
      </PageBody>
    </>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-4 border-b border-border px-4 py-2.5 last:border-b-0">
      <dt className="w-[130px] shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">
        {value || <span className="text-muted-foreground/40">—</span>}
      </dd>
    </div>
  );
}

function describe(e: {
  type: string;
  fromValue: string | null;
  toValue: string | null;
}): string {
  switch (e.type) {
    case 'CREATED':
      return `Order created from ${e.toValue === 'EASYORDERS' ? 'the website' : 'social'}`;
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
