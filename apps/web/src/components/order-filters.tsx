'use client';

import { ORDER_STATUS_LABELS, orderStatusSchema, type AssignableUser } from '@app/contracts';
import { Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const STATUSES = orderStatusSchema.options;

const field =
  'h-9 rounded-md border border-line bg-surface px-2.5 text-[13px] text-ink ' +
  'transition-colors hover:border-ink-3 focus:border-ink focus:outline-none ' +
  'focus:ring-2 focus:ring-ink/10';

/**
 * Filters live in the URL, so a filtered view is shareable, survives a reload,
 * and the back button behaves. Each control writes a query param and lets the
 * server re-render; none of the filtering happens in the browser.
 */
export function OrderFilters({ assignableUsers }: { assignableUsers: AssignableUser[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [search, setSearch] = useState(params.get('search') ?? '');
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the box in step when the URL changes from elsewhere (back button, reset).
  useEffect(() => {
    setSearch(params.get('search') ?? '');
  }, [params]);

  function apply(next: Record<string, string | null>) {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    // Any filter change invalidates the current page position.
    query.delete('page');
    router.push(`${pathname}?${query.toString()}`);
  }

  function onSearchChange(value: string) {
    setSearch(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => apply({ search: value.trim() || null }), 350);
  }

  const activeCount = ['status', 'assigneeId', 'placedFrom', 'placedTo', 'search'].filter((k) =>
    params.get(k),
  ).length;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface p-2">
      <div className="relative min-w-[15rem] flex-1">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3"
          aria-hidden
        />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search order number, customer or phone…"
          aria-label="Search orders"
          className={`${field} w-full pl-8`}
        />
      </div>

      <select
        aria-label="Filter by status"
        value={params.get('status') ?? ''}
        onChange={(e) => apply({ status: e.target.value || null })}
        className={field}
      >
        <option value="">Status: All</option>
        {STATUSES.map((status) => (
          <option key={status} value={status}>
            {ORDER_STATUS_LABELS[status]}
          </option>
        ))}
      </select>

      {assignableUsers.length > 0 ? (
        <select
          aria-label="Filter by assignee"
          value={params.get('assigneeId') ?? ''}
          onChange={(e) => apply({ assigneeId: e.target.value || null })}
          className={field}
        >
          <option value="">Assignee: All</option>
          {assignableUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      ) : null}

      <label className="flex items-center gap-1.5 text-[12px] text-ink-3">
        <span className="sr-only sm:not-sr-only">From</span>
        <input
          type="date"
          aria-label="Placed from"
          value={params.get('placedFrom') ?? ''}
          onChange={(e) => apply({ placedFrom: e.target.value || null })}
          className={field}
        />
      </label>
      <label className="flex items-center gap-1.5 text-[12px] text-ink-3">
        <span className="sr-only sm:not-sr-only">To</span>
        <input
          type="date"
          aria-label="Placed to"
          value={params.get('placedTo') ?? ''}
          onChange={(e) => apply({ placedTo: e.target.value || null })}
          className={field}
        />
      </label>

      {activeCount > 0 ? (
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="inline-flex h-9 items-center gap-1 rounded-md px-2.5 text-[13px] text-ink-2 transition-colors hover:bg-line-soft hover:text-ink"
        >
          <X className="size-3.5" aria-hidden />
          Clear ({activeCount})
        </button>
      ) : null}
    </div>
  );
}
