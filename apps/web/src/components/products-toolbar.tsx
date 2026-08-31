'use client';

import { Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import type { Period } from '@/lib/api';
import { monthLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Filters live in the URL, matching the pattern used on Orders and Inventory:
 * shareable, back-button-safe, and the filtering itself happens once on the
 * server rather than being duplicated in client state.
 */
export function ProductsToolbar({ periods }: { periods: Period[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(params.get('q') ?? '');

  const period = params.get('period');
  const returnsOnly = params.get('returns') === '1';
  const missingCost = params.get('cost') === 'missing';

  const apply = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  const toggle = (key: string, value: string) =>
    apply((next) => {
      if (next.get(key) === value) next.delete(key);
      else next.set(key, value);
    });

  // Debounced so typing does not push a navigation per keystroke.
  useEffect(() => {
    const current = params.get('q') ?? '';
    if (search === current) return;
    const t = setTimeout(() => {
      apply((next) => {
        if (search.trim()) next.set('q', search.trim());
        else next.delete('q');
      });
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
          placeholder="Search products"
          aria-label="Search products"
          className="h-8 w-[220px] rounded-md border border-border bg-background pr-7 pl-8 text-[13px] placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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

      <span className="mx-1 h-5 w-px bg-border" />

      <button
        type="button"
        onClick={() => apply((next) => next.delete('period'))}
        className={chip(!period)}
      >
        All time
      </button>
      {periods.map((p) => (
        <button
          key={p.month}
          type="button"
          onClick={() => toggle('period', p.month)}
          className={chip(period === p.month)}
        >
          {monthLabel(p.month)}
        </button>
      ))}

      <span className="mx-1 h-5 w-px bg-border" />

      <button type="button" onClick={() => toggle('returns', '1')} className={chip(returnsOnly)}>
        Has returns
      </button>
      <button
        type="button"
        onClick={() => toggle('cost', 'missing')}
        className={chip(missingCost)}
      >
        Missing cost
      </button>
    </div>
  );
}
