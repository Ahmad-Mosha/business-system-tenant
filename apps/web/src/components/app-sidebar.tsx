'use client';

import {
  BarChart3,
  CalendarRange,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  ShoppingBag,
  Truck,
  Upload,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { signOut } from '@/app/login/actions';
import type { Role, SessionUser } from '@/lib/session';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  roles?: Role[];
}

/**
 * Grouped so the shape of the product stays legible as sections are added.
 * `roles` hides what a user cannot use — the API refuses it regardless.
 */
const NAVIGATION: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Operations',
    items: [
      { href: '/orders', label: 'Orders', icon: ShoppingBag },
      { href: '/shipments', label: 'Shipments', icon: Truck },
      { href: '/inventory', label: 'Inventory', icon: Package, roles: ['ADMIN'] },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { href: '/', label: 'Overview', icon: LayoutGrid, roles: ['ADMIN'] },
      { href: '/months', label: 'Months', icon: CalendarRange, roles: ['ADMIN'] },
      { href: '/products', label: 'Products', icon: BarChart3, roles: ['ADMIN'] },
    ],
  },
  {
    label: 'Data',
    items: [{ href: '/imports', label: 'Imports', icon: Upload, roles: ['ADMIN'] }],
  },
];

export function AppSidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Navigating on a small screen should dismiss the drawer.
  useEffect(() => setOpen(false), [pathname]);

  const groups = NAVIGATION.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.roles || i.roles.includes(user.role)),
  })).filter((g) => g.items.length);

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
          {groups.map((group) => (
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
                            active
                              ? 'text-foreground'
                              : 'text-muted-foreground/80 group-hover:text-foreground',
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

        <div className="shrink-0 border-t border-border p-3">
          <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{user.name}</p>
              <p className="text-[11px] text-muted-foreground capitalize">
                {user.role.toLowerCase()}
              </p>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                aria-label="Sign out"
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <LogOut className="size-3.5" />
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}

function Wordmark() {
  return (
    <Link
      href="/orders"
      className="flex items-center gap-2.5 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="flex size-7 items-center justify-center rounded-[7px] bg-foreground text-[13px] font-semibold text-background">
        P
      </span>
      <span className="text-[15px] font-semibold tracking-[-0.02em]">Prime Market</span>
    </Link>
  );
}
