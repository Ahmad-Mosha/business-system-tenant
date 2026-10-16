import { HandCoins, Inbox, Plus, ShoppingBag, Truck, UserRoundX } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { FilterBar } from '@/components/filter-bar';
import { QuickViews, SummaryMetric, SummaryStrip } from '@/components/list-page';
import { OrdersTable } from '@/components/orders-table';
import { Page, PageHeader } from '@/components/page';
import { TableEmpty, TablePagination, TablePanel } from '@/components/table-panel';
import { Button } from '@/components/ui/button';
import { getFormat } from '@/i18n/get-format';
import { getAssignees, getOrderSummary, getOrders, type OrderStatus } from '@/lib/api';
import { money } from '@/lib/format';
import { requireSession } from '@/lib/session';

const PAGE_SIZE = 20;
const FILTERS = ['source', 'paymentStatus', 'search', 'assignedToId'] as const;
const PAYMENTS = ['UNPAID', 'PAID', 'REFUND_DUE', 'REFUNDED'] as const;

/**
 * The status tabs, in the order work moves. "Needs work" is new and assigned
 * together — the same set the figure above counts — so the figure and its tab
 * always agree.
 */
const VIEWS: Array<{ key: string; statuses: OrderStatus[] }> = [
  { key: 'needsWork', statuses: ['NEW', 'ASSIGNED'] },
  { key: 'CONFIRMED', statuses: ['CONFIRMED'] },
  { key: 'SHIPPED', statuses: ['SHIPPED'] },
  { key: 'DELIVERED', statuses: ['DELIVERED'] },
  { key: 'CANCELLED', statuses: ['CANCELLED'] },
  { key: 'RETURNED', statuses: ['RETURNED'] },
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [f, t, te, tc, tf] = await Promise.all([
    getFormat(),
    getTranslations('orders'),
    getTranslations('enums'),
    getTranslations('common'),
    getTranslations('filters'),
  ]);
  const user = await requireSession();
  const params = await searchParams;
  const isAdmin = user.role === 'ADMIN';

  // Everything but the status: the tab counts describe this set, so choosing a
  // tab never zeroes the others. The headline figures ignore filters — opening
  // one must not change the numbers you just read.
  const scope = new URLSearchParams();
  for (const key of FILTERS) if (params[key]) scope.set(key, params[key]);
  if (params.unassigned === 'true' && !params.assignedToId) scope.set('assignedToId', 'unassigned');
  const withStatus = (status?: string) => {
    const q = new URLSearchParams(scope);
    if (status) q.set('status', status);
    return q;
  };
  const filters = withStatus(params.status);
  const href = (q: URLSearchParams) => (q.size ? `/orders?${q}` : '/orders');
  /** The API spells "nobody" as its own flag. */
  const forApi = (q: URLSearchParams) => {
    const out = new URLSearchParams(q);
    if (out.get('assignedToId') === 'unassigned') {
      out.delete('assignedToId');
      out.set('unassigned', 'true');
    }
    return out;
  };

  const page = Math.max(Number(params.page) || 1, 1);
  const listQuery = forApi(filters);
  listQuery.set('limit', String(PAGE_SIZE));
  listQuery.set('offset', String((page - 1) * PAGE_SIZE));

  const [{ orders, total }, summary, counts, assignees] = await Promise.all([
    getOrders(listQuery.toString()),
    getOrderSummary(),
    scope.size ? getOrderSummary(forApi(scope).toString()) : null,
    isAdmin ? getAssignees() : Promise.resolve([]),
  ]);
  const tabs = counts ?? summary;

  /** Paging keeps the current filters, so it never resets the view. */
  const pageHref = (p: number) => {
    const next = new URLSearchParams(filters);
    if (p > 1) next.set('page', String(p));
    return href(next);
  };
  const lastPage = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  if (page > lastPage) redirect(pageHref(lastPage));

  const pagination = (
    <TablePagination page={page} pageSize={PAGE_SIZE} total={total} count={orders.length} noun="orders" href={pageHref} />
  );
  const viewCount = (statuses: OrderStatus[]) => statuses.reduce((n, s) => n + (tabs.byStatus[s] ?? 0), 0);
  // A figure opens exactly the orders it counts: no other filter carried along.
  const deliveredUnpaid = '/orders?status=DELIVERED&paymentStatus=UNPAID';

  return (
    <Page>
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

      <SummaryStrip label={t('preview.overview')}>
        <SummaryMetric
          label={t('all')}
          icon={ShoppingBag}
          value={f.count(summary.total)}
          hint={isAdmin ? t('allHintAdmin') : t('allHintMine')}
        />
        <SummaryMetric
          label={t('needsWork')}
          icon={Inbox}
          value={f.count(summary.needsWork)}
          hint={t('needsWorkHint')}
          href="/orders?status=NEW,ASSIGNED"
          attention={summary.needsWork > 0}
          hintAttention={false}
        />
        {isAdmin ? (
          <SummaryMetric
            label={t('unassigned')}
            icon={UserRoundX}
            value={f.count(summary.unassigned)}
            hint={summary.unassigned > 0 ? t('unassignedSome') : t('unassignedNone')}
            href="/orders?assignedToId=unassigned"
            attention={summary.unassigned > 0}
            hintAttention={false}
          />
        ) : (
          <SummaryMetric
            label={te('orderStatus.SHIPPED')}
            icon={Truck}
            value={f.count(summary.byStatus.SHIPPED)}
            hint={t('inTransitHint')}
            href="/orders?status=SHIPPED"
          />
        )}
        <SummaryMetric
          label={t('deliveredUnpaid')}
          icon={HandCoins}
          value={f.count(summary.deliveredUnpaid)}
          hint={summary.deliveredUnpaid > 0
            ? t('toCollect', { amount: money(summary.deliveredUnpaidAmount) })
            : t('deliveredUnpaidNone')}
          href={deliveredUnpaid}
          attention={summary.deliveredUnpaid > 0}
        />
      </SummaryStrip>

      <div className="flex flex-col gap-3">
        <QuickViews
          label={t('preview.views')}
          views={[
            { key: 'all', label: tc('all'), count: f.count(tabs.total), href: href(withStatus()), current: !params.status },
            ...VIEWS.map((v) => ({
              key: v.key,
              label: v.key === 'needsWork' ? t('needsWork') : te(`orderStatus.${v.key as OrderStatus}`),
              count: f.count(viewCount(v.statuses)),
              href: href(withStatus(v.statuses.join(','))),
              current: params.status === v.statuses.join(','),
            })),
          ]}
        />
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
              param: 'paymentStatus',
              all: t('anyPayment'),
              options: PAYMENTS.map((p) => ({ value: p, label: te(`paymentStatus.${p}`) })),
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
      </div>

      {orders.length === 0 ? (
        <TablePanel footer={pagination}>
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
