'use client';

import {
  Boxes,
  ClipboardList,
  LayoutGrid,
  Plug,
  Settings,
  Truck,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import type { Role } from '@/lib/session';

/**
 * What a moderator sees is decided here *and* enforced in the API query. This
 * list only decides what is worth showing; it is never the thing keeping
 * anyone out.
 */
const NAV = [
  { href: '/', label: 'Overview', icon: LayoutGrid, roles: ['ADMIN'] },
  { href: '/inventory', label: 'Inventory', icon: Boxes, roles: ['ADMIN'] },
  { href: '/orders', label: 'Orders', icon: ClipboardList, roles: ['ADMIN', 'MODERATOR'] },
  { href: '/shipping', label: 'Shipping', icon: Truck, roles: ['ADMIN', 'MODERATOR'] },
  { href: '/money', label: 'Money', icon: Wallet, roles: ['ADMIN'] },
  { href: '/channels', label: 'Channels', icon: Plug, roles: ['ADMIN'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['ADMIN'] },
] as const;

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <nav className="flex w-[13.5rem] shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex h-12 items-center border-b border-line px-3">
        <span className="text-[13px] font-semibold tracking-tight text-ink">Prime Market</span>
      </div>

      <ul className="flex flex-col gap-px p-2">
        {NAV.filter((item) => (item.roles as readonly string[]).includes(role)).map(
          ({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex h-8 items-center gap-2.5 rounded-[3px] px-2.5 text-[13px]',
                    'transition-colors',
                    active
                      ? 'bg-raised font-medium text-ink'
                      : 'text-ink-soft hover:bg-raised hover:text-ink',
                  )}
                >
                  {/* The one place the accent marks position, not state. */}
                  {active && (
                    <span className="absolute top-1.5 bottom-1.5 -left-2 w-0.5 rounded-full bg-accent" />
                  )}
                  <Icon size={15} strokeWidth={1.75} className="shrink-0" />
                  {label}
                </Link>
              </li>
            );
          },
        )}
      </ul>
    </nav>
  );
}
