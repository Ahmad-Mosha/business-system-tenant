'use client';

import { ORDER_STATUS_LABELS, type OrderStatus } from '@app/contracts';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from './ui/button';

/**
 * The API tells the page which transitions are legal for this order and this user;
 * the buttons are just a rendering of that list. The UI never decides the lifecycle.
 */
export function StatusActions({
  orderId,
  transitions,
}: {
  orderId: string;
  transitions: OrderStatus[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (transitions.length === 0) return null;

  async function move(status: OrderStatus) {
    setBusy(status);
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
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {transitions.map((status, i) => (
          <Button
            key={status}
            size="sm"
            variant={status === 'CANCELLED' ? 'danger' : i === 0 ? 'primary' : 'secondary'}
            disabled={busy !== null}
            onClick={() => move(status)}
          >
            {busy === status ? 'Saving' : `Mark ${ORDER_STATUS_LABELS[status].toLowerCase()}`}
          </Button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-[13px] text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}
