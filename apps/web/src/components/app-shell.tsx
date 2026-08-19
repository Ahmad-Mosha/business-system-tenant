import { PERMISSIONS, type CurrentUser } from '@app/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { can } from '@/lib/permissions';
import { cn } from '@/lib/cn';
import { Avatar } from './ui/avatar';
import { LogoutButton } from './logout-button';
import {
  AuditIcon,
  CatalogIcon,
  FulfilmentIcon,
  InventoryIcon,
  OrdersIcon,
  UsersIcon,
} from './icons';

type Icon = (props: { className?: string }) => ReactNode;

interface NavEntry {
  href: string;
  label: string;
  icon: Icon;
  permission?: string;
  /** Sections whose slice has not been built yet are shown but not navigable. */
  comingSoon?: boolean;
}

const NAV: NavEntry[] = [
  { href: '/orders', label: 'Orders', icon: OrdersIcon, permission: PERMISSIONS.ORDER_READ },
  { href: '/catalog', label: 'Catalog', icon: CatalogIcon, permission: PERMISSIONS.CATALOG_READ },
  { href: '/fulfilment', label: 'Fulfilment', icon: FulfilmentIcon, comingSoon: true },
  { href: '/inventory', label: 'Inventory', icon: InventoryIcon, comingSoon: true },
  { href: '/team', label: 'Users & Roles', icon: UsersIcon, comingSoon: true },
  { href: '/audit', label: 'Audit Log', icon: AuditIcon, comingSoon: true },
];

export function AppShell({
  user,
  activeHref,
  breadcrumbs,
  actions,
  children,
}: {
  user: CurrentUser;
  activeHref: string;
  breadcrumbs: { label: string; href?: string }[];
  actions?: ReactNode;
  children: ReactNode;
}) {
  const visible = NAV.filter((e) => !e.permission || can(user, e.permission) || e.comingSoon);

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-rail lg:flex">
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-[13px] font-bold text-primary-ink">
            {user.organizationName.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold leading-tight text-ink">
              {user.organizationName}
            </span>
            <span className="block truncate text-[12px] text-ink-3">
              {user.roles.join(' · ') || 'No role'}
            </span>
          </span>
        </div>

        <nav className="flex-1 space-y-0.5 p-3" aria-label="Sections">
          {visible.map((entry) => {
            const active = activeHref === entry.href;
            const Icon = entry.icon;

            if (entry.comingSoon) {
              return (
                <span
                  key={entry.href}
                  aria-disabled
                  title="Arrives in a later slice"
                  className="flex cursor-default items-center gap-3 rounded-lg px-3 py-2 text-[14px] text-ink-3/60"
                >
                  <Icon className="size-[18px] shrink-0" />
                  {entry.label}
                </span>
              );
            }

            return (
              <Link
                key={entry.href}
                href={entry.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition-colors',
                  active
                    ? 'bg-active font-semibold text-active-ink'
                    : 'text-ink-2 hover:bg-line-soft hover:text-ink',
                )}
              >
                <Icon className="size-[18px] shrink-0" />
                {entry.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-4 border-b border-line bg-surface px-6">
          <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
            <ol className="flex items-center gap-2 text-[13px]">
              {breadcrumbs.map((crumb, i) => (
                <li key={crumb.label} className="flex items-center gap-2">
                  {i > 0 ? <span className="text-ink-3">/</span> : null}
                  {crumb.href ? (
                    <Link href={crumb.href} className="text-ink-2 hover:text-ink">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="font-medium text-ink">{crumb.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>

          {actions}

          <div className="flex items-center gap-3">
            <span className="hidden text-[13px] text-ink-2 sm:inline">{user.name}</span>
            <Avatar name={user.name} />
            <LogoutButton />
          </div>
        </header>

        <main className="flex-1 px-6 py-7">{children}</main>
      </div>
    </div>
  );
}
