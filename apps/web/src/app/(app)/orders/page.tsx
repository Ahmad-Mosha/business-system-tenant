import Link from 'next/link';
import { ChevronRight, Plus } from 'lucide-react';
import { PageBody, PageHeader } from '@/components/page-header';
import { PaymentBadge, SourceLabel } from '@/components/order-status';
import { OrderStatusMenu } from '@/components/order-status-menu';
import { Stat, StatCell, StatGrid } from '@/components/stat';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getOrderSummary, getOrders } from '@/lib/api';
import { dateTime, money } from '@/lib/format';
import { requireSession } from '@/lib/session';
import { OrderFilters } from '@/components/order-filters';

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

  return (
    <>
      <PageHeader
        title="Orders"
        actions={
          <Link
            href="/orders/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-3 text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Plus className="size-4" />
            New order
          </Link>
        }
      />

      <PageBody>
        <StatGrid>
          <StatCell>
            <Stat label="Orders" value={String(summary.total)} hint="in total" />
          </StatCell>
          <StatCell>
            <Stat label="Needs work" value={String(summary.needsWork)} hint="new or assigned" />
          </StatCell>
          {isAdmin && (
            <StatCell>
              <Stat label="Unassigned" value={String(summary.unassigned)} hint="nobody owns these" />
            </StatCell>
          )}
          <StatCell>
            <Stat
              label="Delivered unpaid"
              value={String(summary.deliveredUnpaid)}
              hint="cash not yet collected"
            />
          </StatCell>
        </StatGrid>

        <section>
          <OrderFilters isAdmin={isAdmin} />

          {orders.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-5 py-14 text-center text-sm text-muted-foreground">
              No orders match this view.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-[100px]">Order</TableHead>
                    <TableHead className="min-w-[160px]">Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    {isAdmin && <TableHead>Assigned</TableHead>}
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Placed</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id} className="group relative">
                      <TableCell className="font-medium tabular-nums">
                        <Link
                          href={`/orders/${o.id}`}
                          className="after:absolute after:inset-0 focus-visible:underline focus-visible:outline-none"
                        >
                          {o.orderNumber}
                        </Link>
                        <span className="mt-0.5 block">
                          <SourceLabel source={o.source} />
                        </span>
                      </TableCell>
                      <TableCell className="max-w-0">
                        <span className="block truncate font-medium">{o.customerName}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {o.customerPhone}
                          {o.governorate ? ` · ${o.governorate}` : ''}
                        </span>
                      </TableCell>
                      <TableCell>
                        <OrderStatusMenu orderId={o.id} status={o.status} />
                        {o.unmappedCount > 0 && (
                          <span className="mt-1 block text-[11px] text-warning">
                            {o.unmappedCount} unmatched
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <PaymentBadge status={o.paymentStatus} />
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-sm">
                          {o.assignedToName ?? (
                            <span className="text-muted-foreground/50">Unassigned</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-right font-medium tabular-nums">
                        {money(o.total)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap text-xs text-muted-foreground">
                        {dateTime(o.placedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <ChevronRight className="size-4 text-muted-foreground/40 transition-colors group-hover:text-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {total > orders.length && (
            <p className="mt-3 text-xs text-muted-foreground">
              Showing {orders.length} of {total}.
            </p>
          )}
        </section>
      </PageBody>
    </>
  );
}
