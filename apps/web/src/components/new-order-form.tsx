'use client';

import { AlertCircle, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import { createOrder, searchVariants, type CreateOrderState } from '@/app/(app)/orders/actions';
import {
  ContextBar,
  DetailPane,
  ListPane,
  Screen,
  Scroller,
  Split,
  StatusStrip,
} from '@/components/shell';
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

const field =
  'h-[var(--control-h)] w-full rounded-md border border-border bg-background px-2.5 text-[13px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60';

/**
 * The moderator is on a call. They know the customer, the product and the
 * price, and the order has to be recorded before the call ends.
 *
 * Three columns, no page scroll: who is buying on the left, what they are
 * buying in the middle, what it comes to on the right. The old version stacked
 * all three down a single page, which put the submit button below the fold as
 * soon as a second item was added.
 */
export function NewOrderForm({ assignsToSelf }: { assignsToSelf: boolean }) {
  const [state, submit, pending] = useActionState(createOrder, INITIAL);
  const [lines, setLines] = useState<Line[]>([]);
  const [shipping, setShipping] = useState('0');
  const [phone, setPhone] = useState('');
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
        <ContextBar
          title="New order"
          meta={assignsToSelf ? 'assigned to you' : 'unassigned until an admin assigns it'}
          actions={
            <Link
              href="/orders"
              className="inline-flex h-[var(--control-h)] items-center gap-1.5 rounded-md px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <X className="size-3.5" />
              Cancel
            </Link>
          }
        />

        <Split>
          {/* Who is buying. Fixed width — these fields never need more. */}
          <aside className="flex w-[300px] shrink-0 flex-col overflow-hidden border-e border-border">
            <Scroller className="space-y-3 p-4">
              <Legend>Customer</Legend>
              <Labelled label="Name" htmlFor="customerName">
                <input id="customerName" name="customerName" required disabled={pending} className={field} />
              </Labelled>
              <Labelled label="Phone" htmlFor="customerPhone">
                <input
                  id="customerPhone"
                  name="customerPhone"
                  required
                  inputMode="tel"
                  placeholder="010 1234 5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  aria-invalid={phone.length > 0 && !phoneOk}
                  disabled={pending}
                  className={cn(field, phone.length > 0 && !phoneOk && 'border-destructive')}
                />
                {phone.length > 0 && !phoneOk && (
                  <p className="mt-1 text-[11px] text-destructive">Not a valid Egyptian mobile</p>
                )}
              </Labelled>
              <Labelled label="Governorate" htmlFor="governorate">
                <select id="governorate" name="governorate" required defaultValue="" disabled={pending} className={field}>
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
              <Labelled label="Address" htmlFor="address">
                <input id="address" name="address" disabled={pending} className={field} />
              </Labelled>

              <Legend className="pt-2">Payment</Legend>
              <Labelled label="Method" htmlFor="paymentMethod">
                <select id="paymentMethod" name="paymentMethod" defaultValue="COD" disabled={pending} className={field}>
                  <option value="COD">Cash on delivery</option>
                  <option value="INSTAPAY">InstaPay</option>
                  <option value="WALLET">Mobile wallet</option>
                </select>
              </Labelled>

              <Legend className="pt-2">Notes</Legend>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="Anything the team should know"
                disabled={pending}
                className="w-full resize-none rounded-md border border-border bg-background px-2.5 py-2 text-[13px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
              />
            </Scroller>
          </aside>

          {/* What they are buying. Takes the remaining width and does the scrolling. */}
          <ListPane>
            <div className="relative shrink-0 border-b border-border p-3">
              <Search className="pointer-events-none absolute top-1/2 left-6 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search inventory by name or SKU"
                disabled={pending}
                className={cn(field, 'pl-8')}
              />
              {(hits.length > 0 || searching) && (
                <ul className="absolute inset-x-3 z-30 mt-1 max-h-72 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
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
                            <span className={cn('shrink-0 text-[11px]', out ? 'text-destructive' : 'text-muted-foreground')}>
                              {out ? 'Out of stock' : `${h.onHand} in stock`}
                            </span>
                            {h.sellingPrice && (
                              <span className="w-16 shrink-0 text-right tabular-nums">{money(h.sellingPrice)}</span>
                            )}
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              )}
            </div>

            <Scroller>
              {lines.length === 0 ? (
                <p className="p-10 text-center text-sm text-muted-foreground">
                  Search above to add a product, or add a line by hand.
                </p>
              ) : (
                <table className="w-full border-collapse text-[13px]">
                  <thead className="sticky top-0 z-10 bg-background">
                    <tr className="border-b border-border text-[11px] tracking-[0.05em] text-muted-foreground uppercase">
                      <th className="px-3 py-2 text-left font-medium">Item</th>
                      <th className="w-[76px] px-3 py-2 text-right font-medium">Qty</th>
                      <th className="w-[110px] px-3 py-2 text-right font-medium">Unit price</th>
                      <th className="w-[110px] px-3 py-2 text-right font-medium">Line total</th>
                      <th className="w-10 px-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => {
                      const over = l.onHand !== undefined && l.quantity > l.onHand;
                      const under =
                        l.unitCost && Number(l.unitPrice) > 0 && Number(l.unitPrice) < Number(l.unitCost);
                      return (
                        <tr key={l.key} className="border-b border-border/60 align-middle">
                          <td className="px-3 py-1.5">
                            <input
                              value={l.title}
                              onChange={(e) => patch(l.key, { title: e.target.value })}
                              placeholder="Item name"
                              disabled={pending}
                              className={cn(field, 'border-transparent px-1.5 hover:border-border')}
                            />
                            <p className="mt-0.5 px-1.5 text-[11px] text-muted-foreground">
                              {l.variantId ? (
                                <>
                                  {l.onHand} in stock
                                  {l.unitCost ? ` · cost ${money(l.unitCost)}` : ''}
                                  {under ? <span className="text-warning"> · below cost</span> : null}
                                </>
                              ) : (
                                <span className="text-warning">not linked to inventory</span>
                              )}
                            </p>
                          </td>
                          <td className="px-3 py-1.5 align-top">
                            <input
                              type="number"
                              min={1}
                              value={l.quantity}
                              onChange={(e) => patch(l.key, { quantity: Math.max(1, Number(e.target.value)) })}
                              aria-invalid={over}
                              disabled={pending}
                              className={cn(field, 'text-right tabular-nums', over && 'border-destructive')}
                            />
                            {over && (
                              <p className="mt-0.5 text-right text-[11px] text-destructive">max {l.onHand}</p>
                            )}
                          </td>
                          <td className="px-3 py-1.5 align-top">
                            <input
                              inputMode="decimal"
                              value={l.unitPrice}
                              onChange={(e) => patch(l.key, { unitPrice: e.target.value })}
                              disabled={pending}
                              className={cn(field, 'text-right tabular-nums', under && 'border-warning')}
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
                    })}
                  </tbody>
                </table>
              )}

              <button
                type="button"
                onClick={() => addLine()}
                disabled={pending}
                className="flex w-full items-center justify-center gap-1.5 border-b border-border py-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Plus className="size-3.5" />
                Custom item
              </button>
            </Scroller>

            <StatusStrip>
              <span>
                {lines.length} {lines.length === 1 ? 'line' : 'lines'} · {units}{' '}
                {units === 1 ? 'unit' : 'units'}
              </span>
              <span>Stock leaves when the order is dispatched</span>
            </StatusStrip>
          </ListPane>

          {/* What it comes to. Always in view — this is what the previous
              version pushed below the fold. */}
          <DetailPane className="w-[300px]">
            <Scroller className="p-4">
              <Legend>Summary</Legend>
              <dl className="mt-2 space-y-1.5 text-[13px]">
                <SummaryRow label={`Subtotal (${units} ${units === 1 ? 'unit' : 'units'})`} value={money(subtotal)} />
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="shippingCost" className="text-muted-foreground">
                    Shipping
                  </label>
                  <input
                    id="shippingCost"
                    name="shippingCost"
                    inputMode="decimal"
                    value={shipping}
                    onChange={(e) => setShipping(e.target.value)}
                    disabled={pending}
                    className={cn(field, 'w-24 text-right tabular-nums')}
                  />
                </div>
              </dl>

              {(overStock.length > 0 || belowCost.length > 0 || (phone.length > 0 && !phoneOk)) && (
                <ul className="mt-4 space-y-1.5 text-[11px]">
                  {overStock.map((l) => (
                    <li key={l.key} className="rounded-md border border-destructive/30 bg-destructive-subtle px-2 py-1.5 text-destructive">
                      Only {l.onHand} of <bdi>{l.title}</bdi> in stock.
                    </li>
                  ))}
                  {belowCost.map((l) => (
                    <li key={l.key} className="rounded-md border border-warning/30 bg-warning-subtle px-2 py-1.5 text-warning">
                      <bdi>{l.title}</bdi> is priced below its {money(l.unitCost)} cost.
                    </li>
                  ))}
                  {phone.length > 0 && !phoneOk && (
                    <li className="rounded-md border border-destructive/30 bg-destructive-subtle px-2 py-1.5 text-destructive">
                      The phone number is not a valid Egyptian mobile.
                    </li>
                  )}
                </ul>
              )}

              {state.status === 'error' && (
                <p
                  role="alert"
                  className="mt-4 flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive-subtle px-2 py-1.5 text-[11px] text-destructive"
                >
                  <AlertCircle className="mt-px size-3.5 shrink-0" strokeWidth={2} />
                  {state.message}
                </p>
              )}
            </Scroller>

            <div className="shrink-0 border-t border-border p-4">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <span className="text-[11px] font-medium tracking-[0.07em] text-muted-foreground uppercase">
                  Total
                </span>
                <span className="text-xl font-semibold tabular-nums">{money(total)}</span>
              </div>
              <button
                type="submit"
                disabled={!ready || pending}
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-foreground text-[13px] font-medium text-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40"
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                {pending ? 'Creating' : 'Create order'}
              </button>
            </div>
          </DetailPane>
        </Split>
      </Screen>
    </form>
  );
}

function Legend({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('text-[11px] font-medium tracking-[0.07em] text-muted-foreground uppercase', className)}>
      {children}
    </p>
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
      <label htmlFor={htmlFor} className="mb-1 block text-[11px] text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
