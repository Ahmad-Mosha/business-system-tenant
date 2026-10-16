import { ChannelUploads } from '@/components/channel-screens';
import { requireAdmin } from '@/lib/session';

export default async function AmazonImportsPage() {
  await requireAdmin();
  return <ChannelUploads channel="amazon" />;
}
