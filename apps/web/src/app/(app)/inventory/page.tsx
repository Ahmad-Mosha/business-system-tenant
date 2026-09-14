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
import { CATEGORIES, categoryIcon, categoryLabel } from '@/lib/categories';
import { requireAdmin } from '@/lib/session';
import { LOW_STOCK, stockState } from '@/lib/stock';
import { cn } from '@/lib/utils';
import { getFormat } from '@/i18n/get-format';

const PAGE_SIZE = 20;

const STOCK_LEVELS = [
  { value: 'in_stock', label: 'In stock' },
  { value: 'low_stock', label: 'Low stock' },
  { value: 'out_of_stock', label: 'Out of stock' },
] as const;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const f = await getFormat();
  await requireAdmin();
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
        title="Inventory"
        description="What you have, what it's worth, and what needs restocking."
        actions={
          <>
            <SyncWebsiteButton />
            <Button asChild>
              <Link href="/inventory/new">
                <Plus />
                Add product
              </Link>
            </Button>
          </>
        }
      />

      <MetricGrid>
        <MetricCard
          label="Stock value"
          value={<Amount value={summary.stockValue} />}
          tone={summary.missingCost > 0 ? 'warning' : 'default'}
          hint={
            summary.missingCost > 0
              ? `${summary.missingCost} ${summary.missingCost === 1 ? 'product has' : 'products have'} no cost yet`
              : 'EGP, at unit cost'
          }
        />
        <MetricCard
          label="Units on hand"
          value={f.count(summary.unitsOnHand)}
          hint={
            summary.unitsInOrders > 0
              ? `Plus ${f.count(summary.unitsInOrders)} in open orders`
              : 'None waiting in open orders'
          }
        />
        <MetricCard
          label="Low stock"
          value={f.count(count.low_stock)}
          tone={count.low_stock > 0 ? 'warning' : 'default'}
          hint={`${LOW_STOCK} or fewer left`}
        />
        <MetricCard
          label="Out of stock"
          value={f.count(count.out_of_stock)}
          tone={count.out_of_stock > 0 ? 'destructive' : 'default'}
          hint="Nothing left to sell"
        />
      </MetricGrid>

      <FilterBar
        search={{ param: 'search', placeholder: 'Search products…' }}
        filters={[
          {
            kind: 'segments',
            param: 'stock',
            label: 'Stock level',
            all: { value: '', label: 'All', count: summary.products },
            options: STOCK_LEVELS.map((s) => ({ ...s, count: count[s.value] })),
          },
          { kind: 'select', param: 'category', all: 'All categories', options: [...CATEGORIES] },
          {
            kind: 'select',
            param: 'channel',
            all: 'Any channel',
            options: [
              { value: 'noon', label: 'noon' },
              { value: 'easyorders', label: 'Website' },
              { value: 'amazon', label: 'Amazon' },
              { value: 'social', label: 'Social' },
              { value: 'unlisted', label: 'Not on any channel' },
            ],
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
            title={filterQuery.size ? 'No products match' : 'No products yet'}
            description={
              filterQuery.size
                ? 'Try another filter, or clear the search.'
                : 'Add the first product, with its cost and opening stock.'
            }
            action={
              filterQuery.size ? (
                <Button variant="outline" asChild>
                  <Link href="/inventory">Reset filters</Link>
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/inventory/new">
                    <Plus />
                    Add product
                  </Link>
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="w-[120px]">Stock</TableHead>
                <TableHead className="w-[84px] text-end">On hand</TableHead>
                <TableHead className="w-[84px] text-end">In orders</TableHead>
                <TableHead className="w-[110px] text-end">Unit cost</TableHead>
                <TableHead className="w-[130px] text-end">Stock value</TableHead>
                <TableHead className="w-[210px] ps-6">Channels</TableHead>
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
                            {categoryLabel(p.category)}
                            {p.variantCount > 1 ? (
                              <>
                                {' · '}
                                <span className="num">{p.variantCount}</span> variants
                              </>
                            ) : null}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ToneBadge tone={state.tone}>{state.label}</ToneBadge>
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
                        <span className="text-xs text-warning">Not set</span>
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
