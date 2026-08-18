import type { ListOrdersResponse } from '@app/contracts';
import { StatusBadge } from '@/components/ui/status-badge';
import { apiGet } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { requireUser } from '@/lib/session';

export const metadata = { title: 'Orders' };

export default async function OrdersPage() {
  const user = await requireUser();
  const { items, total } = await apiGet<ListOrdersResponse>('/orders');

  // The API decides which orders this user may see; the wording here just explains
  // what the reader is looking at.
  const scopedToMe = user.grants.some(
    (g) => g.permission === 'order:read' && g.scope === 'ASSIGNED',
  );

  return (
    <div>
      <header className="flex items-baseline justify-between gap-6">
        <div>
          <h1 className="font-display text-[32px] leading-none tracking-tight">Orders</h1>
          <p className="mt-2.5 text-sm text-ink-soft">
            {scopedToMe ? 'Orders assigned to you' : 'All orders across every channel'}
          </p>
        </div>
        {total > 0 ? (
          <p className="tnum text-[13px] text-ink-faint">
            {total} {total === 1 ? 'order' : 'orders'}
          </p>
        ) : null}
      </header>

      {items.length === 0 ? (
        <EmptyState scopedToMe={scopedToMe} />
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule-strong text-left">
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Status</Th>
                <Th>Assigned to</Th>
                <Th align="right">Total</Th>
                <Th align="right">Placed</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-rule transition-colors last:border-0 hover:bg-sunken/60"
                >
                  <Td>
                    <span className="tnum font-medium text-ink">{order.orderNumber}</span>
                  </Td>
                  <Td>
                    <span className="text-ink">{order.customerName}</span>
                    <span className="tnum mt-0.5 block text-[13px] text-ink-faint">
                      {order.customerPhone}
                    </span>
                  </Td>
                  <Td>
                    <StatusBadge status={order.status} />
                  </Td>
                  <Td>
                    {order.assignedTo ? (
                      <span className="text-ink-soft">{order.assignedTo.name}</span>
                    ) : (
                      <span className="text-ink-faint">Unassigned</span>
                    )}
                  </Td>
                  <Td align="right">
                    <span className="tnum text-ink">{formatMoney(order.total)}</span>
                  </Td>
                  <Td align="right">
                    <span className="tnum text-ink-faint">{formatDate(order.placedAt)}</span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <th
      scope="col"
      className={`pb-2.5 text-[12px] font-medium uppercase tracking-[0.07em] text-ink-faint ${
        align === 'right' ? 'text-right' : ''
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return <td className={`py-3.5 align-top ${align === 'right' ? 'text-right' : ''}`}>{children}</td>;
}

function EmptyState({ scopedToMe }: { scopedToMe: boolean }) {
  return (
    <div className="mt-10 border-t border-rule py-20 text-center">
      <p className="font-display text-[22px] text-ink">Nothing here yet</p>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-soft">
        {scopedToMe
          ? 'Orders appear here as soon as a manager assigns them to you.'
          : 'Orders will appear here once they are created or imported from a sales channel.'}
      </p>
    </div>
  );
}
