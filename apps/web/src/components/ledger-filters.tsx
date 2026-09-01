'use client';

import { Check, ChevronDown } from 'lucide-react';
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

/** Account filter for the Ledger screen — lives in the URL so views are shareable. */
export function LedgerFilters({ accounts }: { accounts: AccountBalance[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const code = params.get('code');
  const current = accounts.find((a) => a.code === code);

  const pick = (value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set('code', value);
    else next.delete('code');
    next.delete('page');
    start(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  };

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
          <DropdownMenuItem onSelect={() => pick(null)} className="text-sm">
            {!code && <Check className="size-3.5" />}
            All accounts
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {accounts.map((a) => (
            <DropdownMenuItem key={a.code} onSelect={() => pick(a.code)} className="text-sm">
              {code === a.code && <Check className="size-3.5" />}
              <span className="flex-1">{a.nameEn}</span>
              <span dir="rtl" className="text-[11px] text-muted-foreground">
                {a.nameAr}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
