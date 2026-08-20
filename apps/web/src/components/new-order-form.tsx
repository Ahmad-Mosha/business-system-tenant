'use client';

import { AlertCircle, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { useActionState, useEffect, useRef, useState } from 'react';
import { createOrder, searchVariants, type CreateOrderState } from '@/app/(app)/orders/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { money } from '@/lib/format';

const INITIAL: CreateOrderState = { status: 'idle' };

interface Line {
  key: string;
  variantId?: string;
  title: string;
  quantity: number;
  unitPrice: string;
  onHand?: number;
}

type Hit = Awaited<ReturnType<typeof searchVariants>>[number];

/**
 * Built around what a moderator actually does: they are on a call, they know
 * the product and the price, and they need the order recorded quickly. Product
 * lookup is optional — an unlisted item can still be typed in.
 */
export function NewOrderForm({ assignsToSelf }: { assignsToSelf: boolean }) {
  const [state, submit, pending] = useActionState(createOrder, INITIAL);
  const [lines, setLines] = useState<Line[]>([]);
  const [shipping, setShipping] = useState('0');
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);

  // Debounced lookup, so typing does not fire a request per keystroke.
  useEffect(() => {
    if (!term.trim()) {
      setHits([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      setHits(await searchVariants(term));
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [term]);

  const addLine = (hit?: Hit) => {
    seq.current += 1;
    setLines((l) => [
      ...l,
      {
        key: `l${seq.current}`,
        variantId: hit?.id,
        title: hit?.label ?? '',
        quantity: 1,
        unitPrice: hit?.sellingPrice ?? '',
        onHand: hit?.onHand,
      },
    ]);
    setTerm('');
    setHits([]);
  };

  const patch = (key: string, next: Partial<Line>) =>
    setLines((l) => l.map((x) => (x.key === key ? { ...x, ...next } : x)));

  const subtotal = lines.reduce((n, l) => n + (Number(l.unitPrice) || 0) * l.quantity, 0);
  const total = subtotal + (Number(shipping) || 0);
  const ready = lines.length > 0 && lines.every((l) => l.title.trim() && Number(l.unitPrice) > 0);

  return (
    <form action={submit} className="space-y-8">
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(
          lines.map((l) => ({
            variantId: l.variantId,
            title: l.title,
            quantity: l.quantity,
            unitPrice: String(Number(l.unitPrice || 0).toFixed(2)),
          })),
        )}
      />

      <section>
        <h2 className="mb-4 text-sm font-medium">Customer</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Labelled label="Name" htmlFor="customerName">
            <Input id="customerName" name="customerName" required disabled={pending} />
          </Labelled>
          <Labelled label="Phone" htmlFor="customerPhone">
            <Input
              id="customerPhone"
              name="customerPhone"
              required
              inputMode="tel"
              disabled={pending}
            />
          </Labelled>
          <Labelled label="Governorate" htmlFor="governorate">
            <Input id="governorate" name="governorate" disabled={pending} />
          </Labelled>
          <Labelled label="Payment method" htmlFor="paymentMethod">
            <select
              id="paymentMethod"
              name="paymentMethod"
              disabled={pending}
              defaultValue="COD"
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <option value="COD">Cash on delivery</option>
              <option value="INSTAPAY">InstaPay</option>
              <option value="WALLET">Mobile wallet</option>
            </select>
          </Labelled>
          <div className="sm:col-span-2">
            <Labelled label="Address" htmlFor="address">
              <Input id="address" name="address" disabled={pending} />
            </Labelled>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-medium">Items</h2>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search inventory by name or SKU"
            disabled={pending}
            className="pl-9"
          />
          {(hits.length > 0 || searching) && (
            <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-popover shadow-md">
              {searching && !hits.length ? (
                <li className="px-3 py-2.5 text-sm text-muted-foreground">Searching…</li>
              ) : (
                hits.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => addLine(h)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent"
                    >
                      <span className="min-w-0 flex-1 truncate">{h.label}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {h.onHand} in stock
                      </span>
                      {h.sellingPrice && (
                        <span className="shrink-0 text-xs tabular-nums">
                          {money(h.sellingPrice)}
                        </span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        {lines.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
            Search above to add a product, or add a free-text line.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-border">
            {lines.map((l, i) => (
              <li
                key={l.key}
                className={`flex flex-wrap items-end gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}
              >
                <div className="min-w-[180px] flex-1 space-y-1">
                  <label className="text-[11px] text-muted-foreground">Item</label>
                  <Input
                    value={l.title}
                    onChange={(e) => patch(l.key, { title: e.target.value })}
                    placeholder="Item name"
                    disabled={pending}
                  />
                  {l.variantId ? (
                    <p className="text-[11px] text-muted-foreground">
                      Linked to inventory · {l.onHand} in stock
                    </p>
                  ) : (
                    <p className="text-[11px] text-warning">Not linked to inventory</p>
                  )}
                </div>
                <div className="w-20 space-y-1">
                  <label className="text-[11px] text-muted-foreground">Qty</label>
                  <Input
                    type="number"
                    min={1}
                    value={l.quantity}
                    onChange={(e) => patch(l.key, { quantity: Math.max(1, Number(e.target.value)) })}
                    disabled={pending}
                    className="tabular-nums"
                  />
                </div>
                <div className="w-28 space-y-1">
                  <label className="text-[11px] text-muted-foreground">Price</label>
                  <Input
                    inputMode="decimal"
                    value={l.unitPrice}
                    onChange={(e) => patch(l.key, { unitPrice: e.target.value })}
                    disabled={pending}
                    className="tabular-nums"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setLines((x) => x.filter((y) => y.key !== l.key))}
                  aria-label="Remove item"
                  disabled={pending}
                  className="mb-1 inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive-subtle hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => addLine()}
          disabled={pending}
          className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Plus className="size-3.5" />
          Add a line manually
        </button>
      </section>

      <section className="rounded-xl border border-border px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="w-32 space-y-1">
            <label htmlFor="shippingCost" className="text-[11px] text-muted-foreground">
              Shipping
            </label>
            <Input
              id="shippingCost"
              name="shippingCost"
              inputMode="decimal"
              value={shipping}
              onChange={(e) => setShipping(e.target.value)}
              disabled={pending}
              className="tabular-nums"
            />
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">
              Subtotal {money(subtotal)} + shipping {money(shipping || 0)}
            </p>
            <p className="text-2xl font-semibold tracking-[-0.02em] tabular-nums">{money(total)}</p>
          </div>
        </div>
      </section>

      <div className="space-y-1.5">
        <label htmlFor="notes" className="text-xs font-medium text-muted-foreground">
          Notes
        </label>
        <Input id="notes" name="notes" placeholder="Anything the team should know" disabled={pending} />
      </div>

      {state.status === 'error' && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          {state.message}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!ready || pending} className="min-w-[132px]">
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Creating
            </>
          ) : (
            'Create order'
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          {assignsToSelf ? 'This order will be assigned to you.' : 'An admin can assign it after.'}
        </p>
      </div>
    </form>
  );
}

function Labelled({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
