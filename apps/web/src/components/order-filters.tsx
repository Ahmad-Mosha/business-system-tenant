'use client';

import { Check, ChevronDown, Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { ALL_ORDER_STATUSES, STATUS_LABELS } from '@/components/order-status';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/**
 * Filters live in the URL, so a filtered view is shareable and the back button
 * behaves. The list itself stays a server component.
 *
 * Seven status chips used to sit on their own row above the table. Collapsed
 * into one control that shows its current value, they fit the context bar and
 * cost the screen no vertical space at all.
 */
export function OrderFilters({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const status = params.get('status');
  const unassigned = params.get('unassigned') === 'true';
  const [search, setSearch] = useState(params.get('search') ?? '');

  /** Changing a filter drops the selection — that order may not be in the new list. */
  const apply = (next: URLSearchParams) => {
    next.delete('selected');
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value === null) next.delete(key);
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

  const control =
    'inline-flex h-[var(--control-h)] items-center gap-1.5 rounded-md border px-2.5 text-[13px] transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

  return (
    <div className={cn('flex items-center gap-1.5', pending && 'opacity-70')}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, phone or number"
          aria-label="Search orders"
          className="h-[var(--control-h)] w-[220px] rounded-md border border-border bg-background pr-7 pl-8 text-[13px] placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              control,
              status ? 'border-foreground bg-foreground text-background' : 'border-border',
            )}
          >
            {status ? STATUS_LABELS[status as keyof typeof STATUS_LABELS] : 'Any status'}
            <ChevronDown className="size-3.5 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuItem onSelect={() => set('status', null)} className="text-sm">
            {!status && <Check className="size-3.5" />}
            Any status
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {ALL_ORDER_STATUSES.map((s) => (
            <DropdownMenuItem key={s} onSelect={() => set('status', s)} className="text-sm">
              {status === s && <Check className="size-3.5" />}
              {STATUS_LABELS[s]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {isAdmin && (
        <button
          type="button"
          onClick={() => set('unassigned', unassigned ? null : 'true')}
          aria-pressed={unassigned}
          className={cn(
            control,
            unassigned
              ? 'border-foreground bg-foreground text-background'
              : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          Unassigned
        </button>
      )}
    </div>
  );
}
