import { Package, Plus } from 'lucide-react';
import Link from 'next/link';
import { Amount } from '@/components/amount';
import { FilterBar } from '@/components/filter-bar';
import { MetricCard, MetricGrid } from '@/components/metric-card';
import { ChannelBadge } from '@/components/order-status';
import { Page, PageHeader } from '@/components/page';
import { SyncWebsiteButton } from '@/components/sync-website-button';
import { TableEmpty, TablePagination, TablePanel } from '@/components/table-panel';
import { ToneBadge } from '@/components/tone-badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getProductsCatalog, getProductsSummary } from '@/lib/api';
import { CATEGORIES, categoryIcon } from '@/lib/categories';
import { requireAdmin } from '@/lib/session';
import { LOW_STOCK, stockState } from '@/lib/stock';
import { cn, isOneOf } from '@/lib/utils';
import { getTranslations } from 'next-intl/server';
import { getFormat } from '@/i18n/get-format';

const PAGE_SIZE = 20;

/** The API's stock filter, and the `enums.stockState` each one is. */
const STOCK_LEVELS = [
  { value: 'in_stock', state: 'in' },
  { value: 'low_stock', state: 'low' },
  { value: 'out_of_stock', state: 'out' },
] as const;

const CHANNELS = ['noon', 'easyorders', 'amazon', 'social', 'unlisted'] as const;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [f, t, te, tc, tf, tn] = await Promise.all([
    getFormat(),
    getTranslations('inventory'),
    getTranslations('enums'),
    getTranslations('common'),
    getTranslations('filters'),
    getTranslations('nouns'),
  ]);
  await requireAdmin();
  const categoryName = (c: string | null) =>
    !c ? te('category.NONE') : isOneOf(CATEGORIES, c) ? te(`category.${c}`) : c;
  const params = await searchParams;

  // Everything but the stock level: the figures and the stock-level counts
  // describe this set, so choosing a level never zeroes the others.
  const scope = new URLSearchParams();
  for (const key of ['search', 'channel', 'category'] as const) {
    if (params[key]) scope.set(key, params[key]);
  }
  const stock = STOCK_LEVELS.find((s) => s.value === params.stock)?.value;
  const withStock = (level: string) => {
    const q = new URLSearchParams(scope);
    q.set('stock', level);
    return q.toString();
  };
  const filterQuery = stock ? new URLSearchParams(withStock(stock)) : scope;

  const page = Math.max(Number(params.page) || 1, 1);
  const listQuery = new URLSearchParams(filterQuery);
  listQuery.set('limit', String(PAGE_SIZE));
  listQuery.set('offset', String((page - 1) * PAGE_SIZE));

  const [products, summary, ...levels] = await Promise.all([
    getProductsCatalog(listQuery.toString()),
    getProductsSummary(scope.toString()),
    ...STOCK_LEVELS.map((s) => getProductsSummary(withStock(s.value))),
  ]);
  const count = Object.fromEntries(STOCK_LEVELS.map((s, i) => [s.value, levels[i].products]));
  const total = products[0]?.totalCount ?? (stock ? count[stock] : summary.products);

  const pageHref = (p: number) => {
    const next = new URLSearchParams(filterQuery);
    if (p > 1) next.set('page', String(p));
    const qs = next.toString();
    return qs ? `/inventory?${qs}` : '/inventory';
  };

  return (
    <Page fill>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <>
            <SyncWebsiteButton />
            <Button asChild>
              <Link href="/inventory/new">
                <Plus />
                {t('add')}
              </Link>
            </Button>
          </>
        }
      />

      <MetricGrid>
        <MetricCard
          label={t('stockValue')}
          value={<Amount value={summary.stockValue} />}
          tone={summary.missingCost > 0 ? 'warning' : 'default'}
          hint={summary.missingCost > 0 ? t('missingCost', { count: summary.missingCost }) : t('atCost')}
        />
        <MetricCard
          label={t('unitsOnHand')}
          value={f.count(summary.unitsOnHand)}
          hint={
            summary.unitsInOrders > 0
              ? t('inOpenOrders', { count: f.count(summary.unitsInOrders) })
              : t('noneInOrders')
          }
        />
        <MetricCard
          label={te('stockState.low')}
          value={f.count(count.low_stock)}
          tone={count.low_stock > 0 ? 'warning' : 'default'}
          hint={t('lowHint', { count: LOW_STOCK })}
        />
        <MetricCard
          label={te('stockState.out')}
          value={f.count(count.out_of_stock)}
          tone={count.out_of_stock > 0 ? 'destructive' : 'default'}
          hint={t('outHint')}
        />
      </MetricGrid>

      <FilterBar
        search={{ param: 'search', placeholder: t('search') }}
        filters={[
          {
            kind: 'segments',
            param: 'stock',
            label: t('stockLevel'),
            all: { value: '', label: tc('all'), count: summary.products },
            options: STOCK_LEVELS.map((s) => ({
              value: s.value,
              label: te(`stockState.${s.state}`),
              count: count[s.value],
            })),
          },
          {
            kind: 'select',
            param: 'category',
            all: t('allCategories'),
            options: CATEGORIES.map((c) => ({ value: c, label: te(`category.${c}`) })),
          },
          {
            kind: 'select',
            param: 'channel',
            all: t('anyChannel'),
            options: CHANNELS.map((c) => ({ value: c, label: te(`channel.${c}`) })),
          },
        ]}
      />

      <TablePanel
        minWidth="62rem"
        footer={
          <TablePagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            count={products.length}
            noun="products"
            href={pageHref}
          />
        }
      >
        {products.length === 0 ? (
          <TableEmpty
            icon={Package}
            title={filterQuery.size ? t('noMatch') : t('none')}
            description={filterQuery.size ? t('noMatchHint') : t('noneHint')}
            action={
              filterQuery.size ? (
                <Button variant="outline" asChild>
                  <Link href="/inventory">{tf('resetFilters')}</Link>
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/inventory/new">
                    <Plus />
                    {t('add')}
                  </Link>
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.product')}</TableHead>
                <TableHead className="w-[120px]">{t('columns.stock')}</TableHead>
                <TableHead className="w-[84px] text-end">{t('columns.onHand')}</TableHead>
                <TableHead className="w-[84px] text-end">{t('columns.inOrders')}</TableHead>
                <TableHead className="w-[110px] text-end">{t('columns.unitCost')}</TableHead>
                <TableHead className="w-[130px] text-end">{t('columns.stockValue')}</TableHead>
                <TableHead className="w-[210px] ps-6">{t('columns.channels')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => {
                const state = stockState(p.onHand);
                const Icon = categoryIcon(p.category);
                return (
                  <TableRow key={p.id} className="relative">
                    <TableCell className="h-14 max-w-0">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          aria-hidden
                          className="flex size-9 shrink-0 items-center justify-center bg-muted text-muted-foreground"
                        >
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/inventory/${p.id}`}
                            className="block truncate font-medium after:absolute after:inset-0 hover:underline focus-visible:underline focus-visible:outline-none"
                            title={p.name}
                          >
                            <bdi>{p.name}</bdi>
                          </Link>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {categoryName(p.category)}
                            {p.variantCount > 1 ? (
                              <>
                                {' · '}
                                {tn('variants', { count: p.variantCount })}
                              </>
                            ) : null}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ToneBadge tone={state.tone}>{te(`stockState.${state.key}`)}</ToneBadge>
                    </TableCell>
                    <TableCell
                      className={cn('num text-end font-medium', p.onHand < 0 && 'text-destructive')}
                    >
                      {f.count(p.onHand)}
                    </TableCell>
                    <TableCell className="num text-end text-muted-foreground">
                      {p.inOrders > 0 ? f.count(p.inOrders) : '—'}
                    </TableCell>
                    <TableCell className="text-end">
                      {p.unitCost ? (
                        <Amount value={p.unitCost} />
                      ) : (
                        <span className="text-xs text-warning">{tc('notSet')}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-end">
                      {p.unitCost && p.onHand > 0 ? (
                        <Amount value={p.onHand * Number(p.unitCost)} className="font-medium" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="ps-6">
                      {p.channels.length ? (
                        <div className="flex flex-wrap gap-1">
                          {p.channels.map((c) => (
                            <ChannelBadge key={c} channel={c} />
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </TablePanel>
    </Page>
  );
}
