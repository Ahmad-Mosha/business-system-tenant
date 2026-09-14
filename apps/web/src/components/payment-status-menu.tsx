'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { setPaymentStatus } from '@/app/(app)/orders/actions';
import { InlineMenu } from '@/components/inline-menu';
import { ALL_PAYMENT_STATUSES, PAYMENT_LABELS, PaymentBadge } from '@/components/order-status';
import type { PaymentStatus } from '@/lib/api';

/**
 * Changes an order's payment status straight from the list — always free-form
 * (unpaid ↔ paid ↔ refunded never had a guided flow).
 */
export function PaymentStatusMenu({
  orderId,
  status,
}: {
  orderId: string;
  status: PaymentStatus;
}) {
  const [pending, start] = useTransition();

  return (
    <InlineMenu
      label={`Change payment, currently ${PAYMENT_LABELS[status]}`}
      trigger={<PaymentBadge status={status} />}
      pending={pending}
      sections={[
        {
          heading: 'Mark as',
          items: ALL_PAYMENT_STATUSES.map((s) => ({
            value: s,
            label: PAYMENT_LABELS[s],
            current: s === status,
          })),
        },
      ]}
      onSelect={(to) => {
        if (to === status) return;
        start(async () => {
          const result = await setPaymentStatus(orderId, to);
          if (result.ok) toast.success(`Marked ${PAYMENT_LABELS[to as PaymentStatus].toLowerCase()}.`);
          else toast.error(result.message);
        });
      }}
    />
  );
}
