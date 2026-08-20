import { NoDataYet } from '@/components/empty-state';
import { PageBody, PageHeader } from '@/components/page-header';
import { ProductsToolbar } from '@/components/products-toolbar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getDataRange, getPeriods, getProducts } from '@/lib/api';
import { date, money, moneyWhole } from '@/lib/format';
import { requireAdmin } from '@/lib/session';

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { period, q, returns, cost } = await searchParams;

  const [dataRange, periods] = await Promise.all([getDataRange(), getPeriods()]);
  if (!dataRange) {
    return (
      <>
        <PageHeader title="Products" description="Performance by product" />
        <PageBody>
          <NoDataYet />
        </PageBody>
      </>
    );
  }

  // The month chip picks a narrower range; otherwise every period we hold.
  const selected = periods.find((p) => p.month === period);
  const range = selected ? { from: selected.from, to: selected.to } : dataRange;

  let products = await getProducts(range.from, range.to);

  // Filtering happens once here rather than in the browser: the result set is
  // a few hundred rows at most, so a second round trip per keystroke would be
  // pure overhead for no benefit.
  if (q) {
    const term = q.toLowerCase();
    products = products.filter((p) => p.name.toLowerCase().includes(term));
  }
  if (returns === '1') {
    products = products.filter((p) => p.unitsReturned > 0);
  }
  if (cost === 'missing') {
    products = products.filter((p) => p.unitCost === null);
  }

  const units = products.reduce((n, p) => n + p.unitsSold, 0);
  // Every product starts as a stub, so flagging all of them says nothing.
  // The badge only earns its place once some have been enriched.
  const stubs = products.filter((p) => p.discovered).length;
  const markStubs = stubs > 0 && stubs < products.length;
  const filtered = Boolean(period || q || returns || cost);

  return (
    <>
      <PageHeader
        title="Products"
        description={`${products.length} ${products.length === 1 ? 'product' : 'products'} · ${units} units · ${date(range.from)} – ${date(range.to)}`}
      />
      <PageBody>
        <ProductsToolbar periods={periods} />

        {products.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-5 py-14 text-center text-sm text-muted-foreground">
            {filtered ? 'No products match these filters.' : 'No products yet.'}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[38%] min-w-[240px]">Product</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Returned</TableHead>
                  <TableHead className="text-right">Proceeds</TableHead>
                  <TableHead className="text-right">Fees</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => {
                  const fees =
                    Number(p.referralFee) + Number(p.fulfilmentFee) + Number(p.otherFees);
                  return (
                    <TableRow key={p.productId}>
                      <TableCell className="max-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium" title={p.name}>
                            {p.name}
                          </span>
                          {markStubs && p.discovered && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                                  Stub
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                Created automatically from an import. Add a cost and
                                category to complete it.
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p.unitsSold}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.unitsReturned > 0 ? (
                          <span className="text-warning">{p.unitsReturned}</span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {moneyWhole(p.netProceeds)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {moneyWhole(fees)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {moneyWhole(p.net)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.grossProfit === null ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default text-muted-foreground/40">—</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              No cost recorded, so profit cannot be calculated.
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          money(p.grossProfit)
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </PageBody>
    </>
  );
}
