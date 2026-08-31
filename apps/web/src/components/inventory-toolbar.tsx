'use client';

import { Loader2, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { syncEasyOrders } from '@/app/(app)/inventory/actions';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CATEGORIES } from '@/lib/categories';
import { cn } from '@/lib/utils';

const CHANNELS = [
  { value: 'noon', label: 'noon' },
  { value: 'easyorders', label: 'Website' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'social', label: 'Social' },
  { value: 'unlisted', label: 'Not on any channel' },
] as const;

const STOCK = [
  { value: 'in_stock', label: 'In stock' },
  { value: 'low_stock', label: 'Low stock (≤5)' },
  { value: 'out_of_stock', label: 'Out of stock' },
] as const;

/**
 * Search is always visible; everything else lives behind one "Filters"
 * control and shows up as removable chips once applied. The previous version
 * put every filter group on screen at once — three full rows before you ever
 * reached the table. This is the fix for that specifically.
 */
export function InventoryToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [syncing, startSync] = useTransition();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(params.get('search') ?? '');

  const category = params.get('category');
  const channel = params.get('channel');
  const stock = params.get('stock');
  const activeCount = [category, channel, stock].filter(Boolean).length;

  const apply = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params.toString());
    next.delete('offset'); // any filter change starts back at page 1
    mutate(next);
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  const setParam = (key: string, value: string | null) =>
    apply((next) => {
      if (value === null || next.get(key) === value) next.delete(key);
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

  const optionRow = (
    active: boolean,
    label: string,
    onClick: () => void,
    key: string,
  ) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-8 w-full items-center rounded-md px-2.5 text-left text-[13px] transition-colors',
        active ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
      )}
    >
      {label}
    </button>
  );

  const chip = (label: string, onClear: () => void, key: string) => (
    <span
      key={key}
      className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-accent/60 pl-2.5 pr-1.5 text-xs font-medium"
    >
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear ${label}`}
        className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
      >
        <X className="size-3" />
      </button>
    </span>
  );

  return (
    <div className={cn('mb-4 flex flex-wrap items-center gap-2', pending && 'opacity-70')}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products"
          aria-label="Search products"
          className="h-8 w-[200px] rounded-md border border-border bg-background pr-7 pl-8 text-[13px] placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] font-medium transition-colors',
              activeCount > 0
                ? 'border-foreground/30 bg-accent/60 text-foreground'
                : 'border-border text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            )}
          >
            <SlidersHorizontal className="size-3.5" />
            Filters
            {activeCount > 0 && (
              <span className="flex size-4 items-center justify-center rounded-full bg-foreground text-[10px] text-background">
                {activeCount}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-1.5">
          <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
            Category
          </p>
          {optionRow(!category, 'All categories', () => setParam('category', null), 'cat-all')}
          {CATEGORIES.map((c) =>
            optionRow(category === c.value, c.label, () => setParam('category', c.value), c.value),
          )}

          <div className="my-1.5 h-px bg-border" />

          <p className="px-2.5 pt-1 pb-1 text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
            Channel
          </p>
          {optionRow(!channel, 'Any channel', () => setParam('channel', null), 'ch-all')}
          {CHANNELS.map((c) =>
            optionRow(channel === c.value, c.label, () => setParam('channel', c.value), c.value),
          )}

          <div className="my-1.5 h-px bg-border" />

          <p className="px-2.5 pt-1 pb-1 text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
            Stock
          </p>
          {optionRow(!stock, 'Any level', () => setParam('stock', null), 'st-all')}
          {STOCK.map((s) =>
            optionRow(stock === s.value, s.label, () => setParam('stock', s.value), s.value),
          )}
        </PopoverContent>
      </Popover>

      {category && chip(CATEGORIES.find((c) => c.value === category)?.label ?? category, () => setParam('category', null), 'chip-cat')}
      {channel && chip(CHANNELS.find((c) => c.value === channel)?.label ?? channel, () => setParam('channel', null), 'chip-ch')}
      {stock && chip(STOCK.find((s) => s.value === stock)?.label ?? stock, () => setParam('stock', null), 'chip-st')}

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          disabled={syncing}
          onClick={() =>
            startSync(async () => {
              const r = await syncEasyOrders();
              if (r.ok) toast.success(`Website catalogue synced: ${r.updated} updated, ${r.unmatched.length} unmatched.`);
              else toast.error(r.message);
            })
          }
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
        >
          {syncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Sync website
        </button>
        <Button asChild size="sm">
          <Link href="/inventory/new">Add product</Link>
        </Button>
      </div>
    </div>
  );
}
