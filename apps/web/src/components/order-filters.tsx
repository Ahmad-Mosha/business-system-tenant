'use client';

import { ORDER_STATUS_LABELS, orderStatusSchema, type OrderStatus } from '@app/contracts';
import Link from 'next/link';
import { cn } from '@/lib/cn';

const STATUSES = orderStatusSchema.options;

/** Status filter as links, so a filtered view is shareable and survives a reload. */
export function OrderFilters({ activeStatus }: { activeStatus?: OrderStatus }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <FilterChip href="/orders" active={!activeStatus}>
        All
      </FilterChip>
      {STATUSES.map((status) => (
        <FilterChip
          key={status}
          href={`/orders?status=${status}`}
          active={activeStatus === status}
        >
          {ORDER_STATUS_LABELS[status]}
        </FilterChip>
      ))}
    </div>
  );
}

function FilterChip({
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
        'rounded-lg border px-3 py-1.5 text-[13px] transition-colors',
        active
          ? 'border-primary bg-primary text-primary-ink'
          : 'border-line bg-surface text-ink-2 hover:bg-canvas hover:text-ink',
      )}
    >
      {children}
    </Link>
  );
}
