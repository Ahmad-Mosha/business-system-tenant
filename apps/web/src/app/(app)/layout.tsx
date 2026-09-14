import { cookies } from 'next/headers';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
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
  const open = (await cookies()).get('sidebar_state')?.value !== 'false';

  return (
    <SidebarProvider
      defaultOpen={open}
      // 13rem, not shadcn's 16 — the labels fit, and the screen is for the work.
      style={{ '--sidebar-width': '13rem' } as React.CSSProperties}
      className="h-svh min-h-0 overflow-hidden"
    >
      <AppSidebar user={user} />
      <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
        <SiteHeader />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
