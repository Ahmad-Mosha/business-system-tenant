'use client';

import { AssignMenu } from '@/components/assign-menu';
import { OrderStatusMenu } from '@/components/order-status-menu';
import { PaymentStatusMenu } from '@/components/payment-status-menu';
import type { OrderStatus, PaymentStatus } from '@/lib/api';

/**
 * Every move available on this order, beside the summary it belongs to. Built
 * from the same three dropdown menus the orders list uses, so a status,
 * payment or assignment change looks and behaves identically everywhere —
 * one component owns each kind of move, not two.
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
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <h2 className="mb-4 text-[15px] font-semibold">Workflow</h2>
      <div className="space-y-3">
        {canAssign && (
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-[11px] text-muted-foreground">Assigned</span>
            <AssignMenu
              orderId={orderId}
              assignedToId={assignedToId}
              assignedToName={assignedToName}
              assignees={assignees}
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-[11px] text-muted-foreground">Status</span>
          {/* Admins can move an order to any status, including undoing a
              mistake — moderators stay on the guided forward-only path. */}
          <OrderStatusMenu orderId={orderId} status={status} canRevert={canAssign} />
        </div>

        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-[11px] text-muted-foreground">Payment</span>
          <PaymentStatusMenu orderId={orderId} status={paymentStatus} />
        </div>
      </div>
    </div>
  );
}
