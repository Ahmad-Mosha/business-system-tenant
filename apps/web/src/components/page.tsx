import { Topbar } from '@/components/topbar';
import { getSession } from '@/lib/session';

/**
 * Every screen: a fixed top bar and one scrolling region beneath it. The
 * chrome never scrolls, so a long table never pushes the controls off-screen.
 */
export async function Page({ title, children }: { title: string; children: React.ReactNode }) {
  const session = await getSession();
  if (!session) return null;

  return (
    <>
      <Topbar session={session} title={title} />
      <main className="flex-1 overflow-y-auto p-4">{children}</main>
    </>
  );
}
