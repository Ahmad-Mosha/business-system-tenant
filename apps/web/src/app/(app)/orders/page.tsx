import Link from "next/link";
import { Plus } from "lucide-react";
import { OrderFilters } from "@/components/order-filters";
import { PaymentBadge, StatusBadge } from "@/components/order-status";
import {
  MetricCard,
  MetricRow,
  PageCard,
  Pagination,
  Panel,
  Screen,
  Scroller,
} from "@/components/shell";
import { getOrderSummary, getOrders } from "@/lib/api";
import { date, money } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { cn } from "@/lib/utils";

/**
 * A page of rows has to *fit* — the point of paginating is that you never
 * scroll to see the rest. Eight rows clear the header card, the metrics, the
 * filters and the footer on a 900px laptop with margin to spare, even on a
 * shorter window.
 */
const PAGE_SIZE = 8;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireSession();
  const params = await searchParams;

  const filters = new URLSearchParams();
  for (const key of ["status", "source", "search"] as const) {
    if (params[key]) filters.set(key, params[key]);
  }
  if (params.unassigned === "true") filters.set("unassigned", "true");

  const page = Math.max(Number(params.page) || 1, 1);
  const offset = (page - 1) * PAGE_SIZE;

  const listQuery = new URLSearchParams(filters);
  listQuery.set("limit", String(PAGE_SIZE));
  listQuery.set("offset", String(offset));

  const [{ orders, total }, summary] = await Promise.all([
    getOrders(listQuery.toString()),
    getOrderSummary(),
  ]);

  const isAdmin = user.role === "ADMIN";

  /** Paging keeps the current filters, so it never resets the view. */
  const pageHref = (p: number) => {
    const next = new URLSearchParams(filters);
    if (p > 1) next.set("page", String(p));
    const qs = next.toString();
    return qs ? `/orders?${qs}` : "/orders";
  };

  const lastPage = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <Screen>
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <PageCard
          title="Orders"
          description={
            isAdmin
              ? "Every order from social and the website, in one list."
              : "The orders assigned to you."
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
            hint={isAdmin ? "social and website" : "assigned to you"}
          />
          <MetricCard
            label="Needs work"
            value={summary.needsWork}
            hint="new or assigned"
            tone={summary.needsWork > 0 ? "warning" : "default"}
          />
          {isAdmin && (
            <MetricCard
              label="Unassigned"
              value={summary.unassigned}
              hint="nobody owns these"
              tone={summary.unassigned > 0 ? "warning" : "default"}
            />
          )}
          <MetricCard
            label="Delivered unpaid"
            value={summary.deliveredUnpaid}
            hint="cash not yet collected"
            tone={summary.deliveredUnpaid > 0 ? "warning" : "default"}
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
                      className="group relative h-11 border-b border-border/60 last:border-b-0 hover:bg-accent/50"
                    >
                      <Td className="font-medium tabular-nums">
                        <Link
                          href={`/orders/${o.id}`}
                          className="after:absolute after:inset-0 focus-visible:underline focus-visible:outline-none"
                        >
                          {o.orderNumber}
                        </Link>
                      </Td>
                      <Td className="max-w-0">
                        <span className="block truncate font-medium">
                          {o.customerName}
                        </span>
                      </Td>
                      <Td className="tabular-nums text-muted-foreground">
                        {o.customerPhone}
                      </Td>
                      <Td className="text-muted-foreground">
                        {o.source === "EASYORDERS" ? "Website" : "Social"}
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
                          {o.assignedToName ?? (
                            <span className="opacity-40">—</span>
                          )}
                        </Td>
                      )}
                      <Td className="text-right font-medium tabular-nums">
                        {money(o.total)}
                      </Td>
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
            prevHref={page > 1 ? pageHref(page - 1) : null}
            nextHref={page < lastPage ? pageHref(page + 1) : null}
          />
        </Panel>
      </div>
    </Screen>
  );
}

function Th({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-left font-medium whitespace-nowrap",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <td className={cn("px-4 whitespace-nowrap", className)}>{children}</td>
  );
}
