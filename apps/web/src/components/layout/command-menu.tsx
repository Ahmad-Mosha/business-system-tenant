'use client';

import { Command as CommandPrimitive } from 'cmdk';
import { Contact, FilePlus2, PackagePlus, Plus, Search, ShoppingBag, Package, type LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { quickSearch, type QuickResults } from '@/app/(app)/quick-search';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Spinner } from '@/components/ui/spinner';
import { money } from '@/lib/format';
import { navFor } from '@/lib/nav';
import type { Role } from '@/lib/session';

const EMPTY: QuickResults = { orders: [], products: [], customers: [] };

/** The records a person can start from anywhere — admins get the purchasing and catalogue ones. */
const CREATE: Array<{ href: string; key: 'order' | 'sale' | 'purchase' | 'product'; icon: LucideIcon; admin?: boolean }> = [
  { href: '/orders/new', key: 'order', icon: Plus },
  { href: '/sales/new', key: 'sale', icon: FilePlus2, admin: true },
  { href: '/money/purchases/new', key: 'purchase', icon: FilePlus2, admin: true },
  { href: '/inventory/new', key: 'product', icon: PackagePlus, admin: true },
];

/**
 * Search and jump, from anywhere: Ctrl/⌘ K or the field in the header. Empty,
 * it lists every screen and what can be created; typed into, it finds orders
 * by number, name or phone — and, for admins, products and customers.
 */
export function CommandMenu({ role }: { role: Role }) {
  const t = useTranslations('search');
  const tr = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [found, setFound] = useState<QuickResults & { term: string }>({ ...EMPTY, term: '' });
  // The shortcut as the keyboard prints it; the server can't know, so the first paint may differ.
  const [mac] = useState(() => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const q = term.trim();
  useEffect(() => {
    if (q.length < 2) return;
    // Only the answer to what is typed now lands — a slow early search never overwrites a later one.
    let current = true;
    const timer = setTimeout(() => {
      quickSearch(q).then((r) => current && setFound({ ...r, term: q }));
    }, 180);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [q]);

  const go = (href: string) => {
    setOpen(false);
    setTerm('');
    router.push(href);
  };

  const needle = q.toLowerCase();
  const screens = navFor(role)
    .flatMap((g) => g.items.map((item) => ({ ...item, group: tr(`nav.groups.${g.key}`), label: tr(`nav.items.${item.key}`) })))
    .filter((s) => !needle || s.label.toLowerCase().includes(needle) || s.group.toLowerCase().includes(needle));
  const creates = CREATE.filter((c) => !c.admin || role === 'ADMIN')
    .map((c) => ({ ...c, label: t(`create.${c.key}`) }))
    .filter((c) => !needle || c.label.toLowerCase().includes(needle));
  const results = q.length >= 2 && found.term === q ? found : EMPTY;
  const searching = q.length >= 2 && found.term !== q;
  const nothing =
    !searching && !screens.length && !creates.length && !results.orders.length && !results.products.length && !results.customers.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full items-center gap-2.5 rounded-lg border bg-muted/40 px-3 text-[13px] text-muted-foreground transition-colors hover:border-ring/40 hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:bg-input/20"
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1 truncate text-start">{t('trigger')}</span>
        <kbd
          suppressHydrationWarning
          className="hidden shrink-0 rounded border bg-muted px-1.5 font-sans text-[11px] leading-5 sm:inline-block"
          dir="ltr"
        >
          {t(mac ? 'shortcutMac' : 'shortcut')}
        </kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) setTerm('');
        }}
        title={t('title')}
        description={t('placeholder')}
        className="top-[12vh] sm:max-w-xl"
      >
        <Command shouldFilter={false} className="rounded-none">
          <div className="flex items-center gap-2.5 border-b px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <CommandPrimitive.Input
              value={term}
              onValueChange={setTerm}
              placeholder={t('placeholder')}
              dir="auto"
              className="h-12 w-full bg-transparent text-[14px] outline-hidden placeholder:text-muted-foreground"
            />
            {searching ? <Spinner className="size-4 text-muted-foreground" /> : null}
          </div>
          <CommandList className="max-h-[min(24rem,60vh)] p-1.5">
            {nothing ? <CommandEmpty className="py-10 text-[13px] text-muted-foreground">{t('nothing', { term: q })}</CommandEmpty> : null}

            {results.orders.length ? (
              <CommandGroup heading={t('orders')}>
                {results.orders.map((o) => (
                  <CommandItem key={o.id} value={`order-${o.id}`} onSelect={() => go(`/orders/${o.id}`)}>
                    <ShoppingBag className="text-muted-foreground" />
                    <span className="num font-medium">{o.orderNumber}</span>
                    <span className="min-w-0 truncate text-muted-foreground">
                      <bdi>{o.customerName}</bdi>
                    </span>
                    <span data-slot="command-shortcut" className="ms-auto flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                      {tr(`enums.orderStatus.${o.status}`)}
                      <span className="num text-foreground">{money(o.total)}</span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {results.products.length ? (
              <CommandGroup heading={t('products')}>
                {results.products.map((p) => (
                  <CommandItem key={p.id} value={`product-${p.id}`} onSelect={() => go(`/inventory/${p.id}`)}>
                    <Package className="text-muted-foreground" />
                    <span className="min-w-0 truncate">
                      <bdi>{p.name}</bdi>
                    </span>
                    <span data-slot="command-shortcut" className="num ms-auto shrink-0 text-xs text-muted-foreground">{t('inStock', { count: p.onHand })}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {results.customers.length ? (
              <CommandGroup heading={t('customers')}>
                {results.customers.map((c) => (
                  <CommandItem key={c.id} value={`customer-${c.id}`} onSelect={() => go(`/customers/${c.id}`)}>
                    <Contact className="text-muted-foreground" />
                    <span className="min-w-0 truncate">
                      <bdi>{c.name}</bdi>
                    </span>
                    {c.phone ? <span className="num text-xs text-muted-foreground">{c.phone}</span> : null}
                    {Number(c.balance) > 0 ? (
                      <span data-slot="command-shortcut" className="ms-auto shrink-0 text-xs text-muted-foreground">
                        {t('owes')} <span className="num text-foreground">{money(c.balance)}</span>
                      </span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {creates.length ? (
              <CommandGroup heading={t('createHeading')}>
                {creates.map((c) => (
                  <CommandItem key={c.href} value={c.href} onSelect={() => go(c.href)}>
                    <c.icon className="text-muted-foreground" />
                    {c.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {screens.length ? (
              <CommandGroup heading={t('goTo')}>
                {screens.map((s) => (
                  <CommandItem key={s.href} value={`screen-${s.href}`} onSelect={() => go(s.href)}>
                    <s.icon className="text-muted-foreground" />
                    {s.label}
                    <span data-slot="command-shortcut" className="ms-auto text-xs text-muted-foreground">{s.group}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
          <div className="flex items-center gap-4 border-t px-4 py-2 text-[11px] text-muted-foreground">
            <span>{t('hintMove')}</span>
            <span>{t('hintOpen')}</span>
            <span data-slot="command-shortcut" className="ms-auto">{t('hintClose')}</span>
          </div>
        </Command>
      </CommandDialog>
    </>
  );
}
