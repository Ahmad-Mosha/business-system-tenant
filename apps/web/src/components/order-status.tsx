import { ToneBadge, type Tone } from '@/components/tone-badge';
import { Badge } from '@/components/ui/badge';
import type { OrderStatus, PaymentStatus } from '@/lib/api';

/** One definition of what each status means, used everywhere a status appears. */
const STATUS_TONE: Record<OrderStatus, Tone> = {
  NEW: 'neutral',
  ASSIGNED: 'muted',
  CONFIRMED: 'progress',
  SHIPPED: 'progress',
  DELIVERED: 'success',
  CANCELLED: 'danger',
  RETURNED: 'warning',
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
 * only avoids offering a move that would be refused.
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

const PAYMENT_TONE: Record<PaymentStatus, Tone> = {
  UNPAID: 'neutral',
  PAID: 'success',
  REFUNDED: 'warning',
};

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  UNPAID: 'Unpaid',
  PAID: 'Paid',
  REFUNDED: 'Refunded',
};

/** Payment direction was never a guided flow — any status can move to any other. */
export const ALL_PAYMENT_STATUSES: PaymentStatus[] = ['UNPAID', 'PAID', 'REFUNDED'];

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <ToneBadge tone={STATUS_TONE[status]} className={className}>
      {STATUS_LABELS[status]}
    </ToneBadge>
  );
}

export function PaymentBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  return (
    <ToneBadge tone={PAYMENT_TONE[status]} className={className}>
      {PAYMENT_LABELS[status]}
    </ToneBadge>
  );
}

export const sourceLabel = (source: 'EASYORDERS' | 'SOCIAL') =>
  source === 'EASYORDERS' ? 'Website' : 'Social';

/**
 * Channel labels. One definition, used by the inventory table and the filters
 * so a channel looks identical everywhere.
 */
export const CHANNEL_LABELS: Record<string, string> = {
  noon: 'noon',
  amazon: 'Amazon',
  easyorders: 'Website',
  website: 'Website',
  social: 'Social',
};

/**
 * Deliberately monochrome. A channel is an identity, not a state — colouring
 * it would compete with the badges that do mean something (noon's yellow
 * collided with `warning` when it was tried). Its name is unambiguous.
 */
export function ChannelBadge({ channel, className }: { channel: string; className?: string }) {
  const key = (channel ?? '').toLowerCase();
  return (
    <Badge variant="outline" className={className}>
      {CHANNEL_LABELS[key] ?? channel}
    </Badge>
  );
}
