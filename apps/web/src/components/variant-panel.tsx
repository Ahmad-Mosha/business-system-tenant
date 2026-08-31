'use client';

import { Loader2, Minus, Plus } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { recordStock, updateVariant } from '@/app/(app)/inventory/actions';
import { dateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

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

const field =
  'h-9 w-full rounded-md border border-border bg-card px-3 text-[13px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60';

export function VariantPanel({ variant, movements }: { variant: Variant; movements: Movement[] }) {
  const [pending, start] = useTransition();
  const [qty, setQty] = useState('1');
  const [reason, setReason] = useState<string>('PURCHASE');
  const [direction, setDirection] = useState<1 | -1>(1);
  const [cost, setCost] = useState(variant.unitCost ?? '');
  const [price, setPrice] = useState(variant.sellingPrice ?? '');

  const save = () =>
    start(async () => {
      const r = await updateVariant(variant.id, { unitCost: cost || null, sellingPrice: price || null });
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
    <div className="rounded-xl border border-border bg-card shadow-xs">
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium">
            {variant.name}
            {variant.sku ? (
              <code className="ms-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                {variant.sku}
              </code>
            ) : null}
          </p>
          {variant.inOpenOrders > 0 && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {variant.inOpenOrders} in open orders
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xl leading-none font-semibold tabular-nums">{variant.onHand}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">on hand</p>
        </div>
      </div>

      <div className="grid gap-3 border-b border-border px-4 py-3 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">Unit cost</label>
          <input
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            inputMode="decimal"
            placeholder="Not set"
            disabled={pending}
            className={cn(field, 'tabular-nums')}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">Selling price</label>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            inputMode="decimal"
            placeholder="Not set"
            disabled={pending}
            className={cn(field, 'tabular-nums')}
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="inline-flex h-9 min-w-[76px] items-center justify-center rounded-md border border-border bg-card px-3 text-[13px] font-medium transition-colors hover:bg-accent disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2.5 border-b border-border px-4 py-3">
        <div className="flex items-end gap-1">
          <button
            type="button"
            onClick={() => setDirection(1)}
            aria-pressed={direction === 1}
            className={cn(
              'inline-flex size-9 items-center justify-center rounded-md border transition-colors',
              direction === 1 ? 'border-foreground bg-foreground text-background' : 'border-border hover:bg-accent',
            )}
          >
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setDirection(-1)}
            aria-pressed={direction === -1}
            className={cn(
              'inline-flex size-9 items-center justify-center rounded-md border transition-colors',
              direction === -1 ? 'border-foreground bg-foreground text-background' : 'border-border hover:bg-accent',
            )}
          >
            <Minus className="size-4" />
          </button>
        </div>
        <div className="w-20">
          <label className="mb-1 block text-[11px] text-muted-foreground">Quantity</label>
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            inputMode="numeric"
            disabled={pending}
            className={cn(field, 'tabular-nums')}
          />
        </div>
        <div className="min-w-[170px] flex-1">
          <label className="mb-1 block text-[11px] text-muted-foreground">Reason</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)} disabled={pending} className={field}>
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={move}
          disabled={pending || !Number(qty)}
          className="inline-flex h-9 min-w-[100px] items-center justify-center rounded-md bg-foreground px-3 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : 'Record'}
        </button>
      </div>

      {movements.length > 0 && (
        <ul className="max-h-56 overflow-y-auto">
          {movements.map((m, i) => (
            <li
              key={m.id}
              className={cn('flex items-center gap-4 px-4 py-2 text-[13px]', i > 0 && 'border-t border-border')}
            >
              <span
                className={cn(
                  'w-11 shrink-0 text-right font-medium tabular-nums',
                  m.quantity > 0 ? 'text-success' : 'text-muted-foreground',
                )}
              >
                {m.quantity > 0 ? '+' : ''}
                {m.quantity}
              </span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {REASONS.find((r) => r.value === m.reason)?.label ?? m.reason}
                {m.note ? ` · ${m.note}` : ''}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">= {m.runningTotal}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">{dateTime(m.occurredAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
