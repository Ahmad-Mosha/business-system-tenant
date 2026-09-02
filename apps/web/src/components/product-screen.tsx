'use client';

import { ArrowLeft, Check, Loader2, Pencil, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { archiveProduct, updateProduct } from '@/app/(app)/inventory/actions';
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
import { ChannelListings } from '@/components/channel-listings';
import { Screen, Scroller } from '@/components/shell';
import { VariantPanel } from '@/components/variant-panel';
import { CATEGORIES, categoryLabel } from '@/lib/categories';
import type { ProductDetail } from '@/lib/api';
import { cn } from '@/lib/utils';

type Movement = {
  id: string;
  quantity: number;
  reason: string;
  note: string | null;
  occurredAt: string;
  runningTotal: number;
};

const field =
  'h-9 w-full rounded-md border border-border bg-card px-3 text-[13px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60';

/**
 * The whole product screen — header and body share one `editing` toggle, so
 * this owns both rather than splitting them across a server header and a
 * separate edit-form component that can't see each other's state.
 */
export function ProductScreen({
  product,
  history,
}: {
  product: ProductDetail;
  history: Array<{ variantId: string; movements: Movement[] }>;
}) {
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
      } else {
        toast.error(r.message);
      }
    });

  const cancel = () => {
    setName(product.name);
    setCategory(product.category ?? '');
    setEditing(false);
  };

  return (
    <Screen>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-5">
        <Link
          href="/inventory"
          aria-label="Back to inventory"
          className="-ms-2 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ArrowLeft className="size-4.5" />
        </Link>
        <h1 className="truncate text-lg font-semibold tracking-[-0.02em]">{product.name}</h1>
        <span className="shrink-0 text-xs text-muted-foreground">{categoryLabel(product.category)}</span>

        <div className="ms-auto flex shrink-0 items-center gap-1.5">
          {editing ? (
            <>
              <button
                type="button"
                onClick={cancel}
                disabled={pending}
                className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="size-3.5" />
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={pending || !nameOk}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-3.5 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                Save
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[13px] font-medium transition-colors hover:bg-accent"
              >
                <Pencil className="size-3.5" />
                Edit
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[13px] text-destructive transition-colors hover:bg-destructive-subtle"
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete &quot;{product.name}&quot;?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes it from Inventory. Its order and stock history is kept, not
                      erased — nothing that already references this product changes.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={archiving}
                      onClick={(e) => {
                        e.preventDefault();
                        startArchive(async () => {
                          const r = await archiveProduct(product.id);
                          if (r && !r.ok) toast.error(r.message);
                        });
                      }}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      {archiving ? <Loader2 className="size-3.5 animate-spin" /> : 'Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </header>

      <Scroller className="p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {editing && (
            <section className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <h2 className="mb-3 text-[14px] font-semibold">Product details</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="edit-name" className="mb-1.5 block text-[11px] text-muted-foreground">
                    Name
                  </label>
                  <input
                    id="edit-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={!nameOk}
                    disabled={pending}
                    className={cn(field, !nameOk && 'border-destructive')}
                  />
                  {!nameOk && <p className="mt-1 text-[11px] text-destructive">A product needs a name.</p>}
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] text-muted-foreground">Category</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCategory('')}
                      disabled={pending}
                      aria-pressed={category === ''}
                      className={cn(
                        'h-8 rounded-md border px-3 text-[12.5px] transition-colors',
                        category === ''
                          ? 'border-foreground bg-foreground font-medium text-background'
                          : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      None
                    </button>
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setCategory(c.value)}
                        disabled={pending}
                        aria-pressed={category === c.value}
                        className={cn(
                          'h-8 rounded-md border px-3 text-[12.5px] transition-colors',
                          category === c.value
                            ? 'border-foreground bg-foreground font-medium text-background'
                            : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
                        )}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-[13px] font-medium">Variants and stock</h2>
              {product.variants.length > 1 && (
                <span className="text-[11px] text-muted-foreground">{product.variants.length} variants</span>
              )}
            </div>
            <div className="space-y-3">
              {product.variants.map((v) => (
                <VariantPanel
                  key={v.id}
                  variant={v}
                  movements={history.find((h) => h.variantId === v.id)?.movements ?? []}
                />
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-[13px] font-medium">Channels</h2>
              <span className="text-[11px] text-muted-foreground">
                the SKU each channel uses for this product — a sale there moves this stock
              </span>
            </div>
            <ChannelListings product={product} />
          </section>
        </div>
      </Scroller>
    </Screen>
  );
}
