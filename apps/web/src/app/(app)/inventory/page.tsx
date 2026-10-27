import { Archive, Boxes, CircleHelp, Package, PackageCheck, PackageX, Plus, TriangleAlert, Warehouse } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Amount } from '@/components/display/amount';
import { FilterBar } from '@/components/layout/filter-bar';
import { ListTitle, QuickViews, SummaryMetric, SummaryStrip } from '@/components/layout/list-page';
import { Page, PageHeader } from '@/components/layout/page';
import { SyncWebsiteButton } from '@/components/inventory/sync-website-button';
import { TableEmpty, TablePagination, TablePanel } from '@/components/layout/table-panel';
import { ToneBadge } from '@/components/display/tone-badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getFormat } from '@/i18n/get-format';
import { getProductsCatalog, getProductsSummary, type ProductRow } from '@/lib/api';
import { CATEGORIES, categoryIcon } from '@/lib/categories';
import { unitMoney } from '@/lib/format';
import { requireAdmin } from '@/lib/session';
import { LOW_STOCK, stockState } from '@/lib/stock';
import { cn, isOneOf } from '@/lib/utils';
import { InventoryViews } from './inventory-views';
import styles from './inventory.module.css';

const PAGE_SIZE = 20;
const STOCK_LEVELS = [
  { value: 'in_stock', state: 'in' },
  { value: 'low_stock', state: 'low' },
  { value: 'out_of_stock', state: 'out' },
] as const;
const CHANNELS = ['noon', 'easyorders', 'amazon', 'social', 'unlisted'] as const;

