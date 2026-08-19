import {
  ORDER_SOURCE_LABELS,
  PERMISSIONS,
  type AssignableUser,
  type OrderDetail,
} from '@app/contracts';
import { notFound } from 'next/navigation';
import { Avatar } from '@/components/ui/avatar';
import { AssignControl } from '@/components/assign-control';
import { StatusControl } from '@/components/status-control';
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
  const mayUpdateStatus = can(user, PERMISSIONS.ORDER_UPDATE_STATUS);
  const assignable = mayAssign ? await apiGet<AssignableUser[]>('/orders/assignable-users') : [];

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Left column */}
        <div className="flex flex-1 flex-col gap-4">
          {/* Hero */}
          <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-line bg-surface p-5">
            <div>
              <h1 className="tnum text-[21px] font-bold leading-tight text-ink">
                {order.orderNumber}
              </h1>
              <p className="mt-1 text-[13px] text-ink-2">
                Placed {formatDateTime(order.placedAt)} via {ORDER_SOURCE_LABELS[order.source]}
              </p>
            </div>
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                Status
              </span>
              <StatusControl
                orderId={order.id}
                status={order.status}
                canUpdate={mayUpdateStatus}
                size="md"
              />
            </div>
          </div>

          {/* Customer + Assignment */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Panel title="Customer">
              <div className="flex gap-3">
                <Avatar name={order.customerName} className="size-10 shrink-0 rounded text-[13px]" />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-ink">{order.customerName}</p>
                  <p className="tnum text-[13px] text-ink-2">{order.customerPhone}</p>
                </div>
              </div>
              {order.customerAddress ? (
                <div className="mt-3">
                  <Label>Shipping address</Label>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink">
                    {order.customerAddress}
                    {order.customerGovernorate ? (
                      <>
                        <br />
                        {order.customerGovernorate}
                      </>
                    ) : null}
                  </p>
                </div>
              ) : null}
            </Panel>

            <Panel title="Assignment">
              <div>
                <Label>Assigned to</Label>
                <div className="mt-1.5">
                  {order.assignedTo ? (
                    <span className="flex items-center gap-2">
                      <Avatar name={order.assignedTo.name} className="size-6 text-[10px]" />
                      <span className="text-[13.5px] text-ink">{order.assignedTo.name}</span>
                    </span>
                  ) : (
                    <span className="text-[13.5px] text-ink-3">Nobody yet</span>
                  )}
                </div>
              </div>
              {mayAssign ? (
                <div className="mt-auto border-t border-line pt-3">
                  <AssignControl
                    orderId={order.id}
                    users={assignable}
                    currentAssigneeId={order.assignedTo?.id ?? null}
                  />
                </div>
              ) : null}
            </Panel>
          </div>

          {/* Items */}
          <div className="overflow-hidden rounded border border-line bg-surface">
            <div className="border-b border-line p-4">
              <h3 className="text-[15px] font-semibold text-ink">Items ({order.lines.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
                <thead className="border-b border-line bg-line-soft">
                  <tr>
                    <Th>Product</Th>
                    <Th>SKU</Th>
                    <Th align="right">Qty</Th>
                    <Th align="right">Unit price</Th>
                    <Th align="right" pad="pr-4">
                      Total
                    </Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {order.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="p-2.5 pl-4">
                        <div className="flex items-center gap-3">
                          <span className="size-9 shrink-0 rounded border border-line bg-line-soft" />
                          <span>
                            <span className="block text-[13.5px] text-ink">
                              {line.externalTitle}
                            </span>
                            {line.resolution === 'UNRESOLVED' ? (
                              // Never silently absorbed: an unmapped line is excluded from
                              // stock and margin, and has to look like it.
                              <span className="mt-0.5 inline-flex rounded bg-warn-bg px-1.5 py-0.5 text-[11px] font-medium text-warn">
                                Not matched to a product
                              </span>
                            ) : null}
                          </span>
                        </div>
                      </td>
                      <td className="tnum p-2.5 text-[13px] text-ink-2">
                        {line.sku ?? line.externalSku ?? '—'}
                      </td>
                      <td className="tnum p-2.5 text-right text-ink-2">{line.quantity}</td>
                      <td className="tnum p-2.5 text-right text-ink-2">
                        {formatMoney(line.unitPrice)}
                      </td>
                      <td className="tnum p-2.5 pr-4 text-right font-medium text-ink">
                        {formatMoney(line.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary - confined to a narrow column at the trailing edge, not stretched
                across the card, so the label sits next to its number. */}
            <div className="flex justify-end border-t border-line bg-line-soft p-4">
              <div className="w-64 space-y-2 text-[13.5px]">
                <TotalRow label="Items" value={formatMoney(order.itemsTotal)} />
                {order.discountTotal.amount !== 0 ? (
                  <TotalRow label="Discount" value={`−${formatMoney(order.discountTotal)}`} />
                ) : null}
                <TotalRow label="Shipping" value={formatMoney(order.shippingTotal)} />
                <div className="flex justify-between border-t border-line pt-2 text-[15px] font-bold text-ink">
                  <span>Total</span>
                  <span className="tnum">{formatMoney(order.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: History */}
        <aside className="w-full shrink-0 rounded border border-line bg-surface p-4 lg:sticky lg:top-[4.5rem] lg:h-[calc(100vh-6rem)] lg:w-80">
          <h3 className="mb-3 border-b border-line pb-2 text-[15px] font-semibold text-ink">
            History
          </h3>
          <div className="lg:h-[calc(100%-2.5rem)] lg:overflow-y-auto">
            <ol className="space-y-4">
              {order.timeline.map((entry, i) => (
                <li key={`${entry.at}-${i}`} className="flex gap-3">
                  <span className="mt-1.5 flex flex-col items-center">
                    <span
                      className={
                        i === 0
                          ? 'size-2 rounded-full bg-primary'
                          : 'size-2 rounded-full bg-line'
                      }
                    />
                    {i < order.timeline.length - 1 ? (
                      <span className="mt-1 w-px flex-1 bg-line" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1 pb-1">
                    <span className="tnum block text-[11px] text-ink-3">
                      {formatDateTime(entry.at)}
                    </span>
                    <span className="mt-0.5 block text-[13.5px] font-medium text-ink">
                      {entry.title}
                    </span>
                    {entry.detail ? (
                      <span className="mt-0.5 block text-[12.5px] text-ink-2">
                        {entry.detail}
                      </span>
                    ) : null}
                    {entry.actorName ? (
                      <span className="mt-0.5 block text-[11px] text-ink-3">
                        {entry.actorName}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded border border-line bg-surface p-4">
      <h3 className="border-b border-line pb-2 text-[15px] font-semibold text-ink">{title}</h3>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-wide text-ink-2">{children}</p>
  );
}

function Th({
  children,
  align,
  pad,
}: {
  children: React.ReactNode;
  align?: 'right';
  pad?: string;
}) {
  return (
    <th
      className={`p-2.5 ${pad ?? 'pl-4'} text-[11px] font-semibold uppercase tracking-wide text-ink-2 ${
        align === 'right' ? 'text-right' : ''
      }`}
    >
      {children}
    </th>
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
