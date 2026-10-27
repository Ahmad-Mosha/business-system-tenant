import { ChannelOverview } from '@/components/channels/channel-screens';
import { requireAdmin } from '@/lib/session';

export default async function AmazonOverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  return <ChannelOverview channel="amazon" params={await searchParams} />;
}
