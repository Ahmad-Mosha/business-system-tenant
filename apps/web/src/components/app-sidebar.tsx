'use client';

import { CalendarRange, LayoutGrid, Menu, Package, Upload, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Grouped so the shape of the product stays legible as sections are added.
 * Order matters: the daily read sits above the occasional write.
 */
const NAVIGATION = [
  {
    label: 'Analysis',
    items: [
      { href: '/', label: 'Overview', icon: LayoutGrid },
      { href: '/months', label: 'Months', icon: CalendarRange },
      { href: '/products', label: 'Products', icon: Package },
    ],
  },
  {
    label: 'Data',
    items: [{ href: '/imports', label: 'Imports', icon: Upload }],
  },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Navigating on a small screen should dismiss the drawer.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      {/* Small screens only: a bar that owns the drawer toggle. */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          className="-ml-2 inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {open ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
        </button>
        <Wordmark />
      </header>

      {/* Scrim, drawer only. */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden
        className={cn(
          'fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[2px] transition-opacity duration-200 lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-border bg-sidebar',
          'transition-transform duration-250 ease-[cubic-bezier(0.32,0.72,0,1)]',
          'lg:sticky lg:inset-auto lg:top-0 lg:h-svh lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center px-5">
          <Wordmark />
        </div>

        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-2">
          {NAVIGATION.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-2 text-[11px] font-medium tracking-[0.08em] text-muted-foreground/70 uppercase">
                {group.label}
              </p>
              <ul className="flex flex-col gap-0.5">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active =
                    href === '/' ? pathname === '/' : pathname.startsWith(href);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'group relative flex h-9 items-center gap-2.5 rounded-md px-3 text-sm transition-colors duration-150',
                          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                          active
                            ? 'bg-accent font-medium text-accent-foreground'
                            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                        )}
                      >
                        {/* The active marker: the one piece of chrome that
                            earns its place, because it answers "where am I". */}
                        <span
                          className={cn(
                            'absolute left-0 h-4 w-0.5 rounded-full bg-foreground transition-all duration-200',
                            active ? 'opacity-100' : 'scale-y-50 opacity-0',
                          )}
                        />
                        <Icon
                          className={cn(
                            'size-4 shrink-0 transition-colors',
                            active ? 'text-foreground' : 'text-muted-foreground/80 group-hover:text-foreground',
                          )}
                          strokeWidth={active ? 2.1 : 1.9}
                        />
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-border px-5 py-3.5">
          <p className="text-[11px] text-muted-foreground/70">
            noon · EGP
          </p>
        </div>
      </aside>
    </>
  );
}

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      <span className="flex size-7 items-center justify-center rounded-[7px] bg-foreground text-[13px] font-semibold text-background">
        P
      </span>
      <span className="text-[15px] font-semibold tracking-[-0.02em]">Prime Market</span>
    </Link>
  );
}
