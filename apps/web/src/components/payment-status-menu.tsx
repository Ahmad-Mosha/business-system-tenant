'use client';

import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { setPaymentStatus } from '@/app/(app)/orders/actions';
import {
  ALL_PAYMENT_STATUSES,
  PaymentBadge,
  PAYMENT_LABELS,
} from '@/components/order-status';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PaymentStatus } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Changes an order's payment status straight from the list — always free-form
 * (unpaid ↔ paid ↔ refunded never had a guided flow), so this needs no
 * "canRevert" flag the way the status menu does.
 *
 * Same row-is-a-link caveat as OrderStatusMenu: every interactive part stops
 * propagation so choosing a status doesn't also navigate.
 */
export function PaymentStatusMenu({
  orderId,
  status,
}: {
  orderId: string;
  status: PaymentStatus;
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const options = ALL_PAYMENT_STATUSES.filter((s) => s !== status);

  const move = (to: PaymentStatus) =>
    start(async () => {
      const result = await setPaymentStatus(orderId, to);
      if (result.ok) toast.success(`Marked ${PAYMENT_LABELS[to].toLowerCase()}.`);
      else toast.error(result.message);
    });

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={pending}
          aria-label={`Change payment, currently ${PAYMENT_LABELS[status]}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className={cn(
            'relative z-10 inline-flex items-center gap-1 rounded-full transition-opacity',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            pending ? 'opacity-60' : 'hover:opacity-80',
          )}
        >
          <PaymentBadge status={status} />
          {pending ? (
            <Loader2 className="size-3 animate-spin text-muted-foreground" />
          ) : (
            <ChevronDown className="size-3 text-muted-foreground/60" />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-40" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
          Mark as
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((s) => (
          <DropdownMenuItem
            key={s}
            onSelect={(e) => {
              e.preventDefault();
              setOpen(false);
              move(s);
            }}
            className="text-sm"
          >
            {PAYMENT_LABELS[s]}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
          <Check className="size-3" />
          Now: {PAYMENT_LABELS[status]}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
