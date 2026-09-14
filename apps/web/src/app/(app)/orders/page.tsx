import { AlertTriangle, Plus, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { AssignMenu } from '@/components/assign-menu';
import { FilterBar } from '@/components/filter-bar';
import { MetricCard, MetricGrid } from '@/components/metric-card';
import { ALL_ORDER_STATUSES } from '@/components/order-status';
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
import { getTranslations } from 'next-intl/server';
import { getAssignees, getOrderSummary, getOrders } from '@/lib/api';
import { money } from '@/lib/format';
import { requireSession } from '@/lib/session';
import { getFormat } from '@/i18n/get-format';

const PAGE_SIZE = 20;
const FILTERS = ['status', 'source', 'search'] as const;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [f, t, te, tf] = await Promise.all([
    getFormat(),
    getTranslations('orders'),
    getTranslations('enums'),
    getTranslations('filters'),
  ]);
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

  return (
    <Page fill>
      <PageHeader
        title={t('title')}
        description={isAdmin ? t('descriptionAdmin') : t('descriptionMine')}
        actions={
          <Button asChild>
            <Link href="/orders/new">
              <Plus />
              {t('new')}
            </Link>
          </Button>
        }
      />

      <MetricGrid>
        <MetricCard
          label={t('all')}
          value={summary.total}
          hint={isAdmin ? t('allHintAdmin') : t('allHintMine')}
        />
        <MetricCard
          label={t('needsWork')}
          value={summary.needsWork}
          tone={summary.needsWork > 0 ? 'warning' : 'default'}
          hint={
            summary.total > 0
              ? t('needsWorkShare', { share: summary.needsWork / summary.total })
              : t('needsWorkHint')
          }
        />
        {isAdmin ? (
          <MetricCard
            label={t('unassigned')}
            value={summary.unassigned}
            tone={summary.unassigned > 0 ? 'warning' : 'default'}
            hint={summary.unassigned > 0 ? t('unassignedSome') : t('unassignedNone')}
          />
        ) : null}
        <MetricCard
          label={t('deliveredUnpaid')}
          value={summary.deliveredUnpaid}
          tone={summary.deliveredUnpaid > 0 ? 'warning' : 'default'}
          hint={summary.deliveredUnpaid > 0 ? t('deliveredUnpaidSome') : t('deliveredUnpaidNone')}
        />
      </MetricGrid>

      <FilterBar
        search={{ param: 'search', placeholder: t('search') }}
        filters={[
          {
            kind: 'select',
            param: 'source',
            all: t('allChannels'),
            options: [
              { value: 'SOCIAL', label: te('orderSource.SOCIAL') },
              { value: 'EASYORDERS', label: te('orderSource.EASYORDERS') },
            ],
          },
          {
            kind: 'select',
            param: 'status',
            all: t('anyStatus'),
            options: ALL_ORDER_STATUSES.map((s) => ({ value: s, label: te(`orderStatus.${s}`) })),
          },
          ...(isAdmin
            ? [{ kind: 'toggle' as const, param: 'unassigned', value: 'true', label: t('unassigned') }]
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
              title={t('noMatch')}
              description={t('noMatchHint')}
              action={
                <Button variant="outline" asChild>
                  <Link href="/orders">{tf('resetFilters')}</Link>
                </Button>
              }
            />
          ) : (
            <TableEmpty
              icon={ShoppingBag}
              title={t('none')}
              description={t('noneHint')}
              action={
                <Button asChild>
                  <Link href="/orders/new">
                    <Plus />
                    {t('new')}
                  </Link>
                </Button>
              }
            />
          )
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">{t('columns.order')}</TableHead>
                <TableHead>{t('columns.customer')}</TableHead>
                <TableHead className="w-[96px]">{t('columns.channel')}</TableHead>
                <TableHead className="w-[140px]">{t('columns.status')}</TableHead>
                <TableHead className="w-[120px]">{t('columns.payment')}</TableHead>
                {isAdmin ? <TableHead className="w-[150px]">{t('columns.assigned')}</TableHead> : null}
                <TableHead className="w-[120px] text-end">{t('columns.total')}</TableHead>
                <TableHead className="w-[110px] text-end">{t('columns.placed')}</TableHead>
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
                              aria-label={t('unmapped', { count: o.unmappedCount })}
                              className="relative z-10 size-3.5 text-warning"
                            />
                          </TooltipTrigger>
                          <TooltipContent>{t('unmapped', { count: o.unmappedCount })}</TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-0">
                    <p className="truncate font-medium">
                      <bdi>{o.customerName}</bdi>
                    </p>
                    <p className="num truncate text-xs text-muted-foreground">
                      <bdi>{o.customerPhone}</bdi>
                    </p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{te(`orderSource.${o.source}`)}</TableCell>
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
                  <TableCell className="num text-end font-medium">{money(o.total)}</TableCell>
                  <TableCell className="text-end text-muted-foreground">{f.date(o.placedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TablePanel>
    </Page>
  );
}
