import { redirect } from 'next/navigation';

/**
 * The order now lives in the detail pane beside the list, not on its own page.
 * Existing links — and the redirect after creating an order — land on the list
 * with that order selected, so context is never lost.
 */
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/orders?selected=${id}`);
}
