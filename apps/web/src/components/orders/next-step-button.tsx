'use client';

import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { setOrderStatus, setPaymentStatus } from '@/app/(app)/orders/actions';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import type { OrderStatus, PaymentStatus } from '@/lib/api';

/**
 * The one move that takes this order forward, as a button — confirm, ship,
 * deliver, collect — so the everyday path is a click, not a menu. The menus
 * below still offer every other move. Nothing left to do, nothing shown.
 */
function nextStep(status: OrderStatus, payment: PaymentStatus) {
  if (status === 'NEW' || status === 'ASSIGNED') return { kind: 'status', to: 'CONFIRMED' } as const;
  if (status === 'CONFIRMED') return { kind: 'status', to: 'SHIPPED' } as const;
  if (status === 'SHIPPED') return { kind: 'status', to: 'DELIVERED' } as const;
  if (status === 'DELIVERED' && payment === 'UNPAID') return { kind: 'payment', to: 'PAID' } as const;
  return null;
}

export function NextStepButton({ orderId, status, payment }: { orderId: string; status: OrderStatus; payment: PaymentStatus }) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  const step = nextStep(status, payment);
  if (!step) return null;
  return (
    <Button
      size="lg"
      className="w-full"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = step.kind === 'status' ? await setOrderStatus(orderId, step.to) : await setPaymentStatus(orderId, step.to);
          if (!result.ok) return void toast.error(result.message);
          toast.success(step.kind === 'status'
            ? t('status.movedTo', { status: t(`enums.orderStatus.${step.to}`) })
            : t('status.markedAs', { status: t(`enums.paymentStatus.${step.to}`) }));
        })
      }
    >
      {pending ? <Spinner /> : null}
      {t(`orders.workflow.next.${step.to}`)}
      <ArrowLeft className="ltr:rotate-180" aria-hidden />
    </Button>
  );
}
