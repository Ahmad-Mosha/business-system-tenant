import { ORDER_STATUS_LABELS, type OrderStatus } from '@app/contracts';
import { cn } from '@/lib/cn';

/**
 * Tone maps to what the state means for the business, not to a rainbow:
 * blue = in progress, amber = waiting on someone, green = money/goods landed,
 * red = stopped, grey = handed off and out of our hands.
 */
export const STATUS_TONES: Record<OrderStatus, string> = {
  NEW: 'text-info bg-info-bg border-info-border',
  CONTACTED: 'text-warn bg-warn-bg border-warn-border',
  CONFIRMED: 'text-info bg-info-bg border-info-border',
  READY_TO_SHIP: 'text-info bg-info-bg border-info-border',
  SHIPPED: 'text-ink-2 bg-line-soft border-line',
  DELIVERED: 'text-ok bg-ok-bg border-ok-border',
  COLLECTED: 'text-ok bg-ok-bg border-ok-border',
  RETURNED: 'text-bad bg-bad-bg border-bad-border',
  ON_HOLD: 'text-warn bg-warn-bg border-warn-border',
  CANCELLED: 'text-bad bg-bad-bg border-bad-border',
};

export function StatusPill({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5',
        'text-[11.5px] font-medium leading-5',
        STATUS_TONES[status],
        className,
      )}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
