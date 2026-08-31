import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { getSession } from '@/lib/session';

/** The gate for every signed-in page. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar role={session.role} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
