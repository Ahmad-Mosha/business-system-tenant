'use client';

import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Package } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { addProduct, type CreateProductState } from '@/app/(app)/inventory/actions';
import { Screen } from '@/components/shell';
import { CATEGORIES } from '@/lib/categories';
import { cn } from '@/lib/utils';

const INITIAL: CreateProductState = { status: 'idle' };

/** Mirrors MONEY on the API — `120`, `120.5` or `120.50`. */
const MONEY = /^\d+(\.\d{1,2})?$/;

const field =
  'h-9 w-full rounded-md border border-border bg-card px-3 text-[13px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60';

/**
 * Every rule here mirrors CatalogService.createProduct — checked as the mod
 * types, not after a round trip that comes back with the same message.
 */
export function NewProductForm() {
  const [state, submit, pending] = useActionState(addProduct, INITIAL);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [sku, setSku] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [openingStock, setOpeningStock] = useState('0');

  const nameOk = name.trim().length > 0;
  const costOk = unitCost.trim() === '' || MONEY.test(unitCost.trim());
  const stockOk = /^\d+$/.test(openingStock.trim() || '0');
  const touched = name.length > 0;
  const ready = nameOk && costOk && stockOk;

  return (
    <form action={submit} className="contents">
      <Screen>
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-5">
          <Link
            href="/inventory"
            aria-label="Back to inventory"
            className="-ms-2 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ArrowLeft className="size-4.5" />
          </Link>
          <h1 className="text-lg font-semibold tracking-[-0.02em]">Add Product</h1>
          <Link
            href="/inventory"
            className="ms-auto inline-flex h-9 items-center rounded-md border border-border bg-card px-4 text-[13px] font-medium transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Cancel
          </Link>
        </header>

        <div className="flex min-h-0 flex-1 justify-center overflow-y-auto p-6">
          <div className="w-full max-w-xl">
            <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
              <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold">
                <Package className="size-4.5 text-muted-foreground" strokeWidth={1.9} />
                Product details
              </h2>

              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="mb-1.5 block text-[11px] text-muted-foreground">
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    required
                    autoFocus
                    placeholder="e.g. اكسجين بلوب 1 لتر مشكل"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={touched && !nameOk}
                    disabled={pending}
                    className={cn(field, touched && !nameOk && 'border-destructive')}
                  />
                  {touched && !nameOk && (
                    <p className="mt-1 text-[11px] text-destructive">A product needs a name.</p>
                  )}
                </div>

                <div>
                  <p className="mb-1.5 text-[11px] text-muted-foreground">Category (optional)</p>
                  <input type="hidden" name="category" value={category ?? ''} />
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setCategory(category === c.value ? null : c.value)}
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="sku" className="mb-1.5 block text-[11px] text-muted-foreground">
                      Our SKU (optional)
                    </label>
                    <input
                      id="sku"
                      name="sku"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      placeholder="Leave blank if none yet"
                      disabled={pending}
                      className={field}
                    />
                  </div>
                  <div>
                    <label htmlFor="unitCost" className="mb-1.5 block text-[11px] text-muted-foreground">
                      Unit cost, EGP (optional)
                    </label>
                    <input
                      id="unitCost"
                      name="unitCost"
                      inputMode="decimal"
                      value={unitCost}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => setUnitCost(e.target.value)}
                      placeholder="What we paid"
                      aria-invalid={unitCost.length > 0 && !costOk}
                      disabled={pending}
                      className={cn(field, 'tabular-nums', unitCost.length > 0 && !costOk && 'border-destructive')}
                    />
                    {unitCost.length > 0 && !costOk && (
                      <p className="mt-1 text-[11px] text-destructive">
                        An amount like 120 or 120.50.
                      </p>
                    )}
                  </div>
                </div>

                <div className="w-1/2 sm:pr-2">
                  <label htmlFor="openingStock" className="mb-1.5 block text-[11px] text-muted-foreground">
                    Opening stock
                  </label>
                  <input
                    id="openingStock"
                    name="openingStock"
                    inputMode="numeric"
                    value={openingStock}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => setOpeningStock(e.target.value)}
                    aria-invalid={!stockOk}
                    disabled={pending}
                    className={cn(field, 'tabular-nums', !stockOk && 'border-destructive')}
                  />
                  {!stockOk && (
                    <p className="mt-1 text-[11px] text-destructive">A whole number, 0 or more.</p>
                  )}
                </div>
              </div>

              <p className="mt-5 border-t border-border pt-4 text-[11px] text-muted-foreground">
                No selling price here — price is set per order, since it differs by channel. A
                product carries cost, not price.
              </p>

              <div className="mt-5 border-t border-border pt-4">
                <p className="text-[11px] text-muted-foreground">
                  Also sold on (optional) — the SKU each channel uses. A sale there will move this
                  product’s stock. Leave blank if you don’t sell it there; you can add these later
                  from the product page.
                </p>
                <div className="mt-3 space-y-3">
                  {[
                    { name: 'sku_noon', label: 'noon', placeholder: 'Partner SKU, e.g. CCC-0001' },
                    { name: 'sku_amazon', label: 'Amazon', placeholder: 'Seller SKU' },
                    { name: 'sku_easyorders', label: 'Website', placeholder: 'Easy Orders product ID' },
                  ].map((c) => (
                    <div key={c.name} className="flex items-center gap-3">
                      <span className="w-16 shrink-0 text-[11px] text-muted-foreground">{c.label}</span>
                      <input
                        name={c.name}
                        placeholder={c.placeholder}
                        disabled={pending}
                        className={cn(field, 'font-mono')}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {state.status === 'error' && (
                <p
                  role="alert"
                  className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2 text-[13px] text-destructive"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
                  {state.message}
                </p>
              )}

              <button
                type="submit"
                disabled={!ready || pending}
                className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                {pending ? 'Adding' : 'Add Product'}
              </button>
            </section>
          </div>
        </div>
      </Screen>
    </form>
  );
}
