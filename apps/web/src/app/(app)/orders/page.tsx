import {
  ORDER_SOURCE_LABELS,
  PERMISSIONS,
  listOrdersQuerySchema,
  type AssignableUser,
  type ListOrdersResponse,
} from '@app/contracts';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { OrderFilters } from '@/components/order-filters';
import { StatusControl } from '@/components/status-control';
import { apiGet } from '@/lib/api';
import { formatDateTime, formatMoney } from '@/lib/format';
import { can, isScopedToSelf } from '@/lib/permissions';
import { requireUser } from '@/lib/session';

export const metadata = { title: 'Orders · PRIME' };

const PAGE_SIZE = 25;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  // Unrecognised or malformed filters are dropped rather than sent on to fail.
  const parsed = listOrdersQuerySchema
    .omit({ limit: true, offset: true })
    .safeParse(params);
  const filters = parsed.success ? parsed.data : {};

  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const query = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, String(value));
  }

  const canAssign = can(user, PERMISSIONS.ORDER_ASSIGN);
  const [{ items, total }, assignableUsers] = await Promise.all([
    apiGet<ListOrdersResponse>(`/orders?${query}`),
    canAssign
      ? apiGet<AssignableUser[]>('/orders/assignable-users')
      : Promise.resolve([] as AssignableUser[]),
  ]);

  const scopedToMe = isScopedToSelf(user, PERMISSIONS.ORDER_READ);
  const canUpdateStatus = can(user, PERMISSIONS.ORDER_UPDATE_STATUS);
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-ink">Orders</h1>
          <p className="mt-1 text-[13.5px] text-ink-2">
            {scopedToMe
              ? 'Orders assigned to you.'
              : 'Manage and track orders across every channel.'}
          </p>
        </div>
        {can(user, PERMISSIONS.ORDER_CREATE) ? (
          <Link
            href="/orders/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-[13.5px] font-medium text-primary-ink shadow-sm transition-colors hover:bg-ink"
          >
            <Plus className="size-4" aria-hidden />
            New order
          </Link>
        ) : null}
      </header>

      <OrderFilters assignableUsers={assignableUsers} />

      <div className="mt-3 overflow-hidden rounded-lg border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        {items.length === 0 ? (
          <EmptyState scopedToMe={scopedToMe} filtered={Object.keys(filters).length > 0} />
        ) : (
          <div className="overflow-x-auto">
            {/*
              Fixed layout with declared column widths: the browser then cannot
              re-flow columns based on content, so a long customer name can never
              shove the numeric columns out of alignment between rows.
            */}
            <table className="w-full min-w-[68rem] table-fixed border-collapse text-left text-[13.5px]">
              <colgroup>
                <col className="w-[7rem]" />
                <col className="w-[13.5rem]" />
                <col className="w-[3.5rem]" />
                <col className="w-[8rem]" />
                <col className="w-[9rem]" />
                <col className="w-[9rem]" />
                <col className="w-[7rem]" />
                <col className="w-[10rem]" />
              </colgroup>
              <thead>
                <tr className="border-b border-line bg-line-soft">
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th numeric>Items</Th>
                  <Th numeric>Total</Th>
                  <Th>Status</Th>
                  <Th>Assignee</Th>
                  <Th>Source</Th>
                  <Th numeric>Placed</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((order) => (
                  <tr key={order.id} className="row-hover">
                    <Td>
                      <Link
                        href={`/orders/${order.id}`}
                        className="tnum font-medium text-ink underline-offset-4 transition-colors hover:text-ink hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </Td>
                    <Td>
                      <span className="block truncate font-medium text-ink" title={order.customerName}>
                        {order.customerName}
                      </span>
                      <span className="tnum block truncate text-[12px] text-ink-3">
                        {order.customerPhone}
                      </span>
                    </Td>
                    <Td numeric>
                      <span className="tnum text-ink-2">{order.itemCount}</span>
                    </Td>
                    <Td numeric>
                      <span className="tnum font-medium text-ink">
                        {formatMoney(order.total)}
                      </span>
                    </Td>
                    <Td>
                      <StatusControl
                        orderId={order.id}
                        status={order.status}
                        canUpdate={canUpdateStatus}
                      />
                    </Td>
                    <Td>
                      {order.assignedTo ? (
                        <span className="flex min-w-0 items-center gap-2">
                          <Avatar name={order.assignedTo.name} className="size-5 text-[9px]" />
                          <span className="truncate text-ink" title={order.assignedTo.name}>
                            {order.assignedTo.name}
                          </span>
                        </span>
                      ) : (
                        <span className="text-ink-3">Unassigned</span>
                      )}
                    </Td>
                    <Td>
                      <span className="text-ink-2">{ORDER_SOURCE_LABELS[order.source]}</span>
                    </Td>
                    <Td numeric>
                      <span className="tnum text-[12.5px] text-ink-2">
                        {formatDateTime(order.placedAt)}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 ? (
          <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-3 text-[13px] text-ink-2">
            <span className="tnum">
              Showing {offset + 1}–{Math.min(offset + items.length, total)} of {total}
            </span>
            <span className="flex items-center gap-2">
              <PageLink page={page - 1} disabled={page <= 1} params={params}>
                Previous
              </PageLink>
              <span className="tnum px-1 text-ink">
                {page} / {lastPage}
              </span>
              <PageLink page={page + 1} disabled={page >= lastPage} params={params}>
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
  params,
  children,
}: {
  page: number;
  disabled: boolean;
  params: Record<string, string | undefined>;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="cursor-not-allowed rounded-md border border-line px-2.5 py-1 text-ink-3/50">
        {children}
      </span>
    );
  }
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== 'page') query.set(key, value);
  }
  query.set('page', String(page));
  return (
    <Link
      href={`/orders?${query}`}
      className="rounded-md border border-line px-2.5 py-1 text-ink-2 transition-colors hover:bg-line-soft hover:text-ink"
    >
      {children}
    </Link>
  );
}

/**
 * `numeric` right-aligns the column. Header and cell share the identical padding
 * constant, so a right-aligned heading sits on exactly the same edge as the
 * figures beneath it - the misalignment that was visible before came from the two
 * carrying different padding.
 */
const CELL_X = 'px-4';

function Th({ children, numeric }: { children: React.ReactNode; numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={`${CELL_X} whitespace-nowrap py-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3 ${
        numeric ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, numeric }: { children: React.ReactNode; numeric?: boolean }) {
  return (
    <td
      className={`${CELL_X} whitespace-nowrap py-3 align-middle ${
        numeric ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </td>
  );
}

function EmptyState({ scopedToMe, filtered }: { scopedToMe: boolean; filtered: boolean }) {
  return (
    <div className="px-6 py-20 text-center">
      <p className="text-[15px] font-medium text-ink">
        {filtered ? 'No orders match these filters' : 'No orders yet'}
      </p>
      <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-ink-2">
        {filtered
          ? 'Try clearing a filter to widen the search.'
          : scopedToMe
            ? 'Orders appear here when a manager assigns them to you, or when you take one yourself.'
            : 'Orders will appear here once they are created or arrive from a sales channel.'}
      </p>
      {!filtered ? (
        <Link
          href="/orders/new"
          className="mt-5 inline-flex h-9 items-center rounded-md bg-primary px-3.5 text-[13.5px] font-medium text-primary-ink transition-colors hover:bg-ink"
        >
          Create the first order
        </Link>
      ) : null}
    </div>
  );
}
