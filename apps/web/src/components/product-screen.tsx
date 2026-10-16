'use client';

import { Archive, ArchiveRestore, Check, Merge, Pencil, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { archiveProduct, deleteProduct, mergeProduct, restoreProduct, updateProduct } from '@/app/(app)/inventory/actions';
import { PickProductDialog } from '@/components/pick-product-dialog';
import { blockedBy } from '@/lib/problem';
import { ConfirmAction } from '@/components/confirm-action';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Amount } from '@/components/amount';
import { ChannelListings } from '@/components/channel-listings';
import { MetricCard, MetricGrid, type MetricTone } from '@/components/metric-card';
import { Page, PageHeader } from '@/components/page';
import type { Tone } from '@/components/tone-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { VariantPanel, type Movement } from '@/components/variant-panel';
import type { ProductDetail } from '@/lib/api';
import { CATEGORIES } from '@/lib/categories';
import { money, unitMoney } from '@/lib/format';
import { LOW_STOCK, stockState } from '@/lib/stock';
import { isOneOf } from '@/lib/utils';
import { bdi } from '@/i18n/rich';
import { useFormat } from '@/i18n/use-format';

/** "No category" in a toggle group that can't hold an empty value. */
const NONE = 'none';

/** In stock is the normal state — only low and out earn a mark. */
const STATE_MARK: Partial<Record<Tone, MetricTone>> = { warning: 'warning', danger: 'destructive' };

/**
 * The whole product screen — header and body share one `editing` toggle, so
 * this owns both rather than splitting them across components that can't see
 * each other's state.
 */
