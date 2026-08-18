'use client';

import type { CurrentUser } from '@app/contracts';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from './app-shell';

/** Derives the active nav entry and breadcrumbs from the current route. */
export function ShellFrame({ user, children }: { user: CurrentUser; children: ReactNode }) {
  const pathname = usePathname() ?? '/orders';
  const section = `/${pathname.split('/')[1] ?? 'orders'}`;

  const breadcrumbs: { label: string; href?: string }[] = [];
  if (section === '/catalog') {
    breadcrumbs.push({ label: 'Catalog' });
  } else {
    breadcrumbs.push(pathname === '/orders' ? { label: 'Orders' } : { label: 'Orders', href: '/orders' });
    if (pathname === '/orders/new') breadcrumbs.push({ label: 'New order' });
    else if (pathname !== '/orders') breadcrumbs.push({ label: 'Order detail' });
  }

  return (
    <AppShell user={user} activeHref={section} breadcrumbs={breadcrumbs}>
      {children}
    </AppShell>
  );
}
