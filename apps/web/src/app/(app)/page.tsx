import { redirect } from 'next/navigation';
import { ChannelOverview } from '@/components/channel-screens';
import { requireSession } from '@/lib/session';

/** noon's overview — the home screen for admins; moderators start at Orders. */
export default async function OverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireSession();
  if (user.role === 'MODERATOR') redirect('/orders');
  return (
    <div data-sensitive-scope className="contents">
      <ChannelOverview channel="noon" params={await searchParams} />
    </div>
  );
}
