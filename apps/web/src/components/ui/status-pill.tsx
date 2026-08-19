import { ORDER_STATUS_LABELS, type OrderStatus } from '@app/contracts';
import { cn } from '@/lib/cn';

/**
 * Translucent fill over a matching border - the exact treatment from the Stitch
 * reference's status pills, not a flat solid chip.
 */
const TONES: Record<OrderStatus, string> = {
  NEW: 'text-mute bg-mute-bg border-mute-border',
  CONTACTED: 'text-warn bg-warn-bg border-warn-border',
  CONFIRMED: 'text-ok bg-ok-bg border-ok-border',
  READY_TO_SHIP: 'text-ok bg-ok-bg border-ok-border',
  SHIPPED: 'text-ink-2 bg-line-soft border-line',
  ON_HOLD: 'text-warn bg-warn-bg border-warn-border',
  CANCELLED: 'text-bad bg-bad-bg border-bad-border',
};

export function StatusPill({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-medium',
        'border',
        TONES[status],
        className,
      )}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
