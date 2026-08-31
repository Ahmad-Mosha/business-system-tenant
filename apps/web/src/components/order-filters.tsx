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
 */
export function OrderFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const status = params.get('status');
  const source = params.get('source');
  const [search, setSearch] = useState(params.get('search') ?? '');

  /** Any filter change drops the selection and the page — neither survives a new result set. */
  const apply = (next: URLSearchParams) => {
    next.delete('selected');
    next.delete('page');
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value === null) next.delete(key);
    else next.set(key, value);
    apply(next);
  };

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
    'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[13px] transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

  return (
    <div className={cn('flex flex-wrap items-center gap-2', pending && 'opacity-70')}>
      <Picker
        label={source === 'SOCIAL' ? 'Social' : source === 'EASYORDERS' ? 'Website' : 'All channels'}
        active={!!source}
        className={control}
        options={[
          { value: null, label: 'All channels' },
          { value: 'SOCIAL', label: 'Social' },
          { value: 'EASYORDERS', label: 'Website' },
        ]}
        current={source}
        onPick={(v) => set('source', v)}
      />

      <Picker
        label={status ? STATUS_LABELS[status as keyof typeof STATUS_LABELS] : 'Any status'}
        active={!!status}
        className={control}
        options={[
          { value: null, label: 'Any status' },
          ...ALL_ORDER_STATUSES.map((s) => ({ value: s as string, label: STATUS_LABELS[s] })),
        ]}
        current={status}
        onPick={(v) => set('status', v)}
      />

      <div className="relative ms-auto">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search orders…"
          aria-label="Search orders"
          className="h-9 w-[240px] rounded-md border border-border bg-background pr-8 pl-8.5 text-[13px] placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="Clear search"
            className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function Picker({
  label,
  active,
  className,
  options,
  current,
  onPick,
}: {
  label: string;
  active: boolean;
  className: string;
  options: Array<{ value: string | null; label: string }>;
  current: string | null;
  onPick: (value: string | null) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            className,
            active
              ? 'border-foreground font-medium'
              : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          {label}
          <ChevronDown className="size-3.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {options.map((o, i) => (
          <div key={o.value ?? 'all'}>
            {i === 1 && <DropdownMenuSeparator />}
            <DropdownMenuItem onSelect={() => onPick(o.value)} className="text-sm">
              {current === o.value && <Check className="size-3.5" />}
              {o.label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
