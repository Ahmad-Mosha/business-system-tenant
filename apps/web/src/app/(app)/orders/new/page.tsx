import { OrderForm } from '@/components/orders/order-form';
import { requireSession } from '@/lib/session';

export default async function NewOrderPage() {
  const user = await requireSession();
  return <OrderForm assignsToSelf={user.role === 'MODERATOR'} draftKey={`${user.id}:order:new`} />;
}
