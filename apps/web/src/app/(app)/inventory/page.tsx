import Link from 'next/link';
import { InventoryToolbar } from '@/components/inventory-toolbar';
import {
  MetricCard,
  MetricRow,
  PageCard,
  Pagination,
  Panel,
  Screen,
  Scroller,
} from '@/components/shell';
import { categoryLabel } from '@/lib/categories';
import { getProductsCatalog, getProductsSummary } from '@/lib/api';
import { money, moneyWhole } from '@/lib/format';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';

/** Fits a laptop screen without scrolling — the point of paginating at all. */
const PAGE_SIZE = 8;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const filterQuery = new URLSearchParams();
  if (params.search) filterQuery.set('search', params.search);
  if (params.channel) filterQuery.set('channel', params.channel);
  if (params.category) filterQuery.set('category', params.category);
  if (params.stock) filterQuery.set('stock', params.stock);

  const page = Math.max(Number(params.page) || 1, 1);
  const offset = (page - 1) * PAGE_SIZE;

  const listQuery = new URLSearchParams(filterQuery);
  listQuery.set('limit', String(PAGE_SIZE));
  listQuery.set('offset', String(offset));

  const [products, summary] = await Promise.all([
    getProductsCatalog(listQuery.toString()),
    getProductsSummary(filterQuery.toString()),
  ]);

  const total = products[0]?.totalCount ?? summary.products;
  const lastPage = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const pageHref = (p: number) => {
    const next = new URLSearchParams(filterQuery);
    if (p > 1) next.set('page', String(p));
    const qs = next.toString();
    return qs ? `/inventory?${qs}` : '/inventory';
  };

  return (
    <Screen>
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <PageCard title="Inventory" description="Every product, its stock, and what's tied up in open orders." />

        <MetricRow>
          <MetricCard label="Products" value={summary.products} hint="active catalogue" />
          <MetricCard label="Units on hand" value={summary.unitsOnHand} />
          <MetricCard label="Stock value" value={moneyWhole(summary.stockValue)} hint="EGP, at unit cost" />
          <MetricCard
            label="Missing cost"
            value={summary.missingCost}
            tone={summary.missingCost > 0 ? 'warning' : 'default'}
            hint={summary.missingCost > 0 ? 'stock value understated' : 'all costed'}
          />
        </MetricRow>

        <InventoryToolbar />

        <Panel>
          <Scroller>
            {products.length === 0 ? (
              <p className="p-12 text-center text-sm text-muted-foreground">No products match.</p>
            ) : (
              <table className="w-full border-collapse text-[13px]">
                <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
                  <tr className="border-b border-border text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
                    <Th>Product</Th>
                    <Th className="w-[140px]">Category</Th>
                    <Th className="w-[100px] text-right">On hand</Th>
                    <Th className="w-[100px] text-right">In orders</Th>
                    <Th className="w-[110px] text-right">Cost</Th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="group relative h-11 border-b border-border/60 last:border-b-0 hover:bg-accent/50">
                      <Td className="max-w-0">
                        <Link
                          href={`/inventory/${p.id}`}
                          className="block truncate font-medium after:absolute after:inset-0 focus-visible:underline focus-visible:outline-none"
                          title={p.name}
                        >
                          {p.name}
                        </Link>
                        {p.variantCount > 1 && (
                          <span className="text-[11px] text-muted-foreground">{p.variantCount} variants</span>
                        )}
                      </Td>
                      <Td className="text-muted-foreground">{categoryLabel(p.category)}</Td>
                      <Td className="text-right font-medium tabular-nums">
                        {p.onHand === 0 ? <span className="text-muted-foreground/40">0</span> : p.onHand}
                      </Td>
                      <Td className="text-right tabular-nums text-muted-foreground">
                        {p.inOrders > 0 ? p.inOrders : <span className="text-muted-foreground/40">—</span>}
                      </Td>
                      <Td className="text-right tabular-nums text-muted-foreground">
                        {p.unitCost ? money(p.unitCost) : <span className="text-warning/70">—</span>}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Scroller>

          <Pagination
            from={total === 0 ? 0 : offset + 1}
            to={offset + products.length}
            total={total}
            noun="products"
            prevHref={page > 1 ? pageHref(page - 1) : null}
            nextHref={page < lastPage ? pageHref(page + 1) : null}
          />
        </Panel>
      </div>
    </Screen>
  );
}

function Th({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <th className={cn('px-4 py-2.5 text-left font-medium whitespace-nowrap', className)}>{children}</th>;
}

function Td({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <td className={cn('px-4 whitespace-nowrap', className)}>{children}</td>;
}
