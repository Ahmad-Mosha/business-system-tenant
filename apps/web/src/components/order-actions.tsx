'use client';

import { Check, Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { assignOrder, setOrderStatus, setPaymentStatus } from '@/app/(app)/orders/actions';
import { isReverse, NEXT_STATUSES, STATUS_LABELS } from '@/components/order-status';
import type { OrderStatus, PaymentStatus } from '@/lib/api';
import { cn } from '@/lib/utils';

const PAYMENTS: PaymentStatus[] = ['UNPAID', 'PAID', 'REFUNDED'];

/** Every move available on this order, beside the summary it belongs to. */
export function OrderActions({
  orderId,
  status,
  paymentStatus,
  assignedToId,
  assignees,
  canAssign,
}: {
  orderId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  assignedToId: string | null;
  assignees: Array<{ id: string; name: string }>;
  canAssign: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const run = (label: string, fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setBusy(label);
    startTransition(async () => {
      const result = await fn();
      setBusy(null);
      if (result.ok) toast.success('Order updated.');
      else toast.error(result.message ?? 'Could not update the order.');
    });
  };

  const next = NEXT_STATUSES[status];
  const button =
    'inline-flex h-[var(--control-h)] items-center gap-1.5 rounded-md border px-2.5 text-[13px] transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <h2 className="mb-4 text-[15px] font-semibold">Workflow</h2>
      <div className="space-y-3">
        {canAssign && (
          <label className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-[11px] text-muted-foreground">Assigned</span>
            <select
              value={assignedToId ?? ''}
              disabled={pending}
              onChange={(e) => run('assign', () => assignOrder(orderId, e.target.value || null))}
              className="h-[var(--control-h)] min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-[13px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <option value="">Unassigned</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-16 shrink-0 text-[11px] text-muted-foreground">Move to</span>
          {next.length ? (
            next.map((s) => (
              <button
                key={s}
                type="button"
                disabled={pending}
                onClick={() => run(s, () => setOrderStatus(orderId, s))}
                className={cn(
                  button,
                  isReverse(s)
                    ? 'border-destructive/30 text-destructive hover:bg-destructive-subtle'
                    : 'border-border font-medium hover:bg-accent',
                )}
              >
                {busy === s && <Loader2 className="size-3.5 animate-spin" />}
                {STATUS_LABELS[s]}
              </button>
            ))
          ) : (
            <span className="text-[13px] text-muted-foreground">Final state</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-16 shrink-0 text-[11px] text-muted-foreground">Payment</span>
          {PAYMENTS.filter((p) => p !== paymentStatus).map((p) => (
            <button
              key={p}
              type="button"
              disabled={pending}
              onClick={() => run(p, () => setPaymentStatus(orderId, p))}
              className={cn(button, 'border-border hover:bg-accent')}
            >
              {busy === p ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : p === 'PAID' ? (
                <Check className="size-3.5" />
              ) : null}
              {p === 'UNPAID' ? 'Unpaid' : p === 'PAID' ? 'Paid' : 'Refunded'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
