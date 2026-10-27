import { ChannelUploads } from '@/components/channels/channel-screens';
import { requireAdmin } from '@/lib/session';

export default async function ImportsPage() {
  await requireAdmin();
  return <ChannelUploads channel="noon" />;
}
