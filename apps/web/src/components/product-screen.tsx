'use client';

import { Check, Pencil, Trash2, X } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { archiveProduct, updateProduct } from '@/app/(app)/inventory/actions';
import { Amount } from '@/components/amount';
import { ChannelListings } from '@/components/channel-listings';
import { MetricCard, MetricGrid, type MetricTone } from '@/components/metric-card';
import { Page, PageHeader } from '@/components/page';
import type { Tone } from '@/components/tone-badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { VariantPanel, type Movement } from '@/components/variant-panel';
import type { ProductDetail } from '@/lib/api';
import { CATEGORIES, categoryLabel } from '@/lib/categories';
import { money } from '@/lib/format';
import { LOW_STOCK, stockState } from '@/lib/stock';
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
        toast.success('Product updated.');
        setEditing(false);
      } else toast.error(r.message);
    });

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

  return (
    <Page>
      <PageHeader
        back={{ href: '/inventory', label: 'Back to inventory' }}
        title={<bdi>{product.name}</bdi>}
        meta={
          <>
            <Badge variant="outline">{categoryLabel(product.category)}</Badge>
            {only?.sku ? (
              <Badge variant="secondary" className="font-mono">
                {only.sku}
              </Badge>
            ) : null}
          </>
        }
        description={
          product.variants.length > 1
            ? `${product.variants.length} variants`
            : 'Stock, cost and the channels that sell it.'
        }
        actions={
          editing ? (
            <>
              <Button variant="ghost" onClick={cancel} disabled={pending}>
                <X />
                Cancel
              </Button>
              <Button onClick={save} disabled={pending || !nameOk}>
                {pending ? <Spinner /> : <Check />}
                Save
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil />
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive hover:bg-destructive-subtle hover:text-destructive">
                    <Trash2 />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete “<bdi>{product.name}</bdi>”?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      It leaves Inventory. Its order and stock history is kept, not erased —
                      nothing that already references this product changes.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      className="bg-destructive text-white hover:bg-destructive/90"
                      disabled={archiving}
                      onClick={(e) => {
                        e.preventDefault();
                        startArchive(async () => {
                          const r = await archiveProduct(product.id);
                          if (r && !r.ok) toast.error(r.message);
                        });
                      }}
                    >
                      {archiving ? <Spinner /> : null}
                      Delete product
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )
        }
      />

      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>Product details</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto]">
              <Field data-invalid={!nameOk}>
                <FieldLabel htmlFor="edit-name">Name</FieldLabel>
                <Input
                  id="edit-name"
                  dir="auto"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={!nameOk}
                  disabled={pending}
                />
                {!nameOk ? <FieldError>A product needs a name.</FieldError> : null}
              </Field>
              <Field>
                <FieldLabel>Category</FieldLabel>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  spacing={0}
                  value={category || NONE}
                  onValueChange={(v) => v && setCategory(v === NONE ? '' : v)}
                  disabled={pending}
                  aria-label="Category"
                >
                  <ToggleGroupItem value={NONE}>None</ToggleGroupItem>
                  {CATEGORIES.map((c) => (
                    <ToggleGroupItem key={c.value} value={c.value}>
                      {c.label}
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
          label="On hand"
          value={f.count(onHand)}
          tone={STATE_MARK[state.tone]}
          hint={
            state.tone === 'success'
              ? 'In stock'
              : state.tone === 'warning'
                ? `Low — ${LOW_STOCK} or fewer left`
                : 'Nothing left to sell'
          }
        />
        <MetricCard
          label="In open orders"
          value={f.count(inOrders)}
          hint={inOrders > 0 ? 'Already off on-hand, not delivered yet' : 'Nothing waiting'}
        />
        <MetricCard
          label="Unit cost"
          value={only ? <Amount value={only.unitCost} /> : 'Varies'}
          tone={only && !only.unitCost ? 'warning' : 'default'}
          hint={
            !only
              ? `Differs across ${product.variants.length} variants`
              : !only.unitCost
                ? 'Not set — left out of stock value'
                : only.sellingPrice
                  ? `Sells for ${money(only.sellingPrice)}`
                  : 'No selling price yet'
          }
        />
        <MetricCard label="Stock value" value={<Amount value={value} />} hint="On hand at unit cost" />
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
            <CardTitle>Channels</CardTitle>
            <CardDescription>
              The SKU each channel uses for this product — a sale there moves this stock.
            </CardDescription>
          </CardHeader>
          <ChannelListings product={product} />
        </Card>
      </div>
    </Page>
  );
}
