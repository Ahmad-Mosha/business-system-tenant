'use client';

import { ORDER_STATUS_LABELS, orderStatusSchema, type OrderStatus } from '@app/contracts';
import Link from 'next/link';
import { cn } from '@/lib/cn';

const STATUSES = orderStatusSchema.options;

export function OrderFilters({ activeStatus }: { activeStatus?: OrderStatus }) {
  return (
    <>
      <Segment href="/orders" active={!activeStatus}>
        All
      </Segment>
      {STATUSES.map((status) => (
        <Segment key={status} href={`/orders?status=${status}`} active={activeStatus === status}>
          {ORDER_STATUS_LABELS[status]}
        </Segment>
      ))}
    </>
  );
}

function Segment({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'rounded px-3 py-1.5 text-[13px] transition-colors',
        active ? 'bg-primary font-medium text-primary-ink' : 'text-ink-2 hover:bg-line-soft',
      )}
    >
      {children}
    </Link>
  );
}