export function ProductScreen({
  product,
  history,
}: {
  product: ProductDetail;
  history: Array<{ variantId: string; movements: Movement[] }>;
}) {
  const t = useTranslations('product');
  const tc = useTranslations('common');
  const te = useTranslations('enums');
  const tn = useTranslations('nouns');
  const tr = useTranslations();
  const f = useFormat();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [archiving, startArchive] = useTransition();
  const [name, setName] = useState(product.name);
  const [category, setCategory] = useState(product.category ?? '');
  const nameOk = name.trim().length > 0;

  const save = () =>
    start(async () => {
      const r = await updateProduct(product.id, { name: name.trim(), category: category || null });
      if (r.ok) {
        toast.success(t('updated'));
        setEditing(false);
      } else toast.error(r.message);
    });

  const restore = () =>
    startArchive(async () => {
      const r = await restoreProduct(product.id);
      if (r.ok) toast.success(t('restored'));
      else toast.error(r.message);
    });
  // Both actions are always offered; when one is blocked, its dialog says by
  // what (from the API — the same rule the action enforces) instead of hiding it.
  const deleteButton = (
    <ConfirmAction
      trigger={
        <Button variant="ghost" className="text-destructive hover:bg-destructive-subtle hover:text-destructive">
          <Trash2 />
          {t('delete')}
        </Button>
      }
      title={t.rich('deleteTitle', { name: product.name, bdi })}
      description={t('deleteDescription')}
      confirmLabel={t('deleteConfirm')}
      destructive
      action={() => deleteProduct(product.id)}
      blocked={blockedBy('product.deleteBlocked', product.blocked?.delete)}
      blockedTitle={<bdi>{product.name}</bdi>}
    />
  );

  const cancel = () => {
    setName(product.name);
    setCategory(product.category ?? '');
    setEditing(false);
  };

  // Every product is single-variant today; the figures still add up if one isn't.
  const only = product.variants.length === 1 ? product.variants[0] : null;
  const onHand = product.variants.reduce((n, v) => n + v.onHand, 0);
  const inOrders = product.variants.reduce((n, v) => n + v.inOpenOrders, 0);
  const value = product.variants.reduce(
    (n, v) => n + (v.unitCost && v.onHand > 0 ? v.onHand * Number(v.unitCost) : 0),
    0,
  );
  const state = stockState(onHand);
  const categoryName = !product.category
    ? te('category.NONE')
    : isOneOf(CATEGORIES, product.category)
      ? te(`category.${product.category}`)
      : product.category;

  return (
    <Page>
      <PageHeader
        back={{ href: '/inventory', label: t('back') }}
        title={<bdi>{product.name}</bdi>}
        meta={
          <>
            <Badge variant="outline">{categoryName}</Badge>
            {only?.sku ? (
              <Badge variant="secondary" className="font-mono">
                {only.sku}
              </Badge>
            ) : null}
          </>
        }
        description={
          product.variants.length > 1
            ? tn('variants', { count: product.variants.length })
            : t('description')
        }
        actions={
          editing ? (
            <>
              <Button variant="ghost" onClick={cancel} disabled={pending}>
                <X />
                {tc('cancel')}
              </Button>
              <Button onClick={save} disabled={pending || !nameOk}>
                {pending ? <Spinner /> : <Check />}
                {tc('save')}
              </Button>
            </>
          ) : !product.active ? (
            <>
              <Button variant="outline" onClick={restore} disabled={archiving}>
                {archiving ? <Spinner /> : <ArchiveRestore />}
                {t('restore')}
              </Button>
              {deleteButton}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil />
                {t('edit')}
              </Button>
              <ConfirmAction
                trigger={
                  <Button variant="outline" className="text-destructive hover:bg-destructive-subtle hover:text-destructive">
                    <Archive />
                    {t('archive')}
                  </Button>
                }
                title={t.rich('archiveTitle', { name: product.name, bdi })}
                description={t('archiveDescription')}
                confirmLabel={t('archiveConfirm')}
                destructive
                action={() => archiveProduct(product.id)}
                blocked={blockedBy('product.archiveBlocked', product.blocked?.archive)}
                blockedTitle={<bdi>{product.name}</bdi>}
              />
              <PickProductDialog
                trigger={
                  <Button variant="outline">
                    <Merge />
                    {t('merge.action')}
                  </Button>
                }
                title={t.rich('merge.title', { name: product.name, bdi })}
                description={t('merge.description')}
                confirmLabel={t('merge.confirm')}
                exclude={product.variants.map((v) => v.id)}
                onConfirm={(target) => mergeProduct(product.id, target.id)}
              />
              {deleteButton}
            </>
          )
        }
      />

      {!product.active ? (
        <Alert>
          <Archive />
          <AlertDescription>{t('archivedBanner')}</AlertDescription>
        </Alert>
      ) : null}

      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('details')}</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto]">
              <Field data-invalid={!nameOk}>
                <FieldLabel htmlFor="edit-name">{t('name')}</FieldLabel>
                <Input
                  id="edit-name"
                  dir="auto"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={!nameOk}
                  disabled={pending}
                />
                {!nameOk ? <FieldError>{t('nameRequired')}</FieldError> : null}
              </Field>
              <Field>
                <FieldLabel>{t('category')}</FieldLabel>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  spacing={0}
                  value={category || NONE}
                  onValueChange={(v) => v && setCategory(v === NONE ? '' : v)}
                  disabled={pending}
                  aria-label={t('category')}
                >
                  <ToggleGroupItem value={NONE}>{t('noCategory')}</ToggleGroupItem>
                  {CATEGORIES.map((c) => (
                    <ToggleGroupItem key={c} value={c}>
                      {te(`category.${c}`)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      ) : null}

      <MetricGrid>
        <MetricCard
          label={t('onHand')}
          value={f.count(onHand)}
          tone={STATE_MARK[state.tone]}
          hint={
            state.key === 'in'
              ? te('stockState.in')
              : state.key === 'low'
                ? t('lowHint', { count: LOW_STOCK })
                : tr('inventory.outHint')
          }
        />
        <MetricCard
          label={t('inOpenOrders')}
          value={f.count(inOrders)}
          hint={inOrders > 0 ? t('inOpenOrdersHint') : t('nothingWaiting')}
        />
        <MetricCard
          label={tr('inventory.columns.unitCost')}
          value={only ? <span data-sensitive><Amount value={only.unitCost} /></span> : t('varies')}
          tone={only && !only.unitCost ? 'warning' : 'default'}
          hint={
            !only
              ? t('differs', { variants: tn('variants', { count: product.variants.length }) })
              : !only.unitCost
                ? t('costNotSet')
                : only.sellingPrice
                  ? t('sellsFor', { price: money(only.sellingPrice) })
                  : t('noPrice')
          }
        />
        <MetricCard
          label={tr('inventory.stockValue')}
          value={<span data-sensitive><Amount value={value} /></span>}
          hint={t('stockValueHint')}
        />
      </MetricGrid>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="grid min-w-0 gap-6">
          {product.variants.map((v) => (
            <VariantPanel
              key={v.id}
              variant={v}
              single={!!only}
              movements={history.find((h) => h.variantId === v.id)?.movements ?? []}
            />
          ))}
        </section>

        <Card className="pb-0">
          <CardHeader>
            <CardTitle>{t('channels')}</CardTitle>
            <CardDescription>{t('channelsHint')}</CardDescription>
          </CardHeader>
          <ChannelListings product={product} />
        </Card>
      </div>

      <PurchaseHistory product={product} />
    </Page>
  );
}

