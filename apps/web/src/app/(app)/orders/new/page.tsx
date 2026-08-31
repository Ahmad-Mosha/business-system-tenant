import { OrderForm } from '@/components/order-form';
import { requireSession } from '@/lib/session';

export default async function NewOrderPage() {
  const user = await requireSession();
  return <OrderForm assignsToSelf={user.role === 'MODERATOR'} />;
}
