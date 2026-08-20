import { NoDataYet } from '@/components/empty-state';
import { PageBody, PageHeader } from '@/components/page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getDataRange, getProducts } from '@/lib/api';
import { date, money, moneyWhole } from '@/lib/format';

export default async function ProductsPage() {
  const range = await getDataRange();
  if (!range) {
    return (
      <>
        <PageHeader title="Products" description="Performance by product" />
        <PageBody>
          <NoDataYet />
        </PageBody>
      </>
    );
  }

  const products = await getProducts(range.from, range.to);
  const units = products.reduce((n, p) => n + p.unitsSold, 0);
  // Every product starts as a stub, so flagging all of them says nothing.
  // The badge only earns its place once some have been enriched.
  const stubs = products.filter((p) => p.discovered).length;
  const markStubs = stubs > 0 && stubs < products.length;

  return (
    <>
      <PageHeader
        title="Products"
        description={`${products.length} products · ${units} units · ${date(range.from)} – ${date(range.to)}`}
      />
      <PageBody>
        {/* 84 products today, bounded by catalogue size rather than by history,
            so the full list is rendered. Paginate if this passes a few hundred. */}
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
      </PageBody>
    </>
  );
}