/**
 * What this product was bought for — the supplier's price, kept apart from the
 * inventory cost above (which adds shipping and customs). Posted invoices only.
 */
function PurchaseHistory({ product }: { product: ProductDetail }) {
  const t = useTranslations('product.purchases');
  const ti = useTranslations('inventory');
  const f = useFormat();
  return (
    <Card className="pb-0">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('hint')}</CardDescription>
      </CardHeader>
      {product.purchases.length === 0 ? (
        <p className="border-t p-8 text-center text-[13px] text-muted-foreground">{ti('noPurchases')}</p>
      ) : (
        <>
          <CardContent className="flex flex-wrap gap-8 border-t py-4" data-sensitive-scope>
            <div>
              <p className="text-xs text-muted-foreground">{ti('columns.lastPurchase')}</p>
              <p className="num text-lg font-semibold">{unitMoney(product.lastPurchasePrice)}</p>
              <p className="text-xs text-muted-foreground">
                {product.lastPurchaseDate ? f.date(product.lastPurchaseDate) : null}
                {product.lastPurchaseSupplier ? <> · <bdi>{product.lastPurchaseSupplier}</bdi></> : null}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{ti('columns.avgPurchase')}</p>
              <p className="num text-lg font-semibold">{unitMoney(product.avgPurchasePrice)}</p>
              <p className="text-xs text-muted-foreground">
                {ti('purchaseBasis', { units: f.count(product.purchasedUnits ?? 0), invoices: f.count(product.purchaseInvoices ?? 0) })}
              </p>
            </div>
          </CardContent>
          <Table data-sensitive-scope>
            <TableHeader>
              <TableRow>
                <TableHead>{t('date')}</TableHead>
                <TableHead>{t('supplier')}</TableHead>
                <TableHead className="text-end">{t('quantity')}</TableHead>
                <TableHead className="text-end">{t('unitPrice')}</TableHead>
                <TableHead className="text-end">{t('landed')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {product.purchases.map((p) => (
                <TableRow key={`${p.invoiceId}-${p.variantId}-${p.quantity}-${p.unitCost}`} className="relative">
                  <TableCell>
                    <Link href={`/money/purchases/${p.invoiceId}`} className="after:absolute after:inset-0 hover:underline">
                      {f.date(p.invoiceDate)}
                    </Link>
                    {p.invoiceNo ? <span className="ms-2 text-xs text-muted-foreground"><bdi>{p.invoiceNo}</bdi></span> : null}
                  </TableCell>
                  <TableCell className="max-w-0 truncate"><bdi>{p.supplier}</bdi></TableCell>
                  <TableCell className="num text-end">{f.count(p.quantity)}</TableCell>
                  <TableCell className="num text-end">{unitMoney(p.unitCost)}</TableCell>
                  <TableCell className="num text-end text-muted-foreground">{p.landedUnitCost ? unitMoney(p.landedUnitCost) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Card>
  );
}
