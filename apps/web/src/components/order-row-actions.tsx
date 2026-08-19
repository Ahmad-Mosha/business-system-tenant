'use client';

import { ALLOWED_TRANSITIONS, ORDER_STATUS_LABELS, type OrderStatus } from '@app/contracts';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DropdownMenu, type MenuItem } from './ui/dropdown-menu';

/**
 * The per-row "more" menu from the approved reference - the quick action point for
 * status changes without leaving the list. Legal transitions are computed from the
 * shared table in @app/contracts, the same one the API enforces, so this can never
 * offer a move the server would reject.
 */
export function OrderRowActions({
  orderId,
  orderNumber,
  status,
  canUpdateStatus,
}: {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  canUpdateStatus: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function move(next: OrderStatus) {
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const transitions = canUpdateStatus ? ALLOWED_TRANSITIONS[status] : [];

  const items: MenuItem[] = [
    {
      key: 'open',
      label: 'Open order',
      description: orderNumber,
      onSelect: () => router.push(`/orders/${orderId}`),
    },
    ...transitions.map((next): MenuItem => ({
      key: next,
      label: `Mark ${ORDER_STATUS_LABELS[next].toLowerCase()}`,
      tone: next === 'CANCELLED' ? 'danger' : 'default',
      onSelect: () => void move(next),
    })),
  ];

  return (
    <DropdownMenu
      align="end"
      disabled={busy}
      items={items}
      trigger={
        <span className="flex size-7 items-center justify-center rounded text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-line-soft hover:text-ink">
          <svg viewBox="0 0 20 20" className="size-[18px]" fill="currentColor" aria-hidden>
            <circle cx="10" cy="4" r="1.6" />
            <circle cx="10" cy="10" r="1.6" />
            <circle cx="10" cy="16" r="1.6" />
          </svg>
          <span className="sr-only">Actions for {orderNumber}</span>
        </span>
      }
    />
  );
}
