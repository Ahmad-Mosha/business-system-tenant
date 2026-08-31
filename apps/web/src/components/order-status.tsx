import type { OrderStatus, PaymentStatus } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * One definition of how a status looks, used everywhere a status appears.
 */
export const STATUS_STYLES: Record<OrderStatus, string> = {
  NEW: 'border-border bg-muted text-foreground',
  ASSIGNED: 'border-border bg-muted text-foreground',
  CONFIRMED: 'border-foreground/25 bg-foreground/5 text-foreground',
  SHIPPED: 'border-foreground/25 bg-foreground/5 text-foreground',
  DELIVERED: 'border-success/30 bg-success-subtle text-success',
  CANCELLED: 'border-destructive/30 bg-destructive-subtle text-destructive',
  RETURNED: 'border-warning/30 bg-warning-subtle text-warning',
};

export const STATUS_DESCRIPTIONS: Record<OrderStatus, string> = {
  NEW: 'Newly placed order, awaiting assignment or confirmation',
  ASSIGNED: 'Assigned to a moderator to review and contact customer',
  CONFIRMED: 'Customer verified address & order is ready to fulfill',
  SHIPPED: 'Dispatched with courier (e.g. Bosta) for delivery',
  DELIVERED: 'Successfully handed over to customer',
  CANCELLED: 'Order was cancelled before fulfillment',
  RETURNED: 'Delivery failed or customer returned the package',
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'New',
  ASSIGNED: 'Assigned',
  CONFIRMED: 'Confirmed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned',
};

export const ALL_ORDER_STATUSES: OrderStatus[] = [
  'NEW',
  'ASSIGNED',
  'CONFIRMED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
];

/**
 * Mirrors ALLOWED_TRANSITIONS in the API. The API remains the authority; this
 * only avoids offering a move that would be refused. One definition — it was
 * previously copied into both the list menu and the detail workflow.
 */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['ASSIGNED', 'CONFIRMED', 'CANCELLED'],
  ASSIGNED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

/** A move that undoes rather than advances — styled as destructive. */
export const isReverse = (s: OrderStatus) => s === 'CANCELLED' || s === 'RETURNED';

const PAYMENT_STYLES: Record<PaymentStatus, string> = {
  UNPAID: 'border-border bg-transparent text-muted-foreground',
  PAID: 'border-success/30 bg-success-subtle text-success',
  REFUNDED: 'border-warning/30 bg-warning-subtle text-warning',
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  UNPAID: 'Unpaid',
  PAID: 'Paid',
  REFUNDED: 'Refunded',
};

const BASE =
  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap';

/** The dot carries the state at a glance; the label says which state it is. */
export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span className={cn(BASE, STATUS_STYLES[status], className)}>
      <span className="size-1.5 shrink-0 rounded-full bg-current opacity-70" />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PaymentBadge({
  status,
  className,
}: {
  status: PaymentStatus;
  className?: string;
}) {
  return (
    <span className={cn(BASE, PAYMENT_STYLES[status], className)}>{PAYMENT_LABELS[status]}</span>
  );
}

export function SourceLabel({ source }: { source: 'EASYORDERS' | 'SOCIAL' }) {
  return (
    <span className="text-xs text-muted-foreground">
      {source === 'EASYORDERS' ? 'Website' : 'Social'}
    </span>
  );
}

/**
 * Channel labels. One definition, used by the inventory table and the filter
 * chips so a channel looks identical everywhere.
 */
export const CHANNEL_LABELS: Record<string, string> = {
  noon: 'noon',
  amazon: 'Amazon',
  easyorders: 'Website',
  website: 'Website',
  social: 'Social',
};

/**
 * Deliberately monochrome.
 *
 * Marketplace brand colours were tried here and removed: a channel is not a
 * state, so colouring it competes with the badges that do mean something, and
 * noon's yellow collided with the `warning` token. The channel is identified by
 * its name — which is unambiguous — not by a hue the reader has to learn.
 */
export function ChannelBadge({ channel, className }: { channel: string; className?: string }) {
  const key = (channel ?? '').toLowerCase();
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded border border-border px-1.5 py-0.5',
        'text-[11px] font-medium whitespace-nowrap text-muted-foreground',
        className,
      )}
    >
      {CHANNEL_LABELS[key] ?? channel}
    </span>
  );
}

