'use client';

import { Check, Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { assignOrder, setOrderStatus, setPaymentStatus } from '@/app/(app)/orders/actions';
import { PaymentBadge, StatusBadge, STATUS_LABELS } from '@/components/order-status';
import type { OrderStatus, PaymentStatus } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Mirrors ALLOWED_TRANSITIONS in the API. The API is the authority — this only
 * avoids offering a move that would be refused.
 */
const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['ASSIGNED', 'CONFIRMED', 'CANCELLED'],
  ASSIGNED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

const PAYMENTS: PaymentStatus[] = ['UNPAID', 'PAID', 'REFUNDED'];

export function OrderWorkflow({
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
  assignees: Array<{ id: string; name: string; role: string }>;
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

  return (
    <section className="rounded-xl border border-border">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border px-5 py-4">
        <Field label="Status">
          <StatusBadge status={status} />
        </Field>
        <Field label="Payment">
          <PaymentBadge status={paymentStatus} />
        </Field>
        {canAssign && (
          <Field label="Assigned to">
            <select
              value={assignedToId ?? ''}
              disabled={pending}
              onChange={(e) =>
                run('assign', () => assignOrder(orderId, e.target.value || null))
              }
              className="h-8 rounded-md border border-border bg-background px-2 text-[13px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <option value="">Unassigned</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-5 py-4">
        {next.length ? (
          <>
            <span className="mr-1 text-xs text-muted-foreground">Move to</span>
            {next.map((s) => (
              <button
                key={s}
                type="button"
                disabled={pending}
                onClick={() => run(s, () => setOrderStatus(orderId, s))}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50',
                  s === 'CANCELLED' || s === 'RETURNED'
                    ? 'border-destructive/30 text-destructive hover:bg-destructive-subtle'
                    : 'border-border hover:bg-accent',
                )}
              >
                {busy === s && <Loader2 className="size-3.5 animate-spin" />}
                {STATUS_LABELS[s]}
              </button>
            ))}
          </>
        ) : (
          <span className="text-xs text-muted-foreground">
            This order has reached a final state.
          </span>
        )}

        <span className="mx-2 hidden h-5 w-px bg-border sm:block" />

        <span className="mr-1 text-xs text-muted-foreground">Payment</span>
        {PAYMENTS.filter((p) => p !== paymentStatus).map((p) => (
          <button
            key={p}
            type="button"
            disabled={pending}
            onClick={() => run(p, () => setPaymentStatus(orderId, p))}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[13px] transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
          >
            {busy === p ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : p === 'PAID' ? (
              <Check className="size-3.5" />
            ) : null}
            Mark {p.toLowerCase()}
          </button>
        ))}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}
