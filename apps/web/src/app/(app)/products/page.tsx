import { ChannelProducts } from '@/components/channel-screens';
import { requireAdmin } from '@/lib/session';

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  return <ChannelProducts channel="noon" params={await searchParams} />;
}
