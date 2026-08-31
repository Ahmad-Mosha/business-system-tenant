import { AppSidebar } from '@/components/app-sidebar';
import { requireSession } from '@/lib/session';

/**
 * The signed-in shell. Every page inside this group has a session, so pages
 * never repeat the check — though the API enforces it independently.
 *
 * The frame is fixed height and hides its own overflow: a screen inside it
 * scrolls its panes, never the document.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();

  return (
    <div className="flex h-full">
      <AppSidebar user={user} />
      {/* pt-14 clears the mobile bar; the sidebar is in flow from lg up. */}
      <main className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
