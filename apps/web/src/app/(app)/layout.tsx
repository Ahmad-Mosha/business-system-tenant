import { cookies } from 'next/headers';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { SiteHeader } from '@/components/layout/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { getOrderSummary } from '@/lib/api';
import { requireSession } from '@/lib/session';

/**
 * The signed-in shell. Every page inside this group has a session, so pages
 * never repeat the check — though the API enforces it independently.
 *
 * Fixed to the viewport: the sidebar and header stay put, and each screen
 * decides what scrolls beneath them.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();
  // Read on the server so a collapsed sidebar doesn't flash open on load.
  const jar = await cookies();
  const open = jar.get('sidebar_state')?.value !== 'false';
  const privacy = jar.get('pm_privacy')?.value === 'hidden';
  // What's waiting on the people here, shown beside its screen in the sidebar.
  // A failed count leaves the badge off; it never blocks the page.
  const orders = await getOrderSummary().catch(() => null);

  return (
    <SidebarProvider
      defaultOpen={open}
      // 14.5rem, not shadcn's 16: room for the labels and their counts, and the screen stays for the work.
      style={{ '--sidebar-width': '14.5rem' } as React.CSSProperties}
      className="h-svh min-h-0 overflow-hidden"
    >
      <AppSidebar user={user} counts={{ orders: orders?.needsWork ?? 0 }} />
      <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
        <SiteHeader role={user.role} privacy={user.role === 'ADMIN' ? privacy : undefined} />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
