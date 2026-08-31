import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { InventoryToolbar } from '@/components/inventory-toolbar';
import { ChannelBadge } from '@/components/order-status';
import { PageBody } from '@/components/page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { categoryLabel } from '@/lib/categories';
import { getProductsCatalog, getProductsSummary } from '@/lib/api';
import { money, moneyWhole } from '@/lib/format';
import { requireAdmin } from '@/lib/session';

const PAGE_SIZE = 50;

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

  const offset = Math.max(Number(params.offset) || 0, 0);
  const listQuery = new URLSearchParams(filterQuery);
  listQuery.set('limit', String(PAGE_SIZE));
  listQuery.set('offset', String(offset));

  const [products, summary] = await Promise.all([
    getProductsCatalog(listQuery.toString()),
    getProductsSummary(filterQuery.toString()),
  ]);

  const total = products[0]?.totalCount ?? summary.products;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const pageHref = (o: number) => {
    const q = new URLSearchParams(filterQuery);
    if (o > 0) q.set('offset', String(o));
    const qs = q.toString();
    return qs ? `/inventory?${qs}` : '/inventory';
  };

  return (
    <>
      {/* A slimmer header than PageHeader: this screen's job is the table
          underneath it, not a hero. */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4 lg:px-10">
        <h1 className="text-lg font-semibold tracking-[-0.01em]">Inventory</h1>
        <p className="text-xs text-muted-foreground">
          {summary.products} products{Number.isFinite(offset) ? ` · page ${page} of ${pageCount}` : ''}
        </p>
      </div>

      <PageBody>
        <section className="-mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
          <MiniStat label="Products" value={String(summary.products)} />
          <MiniStat label="Units on hand" value={String(summary.unitsOnHand)} />
          <MiniStat label="Stock value" value={moneyWhole(summary.stockValue)} />
          <MiniStat
            label="Missing cost"
            value={String(summary.missingCost)}
            warn={summary.missingCost > 0}
          />
        </section>

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
                    <TableHead className="w-[36%] min-w-[220px]">Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Channels</TableHead>
                    <TableHead className="text-right">On hand</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.id} className="group relative">
                      <TableCell className="max-w-0">
                        <Link
                          href={`/inventory/${p.id}`}
                          className="block truncate font-medium after:absolute after:inset-0 focus-visible:underline focus-visible:outline-none"
                          title={p.name}
                        >
                          {p.name}
                        </Link>
                        {p.variantCount > 1 && (
                          <span className="text-xs text-muted-foreground">
                            {p.variantCount} variants
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {categoryLabel(p.category)}
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
                      <TableCell className="text-right">
                        <ChevronRight className="size-4 text-muted-foreground/40 transition-colors group-hover:text-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {pageCount > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex items-center gap-1.5">
                <PageLink href={pageHref(Math.max(offset - PAGE_SIZE, 0))} disabled={offset === 0}>
                  <ChevronLeft className="size-3.5" />
                  Prev
                </PageLink>
                <PageLink
                  href={pageHref(offset + PAGE_SIZE)}
                  disabled={offset + PAGE_SIZE >= total}
                >
                  Next
                  <ChevronRight className="size-3.5" />
                </PageLink>
              </div>
            </div>
          )}
        </section>
      </PageBody>
    </>
  );
}

function MiniStat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="bg-background px-4 py-3">
      <p className="text-[10.5px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${warn ? 'text-warning' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="inline-flex h-8 cursor-not-allowed items-center gap-1 rounded-md border border-border px-2.5 text-xs text-muted-foreground/40">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {children}
    </Link>
  );
}
