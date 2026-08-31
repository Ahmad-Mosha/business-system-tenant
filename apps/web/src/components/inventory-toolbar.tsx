'use client';

import { Check, ChevronDown, Loader2, Plus, RefreshCw, Search, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { syncEasyOrders } from '@/app/(app)/inventory/actions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CATEGORIES } from '@/lib/categories';
import { cn } from '@/lib/utils';

const CHANNELS = [
  { value: 'noon', label: 'noon' },
  { value: 'easyorders', label: 'Website' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'social', label: 'Social' },
  { value: 'unlisted', label: 'Not on any channel' },
];

const STOCK = [
  { value: 'in_stock', label: 'In stock' },
  { value: 'low_stock', label: 'Low stock (≤5)' },
  { value: 'out_of_stock', label: 'Out of stock' },
];

/**
 * Every filter is its own one-line dropdown, the same pattern as the orders
 * screen — never a panel you scroll inside. The old version put all three
 * filter groups in one fixed-height popover, which is what forced the
 * scrolling this replaces.
 */
export function InventoryToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [syncing, startSync] = useTransition();
  const [search, setSearch] = useState(params.get('search') ?? '');

  const category = params.get('category');
  const channel = params.get('channel');
  const stock = params.get('stock');

  const apply = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params.toString());
    next.delete('offset'); // any filter change starts back at page 1
    mutate(next);
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  const setParam = (key: string, value: string | null) =>
    apply((next) => {
      if (value === null) next.delete(key);
      else next.set(key, value);
    });

  // Debounced so typing does not push a navigation per keystroke.
  useEffect(() => {
    const current = params.get('search') ?? '';
    if (search === current) return;
    const t = setTimeout(() => {
      apply((next) => {
        if (search.trim()) next.set('search', search.trim());
        else next.delete('search');
      });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const control =
    'inline-flex h-9 items-center gap-1.5 rounded-md border bg-card px-3 text-[13px] transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

  return (
    <div className={cn('flex flex-wrap items-center gap-2', pending && 'opacity-70')}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          aria-label="Search products"
          className="h-9 w-[220px] rounded-md border border-border bg-card pr-8 pl-8.5 text-[13px] placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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

      <Picker
        label={CATEGORIES.find((c) => c.value === category)?.label ?? 'All categories'}
        active={!!category}
        className={control}
        current={category}
        options={[{ value: null, label: 'All categories' }, ...CATEGORIES]}
        onPick={(v) => setParam('category', v)}
      />

      <Picker
        label={CHANNELS.find((c) => c.value === channel)?.label ?? 'Any channel'}
        active={!!channel}
        className={control}
        current={channel}
        options={[{ value: null, label: 'Any channel' }, ...CHANNELS]}
        onPick={(v) => setParam('channel', v)}
      />

      <Picker
        label={STOCK.find((s) => s.value === stock)?.label ?? 'Any stock level'}
        active={!!stock}
        className={control}
        current={stock}
        options={[{ value: null, label: 'Any stock level' }, ...STOCK]}
        onPick={(v) => setParam('stock', v)}
      />

      <div className="ms-auto flex items-center gap-2">
        <button
          type="button"
          disabled={syncing}
          onClick={() =>
            startSync(async () => {
              const r = await syncEasyOrders();
              if (r.ok)
                toast.success(`Website catalogue synced: ${r.updated} updated, ${r.unmatched.length} unmatched.`);
              else toast.error(r.message);
            })
          }
          className={cn(control, 'border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-60')}
        >
          {syncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Sync website
        </button>
        <Link
          href="/inventory/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-3.5 text-[13px] font-medium text-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Plus className="size-4" />
          Add product
        </Link>
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
      <DropdownMenuContent align="start" className="w-48">
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
