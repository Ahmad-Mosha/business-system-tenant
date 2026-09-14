import { AlertTriangle, Plus, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { AssignMenu } from '@/components/assign-menu';
import { FilterBar } from '@/components/filter-bar';
import { MetricCard, MetricGrid } from '@/components/metric-card';
import { ALL_ORDER_STATUSES, sourceLabel, STATUS_LABELS } from '@/components/order-status';
import { OrderStatusMenu } from '@/components/order-status-menu';
import { Page, PageHeader } from '@/components/page';
import { PaymentStatusMenu } from '@/components/payment-status-menu';
import { TableEmpty, TablePagination, TablePanel } from '@/components/table-panel';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getAssignees, getOrderSummary, getOrders } from '@/lib/api';
import { date, money } from '@/lib/format';
import { requireSession } from '@/lib/session';

const PAGE_SIZE = 20;
const FILTERS = ['status', 'source', 'search'] as const;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireSession();
  const params = await searchParams;
  const isAdmin = user.role === 'ADMIN';

  const filters = new URLSearchParams();
  for (const key of FILTERS) if (params[key]) filters.set(key, params[key]);
  if (params.unassigned === 'true') filters.set('unassigned', 'true');

  const page = Math.max(Number(params.page) || 1, 1);
  const listQuery = new URLSearchParams(filters);
  listQuery.set('limit', String(PAGE_SIZE));
  listQuery.set('offset', String((page - 1) * PAGE_SIZE));

  const [{ orders, total }, summary, assignees] = await Promise.all([
    getOrders(listQuery.toString()),
    getOrderSummary(),
    isAdmin ? getAssignees() : Promise.resolve([]),
  ]);

  /** Paging keeps the current filters, so it never resets the view. */
  const pageHref = (p: number) => {
    const next = new URLSearchParams(filters);
    if (p > 1) next.set('page', String(p));
    const qs = next.toString();
    return qs ? `/orders?${qs}` : '/orders';
  };
  const share = (n: number) =>
    summary.total > 0 ? ` · ${Math.round((n / summary.total) * 100)}% of orders` : '';

  return (
    <Page fill>
      <PageHeader
        title="Orders"
        description={
          isAdmin
            ? 'Every order from social and the website, in one list.'
            : 'The orders assigned to you.'
        }
        actions={
          <Button asChild>
            <Link href="/orders/new">
              <Plus />
              New order
            </Link>
          </Button>
        }
      />

      <MetricGrid>
        <MetricCard
          label="All orders"
          value={summary.total}
          hint={isAdmin ? 'Social and website' : 'Assigned to you'}
        />
        <MetricCard
          label="Needs work"
          value={summary.needsWork}
          tone={summary.needsWork > 0 ? 'warning' : 'default'}
          hint={`New or assigned${share(summary.needsWork)}`}
        />
        {isAdmin ? (
          <MetricCard
            label="Unassigned"
            value={summary.unassigned}
            tone={summary.unassigned > 0 ? 'warning' : 'default'}
            hint={summary.unassigned > 0 ? 'Nobody owns these yet' : 'Every order has an owner'}
          />
        ) : null}
        <MetricCard
          label="Delivered, unpaid"
          value={summary.deliveredUnpaid}
          tone={summary.deliveredUnpaid > 0 ? 'warning' : 'default'}
          hint={summary.deliveredUnpaid > 0 ? 'Cash not yet collected' : 'All delivered orders paid'}
        />
      </MetricGrid>

      <FilterBar
        search={{ param: 'search', placeholder: 'Search orders, customers, phones…' }}
        filters={[
          {
            kind: 'select',
            param: 'source',
            all: 'All channels',
            options: [
              { value: 'SOCIAL', label: 'Social' },
              { value: 'EASYORDERS', label: 'Website' },
            ],
          },
          {
            kind: 'select',
            param: 'status',
            all: 'Any status',
            options: ALL_ORDER_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
          },
          ...(isAdmin
            ? [{ kind: 'toggle' as const, param: 'unassigned', value: 'true', label: 'Unassigned' }]
            : []),
        ]}
      />

      <TablePanel
        minWidth="68rem"
        footer={
          <TablePagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            count={orders.length}
            noun="orders"
            href={pageHref}
          />
        }
      >
        {orders.length === 0 ? (
          filters.size > 0 ? (
            <TableEmpty
              icon={ShoppingBag}
              title="No orders match this view"
              description="Try another status or channel, or clear the search."
              action={
                <Button variant="outline" asChild>
                  <Link href="/orders">Reset filters</Link>
                </Button>
              }
            />
          ) : (
            <TableEmpty
              icon={ShoppingBag}
              title="No orders yet"
              description="Website orders arrive here on their own. Social orders are entered by hand."
              action={
                <Button asChild>
                  <Link href="/orders/new">
                    <Plus />
                    New order
                  </Link>
                </Button>
              }
            />
          )
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="w-[96px]">Channel</TableHead>
                <TableHead className="w-[140px]">Status</TableHead>
                <TableHead className="w-[120px]">Payment</TableHead>
                {isAdmin ? <TableHead className="w-[150px]">Assigned</TableHead> : null}
                <TableHead className="w-[120px] text-right">Total</TableHead>
                <TableHead className="w-[110px] text-right">Placed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id} className="relative">
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/orders/${o.id}`}
                        className="num font-medium after:absolute after:inset-0 hover:underline focus-visible:underline focus-visible:outline-none"
                      >
                        {o.orderNumber}
                      </Link>
                      {o.unmappedCount > 0 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertTriangle
                              aria-label={`${o.unmappedCount} not in inventory`}
                              className="relative z-10 size-3.5 text-warning"
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            {o.unmappedCount} {o.unmappedCount === 1 ? 'item isn’t' : 'items aren’t'}{' '}
                            linked to inventory, so stock won’t move
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-0">
                    <p className="truncate font-medium">
                      <bdi>{o.customerName}</bdi>
                    </p>
                    <p className="num truncate text-xs text-muted-foreground">{o.customerPhone}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{sourceLabel(o.source)}</TableCell>
                  <TableCell>
                    <OrderStatusMenu orderId={o.id} status={o.status} canRevert={isAdmin} />
                  </TableCell>
                  <TableCell>
                    <PaymentStatusMenu orderId={o.id} status={o.paymentStatus} />
                  </TableCell>
                  {isAdmin ? (
                    <TableCell className="max-w-0">
                      <AssignMenu
                        orderId={o.id}
                        assignedToId={o.assignedToId}
                        assignedToName={o.assignedToName}
                        assignees={assignees}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell className="num text-right font-medium">{money(o.total)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{date(o.placedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TablePanel>
    </Page>
  );
}
