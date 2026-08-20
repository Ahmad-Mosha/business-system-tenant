'use client';

import { Check, Filter, Loader2, Plus, RefreshCw, Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { addProduct, syncEasyOrders, type FormState } from '@/app/(app)/inventory/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const INITIAL: FormState = { status: 'idle' };

const CHANNELS = [
  { id: 'noon', label: 'noon' },
  { id: 'amazon', label: 'Amazon' },
  { id: 'easyorders', label: 'Website' },
  { id: 'social', label: 'Social' },
] as const;

const CATEGORIES = ['TV Shop', 'Computer', 'Cosmetics', 'Home Products', 'Uncategorised'];

const STOCK_FILTERS = [
  { id: 'in_stock', label: 'In stock' },
  { id: 'low_stock', label: 'Low stock (≤5)' },
  { id: 'out_of_stock', label: 'Out of stock' },
] as const;

export function InventoryToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [navigating, startNav] = useTransition();
  const [syncing, startSync] = useTransition();

  const [search, setSearch] = useState(params.get('search') ?? '');
  const [adding, setAdding] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [state, submit, pending] = useActionState(addProduct, INITIAL);

  const activeChannel = params.get('channel');
  const activeCategory = params.get('category');
  const activeStock = params.get('stock');

  useEffect(() => {
    if (state.status === 'ok') {
      toast.success(state.message);
      setAdding(false);
      setSelectedChannels([]);
    }
    if (state.status === 'error') toast.error(state.message);
  }, [state]);

  const applyParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value === null || next.get(key) === value) next.delete(key);
    else next.set(key, value);
    startNav(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  const clearAllFilters = () => {
    setSearch('');
    startNav(() => router.push(pathname, { scroll: false }));
  };

  useEffect(() => {
    const current = params.get('search') ?? '';
    if (search === current) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (search.trim()) next.set('search', search.trim());
      else next.delete('search');
      startNav(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const toggleChannel = (channelId: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channelId) ? prev.filter((c) => c !== channelId) : [...prev, channelId],
    );
  };

  const hasActiveFilters = Boolean(
    activeChannel || activeCategory || activeStock || search.trim(),
  );

  const chip = (active: boolean) =>
    cn(
      'inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-medium transition-colors cursor-pointer',
      'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
      active
        ? 'border-foreground bg-foreground text-background'
        : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
    );

  return (
    <div className="mb-4 space-y-3">
      {/* Top Search & Actions Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative mr-auto">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by name or SKU"
            aria-label="Search products"
            className="h-8 w-[260px] rounded-md border border-border bg-background pr-7 pl-8 text-[13px] placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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

        <button
          type="button"
          disabled={syncing}
          onClick={() =>
            startSync(async () => {
              const r = await syncEasyOrders();
              if (r.ok) toast.success(`Website catalogue synced: ${r.created} new, ${r.updated} updated.`);
              else toast.error(r.message);
            })
          }
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[13px] transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
        >
          {syncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Sync website catalogue
        </button>

        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[13px] font-medium text-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Plus className="size-3.5" />
          Add product
        </button>
      </div>

      {/* Filter Chips Bar */}
      <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 text-xs', navigating && 'opacity-70')}>
        {/* Channel Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Channel:
          </span>
          <button
            type="button"
            onClick={() => applyParam('channel', null)}
            className={chip(!activeChannel)}
          >
            All
          </button>
          {CHANNELS.map((ch) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => applyParam('channel', ch.id)}
              className={chip(activeChannel === ch.id)}
            >
              {ch.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => applyParam('channel', 'unlisted')}
            className={chip(activeChannel === 'unlisted')}
          >
            Unlisted
          </button>
        </div>

        <span className="hidden h-4 w-px bg-border sm:block" />

        {/* Category Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Category:
          </span>
          <button
            type="button"
            onClick={() => applyParam('category', null)}
            className={chip(!activeCategory)}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => applyParam('category', cat)}
              className={chip(activeCategory === cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <span className="hidden h-4 w-px bg-border sm:block" />

        {/* Stock Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Stock:
          </span>
          <button
            type="button"
            onClick={() => applyParam('stock', null)}
            className={chip(!activeStock)}
          >
            All
          </button>
          {STOCK_FILTERS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => applyParam('stock', s.id)}
              className={chip(activeStock === s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
            Reset filters
          </button>
        )}
      </div>

      {/* Add Product Form */}
      {adding && (
        <form
          action={submit}
          className="animate-in fade-in slide-in-from-top-1 grid gap-3 rounded-xl border border-border bg-card p-4 duration-150 sm:grid-cols-3"
        >
          <div className="space-y-1.5 sm:col-span-3">
            <label htmlFor="name" className="text-xs font-medium text-muted-foreground">
              Product name
            </label>
            <Input id="name" name="name" required disabled={pending} autoFocus />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="category" className="text-xs font-medium text-muted-foreground">
              Category
            </label>
            <select
              id="category"
              name="category"
              disabled={pending}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select category...</option>
              <option value="TV Shop">TV Shop</option>
              <option value="Computer">Computer</option>
              <option value="Cosmetics">Cosmetics</option>
              <option value="Home Products">Home Products</option>
            </select>
          </div>

          {/* Sales Channels Multi-Selector */}
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">
              Sales Channels
            </label>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {CHANNELS.map((ch) => {
                const isSelected = selectedChannels.includes(ch.id);
                return (
                  <button
                    key={ch.id}
                    type="button"
                    disabled={pending}
                    onClick={() => toggleChannel(ch.id)}
                    className={cn(
                      'inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors',
                      isSelected
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {isSelected && <Check className="size-3 stroke-[2.5]" />}
                    {ch.label}
                  </button>
                );
              })}
            </div>
            {/* Hidden inputs to submit selected channels to formData */}
            {selectedChannels.map((ch) => (
              <input key={ch} type="hidden" name="channels" value={ch} />
            ))}
          </div>

          <Field label="Our SKU" name="sku" pending={pending} />
          <Field label="Opening stock" name="openingStock" pending={pending} inputMode="numeric" />
          <Field label="Unit cost" name="unitCost" pending={pending} inputMode="decimal" />
          <Field label="Selling price" name="sellingPrice" pending={pending} inputMode="decimal" />

          <div className="flex items-end gap-2 sm:col-span-2">
            <Button type="submit" disabled={pending} className="min-w-[96px]">
              {pending ? <Loader2 className="size-4 animate-spin" /> : 'Save product'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)} disabled={pending}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      {navigating && <span className="sr-only">Loading</span>}
    </div>
  );
}

function Field({
  label,
  name,
  pending,
  inputMode,
}: {
  label: string;
  name: string;
  pending: boolean;
  inputMode?: 'numeric' | 'decimal';
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Input id={name} name={name} disabled={pending} inputMode={inputMode} className={inputMode ? 'tabular-nums' : undefined} />
    </div>
  );
}
