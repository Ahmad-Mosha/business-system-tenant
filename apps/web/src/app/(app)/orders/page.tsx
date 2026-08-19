import {
  ORDER_SOURCE_LABELS,
  PERMISSIONS,
  orderStatusSchema,
  type ListOrdersResponse,
  type OrderStatus,
} from '@app/contracts';
import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { StatusPill } from '@/components/ui/status-pill';
import { OrderFilters } from '@/components/order-filters';
import { OrderRowActions } from '@/components/order-row-actions';
import { apiGet } from '@/lib/api';
import { formatDateTime, formatMoney } from '@/lib/format';
import { can, isScopedToSelf } from '@/lib/permissions';
import { requireUser } from '@/lib/session';

export const metadata = { title: 'Orders' };

const PAGE_SIZE = 25;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  // An unrecognised filter is dropped rather than passed on to fail server-side.
  const status = orderStatusSchema.safeParse(params.status);
  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const query = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
  if (status.success) query.set('status', status.data);

  const { items, total } = await apiGet<ListOrdersResponse>(`/orders?${query}`);
  const scopedToMe = isScopedToSelf(user, PERMISSIONS.ORDER_READ);
  const canUpdateStatus = can(user, PERMISSIONS.ORDER_UPDATE_STATUS);
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-ink">Orders</h1>
          <p className="mt-1 text-[14px] text-ink-2">
            {scopedToMe
              ? 'Orders assigned to you.'
              : 'Manage and track orders across every channel.'}
          </p>
        </div>
        {can(user, PERMISSIONS.ORDER_CREATE) ? (
          <Link
            href="/orders/new"
            className="inline-flex h-9 items-center gap-1.5 rounded bg-primary px-4 text-sm font-medium text-primary-ink shadow-sm hover:bg-black"
          >
            <span className="text-[16px] leading-none">+</span> New order
          </Link>
        ) : null}
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface p-2">
        <OrderFilters activeStatus={status.success ? status.data : undefined} />
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        {items.length === 0 ? (
          <EmptyState scopedToMe={scopedToMe} filtered={status.success} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[62rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-line-soft text-left">
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th>Phone</Th>
                  <Th align="right">Items</Th>
                  <Th align="right">Total</Th>
                  <Th>Status</Th>
                  <Th>Assignee</Th>
                  <Th>Source</Th>
                  <Th align="right">Placed</Th>
                  <th className="w-10 px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((order) => (
                  <tr key={order.id} className="group transition-colors hover:bg-line-soft">
                    <Td>
                      <Link
                        href={`/orders/${order.id}`}
                        className="tnum font-medium text-ink underline-offset-4 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </Td>
                    <Td>
                      <span className="block font-medium text-ink">{order.customerName}</span>
                    </Td>
                    <Td>
                      <span className="tnum text-ink-2">{order.customerPhone}</span>
                    </Td>
                    <Td align="right">
                      <span className="tnum text-ink-2">{order.itemCount}</span>
                    </Td>
                    <Td align="right">
                      <span className="tnum font-medium text-ink">{formatMoney(order.total)}</span>
                    </Td>
                    <Td>
                      <StatusPill status={order.status} />
                    </Td>
                    <Td>
                      {order.assignedTo ? (
                        <span className="flex items-center gap-2">
                          <Avatar name={order.assignedTo.name} className="size-5 text-[9px]" />
                          <span className="text-ink">{order.assignedTo.name}</span>
                        </span>
                      ) : (
                        <span className="text-[13px] text-ink-3">Unassigned</span>
                      )}
                    </Td>
                    <Td>
                      <span className="text-ink-2">{ORDER_SOURCE_LABELS[order.source]}</span>
                    </Td>
                    <Td align="right">
                      <span className="tnum text-[12px] text-ink-2">
                        {formatDateTime(order.placedAt)}
                      </span>
                    </Td>
                    <td className="px-3 py-2.5 text-right">
                      <OrderRowActions
                        orderId={order.id}
                        orderNumber={order.orderNumber}
                        status={order.status}
                        canUpdateStatus={canUpdateStatus}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 ? (
          <div className="flex items-center justify-between border-t border-line bg-surface px-3 py-3 text-[13px] text-ink-2">
            <span className="tnum">
              Showing {offset + 1}–{Math.min(offset + items.length, total)} of {total}
            </span>
            <span className="flex items-center gap-2">
              <PageLink page={page - 1} disabled={page <= 1} status={params.status}>
                Prev
              </PageLink>
              <span className="tnum px-1 text-ink">
                {page} / {lastPage}
              </span>
              <PageLink page={page + 1} disabled={page >= lastPage} status={params.status}>
                Next
              </PageLink>
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PageLink({
  page,
  disabled,
  status,
  children,
}: {
  page: number;
  disabled: boolean;
  status?: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded border border-line px-2 py-1 text-ink-3/60">{children}</span>
    );
  }
  const query = new URLSearchParams({ page: String(page) });
  if (status) query.set('status', status);
  return (
    <Link
      href={`/orders?${query}`}
      className="rounded border border-line px-2 py-1 text-ink-2 hover:bg-line-soft"
    >
      {children}
    </Link>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <th
      scope="col"
      className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-2 ${
        align === 'right' ? 'text-right' : ''
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <td className={`px-3 py-2.5 align-middle ${align === 'right' ? 'text-right' : ''}`}>
      {children}
    </td>
  );
}

function EmptyState({ scopedToMe, filtered }: { scopedToMe: boolean; filtered: boolean }) {
  return (
    <div className="px-6 py-20 text-center">
      <p className="text-[16px] font-medium text-ink">
        {filtered ? 'No orders with that status' : 'No orders yet'}
      </p>
      <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-ink-2">
        {filtered
          ? 'Clear the filter to see everything else.'
          : scopedToMe
            ? 'Orders appear here when a manager assigns them to you, or when you take one yourself.'
            : 'Orders will appear here once they are created or arrive from a sales channel.'}
      </p>
      {!filtered ? (
        <Link
          href="/orders/new"
          className="mt-5 inline-flex h-9 items-center rounded bg-primary px-4 text-sm font-medium text-primary-ink hover:bg-black"
        >
          Create the first order
        </Link>
      ) : null}
    </div>
  );
}

export type { OrderStatus };
