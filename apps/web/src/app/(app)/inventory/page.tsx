import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { InventoryToolbar } from '@/components/inventory-toolbar';
import { ChannelBadge } from '@/components/order-status';
import { PageBody, PageHeader } from '@/components/page-header';
import { Stat, StatCell, StatGrid } from '@/components/stat';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getProductsCatalog } from '@/lib/api';
import { money } from '@/lib/format';
import { requireAdmin } from '@/lib/session';

const CHANNEL_LABELS: Record<string, string> = {
  noon: 'noon',
  easyorders: 'Website',
  amazon: 'Amazon',
  social: 'Social',
};

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.channel) query.set('channel', params.channel);
  if (params.category) query.set('category', params.category);
  if (params.stock) query.set('stock', params.stock);

  const products = await getProductsCatalog(query.toString());

  const withStock = products.filter((p) => p.onHand > 0).length;
  const withoutCost = products.filter((p) => !p.unitCost).length;
  const stockValue = products.reduce(
    (n, p) => n + (p.unitCost ? Number(p.unitCost) * p.onHand : 0),
    0,
  );

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Every product Prime Market sells, and what links it to each channel"
      />

      <PageBody>
        <StatGrid>
          <StatCell>
            <Stat label="Products" value={String(products.length)} hint={`${withStock} with stock`} />
          </StatCell>
          <StatCell>
            <Stat
              label="Units on hand"
              value={String(products.reduce((n, p) => n + p.onHand, 0))}
              hint="from recorded movements"
            />
          </StatCell>
          <StatCell>
            <Stat
              label="Stock value"
              value={money(stockValue)}
              hint="at current unit cost"
            />
          </StatCell>
          <StatCell>
            <Stat
              label="Missing cost"
              value={String(withoutCost)}
              hint="profit cannot be calculated"
            />
          </StatCell>
        </StatGrid>

        <section>
          <InventoryToolbar />

          {products.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-5 py-14 text-center text-sm text-muted-foreground">
              No products match.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[34%] min-w-[220px]">Product</TableHead>
                    <TableHead>Channels</TableHead>
                    <TableHead className="text-right">On hand</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => {
                    const margin =
                      p.unitCost && p.sellingPrice
                        ? Number(p.sellingPrice) - Number(p.unitCost)
                        : null;
                    return (
                      <TableRow key={p.id} className="group relative">
                        <TableCell className="max-w-0">
                          <Link
                            href={`/inventory/${p.id}`}
                            className="block truncate font-medium after:absolute after:inset-0 focus-visible:underline focus-visible:outline-none"
                            title={p.name}
                          >
                            {p.name}
                          </Link>
                          <span className="text-xs text-muted-foreground">
                            {p.category ?? 'Uncategorised'}
                            {p.variantCount > 1 ? ` · ${p.variantCount} variants` : ''}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="flex flex-wrap gap-1.5">
                            {p.channels.length === 0 ? (
                              <span className="text-xs text-muted-foreground/50">None</span>
                            ) : (
                              p.channels.map((c) => <ChannelBadge key={c} channel={c} />)
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {p.onHand === 0 ? (
                            <span className="text-muted-foreground/40">0</span>
                          ) : (
                            p.onHand
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {p.unitCost ? money(p.unitCost) : <span className="text-muted-foreground/40">—</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.sellingPrice ? money(p.sellingPrice) : <span className="text-muted-foreground/40">—</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {margin === null ? (
                            <span className="text-muted-foreground/40">—</span>
                          ) : (
                            money(margin)
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <ChevronRight className="size-4 text-muted-foreground/40 transition-colors group-hover:text-foreground" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Stock value uses each product&rsquo;s current unit cost. How cost is
            carried over time — average, FIFO, or something else — is still an
            open business decision, so treat this as indicative.
          </p>
        </section>
      </PageBody>
    </>
  );
}
