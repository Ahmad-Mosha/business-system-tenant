'use client';

import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { setOrderStatus } from '@/app/(app)/orders/actions';
import {
  ALL_ORDER_STATUSES,
  isReverse,
  NEXT_STATUSES,
  StatusBadge,
  STATUS_LABELS,
} from '@/components/order-status';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { OrderStatus } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Changes an order's status straight from the list, so a moderator working a
 * batch never has to open each order.
 *
 * The row is a link, so every interactive part here stops propagation —
 * otherwise choosing a status would also navigate.
 *
 * `canRevert` (admin only) lifts the guided forward-only path: every status
 * becomes reachable, grouped under "Other statuses" below the usual next
 * steps, so a mistake (confirmed by accident, say) can be undone from here —
 * the API enforces the same rule, this only decides what's offered.
 */
export function OrderStatusMenu({
  orderId,
  status,
  canRevert = false,
}: {
  orderId: string;
  status: OrderStatus;
  canRevert?: boolean;
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const next = NEXT_STATUSES[status];
  const other = canRevert
    ? ALL_ORDER_STATUSES.filter((s) => s !== status && !next.includes(s))
    : [];

  // A final state with no revert power has nowhere to go; render the badge alone.
  if (!next.length && !other.length) return <StatusBadge status={status} />;

  const move = (to: OrderStatus) =>
    start(async () => {
      const result = await setOrderStatus(orderId, to);
      if (result.ok) toast.success(`Moved to ${STATUS_LABELS[to].toLowerCase()}.`);
      else toast.error(result.message);
    });

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={pending}
          aria-label={`Change status, currently ${STATUS_LABELS[status]}`}
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
          <StatusBadge status={status} />
          {pending ? (
            <Loader2 className="size-3 animate-spin text-muted-foreground" />
          ) : (
            <ChevronDown className="size-3 text-muted-foreground/60" />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-48"
        onClick={(e) => e.stopPropagation()}
      >
        {next.length > 0 && (
          <>
            <DropdownMenuLabel className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
              Move to
            </DropdownMenuLabel>
            {next.map((s) => (
              <DropdownMenuItem
                key={s}
                onSelect={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  move(s);
                }}
                className={cn(
                  'text-sm',
                  isReverse(s) &&
                    'text-destructive focus:bg-destructive-subtle focus:text-destructive',
                )}
              >
                {STATUS_LABELS[s]}
              </DropdownMenuItem>
            ))}
          </>
        )}
        {other.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
              Other statuses
            </DropdownMenuLabel>
            {other.map((s) => (
              <DropdownMenuItem
                key={s}
                onSelect={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  move(s);
                }}
                className={cn(
                  'text-sm',
                  isReverse(s) &&
                    'text-destructive focus:bg-destructive-subtle focus:text-destructive',
                )}
              >
                {STATUS_LABELS[s]}
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
          <Check className="size-3" />
          Now: {STATUS_LABELS[status]}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
