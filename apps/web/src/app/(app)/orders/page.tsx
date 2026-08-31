import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import { OrderDetail } from '@/components/order-detail';
import { OrderFilters } from '@/components/order-filters';
import { PaymentBadge, StatusBadge } from '@/components/order-status';
import {
  ContextBar,
  DetailPane,
  Figure,
  ListPane,
  Screen,
  Scroller,
  Split,
  StatusStrip,
} from '@/components/shell';
import { getOrderSummary, getOrders } from '@/lib/api';
import { dateTime, money } from '@/lib/format';
import { requireSession } from '@/lib/session';
import { cn } from '@/lib/utils';

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireSession();
  const params = await searchParams;

  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.search) query.set('search', params.search);
  if (params.unassigned === 'true') query.set('unassigned', 'true');

  const [{ orders, total }, summary] = await Promise.all([
    getOrders(query.toString()),
    getOrderSummary(),
  ]);

  const isAdmin = user.role === 'ADMIN';
  const selected = params.selected ?? null;

  /** Selecting an order is a URL change, so it is shareable and reversible. */
  const rowHref = (id: string | null) => {
    const next = new URLSearchParams(query);
    if (id) next.set('selected', id);
    const qs = next.toString();
    return qs ? `/orders?${qs}` : '/orders';
  };

  return (
    <Screen>
      <ContextBar
        title="Orders"
        meta={`${total}`}
        figures={
          <>
            <Figure
              label="Needs work"
              value={summary.needsWork}
              tone={summary.needsWork > 0 ? 'warning' : 'default'}
            />
            {isAdmin && <Figure label="Unassigned" value={summary.unassigned} />}
            <Figure
              label="Delivered unpaid"
              value={summary.deliveredUnpaid}
              tone={summary.deliveredUnpaid > 0 ? 'warning' : 'default'}
            />
          </>
        }
        actions={
          <Link
            href="/orders/new"
            className="inline-flex h-[var(--control-h)] items-center gap-1.5 rounded-md bg-foreground px-3 text-[13px] font-medium text-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Plus className="size-4" />
            New order
          </Link>
        }
      >
        <OrderFilters isAdmin={isAdmin} />
      </ContextBar>

      <Split>
        <ListPane>
          <Scroller>
            {orders.length === 0 ? (
              <p className="p-10 text-center text-sm text-muted-foreground">
                No orders match this view.
              </p>
            ) : (
              <table className="w-full border-collapse text-[13px]">
                <thead className="sticky top-0 z-10 bg-background">
                  <tr className="border-b border-border text-[11px] tracking-[0.05em] text-muted-foreground uppercase">
                    <Th className="w-[110px]">Order</Th>
                    <Th>Customer</Th>
                    <Th className="w-[120px]">Phone</Th>
                    <Th className="w-[70px]">Source</Th>
                    <Th className="w-[110px]">Status</Th>
                    <Th className="w-[90px]">Payment</Th>
                    {isAdmin && <Th className="w-[110px]">Assigned</Th>}
                    <Th className="w-[100px] text-right">Total</Th>
                    <Th className="w-[120px] text-right">Placed</Th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const active = o.id === selected;
                    return (
                      <tr
                        key={o.id}
                        className={cn(
                          'group relative h-[var(--row-h)] border-b border-border/60',
                          active ? 'bg-accent' : 'hover:bg-accent/50',
                        )}
                      >
                        <Td className="font-medium tabular-nums">
                          <Link
                            href={rowHref(o.id)}
                            scroll={false}
                            className="after:absolute after:inset-0 focus-visible:underline focus-visible:outline-none"
                          >
                            {o.orderNumber}
                          </Link>
                        </Td>
                        <Td className="max-w-0">
                          <span className="block truncate">{o.customerName}</span>
                        </Td>
                        <Td className="tabular-nums text-muted-foreground">{o.customerPhone}</Td>
                        <Td className="text-muted-foreground">
                          {o.source === 'EASYORDERS' ? 'Website' : 'Social'}
                        </Td>
                        <Td>
                          <StatusBadge status={o.status} />
                          {o.unmappedCount > 0 && (
                            <span className="ms-1 text-[11px] text-warning">
                              {o.unmappedCount}
                            </span>
                          )}
                        </Td>
                        <Td>
                          <PaymentBadge status={o.paymentStatus} />
                        </Td>
                        {isAdmin && (
                          <Td className="truncate text-muted-foreground">
                            {o.assignedToName ?? <span className="opacity-50">—</span>}
                          </Td>
                        )}
                        <Td className="text-right font-medium tabular-nums">{money(o.total)}</Td>
                        <Td className="text-right whitespace-nowrap text-muted-foreground">
                          {dateTime(o.placedAt)}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Scroller>

          <StatusStrip>
            <span>
              {orders.length} of {total} {total === 1 ? 'order' : 'orders'}
              {params.status || params.search || params.unassigned ? ' · filtered' : ''}
            </span>
            <span>{isAdmin ? 'All orders' : 'Your orders only'}</span>
          </StatusStrip>
        </ListPane>

        {selected && (
          <DetailPane
            /* Below xl there is not enough width for two panes side by side, so
               the detail floats over the list instead of squeezing it. */
            className="fixed inset-y-0 right-0 z-30 w-[400px] bg-background shadow-xl xl:static xl:z-auto xl:w-[var(--detail-w)] xl:shadow-none"
          >
            <Link
              href={rowHref(null)}
              scroll={false}
              aria-label="Close order details"
              className="absolute end-2 top-2 z-10 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground xl:hidden"
            >
              <X className="size-4" />
            </Link>
            <OrderDetail id={selected} user={user} />
          </DetailPane>
        )}
      </Split>
    </Screen>
  );
}

function Th({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <th className={cn('px-3 py-2 text-left font-medium whitespace-nowrap', className)}>
      {children}
    </th>
  );
}

function Td({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <td className={cn('px-3 whitespace-nowrap', className)}>{children}</td>;
}
