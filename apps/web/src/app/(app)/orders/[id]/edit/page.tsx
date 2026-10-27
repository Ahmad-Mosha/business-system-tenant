import { notFound, redirect } from 'next/navigation';
import { OrderForm } from '@/components/orders/order-form';
import { getOrder } from '@/lib/api';
import { requireSession } from '@/lib/session';

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSession();
  const { id } = await params;

  const order = await getOrder(id).catch(() => null);
  if (!order) notFound();
  // Opened from an old link after it stopped being editable: the order page explains why.
  if (order.blocked?.edit?.length) redirect(`/orders/${id}`);

  return <OrderForm order={order} draftKey={`${user.id}:order:${id}`} />;
}
