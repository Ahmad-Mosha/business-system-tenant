'use client';

import { ClipboardList, PackagePlus, Plus, Search, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';
import { navFor } from '@/lib/nav';
import type { Role } from '@/lib/session';

const ACTIONS = [
  { href: '/orders/new', label: 'New order', icon: Plus },
  { href: '/inventory/new', label: 'Add product', icon: PackagePlus, admin: true },
  { href: '/money/purchases/new', label: 'New purchase invoice', icon: ClipboardList, admin: true },
  { href: '/imports', label: 'Import a noon report', icon: Upload, admin: true },
] as const;

/** ⌘K — jump to any screen or start any record without touching the sidebar. */
export function CommandMenu({ role }: { role: Role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="w-9 justify-center px-0 text-muted-foreground sm:w-56 sm:justify-start sm:px-2.5"
      >
        <Search />
        <span className="hidden flex-1 text-left font-normal sm:inline">Search or jump to…</span>
        <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Jump to"
        description="Search screens and actions"
      >
        <CommandInput placeholder="Search screens and actions…" />
        <CommandList>
          <CommandEmpty>Nothing matches.</CommandEmpty>
          <CommandGroup heading="Create">
            {ACTIONS.filter((a) => !('admin' in a) || role === 'ADMIN').map((a) => (
              <CommandItem key={a.href} onSelect={() => go(a.href)}>
                <a.icon />
                {a.label}
              </CommandItem>
            ))}
          </CommandGroup>
          {navFor(role).map((group) => (
            <div key={group.label}>
              <CommandSeparator />
              <CommandGroup heading={group.label}>
                {group.items.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={`${group.label} ${item.label}`}
                    onSelect={() => go(item.href)}
                  >
                    <item.icon />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
