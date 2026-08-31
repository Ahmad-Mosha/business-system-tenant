'use client';

import { Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { cn } from '@/lib/cn';

const CATEGORIES = [
  { value: '', label: 'All categories' },
  { value: 'COSMETICS', label: 'Cosmetics', ar: 'مستحضرات تجميل' },
  { value: 'HOME', label: 'Home', ar: 'منزلي' },
  { value: 'ELECTRONICS', label: 'Electronics', ar: 'إلكترونيات' },
  { value: 'TV_SHOP', label: 'TV Shop', ar: 'تي في شوب' },
] as const;

/**
 * Filters live in the URL, not in component state — a filtered view can be
 * linked, reloaded and gone back to.
 */
export function ProductsToolbar({ total, unmapped }: { total: number; unmapped: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const [search, setSearch] = useState(params.get('search') ?? '');

  const apply = (next: Record<string, string>) => {
    const q = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) q.set(key, value);
      else q.delete(key);
    }
    // Selecting a different filter set invalidates whatever row was open.
    q.delete('id');
    start(() => router.replace(`/products?${q.toString()}`, { scroll: false }));
  };

  // Typing shouldn't fire a request per keystroke, and shouldn't need a button.
  useEffect(() => {
    const current = params.get('search') ?? '';
    if (search === current) return;
    const t = setTimeout(() => apply({ search }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const category = params.get('category') ?? '';

  return (
    <div className="flex h-11 items-center gap-2 border-b border-line px-3">
      <div className="relative w-64">
        <Search
          size={13}
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-faint"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          dir="auto"
          aria-label="Search products by name"
          className={cn(
            'h-7 w-full rounded-[3px] border border-line bg-surface pr-7 pl-7',
            'text-data placeholder:text-ink-faint focus:border-accent',
          )}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            aria-label="Clear search"
            className="absolute top-1/2 right-1.5 -translate-y-1/2 text-ink-faint hover:text-ink"
          >
            <X size={13} />
          </button>
        )}
      </div>

      <select
        value={category}
        onChange={(e) => apply({ category: e.target.value })}
        aria-label="Filter by category"
        className="h-7 rounded-[3px] border border-line bg-surface px-2 text-data text-ink focus:border-accent"
      >
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      <div className="ml-auto flex items-center gap-3 text-xs">
        {unmapped > 0 && (
          <span className="text-warn" title="No channel identifier points at these yet">
            {unmapped} on no channel
          </span>
        )}
        <span className={cn(pending ? 'text-ink-faint' : 'text-ink-soft')}>
          {pending ? 'Loading…' : `${total} product${total === 1 ? '' : 's'}`}
        </span>
      </div>
    </div>
  );
}
