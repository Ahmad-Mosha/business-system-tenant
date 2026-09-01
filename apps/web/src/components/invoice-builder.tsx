'use client';

import { ArrowLeft, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { searchVariants } from '@/app/(app)/orders/actions';
import { saveInvoice, type InvoicePayload } from '@/app/(app)/money/actions';
import { Screen } from '@/components/shell';
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
  onHand: number;
}

type Hit = Awaited<ReturnType<typeof searchVariants>>[number];
const todayISO = () => new Date().toISOString().slice(0, 10);
const field =
  'h-9 w-full rounded-md border border-border bg-card px-3 text-[13px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60';

export function InvoiceBuilder({ suppliers }: { suppliers: SupplierRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [supplierId, setSupplierId] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [payment, setPayment] = useState<'CASH' | 'CREDIT'>('CREDIT');
  const [allocation, setAllocation] = useState<'BY_VALUE' | 'PER_UNIT'>('BY_VALUE');
  const [extraCosts, setExtraCosts] = useState('');
  const [lines, setLines] = useState<Line[]>([]);

  const numeric = lines.map((l) => ({ quantity: l.quantity, unitCost: Number(l.unitCost) || 0 }));
  const goods = numeric.reduce((s, l) => s + l.quantity * l.unitCost, 0);
  const extra = Number(extraCosts) || 0;
  const landed = previewLanded(numeric, extra, allocation);

  const removeLine = (key: string) => setLines((ls) => ls.filter((l) => l.key !== key));
  const patchLine = (key: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addHit = (h: Hit) => {
    if (lines.some((l) => l.variantId === h.id)) return;
    setLines((ls) => [
      ...ls,
      {
        key: crypto.randomUUID(),
        variantId: h.id,
        label: h.label,
        quantity: 1,
        unitCost: h.unitCost ?? '',
        onHand: h.onHand,
      },
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
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-4 overflow-y-auto p-4">
        <Link
          href="/money/purchases"
          className="inline-flex w-fit items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Purchases
        </Link>
        <h1 className="text-xl font-semibold tracking-[-0.02em]">New purchase invoice</h1>

        <section className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
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
              <option value="CREDIT">On credit — pay later</option>
              <option value="CASH">Paid cash now</option>
            </select>
          </label>
          <label className="grid gap-1.5">
            <Lbl>Invoice ref (optional)</Lbl>
            <input className={field} value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="supplier's number" />
          </label>
          <label className="grid gap-1.5">
            <Lbl>Invoice date</Lbl>
            <input type="date" className={field} value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </label>
        </section>

        <section className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-2.5 text-[13px] font-semibold">Products</div>
          <ProductSearch onPick={addHit} chosen={lines.map((l) => l.variantId)} />
          {lines.length > 0 && (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
                  <th className="px-4 py-2 text-left font-medium">Product</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Unit cost</th>
                  <th className="px-3 py-2 text-right font-medium">Landed unit</th>
                  <th className="px-3 py-2 text-right font-medium">Line</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={l.key} className="border-b border-border/60 last:border-b-0">
                    <td className="px-4 py-1.5" dir="rtl">
                      {l.label}
                      <span className="ms-2 text-[11px] text-muted-foreground" dir="ltr">
                        {l.onHand} on hand
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <input
                        type="number"
                        min={1}
                        value={l.quantity}
                        onChange={(e) => patchLine(l.key, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                        className="h-7 w-16 rounded border border-border bg-card px-2 text-right tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <input
                        inputMode="decimal"
                        value={l.unitCost}
                        onChange={(e) => patchLine(l.key, { unitCost: e.target.value })}
                        placeholder="0.00"
                        className="h-7 w-20 rounded border border-border bg-card px-2 text-right tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                      {landed[i] ? money(landed[i].landedUnitCost) : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {money(l.quantity * (Number(l.unitCost) || 0))}
                    </td>
                    <td className="px-2 py-1.5 text-center">
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
          )}
        </section>

        <section className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <Lbl>Shipping, customs &amp; clearance (EGP)</Lbl>
            <input
              inputMode="decimal"
              className={cn(field, 'tabular-nums')}
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
        </section>

        <section className="rounded-xl border border-border bg-card px-4 py-3 text-[13px]">
          <Row label="Goods" value={money(goods)} />
          <Row label="Shipping & customs" value={money(extra)} muted />
          <Row label="Landed into stock" value={money(goods + extra)} strong />
        </section>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-background/95 py-3 backdrop-blur">
          <Button variant="outline" size="lg" disabled={pending || !lines.length} onClick={() => submit(true)}>
            Save draft
          </Button>
          <Button size="lg" disabled={pending || !lines.length || !supplierId} onClick={() => submit(false)}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : 'Post invoice'}
          </Button>
        </div>
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

function Row({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
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

function ProductSearch({ onPick, chosen }: { onPick: (h: Hit) => void; chosen: string[] }) {
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
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
    <div ref={box} className="relative border-b border-border px-4 py-2.5">
      <Search className="pointer-events-none absolute top-1/2 left-7 size-3.5 -translate-y-1/2 text-muted-foreground" />
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
      {open && hits.length > 0 && (
        <ul className="absolute left-4 right-4 z-20 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          {hits.map((h) => {
            const taken = chosen.includes(h.id);
            return (
              <li key={h.id}>
                <button
                  type="button"
                  disabled={taken}
                  onClick={() => {
                    onPick(h);
                    setTerm('');
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-accent disabled:opacity-40"
                >
                  <span dir="rtl" className="truncate">
                    {h.label}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {taken ? 'added' : `${h.onHand} on hand`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <span className="ml-1 inline-flex items-center gap-1 pt-1 text-[11px] text-muted-foreground">
        <Plus className="size-3" /> add each product you received
      </span>
    </div>
  );
}
