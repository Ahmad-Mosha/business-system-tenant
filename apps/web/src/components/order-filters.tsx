'use client';

import { ORDER_STATUS_LABELS, orderStatusSchema, type OrderStatus } from '@app/contracts';
import Link from 'next/link';
import { cn } from '@/lib/cn';

const STATUSES = orderStatusSchema.options;

/**
 * A single continuous segmented control rather than a row of separate chips - it
 * reads as one control with a state, not a shelf of buttons.
 */
export function OrderFilters({ activeStatus }: { activeStatus?: OrderStatus }) {
  return (
    <div className="inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-line bg-rail p-0.5">
      <Segment href="/orders" active={!activeStatus}>
        All
      </Segment>
      {STATUSES.map((status) => (
        <Segment key={status} href={`/orders?status=${status}`} active={activeStatus === status}>
          {ORDER_STATUS_LABELS[status]}
        </Segment>
      ))}
    </div>
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
        'rounded-md px-3 py-1.5 text-[13px] transition-colors',
        active
          ? 'bg-surface font-medium text-ink shadow-[0_1px_2px_rgba(22,21,15,0.08)]'
          : 'text-ink-2 hover:text-ink',
      )}
    >
      {children}
    </Link>
  );
}
