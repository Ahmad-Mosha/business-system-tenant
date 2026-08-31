'use client';

import { Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { STATUS_LABELS } from '@/components/order-status';
import { cn } from '@/lib/utils';

const STATUSES = Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>;

/**
 * Filters live in the URL, so a filtered view is shareable and the back button
 * behaves. The list itself stays a server component.
 */
export function OrderFilters({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const status = params.get('status');
  const unassigned = params.get('unassigned') === 'true';
  const [search, setSearch] = useState(params.get('search') ?? '');

  const apply = (next: URLSearchParams) => {
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  const toggle = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value === null || next.get(key) === value) next.delete(key);
    else next.set(key, value);
    apply(next);
  };

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const current = params.get('search') ?? '';
    if (search === current) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (search.trim()) next.set('search', search.trim());
      else next.delete('search');
      apply(next);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const chip = (active: boolean) =>
    cn(
      'inline-flex h-8 items-center rounded-md border px-2.5 text-[13px] transition-colors',
      'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
      active
        ? 'border-foreground bg-foreground text-background'
        : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
    );

  return (
    <div className={cn('mb-4 flex flex-wrap items-center gap-2', pending && 'opacity-70')}>
      <div className="relative mr-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, phone or order number"
          aria-label="Search orders"
          className="h-8 w-[248px] rounded-md border border-border bg-background pl-8 pr-7 text-[13px] placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="Clear search"
            className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {isAdmin && (
        <button
          type="button"
          onClick={() => toggle('unassigned', 'true')}
          className={chip(unassigned)}
        >
          Unassigned
        </button>
      )}

      {STATUSES.map((s) => (
        <button key={s} type="button" onClick={() => toggle('status', s)} className={chip(status === s)}>
          {STATUS_LABELS[s]}
        </button>
      ))}
    </div>
  );
}
