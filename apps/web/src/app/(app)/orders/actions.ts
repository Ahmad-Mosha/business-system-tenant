'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { ShipmentTracking } from '@/lib/api';
import { apiRequest } from '@/lib/api-request';

export type ActionResult = { ok: true } | { ok: false; message: string };

function revalidateOrder(orderId: string) {
  revalidatePath('/orders');
  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/inventory', 'layout');
  revalidatePath('/money', 'layout');
}

/** A status, payment or assignment change — the API decides, the lists refresh. */
async function change(orderId: string, path: string, body: unknown): Promise<ActionResult> {
  const r = await apiRequest(path, 'PATCH', body);
  if (!r.ok) return r;
  revalidateOrder(orderId);
  return { ok: true };
}

export async function setOrderStatus(orderId: string, status: string, returned?: { reason: string; restock: boolean }) {
  return change(orderId, `/orders/${orderId}/status`, { status, ...returned });
}

export async function setPaymentStatus(orderId: string, paymentStatus: string) {
  return change(orderId, `/orders/${orderId}/payment`, { paymentStatus });
}

export async function assignOrder(orderId: string, assignedToId: string | null) {
  return change(orderId, `/orders/${orderId}/assignment`, { assignedToId });
}

export type CreateOrderState = { status: 'idle' } | { status: 'error'; message: string };

/** What the order form sends — the same for a new order and an edit. */
function orderBody(formData: FormData) {
  return {
    customerName: formData.get('customerName'),
    customerPhone: formData.get('customerPhone'),
    governorate: formData.get('governorate'),
    address: formData.get('address'),
    paymentMethod: formData.get('paymentMethod') || 'COD',
    shippingCost: String(formData.get('shippingCost') || '0'),
    notes: formData.get('notes'),
    items: JSON.parse(String(formData.get('items') ?? '[]')) as Array<{
      variantId?: string;
      title?: string;
      quantity: number;
      unitPrice: string;
    }>,
  };
}

const noItems = async (): Promise<CreateOrderState> => ({
  status: 'error',
  message: (await getTranslations('orders.form'))('needsItem'),
});

/** Manual creation for orders that arrive through social conversations. */
export async function createOrder(
  _previous: CreateOrderState,
  formData: FormData,
): Promise<CreateOrderState> {
  const body = orderBody(formData);
  if (!body.items.length) return noItems();

  const created = await apiRequest<{ id: string }>('/orders', 'POST', body);
  if (!created.ok) return { status: 'error', message: created.message };

  // Prepaid orders — wallet and InstaPay are usually settled before dispatch.
  // Creation already succeeded, so a failure here leaves a real order that is
  // one click from correct, rather than losing the order.
  if (formData.get('paymentCollected') === 'on') {
    await apiRequest(`/orders/${created.data.id}/payment`, 'PATCH', { paymentStatus: 'PAID' });
  }

  revalidatePath('/orders');
  redirect(`/orders/${created.data.id}`);
}

/** Edit an existing order — same payload as creation, applied in place. */
export async function updateOrder(
  orderId: string,
  _previous: CreateOrderState,
  formData: FormData,
): Promise<CreateOrderState> {
  const body = orderBody(formData);
  if (!body.items.length) return noItems();

  const saved = await apiRequest(`/orders/${orderId}`, 'PATCH', body);
  if (!saved.ok) return { status: 'error', message: saved.message };

  revalidateOrder(orderId);
  redirect(`/orders/${orderId}`);
}

/** Product lookup for the manual order form. */
export async function searchVariants(term: string) {
  if (!term.trim()) return [];
  const r = await apiRequest<
    Array<{
      id: string;
      label: string;
      sku: string | null;
      sellingPrice: string | null;
      unitCost: string | null;
      onHand: number;
    }>
  >(`/catalog/variants/search?q=${encodeURIComponent(term)}`, 'GET');
  return r.ok ? r.data : [];
}

export async function trackBostaLive(trackingNumber: string) {
  const clean = trackingNumber.trim();
  if (!clean) return { ok: false as const, message: (await getTranslations('errors'))('trackingRequired') };
  return apiRequest<ShipmentTracking>(`/bosta/track/${encodeURIComponent(clean)}`, 'GET');
}
