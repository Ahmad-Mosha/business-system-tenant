import { SlidersHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { AssignMenu } from '@/components/orders/assign-menu';
import { NextStepButton } from '@/components/orders/next-step-button';
import { OrderStatusMenu } from '@/components/orders/order-status-menu';
import { PaymentStatusMenu } from '@/components/orders/payment-status-menu';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { OrderStatus, PaymentStatus } from '@/lib/api';

/**
 * Every move available on this order. Built from the same three menus the
 * orders list uses, so a status, payment or assignment change looks and
 * behaves identically everywhere — one component owns each kind of move.
 */
export function OrderActions({
  orderId,
  status,
  paymentStatus,
  assignedToId,
  assignedToName,
  assignees,
  canAssign,
}: {
  orderId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  assignedToId: string | null;
  assignedToName: string | null;
  assignees: Array<{ id: string; name: string }>;
  canAssign: boolean;
}) {
  const t = useTranslations('orders.workflow');
  const tp = useTranslations('orders.detailPreview');
  const ts = useTranslations('status');
  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-2.5 text-base font-semibold">
          <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden />
          {tp('controls')}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{tp('controlsHint')}</p>
      </CardHeader>
      <CardContent className="grid gap-3">
        <NextStepButton orderId={orderId} status={status} payment={paymentStatus} />
        {/* Admins can move an order to any status, including undoing a
            mistake — moderators stay on the guided forward-only path. */}
        <Row label={t('status')}>
          <OrderStatusMenu orderId={orderId} status={status} canRevert={canAssign} />
        </Row>
        <Row label={t('payment')}>
          <PaymentStatusMenu orderId={orderId} status={paymentStatus} orderStatus={status} />
        </Row>
        <Row label={t('assignedTo')}>
          {canAssign ? (
            <AssignMenu
              orderId={orderId}
              assignedToId={assignedToId}
              assignedToName={assignedToName}
              assignees={assignees}
            />
          ) : <span className="text-sm"><bdi>{assignedToName ?? ts('unassigned')}</bdi></span>}
        </Row>
      </CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-h-10 grid-cols-[5.75rem_minmax(0,1fr)] items-center gap-3">
      <span className="text-sm whitespace-nowrap text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center [&>button]:mx-0 [&>button]:min-h-10 [&>button]:w-full [&>button]:max-w-full [&>button]:justify-between [&>button]:rounded-lg [&>button]:border [&>button]:bg-background [&>button]:px-3 [&>button]:py-2 [&>button]:text-sm [&>button:hover]:border-primary/40 [&>button:hover]:bg-primary/5 [&>button>span]:text-sm [&>span]:text-sm">
        {children}
      </div>
    </div>
  );
}
