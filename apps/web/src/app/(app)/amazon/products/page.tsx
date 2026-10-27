import { ChannelProducts } from '@/components/channels/channel-screens';
import { requireAdmin } from '@/lib/session';

export default async function AmazonProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  return <ChannelProducts channel="amazon" params={await searchParams} />;
}
