import { NewOrderForm } from '@/components/new-order-form';
import { requireSession } from '@/lib/session';

export default async function NewOrderPage() {
  const user = await requireSession();
  return <NewOrderForm assignsToSelf={user.role === 'MODERATOR'} />;
}
