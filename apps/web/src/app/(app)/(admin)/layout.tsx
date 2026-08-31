import { Topbar } from '@/components/topbar';
import { Empty } from '@/components/ui/empty';
import { Panel } from '@/components/ui/panel';
import { getSession } from '@/lib/session';

/**
 * Everything in this group is admin-only. The API refuses these calls anyway —
 * this exists so a moderator who follows a link gets an answer instead of a
 * crashed page.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) return null;

  if (session.role !== 'ADMIN') {
    return (
      <>
        <Topbar session={session} title="Not available" />
        <main className="flex-1 overflow-y-auto p-4">
          <Panel className="max-w-xl">
            <Empty
              title="This section is for admins"
              detail="Moderators work with their own orders and shipments. Those screens are not built yet — they arrive with the orders phase."
            />
          </Panel>
        </main>
      </>
    );
  }

  return <>{children}</>;
}
