import Link from 'next/link';
import { Plus } from 'lucide-react';
import { OrderDetail } from '@/components/order-detail';
import { OrderFilters } from '@/components/order-filters';
import { PaymentBadge, StatusBadge } from '@/components/order-status';
import {
  DetailPane,
  ListPane,
  MetricCard,
  MetricRow,
  PageCard,
  Pagination,
  Panel,
  Screen,
  Scroller,
  Split,
} from '@/components/shell';
import { getOrderSummary, getOrders } from '@/lib/api';
import { date, money } from '@/lib/format';
import { requireSession } from '@/lib/session';
import { cn } from '@/lib/utils';

/** Sized so a full page of rows fits a laptop without the list outgrowing it. */
const PAGE_SIZE = 25;

/** The counted views, each backed by a real filter on the API. */
const VIEWS = ['needsWork', 'unassigned', 'deliveredUnpaid'] as const;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireSession();
  const params = await searchParams;

  const filters = new URLSearchParams();
  for (const key of ['status', 'source', 'search'] as const) {
    if (params[key]) filters.set(key, params[key]);
  }
  for (const key of VIEWS) {
    if (params[key] === 'true') filters.set(key, 'true');
  }

  const page = Math.max(Number(params.page) || 1, 1);
  const offset = (page - 1) * PAGE_SIZE;

  const listQuery = new URLSearchParams(filters);
  listQuery.set('limit', String(PAGE_SIZE));
  listQuery.set('offset', String(offset));

  const [{ orders, total }, summary] = await Promise.all([
    getOrders(listQuery.toString()),
    getOrderSummary(),
  ]);

  const isAdmin = user.role === 'ADMIN';
  const selected = params.selected ?? null;

  /** Every link keeps the current filters, so navigating never resets the view. */
  const href = (patch: { selected?: string | null; page?: number }) => {
    const next = new URLSearchParams(filters);
    const sel = 'selected' in patch ? patch.selected : selected;
    const p = patch.page ?? page;
    if (sel) next.set('selected', sel);
    if (p > 1) next.set('page', String(p));
    const qs = next.toString();
    return qs ? `/orders?${qs}` : '/orders';
  };

  const lastPage = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  /** Each metric card is the filter for what it counts. */
  const activeView = VIEWS.find((v) => params[v] === 'true') ?? null;
  const view = (key: (typeof VIEWS)[number] | null) => {
    const next = new URLSearchParams(filters);
    for (const v of VIEWS) next.delete(v);
    if (key) next.set(key, 'true');
    const qs = next.toString();
    return qs ? `/orders?${qs}` : '/orders';
  };

  return (
    <Screen>
      <Split>
        <ListPane>
          <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
            <PageCard
              title="Orders"
              description={
                isAdmin
                  ? 'Every order from social and the website, in one list.'
                  : 'The orders assigned to you.'
              }
              actions={
                <Link
                  href="/orders/new"
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-3.5 text-[13px] font-medium text-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Plus className="size-4" />
                  New order
                </Link>
              }
            />

            <MetricRow>
              <MetricCard
                label="All orders"
                value={summary.total}
                hint={isAdmin ? 'social and website' : 'assigned to you'}
                href={view(null)}
                active={activeView === null}
              />
              <MetricCard
                label="Needs work"
                value={summary.needsWork}
                hint="new or assigned"
                tone={summary.needsWork > 0 ? 'warning' : 'default'}
                href={view('needsWork')}
                active={activeView === 'needsWork'}
              />
              {isAdmin && (
                <MetricCard
                  label="Unassigned"
                  value={summary.unassigned}
                  hint="nobody owns these"
                  tone={summary.unassigned > 0 ? 'warning' : 'default'}
                  href={view('unassigned')}
                  active={activeView === 'unassigned'}
                />
              )}
              <MetricCard
                label="Delivered unpaid"
                value={summary.deliveredUnpaid}
                hint="cash not yet collected"
                tone={summary.deliveredUnpaid > 0 ? 'warning' : 'default'}
                href={view('deliveredUnpaid')}
                active={activeView === 'deliveredUnpaid'}
              />
            </MetricRow>

            <OrderFilters />

            <Panel>
              <Scroller>
                {orders.length === 0 ? (
                  <p className="p-12 text-center text-sm text-muted-foreground">
                    No orders match this view.
                  </p>
                ) : (
                  <table className="w-full border-collapse text-[13px]">
                    <thead className="sticky top-0 z-10 bg-muted/40 backdrop-blur">
                      <tr className="border-b border-border text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
                        <Th className="w-[110px]">Order</Th>
                        <Th>Customer</Th>
                        <Th className="w-[130px]">Phone</Th>
                        <Th className="w-[100px]">Channel</Th>
                        <Th className="w-[120px]">Status</Th>
                        <Th className="w-[100px]">Payment</Th>
                        {isAdmin && <Th className="w-[120px]">Assigned</Th>}
                        <Th className="w-[110px] text-right">Total</Th>
                        <Th className="w-[110px] text-right">Date</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr
                          key={o.id}
                          className={cn(
                            'group relative h-12 border-b border-border/60 last:border-b-0',
                            o.id === selected ? 'bg-accent' : 'hover:bg-accent/50',
                          )}
                        >
                          <Td className="font-medium tabular-nums">
                            <Link
                              href={href({ selected: o.id })}
                              scroll={false}
                              className="after:absolute after:inset-0 focus-visible:underline focus-visible:outline-none"
                            >
                              {o.orderNumber}
                            </Link>
                          </Td>
                          <Td className="max-w-0">
                            <span className="block truncate font-medium">{o.customerName}</span>
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
                              {o.assignedToName ?? <span className="opacity-40">—</span>}
                            </Td>
                          )}
                          <Td className="text-right font-medium tabular-nums">{money(o.total)}</Td>
                          <Td className="text-right whitespace-nowrap text-muted-foreground">
                            {date(o.placedAt)}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Scroller>

              <Pagination
                from={total === 0 ? 0 : offset + 1}
                to={offset + orders.length}
                total={total}
                noun="orders"
                prevHref={page > 1 ? href({ page: page - 1 }) : null}
                nextHref={page < lastPage ? href({ page: page + 1 }) : null}
              />
            </Panel>
          </div>
        </ListPane>

        {selected && (
          <DetailPane
            /* Below xl there is not enough width for two panes side by side, so
               the detail floats over the list instead of squeezing it. */
            className="fixed inset-y-0 right-0 z-30 w-[400px] bg-background shadow-xl xl:static xl:z-auto xl:w-[var(--detail-w)] xl:shadow-none"
          >
            <OrderDetail id={selected} user={user} closeHref={href({ selected: null })} />
          </DetailPane>
        )}
      </Split>
    </Screen>
  );
}

function Th({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <th className={cn('px-4 py-2.5 text-left font-medium whitespace-nowrap', className)}>
      {children}
    </th>
  );
}

function Td({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <td className={cn('px-4 whitespace-nowrap', className)}>{children}</td>;
}
