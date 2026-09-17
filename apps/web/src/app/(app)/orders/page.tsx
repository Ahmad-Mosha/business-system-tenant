import { Plus, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FilterBar } from '@/components/filter-bar';
import { MetricCard, MetricGrid } from '@/components/metric-card';
import { ALL_ORDER_STATUSES } from '@/components/order-status';
import { OrdersTable } from '@/components/orders-table';
import { Page, PageHeader } from '@/components/page';
import { TableEmpty, TablePagination, TablePanel } from '@/components/table-panel';
import { Button } from '@/components/ui/button';
import { getTranslations } from 'next-intl/server';
import { getAssignees, getOrderSummary, getOrders } from '@/lib/api';
import { requireSession } from '@/lib/session';

const PAGE_SIZE = 20;
const FILTERS = ['status', 'source', 'search', 'assignedToId'] as const;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [t, te, tf] = await Promise.all([
    getTranslations('orders'),
    getTranslations('enums'),
    getTranslations('filters'),
  ]);
  const user = await requireSession();
  const params = await searchParams;
  const isAdmin = user.role === 'ADMIN';

  const filters = new URLSearchParams();
  for (const key of FILTERS) if (params[key]) filters.set(key, params[key]);
  if (params.unassigned === 'true' && !params.assignedToId) filters.set('assignedToId', 'unassigned');

  const page = Math.max(Number(params.page) || 1, 1);
  const listQuery = new URLSearchParams(filters);
  if (listQuery.get('assignedToId') === 'unassigned') {
    listQuery.delete('assignedToId');
    listQuery.set('unassigned', 'true');
  }
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
  const lastPage = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  if (page > lastPage) redirect(pageHref(lastPage));

  const pagination = (
    <TablePagination
      page={page}
      pageSize={PAGE_SIZE}
      total={total}
      count={orders.length}
      noun="orders"
      href={pageHref}
    />
  );

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
            ? [{
                kind: 'select' as const,
                param: 'assignedToId',
                all: t('allAssignees'),
                options: [
                  { value: 'unassigned', label: t('unassigned') },
                  ...assignees.map((person) => ({ value: person.id, label: person.name })),
                ],
              }]
            : []),
        ]}
      />

      {orders.length === 0 ? (
        <TablePanel minWidth="68rem" footer={pagination}>
          {filters.size > 0 ? (
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
          )}
        </TablePanel>
      ) : (
        <OrdersTable
          key={orders.map((order) => order.id).join(':')}
          orders={orders}
          assignees={assignees}
          isAdmin={isAdmin}
          footer={pagination}
        />
      )}
    </Page>
  );
}
