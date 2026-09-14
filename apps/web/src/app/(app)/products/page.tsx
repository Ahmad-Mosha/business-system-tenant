import { ArrowDown, ArrowUp, ArrowUpDown, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { NoDataYet } from '@/components/empty-state';
import { FilterBar } from '@/components/filter-bar';
import { Page, PageHeader } from '@/components/page';
import { TableCount, TableEmpty, TablePanel } from '@/components/table-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getDataRange, getPeriods, getProducts, type ProductPerformance } from '@/lib/api';
import { money, moneyWhole, monthLabel } from '@/lib/format';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';

const fees = (p: ProductPerformance) =>
  Number(p.referralFee) + Number(p.fulfilmentFee) + Number(p.otherFees);

/** Sortable columns. The API returns best-first by net; these re-order that. */
const SORTS: Record<string, (p: ProductPerformance) => number> = {
  units: (p) => p.unitsSold,
  returned: (p) => p.unitsReturned,
  proceeds: (p) => Number(p.netProceeds),
  fees: (p) => fees(p),
  net: (p) => Number(p.net),
  profit: (p) => (p.grossProfit === null ? -Infinity : Number(p.grossProfit)),
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const { period, q, returns, cost } = params;
  const sort = params.sort && SORTS[params.sort] ? params.sort : null;
  const asc = params.dir === 'asc';

  const [dataRange, periods] = await Promise.all([getDataRange(), getPeriods()]);
  if (!dataRange) {
    return (
      <Page>
        <PageHeader title="Products" description="How each product did on noon." />
        <NoDataYet />
      </Page>
    );
  }

  const selected = periods.find((p) => p.month === period);
  const range = selected ? { from: selected.from, to: selected.to } : dataRange;
  let products = await getProducts(range.from, range.to);

  // Filtering and sorting happen here rather than in the browser: a few
  // hundred rows at most, so a round trip per keystroke would be pure overhead.
  if (q) {
    const term = q.toLowerCase();
    products = products.filter((p) => p.name.toLowerCase().includes(term));
  }
  if (returns === '1') products = products.filter((p) => p.unitsReturned > 0);
  if (cost === 'missing') products = products.filter((p) => p.unitCost === null);
  if (sort) {
    const key = SORTS[sort];
    products = [...products].sort((a, b) => (asc ? key(a) - key(b) : key(b) - key(a)));
  }

  // Every product starts as a stub, so flagging all of them says nothing —
  // the badge only earns its place once some have been enriched.
  const stubs = products.filter((p) => p.discovered).length;
  const markStubs = stubs > 0 && stubs < products.length;
  const filtered = Boolean(period || q || returns || cost);

  /** A header link that sorts by this column: desc first, then asc, then off. */
  const sortHref = (key: string) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== 'sort' && k !== 'dir') next.set(k, v);
    if (sort !== key) next.set('sort', key);
    else if (!asc) {
      next.set('sort', key);
      next.set('dir', 'asc');
    }
    const qs = next.toString();
    return qs ? `/products?${qs}` : '/products';
  };
  const sortHead = (k: string, label: string) => {
    const Icon = sort !== k ? ArrowUpDown : asc ? ArrowUp : ArrowDown;
    return (
      <TableHead key={k} className="text-end">
        <Link
          href={sortHref(k)}
          scroll={false}
          className={cn(
            'inline-flex items-center gap-1 hover:text-foreground',
            sort === k && 'text-foreground',
          )}
        >
          {label}
          <Icon className={cn('size-3', sort !== k && 'opacity-40')} />
        </Link>
      </TableHead>
    );
  };

  return (
    <Page fill>
      <PageHeader
        title="Products"
        description={
          selected
            ? `How each product did on noon in ${monthLabel(selected.month)}.`
            : 'How each product did on noon — units, proceeds, fees, and profit where cost is known.'
        }
      />

      <FilterBar
        search={{ param: 'q', placeholder: 'Search products…' }}
        filters={[
          {
            kind: 'select',
            param: 'period',
            all: 'All time',
            options: periods.map((p) => ({ value: p.month, label: monthLabel(p.month) })),
          },
          { kind: 'toggle', param: 'returns', value: '1', label: 'Has returns' },
          { kind: 'toggle', param: 'cost', value: 'missing', label: 'Missing cost' },
        ]}
      />

      <TablePanel
        minWidth="56rem"
        footer={
          <TableCount>
            <span className="num font-medium text-foreground">{products.length}</span>{' '}
            {products.length === 1 ? 'product' : 'products'}
          </TableCount>
        }
      >
        {products.length === 0 ? (
          <TableEmpty
            icon={BarChart3}
            title={filtered ? 'No products match these filters' : 'No products yet'}
            description={
              filtered
                ? undefined
                : 'A noon sale lands on a product once its SKU is linked — open the product in Inventory and add its noon Partner SKU.'
            }
            action={
              filtered ? (
                <Button variant="outline" asChild>
                  <Link href="/products">Reset filters</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[38%] min-w-[240px]">Product</TableHead>
                {sortHead('units', 'Units')}
                {sortHead('returned', 'Returned')}
                {sortHead('proceeds', 'Proceeds')}
                {sortHead('fees', 'Fees')}
                {sortHead('net', 'Net')}
                {sortHead('profit', 'Profit')}
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.productId}>
                  <TableCell className="max-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium" title={p.name}>
                        <bdi>{p.name}</bdi>
                      </span>
                      {markStubs && p.discovered ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="shrink-0">
                              Stub
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            Created automatically from an import. Add a cost and category to complete it.
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="num text-end">{p.unitsSold}</TableCell>
                  <TableCell className="num text-end">
                    {p.unitsReturned > 0 ? (
                      <span className="text-warning">{p.unitsReturned}</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className="num text-end">{moneyWhole(p.netProceeds)}</TableCell>
                  <TableCell className="num text-end text-muted-foreground">{moneyWhole(fees(p))}</TableCell>
                  <TableCell className="num text-end font-medium">{moneyWhole(p.net)}</TableCell>
                  <TableCell className="num text-end">
                    {p.grossProfit === null ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-default text-muted-foreground/50">—</span>
                        </TooltipTrigger>
                        <TooltipContent>No cost recorded, so profit can’t be calculated.</TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className={cn(Number(p.grossProfit) < 0 && 'text-destructive')}>
                        {money(p.grossProfit)}
                      </span>
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