function HelpLabel({ label, help }: { label: string; help: string }) {
  return (
    <Tooltip>
      <TooltipTrigger className="inline-flex min-h-8 items-center gap-1.5 rounded-sm text-start focus-visible:outline-2 focus-visible:outline-ring">
        {label}<CircleHelp className="size-3.5" aria-hidden />
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-start leading-relaxed">{help}</TooltipContent>
    </Tooltip>
  );
}

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
  const archived = params.status === 'archived';
  const scope = new URLSearchParams();
  for (const key of ['search', 'channel', 'category', 'status'] as const) {
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
  const lastPage = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  if (page > lastPage) redirect(pageHref(lastPage));

  const stockHref = (level?: string) => {
    const query = level ? withStock(level) : scope.toString();
    return query ? `/inventory?${query}` : '/inventory';
  };
  const clearHref = archived ? '/inventory?status=archived' : '/inventory';
  const hasFilters = Boolean(stock || params.search || params.channel || params.category);
  const pagination = (
    <TablePagination page={page} pageSize={PAGE_SIZE} total={total} count={products.length} noun="products" href={pageHref} />
  );

  function ProductIdentity({ product: p }: { product: ProductRow }) {
    const Icon = categoryIcon(p.category);
    return (
      <div className={styles.product}>
        <span aria-hidden className={styles.productIcon}><Icon /></span>
        <Link href={`/inventory/${p.id}`} className={styles.productLink}>
          <span className={styles.productName} title={p.name}><bdi>{p.name}</bdi></span>
          <p className={styles.productMeta}>
            {[
              categoryName(p.category),
              p.variantCount > 1 ? tn('variants', { count: p.variantCount }) : null,
              ...p.channels.map((c) => isOneOf(CHANNELS, c) ? te(`channel.${c}`) : c),
            ].filter(Boolean).join(' · ')}
          </p>
        </Link>
      </div>
    );
  }

  function Availability({ product: p }: { product: ProductRow }) {
    const state = stockState(p.onHand);
    return (
      <div className={styles.availability}>
        <span className={cn('num', styles.availableValue, p.onHand < 0 && 'text-destructive')}>{f.count(p.onHand)}</span>
        <ToneBadge tone={state.tone} className={styles.stockBadge}>{te(`stockState.${state.key}`)}</ToneBadge>
      </div>
    );
  }

  function PurchaseValue({ product: p, field }: { product: ProductRow; field: 'lastPurchase' | 'avgPurchase' | 'unitCost' | 'stockValue' }) {
    if (field === 'stockValue') {
      return p.unitCost && p.onHand > 0 ? <Amount value={p.stockValue} className="font-medium" /> : <span className="text-muted-foreground">—</span>;
    }
    if (p.variantCount > 1) return <span className="text-xs text-muted-foreground">{t('varies')}</span>;
    if (field === 'lastPurchase') {
      return p.lastPurchasePrice ? (
        <div>
          <p className="num font-medium">{unitMoney(p.lastPurchasePrice)}</p>
          {p.lastPurchaseDate ? <p className={styles.costContext}>{f.date(p.lastPurchaseDate)}</p> : null}
          {p.lastPurchaseSupplier ? <p className={cn(styles.costContext, 'max-w-48 truncate')} title={t('boughtFrom', { supplier: p.lastPurchaseSupplier })}>{t('boughtFrom', { supplier: p.lastPurchaseSupplier })}</p> : null}
        </div>
      ) : <span className="text-muted-foreground" title={t('noPurchases')}>—</span>;
    }
    if (field === 'avgPurchase') {
      return p.avgPurchasePrice ? (
        <div>
          <p className="num font-medium">{unitMoney(p.avgPurchasePrice)}</p>
          <p className={styles.costContext}>{t('purchaseBasis', { units: f.count(p.purchasedUnits ?? 0), invoices: f.count(p.purchaseInvoices ?? 0) })}</p>
        </div>
      ) : <span className="text-muted-foreground" title={t('noPurchases')}>—</span>;
    }
    return p.unitCost ? <span className="num font-medium">{unitMoney(p.unitCost)}</span> : <span className="text-xs text-warning">{tc('notSet')}</span>;
  }

  const empty = (
    <TableEmpty
      icon={Package}
      title={hasFilters ? t('noMatch') : t('none')}
      description={hasFilters ? t('noMatchHint') : t('noneHint')}
      action={hasFilters || archived ? (
        <Button variant="outline" asChild><Link href={clearHref}>{tf('resetFilters')}</Link></Button>
      ) : (
        <Button asChild><Link href="/inventory/new"><Plus />{t('add')}</Link></Button>
      )}
    />
  );
  const costs = ['lastPurchase', 'avgPurchase', 'unitCost', 'stockValue'] as const;
  const panel = (children: ReactNode, costView = false) => (
    <TablePanel
      minWidth={costView ? '55rem' : '45rem'}
      className={styles.panel}
      footer={pagination}
      toolbar={costView ? <p className={styles.costNote}><CircleHelp aria-hidden />{t('preview.costNote')}</p> : undefined}
    >
      {products.length ? children : empty}
    </TablePanel>
  );

  return (
    <Page>
      <PageHeader
        title={archived ? t('archivedTitle') : t('title')}
        description={archived ? t('archivedDescription') : t('preview.description')}
        back={archived ? { href: '/inventory', label: t('backToInventory') } : undefined}
        actions={archived ? undefined : (
          <>
            <Button variant="ghost" asChild><Link href="/inventory?status=archived"><Archive />{t('showArchived')}</Link></Button>
            <SyncWebsiteButton />
            <Button asChild><Link href="/inventory/new"><Plus />{t('add')}</Link></Button>
          </>
        )}
      />

      {!archived ? (
        <SummaryStrip label={t('preview.summary')}>
          <SummaryMetric
            label={t('unitsOnHand')}
            icon={PackageCheck}
            value={f.count(summary.unitsOnHand)}
            hint={summary.unitsInOrders > 0 ? t('inOpenOrders', { count: f.count(summary.unitsInOrders) }) : t('noneInOrders')}
          />
          <SummaryMetric
            label={te('stockState.low')}
            icon={TriangleAlert}
            value={f.count(count.low_stock)}
            hint={t('lowHint', { count: LOW_STOCK })}
            href={stockHref('low_stock')}
            attention={count.low_stock > 0}
          />
          <SummaryMetric
            label={te('stockState.out')}
            icon={PackageX}
            value={f.count(count.out_of_stock)}
            hint={t('outHint')}
            href={stockHref('out_of_stock')}
            attention={count.out_of_stock > 0}
            hintAttention={false}
          />
          <SummaryMetric
            label={t('stockValue')}
            icon={Boxes}
            value={<Amount value={summary.stockValue} />}
            hint={summary.missingCost > 0 ? t('missingCost', { count: summary.missingCost }) : t('atCost')}
            hintAttention={summary.missingCost > 0}
            sensitive
          />
        </SummaryStrip>
      ) : null}

      <InventoryViews
        heading={<ListTitle title={t('preview.products')} count={f.count(total)} />}
        filters={
          <>
            <QuickViews
              label={t('stockLevel')}
              views={[
                { key: 'all', label: tc('all'), count: f.count(summary.products), href: stockHref(), current: !stock },
                ...STOCK_LEVELS.map((level) => ({
                  key: level.value,
                  label: te(`stockState.${level.state}`),
                  count: f.count(count[level.value]),
                  href: stockHref(level.value),
                  current: stock === level.value,
                })),
              ]}
            />
            <FilterBar
              search={{ param: 'search', placeholder: t('search') }}
              filters={[
                { kind: 'select', param: 'category', all: t('allCategories'), options: CATEGORIES.map((c) => ({ value: c, label: te(`category.${c}`) })) },
                { kind: 'select', param: 'channel', all: t('anyChannel'), options: CHANNELS.map((c) => ({ value: c, label: te(`channel.${c}`) })) },
              ]}
            />
          </>
        }
        quantities={panel(
          <>
            <div className={styles.desktopTable}>
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-[42%]">{t('columns.product')}</TableHead>
                  <TableHead>{t('preview.available')}</TableHead>
                  <TableHead className="text-end"><span className={styles.locationHead}><Warehouse aria-hidden />{te('stockLocation.WAREHOUSE')}</span></TableHead>
                  <TableHead className="text-end">{te('stockLocation.NOON')}</TableHead>
                  <TableHead className="text-end"><HelpLabel label={t('columns.inOrders')} help={t('preview.inOrdersHelp')} /></TableHead>
                </TableRow></TableHeader>
                <TableBody>{products.map((p) => <TableRow key={p.id}>
                  <TableCell className="max-w-0"><ProductIdentity product={p} /></TableCell>
                  <TableCell><Availability product={p} /></TableCell>
                  <TableCell className={cn('num text-end', styles.locationNumber)}>{f.count(p.warehouseOnHand)}</TableCell>
                  <TableCell className={cn('num text-end', styles.locationNumber)}>{f.count(p.noonOnHand)}</TableCell>
                  <TableCell className={cn('num text-end', styles.locationNumber, styles.secondaryNumber)}>{p.inOrders > 0 ? f.count(p.inOrders) : '—'}</TableCell>
                </TableRow>)}</TableBody>
              </Table>
            </div>
            <div className={styles.mobileCards}>
              {products.map((p) => <article key={p.id} className={styles.mobileCard}>
                <div className={styles.mobileHeading}><ProductIdentity product={p} /><Availability product={p} /></div>
                <dl className={styles.stockDetails}>
                  <div><dt>{te('stockLocation.WAREHOUSE')}</dt><dd className="num">{f.count(p.warehouseOnHand)}</dd></div>
                  <div><dt>{te('stockLocation.NOON')}</dt><dd className="num">{f.count(p.noonOnHand)}</dd></div>
                  <div><dt><HelpLabel label={t('columns.inOrders')} help={t('preview.inOrdersHelp')} /></dt><dd className="num">{p.inOrders > 0 ? f.count(p.inOrders) : '—'}</dd></div>
                </dl>
              </article>)}
            </div>
          </>
        )}
        costs={panel(
          <>
            <div className={styles.desktopTable}>
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-[32%]">{t('columns.product')}</TableHead>
                  {costs.map((field) => <TableHead key={field} className="text-end">{field === 'stockValue' ? t('columns.stockValue') : <HelpLabel label={t(`columns.${field}`)} help={t(`help.${field}`)} />}</TableHead>)}
                </TableRow></TableHeader>
                <TableBody>{products.map((p) => <TableRow key={p.id}>
                  <TableCell className="max-w-0"><ProductIdentity product={p} /></TableCell>
                  {costs.map((field) => <TableCell key={field} className="text-end" data-sensitive><PurchaseValue product={p} field={field} /></TableCell>)}
                </TableRow>)}</TableBody>
              </Table>
            </div>
            <div className={styles.mobileCards}>
              {products.map((p) => <article key={p.id} className={styles.mobileCard}>
                <ProductIdentity product={p} />
                <dl className={styles.costDetails}>
                  {costs.map((field) => <div key={field}>
                    <dt>{field === 'stockValue' ? t('columns.stockValue') : <HelpLabel label={t(`columns.${field}`)} help={t(`help.${field}`)} />}</dt>
                    <dd data-sensitive><PurchaseValue product={p} field={field} /></dd>
                  </div>)}
                </dl>
              </article>)}
            </div>
          </>, true
        )}
      />
    </Page>
  );
}
