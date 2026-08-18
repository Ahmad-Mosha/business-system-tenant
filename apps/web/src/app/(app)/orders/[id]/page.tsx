import {
  ORDER_SOURCE_LABELS,
  PERMISSIONS,
  type AssignableUser,
  type OrderDetail,
} from '@app/contracts';
import { notFound } from 'next/navigation';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/status-pill';
import { AssignControl } from '@/components/assign-control';
import { StatusActions } from '@/components/status-actions';
import { ApiRequestError, apiGet } from '@/lib/api';
import { formatDateTime, formatMoney } from '@/lib/format';
import { can } from '@/lib/permissions';
import { requireUser } from '@/lib/session';

export const metadata = { title: 'Order' };

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  let order: OrderDetail;
  try {
    order = await apiGet<OrderDetail>(`/orders/${id}`);
  } catch (error) {
    // The API returns 404 both for an order that does not exist and one outside the
    // caller's scope; the UI must not distinguish them either.
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }

  const mayAssign = can(user, PERMISSIONS.ORDER_ASSIGN);
  const assignable = mayAssign ? await apiGet<AssignableUser[]>('/orders/assignable-users') : [];

  return (
    <div className="mx-auto max-w-[1400px]">
      <Card className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="tnum text-[22px] font-semibold tracking-tight text-ink">
                {order.orderNumber}
              </h1>
              <StatusPill status={order.status} />
            </div>
            <p className="mt-1.5 text-[13px] text-ink-2">
              Placed {formatDateTime(order.placedAt)} · via{' '}
              {ORDER_SOURCE_LABELS[order.source]}
            </p>
          </div>
          <StatusActions orderId={order.id} transitions={order.availableTransitions} />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Card>
              <CardHeader title="Customer" />
              <CardBody className="space-y-1.5 text-sm">
                <p className="font-medium text-ink">{order.customerName}</p>
                <p className="tnum text-ink-2">{order.customerPhone}</p>
                {order.customerAddress ? (
                  <p className="pt-1.5 leading-relaxed text-ink-2">{order.customerAddress}</p>
                ) : null}
                {order.customerGovernorate ? (
                  <p className="text-ink-3">{order.customerGovernorate}</p>
                ) : null}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Assignment" />
              <CardBody className="space-y-3">
                {order.assignedTo ? (
                  <span className="flex items-center gap-2.5">
                    <Avatar name={order.assignedTo.name} className="size-8 text-[11px]" />
                    <span className="text-sm text-ink">{order.assignedTo.name}</span>
                  </span>
                ) : (
                  <p className="text-sm text-ink-3">Nobody is working this order yet.</p>
                )}
                {mayAssign ? (
                  <AssignControl
                    orderId={order.id}
                    users={assignable}
                    currentAssigneeId={order.assignedTo?.id ?? null}
                  />
                ) : null}
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader title={`Items (${order.lines.length})`} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                      Product
                    </th>
                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                      SKU
                    </th>
                    <th className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                      Qty
                    </th>
                    <th className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                      Unit
                    </th>
                    <th className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((line) => (
                    <tr key={line.id} className="border-b border-line-soft last:border-0">
                      <td className="px-5 py-3.5 align-top">
                        <span className="block text-ink">{line.externalTitle}</span>
                        {line.resolution === 'UNRESOLVED' ? (
                          // Never silently absorbed: an unmapped line is excluded from
                          // stock and margin, and has to look like it.
                          <span className="mt-1 inline-flex rounded-md bg-warn-bg px-1.5 py-0.5 text-[11px] font-medium text-warn">
                            Not matched to a product
                          </span>
                        ) : null}
                      </td>
                      <td className="tnum px-5 py-3.5 align-top text-[13px] text-ink-2">
                        {line.sku ?? line.externalSku ?? '—'}
                      </td>
                      <td className="tnum px-5 py-3.5 text-right align-top text-ink-2">
                        {line.quantity}
                      </td>
                      <td className="tnum px-5 py-3.5 text-right align-top text-ink-2">
                        {formatMoney(line.unitPrice)}
                      </td>
                      <td className="tnum px-5 py-3.5 text-right align-top font-medium text-ink">
                        {formatMoney(line.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-1.5 border-t border-line px-5 py-4 text-sm">
              <TotalRow label="Items" value={formatMoney(order.itemsTotal)} />
              {order.discountTotal.amount !== 0 ? (
                <TotalRow label="Discount" value={`−${formatMoney(order.discountTotal)}`} />
              ) : null}
              <TotalRow label="Shipping" value={formatMoney(order.shippingTotal)} />
              <div className="flex justify-between border-t border-line pt-2.5 text-[15px] font-semibold text-ink">
                <span>Total</span>
                <span className="tnum">{formatMoney(order.total)}</span>
              </div>
            </div>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="History" />
          <CardBody>
            <ol className="space-y-4">
              {order.timeline.map((entry, i) => (
                <li key={`${entry.at}-${i}`} className="flex gap-3">
                  <span className="mt-1.5 flex flex-col items-center">
                    <span
                      className={
                        i === 0 ? 'size-2 rounded-full bg-primary' : 'size-2 rounded-full bg-line'
                      }
                    />
                    {i < order.timeline.length - 1 ? (
                      <span className="mt-1 w-px flex-1 bg-line" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1 pb-1">
                    <span className="tnum block text-[12px] text-ink-3">
                      {formatDateTime(entry.at)}
                    </span>
                    <span className="mt-0.5 block text-[14px] font-medium text-ink">
                      {entry.title}
                    </span>
                    {entry.detail ? (
                      <span className="mt-0.5 block text-[13px] text-ink-2">{entry.detail}</span>
                    ) : null}
                    {entry.actorName ? (
                      <span className="mt-0.5 block text-[12px] text-ink-3">
                        by {entry.actorName}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-ink-2">
      <span>{label}</span>
      <span className="tnum">{value}</span>
    </div>
  );
}
