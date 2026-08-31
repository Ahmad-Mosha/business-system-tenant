'use client';

import {
  AlignLeft,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  Truck,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import {
  createOrder,
  searchVariants,
  updateOrder,
  type CreateOrderState,
} from '@/app/(app)/orders/actions';
import { Screen } from '@/components/shell';
import type { OrderDetail } from '@/lib/api';
import { GOVERNORATES } from '@/lib/governorates';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';

const INITIAL: CreateOrderState = { status: 'idle' };

/** Mirrors EGYPT_PHONE on the API — checked here too so the mod sees the
 * problem while typing, not after a round trip. */
const EGYPT_PHONE = /^(?:\+?20|0)?1[0125]\d{8}$/;
const isEgyptianPhone = (raw: string) =>
  EGYPT_PHONE.test(raw.replace(/[\s-]/g, '').replace(/^00/, '+'));

interface Line {
  key: string;
  variantId?: string;
  title: string;
  quantity: number;
  unitPrice: string;
  onHand?: number;
  unitCost?: string | null;
}

type Hit = Awaited<ReturnType<typeof searchVariants>>[number];

const PAYMENT_METHODS = [
  { value: 'COD', label: 'Cash on Delivery' },
  { value: 'WALLET', label: 'Mobile Wallet' },
  { value: 'INSTAPAY', label: 'InstaPay' },
] as const;

const field =
  'h-9 w-full rounded-md border border-border bg-card px-3 text-[13px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60';

/**
 * Manual order entry, and the edit screen for an existing one — the same form
 * either way, because they collect exactly the same thing.
 *
 * Laid out as a grid of cards rather than a stack of sections: the two short
 * forms sit side by side, the item table is capped, and the whole screen fits a
 * laptop without scrolling.
 */
export function OrderForm({
  assignsToSelf,
  order,
}: {
  assignsToSelf?: boolean;
  order?: OrderDetail;
}) {
  const editing = !!order;
  const [state, submit, pending] = useActionState(
    editing ? updateOrder.bind(null, order.id) : createOrder,
    INITIAL,
  );
  const [lines, setLines] = useState<Line[]>(
    () =>
      order?.items.map((i, ix) => ({
        key: `e${ix}`,
        variantId: i.variantId ?? undefined,
        title: i.title,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })) ?? [],
  );
  const [shipping, setShipping] = useState(order?.shippingCost ?? '0');
  const [phone, setPhone] = useState(order?.customerPhone ?? '');
  const [method, setMethod] = useState<string>(order?.paymentMethod ?? 'COD');
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);

  // Debounced lookup, so typing does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!term.trim()) {
        setHits([]);
        return;
      }
      setSearching(true);
      setHits(await searchVariants(term));
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [term]);

  const addLine = (hit?: Hit) => {
    if (hit && hit.onHand <= 0) return; // out of stock — nothing to sell
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
        unitCost: hit?.unitCost,
      },
    ]);
    setTerm('');
    setHits([]);
  };

  const patch = (key: string, next: Partial<Line>) =>
    setLines((l) => l.map((x) => (x.key === key ? { ...x, ...next } : x)));

  const lineTotal = (l: Line) => (Number(l.unitPrice) || 0) * l.quantity;
  const subtotal = lines.reduce((n, l) => n + lineTotal(l), 0);
  const total = subtotal + (Number(shipping) || 0);
  const units = lines.reduce((n, l) => n + l.quantity, 0);

  const phoneOk = isEgyptianPhone(phone);
  const overStock = lines.filter((l) => l.onHand !== undefined && l.quantity > l.onHand);
  const belowCost = lines.filter(
    (l) => l.unitCost && Number(l.unitPrice) > 0 && Number(l.unitPrice) < Number(l.unitCost),
  );
  const unpriced = lines.filter((l) => !l.title.trim() || !(Number(l.unitPrice) > 0));
  const ready = lines.length > 0 && !unpriced.length && phoneOk && !overStock.length;

  return (
    <form action={submit} className="contents">
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

      <Screen>
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-5">
          <Link
            href={editing ? `/orders/${order.id}` : '/orders'}
            aria-label={editing ? 'Back to the order' : 'Back to orders'}
            className="-ms-2 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ArrowLeft className="size-4.5" />
          </Link>
          <h1 className="text-lg font-semibold tracking-[-0.02em]">
            {editing ? `Edit ${order.orderNumber}` : 'Manual Order Entry'}
          </h1>
          <span className="text-xs text-muted-foreground">
            {editing
              ? 'changing the items adjusts stock'
              : assignsToSelf
                ? 'assigned to you'
                : 'unassigned until an admin assigns it'}
          </span>
          <Link
            href={editing ? `/orders/${order.id}` : '/orders'}
            className="ms-auto inline-flex h-9 items-center rounded-md border border-border bg-card px-4 text-[13px] font-medium transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Cancel
          </Link>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px] items-start gap-4 overflow-y-auto p-4">
          {/* The work column: two short forms side by side, then the item table
              taking whatever height is left. */}
          <div className="grid content-start gap-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card icon={User} step="1" title="Customer Information">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Labelled label="Full Name" htmlFor="customerName">
                    <input
                      id="customerName"
                      name="customerName"
                      required
                      defaultValue={order?.customerName ?? ''}
                      placeholder="e.g. أحمد جمال"
                      disabled={pending}
                      className={field}
                    />
                  </Labelled>
                  <Labelled label="Phone Number" htmlFor="customerPhone">
                    <input
                      id="customerPhone"
                      name="customerPhone"
                      required
                      inputMode="tel"
                      placeholder="01xxxxxxxxx"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      aria-invalid={phone.length > 0 && !phoneOk}
                      disabled={pending}
                      className={cn(field, phone.length > 0 && !phoneOk && 'border-destructive')}
                    />
                  </Labelled>
                </div>
                {phone.length > 0 && !phoneOk && (
                  <p className="mt-1.5 text-[11px] text-destructive">
                    Not a valid Egyptian mobile number
                  </p>
                )}
              </Card>

              <Card icon={Truck} step="2" title="Shipping Details">
                <div className="grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)]">
                  <Labelled label="Governorate" htmlFor="governorate">
                    <select
                      id="governorate"
                      name="governorate"
                      required
                      defaultValue={order?.governorate ?? ''}
                      disabled={pending}
                      className={field}
                    >
                      <option value="" disabled>
                        Select…
                      </option>
                      {GOVERNORATES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </Labelled>
                  <Labelled label="Street Address" htmlFor="address">
                    <input
                      id="address"
                      name="address"
                      defaultValue={order?.address ?? ''}
                      placeholder="Street, building, apartment, landmark"
                      disabled={pending}
                      className={field}
                    />
                  </Labelled>
                </div>
              </Card>
            </div>

            <Card icon={ShoppingBag} step="3" title="Order Items">
              <div className="relative mb-3 shrink-0">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Search products by name or SKU"
                  disabled={pending}
                  className={cn(field, 'pl-8.5')}
                />
                {(hits.length > 0 || searching) && (
                  <ul className="absolute inset-x-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                    {searching && !hits.length ? (
                      <li className="px-3 py-2 text-[13px] text-muted-foreground">Searching…</li>
                    ) : (
                      hits.map((h) => {
                        const out = h.onHand <= 0;
                        return (
                          <li key={h.id}>
                            <button
                              type="button"
                              onClick={() => addLine(h)}
                              disabled={out}
                              className="flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] transition-colors enabled:hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <span className="min-w-0 flex-1 truncate">{h.label}</span>
                              <span
                                className={cn(
                                  'shrink-0 text-[11px]',
                                  out ? 'text-destructive' : 'text-muted-foreground',
                                )}
                              >
                                {out ? 'Out of stock' : `${h.onHand} in stock`}
                              </span>
                              {h.sellingPrice && (
                                <span className="w-16 shrink-0 text-right tabular-nums">
                                  {money(h.sellingPrice)}
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })
                    )}
                  </ul>
                )}
              </div>

              <div className="flex flex-col overflow-hidden rounded-lg border border-border">
                <div className="max-h-[264px] overflow-y-auto">
                  <table className="w-full border-collapse text-[13px]">
                    <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
                      <tr className="border-b border-border text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
                        <th className="px-3 py-2 text-left font-medium">Item</th>
                        <th className="w-[80px] px-3 py-2 text-right font-medium">Qty</th>
                        <th className="w-[110px] px-3 py-2 text-right font-medium">Unit Price</th>
                        <th className="w-[100px] px-3 py-2 text-right font-medium">Total</th>
                        <th className="w-10 px-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {lines.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-3 py-6 text-center text-[13px] text-muted-foreground"
                          >
                            No items yet — search above, or add a custom item.
                          </td>
                        </tr>
                      ) : (
                        lines.map((l) => {
                          const over = l.onHand !== undefined && l.quantity > l.onHand;
                          const under =
                            l.unitCost &&
                            Number(l.unitPrice) > 0 &&
                            Number(l.unitPrice) < Number(l.unitCost);
                          return (
                            <tr key={l.key} className="border-b border-border/60">
                              <td className="px-3 py-1.5">
                                <input
                                  value={l.title}
                                  onChange={(e) => patch(l.key, { title: e.target.value })}
                                  placeholder="Item name"
                                  disabled={pending}
                                  className={cn(
                                    field,
                                    'h-8 border-transparent bg-transparent px-2 hover:border-border',
                                  )}
                                />
                                <p className="px-2 text-[11px] text-muted-foreground">
                                  {!l.variantId ? (
                                    <span className="text-warning">not linked to inventory</span>
                                  ) : l.onHand === undefined ? (
                                    // Loaded from a saved order — we know it is
                                    // linked, but not what stock stands at now.
                                    'linked to inventory'
                                  ) : (
                                    <>
                                      {l.onHand} in stock
                                      {l.unitCost ? ` · cost ${money(l.unitCost)}` : ''}
                                    </>
                                  )}
                                </p>
                              </td>
                              <td className="px-3 py-1.5 align-top">
                                <input
                                  type="number"
                                  min={1}
                                  value={l.quantity}
                                  onFocus={(e) => e.currentTarget.select()}
                                  onChange={(e) =>
                                    patch(l.key, { quantity: Math.max(1, Number(e.target.value)) })
                                  }
                                  aria-invalid={over}
                                  disabled={pending}
                                  className={cn(
                                    field,
                                    'h-8 px-2 text-right tabular-nums',
                                    over && 'border-destructive',
                                  )}
                                />
                              </td>
                              <td className="px-3 py-1.5 align-top">
                                <input
                                  inputMode="decimal"
                                  value={l.unitPrice}
                                  onFocus={(e) => e.currentTarget.select()}
                                  onChange={(e) => patch(l.key, { unitPrice: e.target.value })}
                                  disabled={pending}
                                  className={cn(
                                    field,
                                    'h-8 px-2 text-right tabular-nums',
                                    under && 'border-warning',
                                  )}
                                />
                              </td>
                              <td className="px-3 py-1.5 text-right align-top font-medium tabular-nums leading-8">
                                {money(lineTotal(l))}
                              </td>
                              <td className="px-2 py-1.5 align-top">
                                <button
                                  type="button"
                                  onClick={() => setLines((x) => x.filter((y) => y.key !== l.key))}
                                  aria-label={`Remove ${l.title || 'item'}`}
                                  disabled={pending}
                                  className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive-subtle hover:text-destructive"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={() => addLine()}
                  disabled={pending}
                  className="flex shrink-0 items-center justify-center gap-1.5 border-t border-border py-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Plus className="size-3.5" />
                  Custom Item
                </button>
              </div>
            </Card>

            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <Card icon={CreditCard} title="Payment Method">
                <input type="hidden" name="paymentMethod" value={method} />
                <div
                  role="radiogroup"
                  aria-label="Payment method"
                  className="flex rounded-md border border-border p-0.5"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      role="radio"
                      aria-checked={method === m.value}
                      onClick={() => setMethod(m.value)}
                      disabled={pending}
                      className={cn(
                        'h-8 flex-1 rounded-[5px] text-[12.5px] transition-colors',
                        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        method === m.value
                          ? 'bg-foreground font-medium text-background'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </Card>

              <Card icon={AlignLeft} title="Notes">
                <textarea
                  id="notes"
                  name="notes"
                  rows={2}
                  defaultValue={order?.notes ?? ''}
                  placeholder="Any special instructions…"
                  disabled={pending}
                  className="w-full resize-none rounded-md border border-border bg-card px-3 py-2 text-[13px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
                />
              </Card>
            </div>
          </div>

          {/* Order Summary — a card, sized to its contents, with the button in it. */}
          <aside className="min-h-0">
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
              <h2 className="text-[15px] font-semibold">Order Summary</h2>

              <div className="mt-4 space-y-2.5 border-t border-border pt-4 text-[13px]">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-muted-foreground">
                    Subtotal ({units} {units === 1 ? 'item' : 'items'})
                  </span>
                  <span className="tabular-nums">{money(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="shippingCost" className="text-muted-foreground">
                    Shipping
                  </label>
                  <input
                    id="shippingCost"
                    name="shippingCost"
                    inputMode="decimal"
                    value={shipping}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => setShipping(e.target.value)}
                    disabled={pending}
                    className={cn(field, 'h-8 w-24 px-2 text-right tabular-nums')}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-border pt-4">
                <span className="text-[15px] font-semibold">Total</span>
                <span className="text-2xl font-semibold tracking-[-0.02em] tabular-nums">
                  {money(total)}
                </span>
              </div>

              {!editing && (
                <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-[13px]">
                  <input
                    type="checkbox"
                    name="paymentCollected"
                    disabled={pending}
                    className="mt-0.5 size-3.5 accent-[var(--foreground)]"
                  />
                  <span>Payment already collected manually</span>
                </label>
              )}

              <button
                type="submit"
                disabled={!ready || pending}
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                {pending ? 'Saving' : editing ? 'Save Changes' : 'Create Order'}
              </button>

              {(overStock.length > 0 || belowCost.length > 0 || state.status === 'error') && (
                <ul className="mt-4 space-y-1.5 text-[11px]">
                  {overStock.map((l) => (
                    <li
                      key={l.key}
                      className="rounded-md border border-destructive/30 bg-destructive-subtle px-2 py-1.5 text-destructive"
                    >
                      Only {l.onHand} of <bdi>{l.title}</bdi> in stock.
                    </li>
                  ))}
                  {belowCost.map((l) => (
                    <li
                      key={l.key}
                      className="rounded-md border border-warning/30 bg-warning-subtle px-2 py-1.5 text-warning"
                    >
                      <bdi>{l.title}</bdi> is priced below its {money(l.unitCost)} cost.
                    </li>
                  ))}
                  {state.status === 'error' && (
                    <li
                      role="alert"
                      className="rounded-md border border-destructive/30 bg-destructive-subtle px-2 py-1.5 text-destructive"
                    >
                      {state.message}
                    </li>
                  )}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </Screen>
    </form>
  );
}

function Card({
  icon: Icon,
  step,
  title,
  children,
}: {
  icon: typeof User;
  step?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <h2 className="mb-3 flex shrink-0 items-center gap-2 text-[14px] font-semibold tracking-[-0.01em]">
        <Icon className="size-4 text-muted-foreground" strokeWidth={1.9} />
        {step ? `${step}. ` : ''}
        {title}
      </h2>
      {children}
    </section>
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
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[11px] text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
