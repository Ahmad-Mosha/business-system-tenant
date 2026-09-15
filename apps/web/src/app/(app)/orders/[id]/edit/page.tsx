import { notFound, redirect } from 'next/navigation';
import { OrderForm } from '@/components/order-form';
import { EDITABLE_STATUSES } from '@/components/order-status';
import { getOrder } from '@/lib/api';
import { requireSession } from '@/lib/session';

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;

  const order = await getOrder(id).catch(() => null);
  if (!order) notFound();
  if (!EDITABLE_STATUSES.includes(order.status)) redirect(`/orders/${id}`);

  return <OrderForm order={order} />;
}
