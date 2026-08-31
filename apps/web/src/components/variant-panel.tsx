'use client';

import { Loader2, Minus, Plus } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { recordStock, updateVariant } from '@/app/(app)/inventory/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { dateTime } from '@/lib/format';

const REASONS = [
  { value: 'PURCHASE', label: 'Purchased' },
  { value: 'RETURN', label: 'Returned by customer' },
  { value: 'DAMAGE', label: 'Damaged or lost' },
  { value: 'COUNT', label: 'Physical count' },
  { value: 'ADJUSTMENT', label: 'Correction' },
] as const;

interface Variant {
  id: string;
  name: string;
  sku: string | null;
  unitCost: string | null;
  sellingPrice: string | null;
  onHand: number;
  inOpenOrders: number;
}

interface Movement {
  id: string;
  quantity: number;
  reason: string;
  note: string | null;
  occurredAt: string;
  runningTotal: number;
}

export function VariantPanel({
  variant,
  movements,
}: {
  variant: Variant;
  movements: Movement[];
}) {
  const [pending, start] = useTransition();
  const [qty, setQty] = useState('1');
  const [reason, setReason] = useState<string>('PURCHASE');
  const [direction, setDirection] = useState<1 | -1>(1);
  const [cost, setCost] = useState(variant.unitCost ?? '');
  const [price, setPrice] = useState(variant.sellingPrice ?? '');

  const save = () =>
    start(async () => {
      const r = await updateVariant(variant.id, {
        unitCost: cost || null,
        sellingPrice: price || null,
      });
      if (r.ok) toast.success('Saved.');
      else toast.error(r.message);
    });

  const move = () =>
    start(async () => {
      const n = Number(qty) * direction;
      const r = await recordStock(variant.id, n, reason);
      if (r.ok) {
        toast.success(`Stock ${direction > 0 ? 'increased' : 'reduced'} by ${Math.abs(n)}.`);
        setQty('1');
      } else toast.error(r.message);
    });

  return (
    <div className="rounded-xl border border-border">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <p className="text-sm font-medium">
            {variant.name}
            {variant.sku ? (
              <code className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                {variant.sku}
              </code>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {variant.onHand} on hand
            {variant.inOpenOrders > 0 ? ` · ${variant.inOpenOrders} in open orders` : ''}
          </p>
        </div>
        <p className="text-2xl font-semibold tabular-nums">{variant.onHand}</p>
      </div>

      <div className="grid gap-4 border-b border-border px-5 py-4 sm:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Unit cost</label>
          <Input
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            inputMode="decimal"
            placeholder="Not set"
            disabled={pending}
            className="tabular-nums"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Selling price</label>
          <Input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            placeholder="Not set"
            disabled={pending}
            className="tabular-nums"
          />
        </div>
        <div className="flex items-end">
          <Button variant="outline" onClick={save} disabled={pending} className="min-w-[84px]">
            {pending ? <Loader2 className="size-4 animate-spin" /> : 'Save'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 border-b border-border px-5 py-4">
        <div className="flex items-end gap-1">
          <button
            type="button"
            onClick={() => setDirection(1)}
            aria-pressed={direction === 1}
            className={`inline-flex size-9 items-center justify-center rounded-md border transition-colors ${direction === 1 ? 'border-foreground bg-foreground text-background' : 'border-border hover:bg-accent'}`}
          >
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setDirection(-1)}
            aria-pressed={direction === -1}
            className={`inline-flex size-9 items-center justify-center rounded-md border transition-colors ${direction === -1 ? 'border-foreground bg-foreground text-background' : 'border-border hover:bg-accent'}`}
          >
            <Minus className="size-4" />
          </button>
        </div>
        <div className="w-24 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Quantity</label>
          <Input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            inputMode="numeric"
            disabled={pending}
            className="tabular-nums"
          />
        </div>
        <div className="min-w-[180px] flex-1 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Reason</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={pending}
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={move} disabled={pending || !Number(qty)} className="min-w-[112px]">
          {pending ? <Loader2 className="size-4 animate-spin" /> : 'Record'}
        </Button>
      </div>

      {movements.length > 0 && (
        <ul className="max-h-64 overflow-y-auto">
          {movements.map((m, i) => (
            <li
              key={m.id}
              className={`flex items-center gap-4 px-5 py-2.5 text-sm ${i > 0 ? 'border-t border-border' : ''}`}
            >
              <span
                className={`w-12 shrink-0 text-right font-medium tabular-nums ${m.quantity > 0 ? 'text-success' : 'text-muted-foreground'}`}
              >
                {m.quantity > 0 ? '+' : ''}
                {m.quantity}
              </span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {REASONS.find((r) => r.value === m.reason)?.label ?? m.reason}
                {m.note ? ` · ${m.note}` : ''}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">= {m.runningTotal}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{dateTime(m.occurredAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
