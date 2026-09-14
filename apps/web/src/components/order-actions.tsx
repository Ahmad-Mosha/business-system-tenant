'use client';

import type { ReactNode } from 'react';
import { AssignMenu } from '@/components/assign-menu';
import { OrderStatusMenu } from '@/components/order-status-menu';
import { PaymentStatusMenu } from '@/components/payment-status-menu';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow</CardTitle>
        <CardDescription>Change any of these in place.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-1">
        {canAssign ? (
          <Row label="Assigned to">
            <AssignMenu
              orderId={orderId}
              assignedToId={assignedToId}
              assignedToName={assignedToName}
              assignees={assignees}
            />
          </Row>
        ) : null}
        {/* Admins can move an order to any status, including undoing a
            mistake — moderators stay on the guided forward-only path. */}
        <Row label="Status">
          <OrderStatusMenu orderId={orderId} status={status} canRevert={canAssign} />
        </Row>
        <Row label="Payment">
          <PaymentStatusMenu orderId={orderId} status={paymentStatus} />
        </Row>
      </CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3 border-b border-dashed last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
