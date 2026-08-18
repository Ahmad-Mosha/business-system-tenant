import { ORDER_STATUS_LABELS, type OrderStatus } from '@app/contracts';
import { cn } from '@/lib/cn';

/**
 * A dot and a word, not a filled pill. Colour marks the exception - the statuses that
 * need a human - so a screen of ordinary orders stays quiet.
 */
const TONES: Record<OrderStatus, string> = {
  NEW: 'bg-ink-faint',
  CONTACTED: 'bg-warn',
  CONFIRMED: 'bg-accent',
  READY_TO_SHIP: 'bg-accent',
  SHIPPED: 'bg-ink-soft',
  ON_HOLD: 'bg-warn',
  CANCELLED: 'bg-danger',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-[13px] text-ink-soft">
      <span
        aria-hidden
        className={cn('size-1.5 shrink-0 rounded-full', TONES[status])}
      />
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
