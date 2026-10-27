import { useTranslations } from 'next-intl';
import { ToneBadge, type Tone } from '@/components/tone-badge';
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
  REFUND_DUE: 'warning',
  REFUNDED: 'warning',
};

/** Payment direction was never a guided flow — any status can move to any other. */
export const ALL_PAYMENT_STATUSES: PaymentStatus[] = ['UNPAID', 'PAID', 'REFUND_DUE', 'REFUNDED'];

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const t = useTranslations('enums.orderStatus');
  return (
    <ToneBadge tone={STATUS_TONE[status]} className={className}>
      {t(status)}
    </ToneBadge>
  );
}

export function PaymentBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  const t = useTranslations('enums.paymentStatus');
  return (
    <ToneBadge tone={PAYMENT_TONE[status]} className={className}>
      {t(status)}
    </ToneBadge>
  );
}
