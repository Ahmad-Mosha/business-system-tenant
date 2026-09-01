'use client';

import { Check, ChevronDown, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AccountBalance } from '@/lib/api';
import { cn } from '@/lib/utils';

/** Account + date filters for the Ledger — all in the URL so views are shareable. */
export function LedgerFilters({ accounts }: { accounts: AccountBalance[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const code = params.get('code');
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const current = accounts.find((a) => a.code === code);
  const dirty = !!(code || from || to);

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete('page');
    start(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  const dateField =
    'h-9 rounded-md border border-border bg-card px-2.5 text-[13px] text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className={cn('flex flex-wrap items-center gap-2', pending && 'opacity-70')}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-md border bg-card px-3 text-[13px] transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              code
                ? 'border-foreground font-medium'
                : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {current ? current.nameEn : 'All accounts'}
            <ChevronDown className="size-3.5 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[60vh] w-56 overflow-y-auto">
          <DropdownMenuItem onSelect={() => set({ code: null })} className="text-sm">
            {!code && <Check className="size-3.5" />}
            All accounts
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {accounts.map((a) => (
            <DropdownMenuItem key={a.code} onSelect={() => set({ code: a.code })} className="text-sm">
              {code === a.code && <Check className="size-3.5" />}
              <span className="flex-1">{a.nameEn}</span>
              <span dir="rtl" className="text-[11px] text-muted-foreground">
                {a.nameAr}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        From
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => set({ from: e.target.value })}
          className={dateField}
        />
      </label>
      <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        To
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => set({ to: e.target.value })}
          className={dateField}
        />
      </label>

      {dirty && (
        <button
          type="button"
          onClick={() => set({ code: null, from: null, to: null })}
          className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" /> Clear
        </button>
      )}
    </div>
  );
}
