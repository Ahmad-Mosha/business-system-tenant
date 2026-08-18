import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { requireUser } from '@/lib/session';

/**
 * Everything under this layout requires a session. The check runs on the server before
 * any page renders, so protected content is never sent to an anonymous browser.
 */
export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return (
    <AppShell user={user} activeHref="/orders" nav={[{ href: '/orders', label: 'Orders' }]}>
      {children}
    </AppShell>
  );
}
