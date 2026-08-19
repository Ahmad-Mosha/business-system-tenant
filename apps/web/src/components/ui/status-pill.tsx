import { ORDER_STATUS_LABELS, type OrderStatus } from '@app/contracts';
import { cn } from '@/lib/cn';

/**
 * Tone marks what needs a human, not what happened. NEW and CONTACTED are neutral -
 * merely existing isn't a state worth colouring - so colour stays reserved for what
 * is actually good (CONFIRMED/READY), actually blocked (WARN), or actually stopped
 * (CANCELLED).
 */
const TONES: Record<OrderStatus, string> = {
  NEW: 'bg-mute-bg text-mute',
  CONTACTED: 'bg-warn-bg text-warn',
  CONFIRMED: 'bg-ok-bg text-ok',
  READY_TO_SHIP: 'bg-ok-bg text-ok',
  SHIPPED: 'bg-accent-soft text-accent',
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
