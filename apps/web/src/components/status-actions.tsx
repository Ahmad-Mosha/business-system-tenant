'use client';

import { ORDER_STATUS_LABELS, type OrderStatus } from '@app/contracts';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChevronIcon } from './icons';
import { DropdownMenu, type MenuItem } from './ui/dropdown-menu';

/** Plain-language help, so the menu explains the workflow rather than naming states. */
const MEANING: Partial<Record<OrderStatus, string>> = {
  CONTACTED: 'You have reached the customer',
  CONFIRMED: 'Customer confirmed what they want',
  READY_TO_SHIP: 'Packed and waiting for the courier',
  SHIPPED: 'Handed over to the courier',
  ON_HOLD: 'Blocked - waiting on someone or something',
  CANCELLED: 'This order will not go ahead',
};

/**
 * The API decides which transitions are legal for this order and this user; these are
 * only a rendering of that list. The UI never invents a move.
 */
export function StatusActions({
  orderId,
  transitions,
}: {
  orderId: string;
  transitions: OrderStatus[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (transitions.length === 0) {
    return <p className="text-[13px] text-ink-3">No further changes from here.</p>;
  }

  async function move(status: OrderStatus) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(body?.error?.message ?? 'Could not update this order.');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  const items: MenuItem[] = transitions.map((status) => ({
    key: status,
    label: `Mark ${ORDER_STATUS_LABELS[status].toLowerCase()}`,
    description: MEANING[status],
    tone: status === 'CANCELLED' ? 'danger' : 'default',
    onSelect: () => void move(status),
  }));

  return (
    <div className="flex flex-col items-end gap-2">
      <DropdownMenu
        disabled={busy}
        items={items}
        trigger={
          <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-primary-ink">
            {busy ? 'Updating…' : 'Update status'}
            <ChevronIcon className="size-4 rotate-90" />
          </span>
        }
      />
      {error ? (
        <p role="alert" className="text-[13px] text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}
