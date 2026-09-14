import { Package, Plus } from 'lucide-react';
import Link from 'next/link';
import { Amount } from '@/components/amount';
import { FilterBar } from '@/components/filter-bar';
import { MetricCard, MetricGrid } from '@/components/metric-card';
import { ChannelBadge } from '@/components/order-status';
import { Page, PageHeader } from '@/components/page';
import { SyncWebsiteButton } from '@/components/sync-website-button';
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
import { getProductsCatalog, getProductsSummary } from '@/lib/api';
import { CATEGORIES, categoryLabel } from '@/lib/categories';
import { money } from '@/lib/format';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;
/** Mirrors the API's `low_stock` filter. */
const LOW_STOCK = 5;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const filterQuery = new URLSearchParams();
  for (const key of ['search', 'channel', 'category', 'stock'] as const) {
    if (params[key]) filterQuery.set(key, params[key]);
  }

  const page = Math.max(Number(params.page) || 1, 1);
  const listQuery = new URLSearchParams(filterQuery);
  listQuery.set('limit', String(PAGE_SIZE));
  listQuery.set('offset', String((page - 1) * PAGE_SIZE));

  const [products, summary] = await Promise.all([
    getProductsCatalog(listQuery.toString()),
    getProductsSummary(filterQuery.toString()),
  ]);

  const total = products[0]?.totalCount ?? summary.products;
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
        description="Every product, its stock, and what's tied up in open orders."
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
        <MetricCard label="Products" value={summary.products} hint="In the active catalogue" />
        <MetricCard label="Units on hand" value={summary.unitsOnHand} hint="Across every product" />
        <MetricCard
          label="Stock value"
          value={<Amount value={summary.stockValue} />}
          hint="EGP, at unit cost"
        />
        <MetricCard
          label="Missing cost"
          value={summary.missingCost}
          tone={summary.missingCost > 0 ? 'warning' : 'default'}
          hint={summary.missingCost > 0 ? 'Stock value is understated' : 'Every product is costed'}
        />
        <MetricCard label="Units in orders" value={summary.unitsInOrders} hint="Not yet delivered" />
      </MetricGrid>

      <FilterBar
        search={{ param: 'search', placeholder: 'Search products or SKUs…' }}
        filters={[
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
          {
            kind: 'select',
            param: 'stock',
            all: 'Any stock level',
            options: [
              { value: 'in_stock', label: 'In stock' },
              { value: 'low_stock', label: `Low stock (≤${LOW_STOCK})` },
              { value: 'out_of_stock', label: 'Out of stock' },
            ],
          },
        ]}
      />

      <TablePanel
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
                <TableHead className="w-[130px]">Category</TableHead>
                <TableHead className="w-[200px]">Channels</TableHead>
                <TableHead className="w-[100px] text-right">On hand</TableHead>
                <TableHead className="w-[100px] text-right">In orders</TableHead>
                <TableHead className="w-[120px] text-right">Unit cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id} className="relative">
                  <TableCell className="max-w-0">
                    <Link
                      href={`/inventory/${p.id}`}
                      className="block truncate font-medium after:absolute after:inset-0 hover:underline focus-visible:underline focus-visible:outline-none"
                      title={p.name}
                    >
                      <bdi>{p.name}</bdi>
                    </Link>
                    {p.variantCount > 1 ? (
                      <span className="num text-xs text-muted-foreground">{p.variantCount} variants</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{categoryLabel(p.category)}</TableCell>
                  <TableCell>
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
                  <TableCell
                    className={cn(
                      'num text-right font-medium',
                      p.onHand <= 0 ? 'text-destructive' : p.onHand <= LOW_STOCK && 'text-warning',
                    )}
                  >
                    {p.onHand}
                  </TableCell>
                  <TableCell className="num text-right text-muted-foreground">
                    {p.inOrders > 0 ? p.inOrders : '—'}
                  </TableCell>
                  <TableCell className="num text-right">
                    {p.unitCost ? (
                      money(p.unitCost)
                    ) : (
                      <span className="text-xs text-warning">Not set</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TablePanel>
    </Page>
  );
}
