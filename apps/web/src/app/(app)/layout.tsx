import { AppSidebar } from '@/components/app-sidebar';
import { requireSession } from '@/lib/session';

/**
 * The signed-in shell. Every page inside this group has a session, so pages
 * never repeat the check — though the API enforces it independently.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();

  return (
    <div className="flex min-h-svh">
      <AppSidebar user={user} />
      {/* pt-14 clears the mobile bar; the sidebar is in flow from lg up. */}
      <main className="min-w-0 flex-1 pt-14 lg:pt-0">{children}</main>
    </div>
  );
}
