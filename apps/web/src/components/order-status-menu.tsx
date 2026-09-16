'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { setOrderStatus } from '@/app/(app)/orders/actions';
import { ReturnOrderDialog } from '@/components/return-order-dialog';
import { InlineMenu } from '@/components/inline-menu';
import {
  ALL_ORDER_STATUSES,
  isReverse,
  NEXT_STATUSES,
  StatusBadge,
} from '@/components/order-status';
import type { OrderStatus } from '@/lib/api';

/**
 * Changes an order's status straight from the list, so a moderator working a
 * batch never has to open each order.
 *
 * `canRevert` (admin only) lifts the guided forward-only path: every status
 * becomes reachable under "Other statuses", so a mistake can be undone from
 * here — the API enforces the same rule, this only decides what's offered.
 */
export function OrderStatusMenu({
  orderId,
  status,
  canRevert = false,
}: {
  orderId: string;
  status: OrderStatus;
  canRevert?: boolean;
}) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  const [returning, setReturning] = useState(false);
  const canMove = (s: OrderStatus) => status !== 'RETURNED' &&
    !(s === 'CANCELLED' && (!canRevert || ['SHIPPED', 'DELIVERED'].includes(status))) &&
    !(s === 'RETURNED' && status === 'CANCELLED');
  const next = NEXT_STATUSES[status].filter(canMove);
  const other = canRevert
    ? ALL_ORDER_STATUSES.filter((s) => s !== status && !next.includes(s) && canMove(s))
    : [];

  // A final state with no revert power has nowhere to go.
  if (!next.length && !other.length) return <StatusBadge status={status} />;

  const name = (s: OrderStatus) => t(`enums.orderStatus.${s}`);
  const item = (s: OrderStatus) => ({ value: s, label: name(s), destructive: isReverse(s) });

  return (
    <>
    <ReturnOrderDialog orderId={orderId} open={returning} onOpenChange={setReturning} />
    <InlineMenu
      label={t('status.changeStatus', { status: name(status) })}
      trigger={<StatusBadge status={status} />}
      pending={pending}
      sections={[
        { heading: t('status.moveTo'), items: next.map(item) },
        { heading: t('status.otherStatuses'), items: other.map(item) },
      ]}
      onSelect={(to) => {
        if (to === 'RETURNED') { setReturning(true); return; }
        start(async () => {
          const result = await setOrderStatus(orderId, to);
          if (result.ok) toast.success(t('status.movedTo', { status: name(to as OrderStatus) }));
          else toast.error(result.message);
        });
      }}
    />
    </>
  );
}
