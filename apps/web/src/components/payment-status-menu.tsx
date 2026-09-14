'use client';

import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { setPaymentStatus } from '@/app/(app)/orders/actions';
import { InlineMenu } from '@/components/inline-menu';
import { ALL_PAYMENT_STATUSES, PaymentBadge } from '@/components/order-status';
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
  const t = useTranslations();
  const [pending, start] = useTransition();
  const name = (s: PaymentStatus) => t(`enums.paymentStatus.${s}`);

  return (
    <InlineMenu
      label={t('status.changePayment', { status: name(status) })}
      trigger={<PaymentBadge status={status} />}
      pending={pending}
      sections={[
        {
          heading: t('status.markAs'),
          items: ALL_PAYMENT_STATUSES.map((s) => ({
            value: s,
            label: name(s),
            current: s === status,
          })),
        },
      ]}
      onSelect={(to) => {
        if (to === status) return;
        start(async () => {
          const result = await setPaymentStatus(orderId, to);
          if (result.ok) toast.success(t('status.markedAs', { status: name(to as PaymentStatus) }));
          else toast.error(result.message);
        });
      }}
    />
  );
}
