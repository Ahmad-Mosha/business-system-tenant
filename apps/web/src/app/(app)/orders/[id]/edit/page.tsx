import { notFound, redirect } from 'next/navigation';
import { OrderForm } from '@/components/order-form';
import { getOrder } from '@/lib/api';
import { requireSession } from '@/lib/session';

/** Mirrors OrdersService.EDITABLE — the API refuses the rest regardless. */
const EDITABLE = ['NEW', 'ASSIGNED', 'CONFIRMED'];

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;

  const order = await getOrder(id).catch(() => null);
  if (!order) notFound();
  if (!EDITABLE.includes(order.status)) redirect(`/orders/${id}`);

  return <OrderForm order={order} />;
}
