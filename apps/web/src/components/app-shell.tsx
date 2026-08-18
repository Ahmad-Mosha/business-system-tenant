import type { CurrentUser } from '@app/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { LogoutButton } from './logout-button';

interface NavItem {
  href: string;
  label: string;
}

/**
 * A quiet top bar rather than a heavy sidebar: this product has few sections, and the
 * screen belongs to the data.
 */
export function AppShell({
  user,
  nav,
  activeHref,
  children,
}: {
  user: CurrentUser;
  nav: NavItem[];
  activeHref: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-rule">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-6">
          <Link href="/orders" className="font-display text-[19px] leading-none tracking-tight">
            {user.organizationName}
          </Link>

          <nav className="flex items-center gap-6" aria-label="Sections">
            {nav.map((item) => {
              const active = activeHref === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={
                    active
                      ? 'relative text-sm text-ink after:absolute after:-bottom-[18px] after:left-0 after:h-px after:w-full after:bg-ink'
                      : 'text-sm text-ink-faint transition-colors hover:text-ink'
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-4">
            <span className="hidden text-[13px] text-ink-faint sm:inline">{user.name}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
