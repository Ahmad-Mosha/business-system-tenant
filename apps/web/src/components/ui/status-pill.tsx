import { ORDER_STATUS_LABELS, type OrderStatus } from '@app/contracts';
import { cn } from '@/lib/cn';

/** Tone marks what needs a human: amber waiting, red stopped, green moving. */
const TONES: Record<OrderStatus, string> = {
  NEW: 'bg-info-bg text-info',
  CONTACTED: 'bg-warn-bg text-warn',
  CONFIRMED: 'bg-ok-bg text-ok',
  READY_TO_SHIP: 'bg-ok-bg text-ok',
  SHIPPED: 'bg-mute-bg text-mute',
  ON_HOLD: 'bg-warn-bg text-warn',
  CANCELLED: 'bg-bad-bg text-bad',
};

export function StatusPill({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-md px-2 py-1 text-[12px] font-medium',
        TONES[status],
        className,
      )}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
