'use client';

import { Plus, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { searchVariants } from '@/app/(app)/orders/actions';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { bdi } from '@/i18n/rich';

export type VariantHit = Awaited<ReturnType<typeof searchVariants>>[number];

/**
 * Find a product by its Arabic name or SKU, from the catalogue, as you type.
 * Shared by the order form and the purchase invoice — the two places stock is
 * picked. The search runs on the server; `seq` drops any answer that arrives
 * after a newer question, so a slow response can't overwrite fresh results.
 */
export function VariantSearch({
  onPick,
  disabledReason,
  meta,
  onCreate,
  placeholder,
  disabled,
}: {
  onPick: (hit: VariantHit) => void;
  /** Why a hit can't be picked (out of stock, already added), or null. */
  disabledReason?: (hit: VariantHit) => string | null;
  /** Right-hand detail for a pickable hit. */
  meta?: (hit: VariantHit) => string;
  /** Offers "Add ‘term’ as a new product" under the results. */
  onCreate?: (name: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const t = useTranslations('productSearch');
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<VariantHit[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const q = term.trim();

  useEffect(() => {
    if (!q) return;
    const id = ++seq.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      const result = await searchVariants(q);
      if (id !== seq.current) return;
      setHits(result);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const shown = q ? hits : [];
  const close = () => {
    setOpen(false);
    setTerm('');
  };

  return (
    <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="w-full justify-start px-2.5 font-normal text-muted-foreground"
        >
          <Search />
          {placeholder ?? t('placeholder')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-80 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={term} onValueChange={setTerm} placeholder={t('input')} />
          <CommandList>
            {!q ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                {t('startTyping')}
              </p>
            ) : loading && !shown.length ? (
              <div className="flex justify-center py-6">
                <Spinner className="text-muted-foreground" />
              </div>
            ) : (
              <CommandEmpty>{t.rich('noMatch', { term: q, bdi })}</CommandEmpty>
            )}
            {shown.length ? (
              <CommandGroup heading={t('products')}>
                {shown.map((h) => {
                  const reason = disabledReason?.(h) ?? null;
                  return (
                    <CommandItem
                      key={h.id}
                      value={h.id}
                      disabled={!!reason}
                      onSelect={() => {
                        onPick(h);
                        close();
                      }}
                    >
                      <bdi className="min-w-0 truncate">{h.label}</bdi>
                      {/* The shortcut slot also hides the item's built-in
                          check mark, which would otherwise split the row. */}
                      <span data-slot="command-shortcut" className="ms-auto shrink-0 ps-3 text-xs opacity-70">
                        {reason ?? meta?.(h) ?? ''}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}
            {onCreate && q ? (
              <CommandGroup>
                <CommandItem
                  value="__create__"
                  onSelect={() => {
                    onCreate(q);
                    close();
                  }}
                >
                  <Plus />
                  <span>{t.rich('create', { term: q, bdi })}</span>
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
