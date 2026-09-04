'use client';

import { Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { searchVariants } from '@/app/(app)/orders/actions';
import { saveInvoice, type InvoicePayload } from '@/app/(app)/money/actions';
import { AddProductDialog } from '@/components/add-product-dialog';
import { ContextBar, Screen } from '@/components/shell';
import { Button } from '@/components/ui/button';
import type { SupplierRow } from '@/lib/api';
import { money } from '@/lib/format';
import { previewLanded } from '@/lib/money';
import { cn } from '@/lib/utils';

interface Line {
  key: string;
  variantId: string;
  label: string;
  quantity: number;
  unitCost: string;
  onHand: number | null;
}

type Hit = Awaited<ReturnType<typeof searchVariants>>[number];
const todayISO = () => new Date().toISOString().slice(0, 10);
const field =
  'h-8 w-full rounded-md border border-border bg-card px-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60';

export function InvoiceBuilder({
  suppliers,
  cashBalance,
}: {
  suppliers: SupplierRow[];
  cashBalance: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [supplierId, setSupplierId] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [payment, setPayment] = useState<'CASH' | 'CREDIT'>('CREDIT');
  const [allocation, setAllocation] = useState<'BY_VALUE' | 'PER_UNIT'>('BY_VALUE');
  const [extraCosts, setExtraCosts] = useState('');
  const [lines, setLines] = useState<Line[]>([]);

  const supplier = suppliers.find((s) => s.id === supplierId);
  const numeric = lines.map((l) => ({ quantity: l.quantity, unitCost: Number(l.unitCost) || 0 }));
  const goods = numeric.reduce((s, l) => s + l.quantity * l.unitCost, 0);
  const extra = Number(extraCosts) || 0;
  const total = goods + extra;
  const landed = previewLanded(numeric, extra, allocation);

  const removeLine = (key: string) => setLines((ls) => ls.filter((l) => l.key !== key));
  const patchLine = (key: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = (variantId: string, label: string, onHand: number | null, unitCost = '') => {
    if (lines.some((l) => l.variantId === variantId)) return;
    setLines((ls) => [
      ...ls,
      { key: crypto.randomUUID(), variantId, label, quantity: 1, unitCost, onHand },
    ]);
  };

  const submit = (asDraft: boolean) => {
    const payload: InvoicePayload = {
      supplierId,
      invoiceNo: invoiceNo.trim() || undefined,
      invoiceDate,
      payment,
      allocation,
      extraCosts: extraCosts.trim() || '0',
      lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitCost: l.unitCost })),
    };
    start(async () => {
      const res = await saveInvoice(payload, asDraft);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(asDraft ? 'Draft saved.' : 'Invoice posted.');
      router.push(`/money/purchases/${res.id}`);
    });
  };

  return (
    <Screen>
      <ContextBar back="/money/purchases" title="New purchase invoice" />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-5 p-4">
          {/* Supplier + terms */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <Lbl>Supplier</Lbl>
              <select className={field} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Choose…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <Lbl>Payment</Lbl>
              <select
                className={field}
                value={payment}
                onChange={(e) => setPayment(e.target.value as 'CASH' | 'CREDIT')}
              >
                <option value="CREDIT">On credit — pay the supplier later</option>
                <option value="CASH">Paid in cash now</option>
              </select>
            </label>
            <label className="grid gap-1.5">
              <Lbl>Invoice ref (optional)</Lbl>
              <input className={field} value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="the supplier's number" />
            </label>
            <label className="grid gap-1.5">
              <Lbl>Invoice date</Lbl>
              <input type="date" className={field} value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </label>
          </div>

          {/* Products */}
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <Lbl>Products received</Lbl>
              <span className="text-[11px] text-muted-foreground">
                pick from inventory, or add a new product
              </span>
            </div>
            <ProductPicker chosen={lines.map((l) => l.variantId)} onExisting={addLine} onNew={addLine} />

            {lines.length > 0 && (
              <div className="mt-2 overflow-hidden rounded-lg border border-border">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[10.5px] tracking-[0.06em] text-muted-foreground uppercase">
                      <th className="px-3 py-1.5 text-left font-medium">Product</th>
                      <th className="px-2 py-1.5 text-right font-medium">Qty</th>
                      <th className="px-2 py-1.5 text-right font-medium">Unit cost</th>
                      <th className="px-2 py-1.5 text-right font-medium">Landed</th>
                      <th className="px-2 py-1.5 text-right font-medium">Line</th>
                      <th className="w-7" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={l.key} className="border-b border-border/60 last:border-b-0">
                        <td className="px-3 py-1.5">
                          <bdi>{l.label}</bdi>
                          {l.onHand !== null && (
                            <span className="ms-2 text-[11px] text-muted-foreground">
                              {l.onHand} on hand
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <input
                            type="number"
                            min={1}
                            value={l.quantity}
                            onChange={(e) =>
                              patchLine(l.key, { quantity: Math.max(1, Number(e.target.value) || 1) })
                            }
                            className="h-7 w-14 rounded border border-border bg-card px-1.5 text-right tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <input
                            inputMode="decimal"
                            value={l.unitCost}
                            onChange={(e) => patchLine(l.key, { unitCost: e.target.value })}
                            placeholder="0.00"
                            className="h-7 w-20 rounded border border-border bg-card px-1.5 text-right tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                          {landed[i] ? money(landed[i].landedUnitCost) : '—'}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {money(l.quantity * (Number(l.unitCost) || 0))}
                        </td>
                        <td className="px-1.5 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(l.key)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="Remove line"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Extra costs */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <Lbl>Shipping, customs &amp; clearance (EGP)</Lbl>
              <input
                inputMode="decimal"
                className={cn(field, 'text-right tabular-nums')}
                value={extraCosts}
                onChange={(e) => setExtraCosts(e.target.value)}
                placeholder="0.00"
              />
            </label>
            <label className="grid gap-1.5">
              <Lbl>Spread across the goods</Lbl>
              <select
                className={field}
                value={allocation}
                onChange={(e) => setAllocation(e.target.value as 'BY_VALUE' | 'PER_UNIT')}
              >
                <option value="BY_VALUE">By value (recommended)</option>
                <option value="PER_UNIT">Evenly per unit</option>
              </select>
            </label>
          </div>

          {/* Money summary — the point of the whole screen */}
          <div className="rounded-lg border border-border bg-card px-4 py-3 text-[13px]">
            <SummaryRow label="Goods" value={money(goods)} muted />
            <SummaryRow label="Shipping & customs" value={money(extra)} muted />
            <SummaryRow label="Total for this invoice" value={money(total)} strong />
            {lines.length > 0 && (
              <p className="mt-2 border-t border-border pt-2 text-[12px] text-muted-foreground">
                {payment === 'CASH' ? (
                  <>
                    On posting, <b className="text-foreground">{money(total)} leaves cash</b> —
                    الخزينة goes {money(cashBalance)} → {money(Number(cashBalance) - total)}.
                  </>
                ) : (
                  <>
                    On posting, <b className="text-foreground">{money(total)} is added to what you owe{' '}
                    {supplier ? <bdi>{supplier.name}</bdi> : 'the supplier'}</b>. Record the
                    payment from their page when you pay them.
                  </>
                )}{' '}
                Either way, {money(total)} of stock value is added.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-2.5">
        <Button variant="outline" size="lg" disabled={pending || !lines.length} onClick={() => submit(true)}>
          Save draft
        </Button>
        <Button
          size="lg"
          disabled={pending || !lines.length || !supplierId}
          onClick={() => submit(false)}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : `Post — ${money(total)}`}
        </Button>
      </div>
    </Screen>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium tracking-[0.03em] text-muted-foreground uppercase">
      {children}
    </span>
  );
}

function SummaryRow({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between py-1',
        strong && 'mt-1 border-t border-border pt-2 font-semibold',
      )}
    >
      <span className={cn(muted && 'text-muted-foreground')}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function ProductPicker({
  chosen,
  onExisting,
  onNew,
}: {
  chosen: string[];
  onExisting: (variantId: string, label: string, onHand: number | null, unitCost?: string) => void;
  onNew: (variantId: string, label: string, onHand: number | null) => void;
}) {
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!term.trim()) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => setHits(await searchVariants(term)), 250);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={box} className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search products by Arabic name or SKU…"
        className="h-9 w-full rounded-md border border-border bg-card pr-3 pl-9 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {open && term.trim() && (
        <div className="absolute inset-x-0 z-20 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          {hits.length > 0 && (
            <ul className="max-h-56 overflow-y-auto">
              {hits.map((h) => {
                const taken = chosen.includes(h.id);
                return (
                  <li key={h.id}>
                    <button
                      type="button"
                      disabled={taken}
                      onClick={() => {
                        onExisting(h.id, h.label, h.onHand, h.unitCost ?? '');
                        setTerm('');
                        setOpen(false);
                      }}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-accent disabled:opacity-40"
                    >
                      <bdi className="truncate">{h.label}</bdi>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {taken ? 'added' : `${h.onHand} on hand`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setOpen(false);
            }}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-accent',
              hits.length > 0 && 'border-t border-border',
            )}
          >
            <Plus className="size-3.5" />
            Add “<bdi>{term.trim()}</bdi>” as a new product
          </button>
        </div>
      )}

      <AddProductDialog
        open={creating}
        onOpenChange={setCreating}
        initialName={term.trim()}
        onCreated={(variantId, label) => {
          onNew(variantId, label, 0);
          setTerm('');
        }}
      />
    </div>
  );
}
