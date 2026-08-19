'use client';

import {
  ALLOWED_TRANSITIONS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_MEANING,
  type OrderStatus,
} from '@app/contracts';
import { ChevronDown, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { Menu, type MenuOption } from './ui/menu';
import { STATUS_TONES } from './ui/status-pill';

/**
 * The status itself is the control: click the pill, pick the next state.
 *
 * Legal moves come from ALLOWED_TRANSITIONS - the same table the API enforces -
 * so this can never offer a transition the server would reject. When there are
 * none left (CANCELLED, RETURNED) it renders as a plain pill with no affordance.
 */
export function StatusControl({
  orderId,
  status,
  canUpdate,
  size = 'sm',
}: {
  orderId: string;
  status: OrderStatus;
  canUpdate: boolean;
  size?: 'sm' | 'md';
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transitions = canUpdate ? ALLOWED_TRANSITIONS[status] : [];
  const interactive = transitions.length > 0;

  async function move(next: OrderStatus) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: next }),
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

  const pill = cn(
    'inline-flex items-center gap-1 whitespace-nowrap rounded-md border font-medium leading-5',
    size === 'md' ? 'px-2.5 py-1 text-[12.5px]' : 'px-2 py-0.5 text-[11.5px]',
    STATUS_TONES[status],
  );

  if (!interactive) {
    return <span className={pill}>{ORDER_STATUS_LABELS[status]}</span>;
  }

  const options: MenuOption[] = transitions.map((next) => ({
    key: next,
    label: `Mark ${ORDER_STATUS_LABELS[next].toLowerCase()}`,
    description: ORDER_STATUS_MEANING[next],
    tone: next === 'CANCELLED' || next === 'RETURNED' ? 'danger' : 'default',
    onSelect: () => void move(next),
  }));

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Menu
        label="Change status"
        options={options}
        trigger={
          <button
            type="button"
            disabled={busy}
            aria-label={`Status: ${ORDER_STATUS_LABELS[status]}. Change status.`}
            className={cn(
              pill,
              'cursor-pointer transition-shadow',
              'hover:shadow-[0_0_0_3px_rgba(0,0,0,0.04)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20',
              'disabled:cursor-wait disabled:opacity-70',
            )}
          >
            {busy ? (
              <Loader2 className="size-3 animate-spin" aria-hidden />
            ) : null}
            {ORDER_STATUS_LABELS[status]}
            <ChevronDown className="size-3 opacity-50" aria-hidden />
          </button>
        }
      />
      {error ? (
        <span role="alert" className="text-[11px] text-bad">
          {error}
        </span>
      ) : null}
    </span>
  );
}
