'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { authHeaders } from '@/lib/session';

const API = process.env.API_URL ?? 'http://localhost:3001';

async function send(path: string, method: string, body: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export type ActionResult = { ok: true } | { ok: false; message: string };

export async function setOrderStatus(orderId: string, status: string): Promise<ActionResult> {
  try {
    await send(`/orders/${orderId}/status`, 'PATCH', { status });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not update status' };
  }
  revalidatePath('/orders');
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}

export async function setPaymentStatus(
  orderId: string,
  paymentStatus: string,
): Promise<ActionResult> {
  try {
    await send(`/orders/${orderId}/payment`, 'PATCH', { paymentStatus });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not update payment' };
  }
  revalidatePath('/orders');
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}

export async function assignOrder(
  orderId: string,
  assignedToId: string | null,
): Promise<ActionResult> {
  try {
    await send(`/orders/${orderId}/assignment`, 'PATCH', { assignedToId });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not assign' };
  }
  revalidatePath('/orders');
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}

export type CreateOrderState = { status: 'idle' } | { status: 'error'; message: string };

/** Manual creation for orders that arrive through social conversations. */
export async function createOrder(
  _previous: CreateOrderState,
  formData: FormData,
): Promise<CreateOrderState> {
  const items = JSON.parse(String(formData.get('items') ?? '[]')) as Array<{
    variantId?: string;
    title?: string;
    quantity: number;
    unitPrice: string;
  }>;

  if (!items.length) return { status: 'error', message: 'Add at least one item.' };

  let created: { id: string };
  try {
    created = await send('/orders', 'POST', {
      customerName: formData.get('customerName'),
      customerPhone: formData.get('customerPhone'),
      governorate: formData.get('governorate'),
      address: formData.get('address'),
      paymentMethod: formData.get('paymentMethod') || 'COD',
      shippingCost: String(formData.get('shippingCost') || '0'),
      notes: formData.get('notes'),
      items,
    });
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Could not create order' };
  }

  // Prepaid orders — wallet and InstaPay are usually settled before dispatch.
  // Creation already succeeded, so a failure here leaves a real order that is
  // one click from correct, rather than losing the order.
  if (formData.get('paymentCollected') === 'on') {
    await send(`/orders/${created.id}/payment`, 'PATCH', { paymentStatus: 'PAID' }).catch(() => null);
  }

  revalidatePath('/orders');
  redirect(`/orders/${created.id}`);
}

/** Edit an existing order — same payload as creation, applied in place. */
export async function updateOrder(
  orderId: string,
  _previous: CreateOrderState,
  formData: FormData,
): Promise<CreateOrderState> {
  const items = JSON.parse(String(formData.get('items') ?? '[]')) as Array<{
    variantId?: string;
    title?: string;
    quantity: number;
    unitPrice: string;
  }>;

  if (!items.length) return { status: 'error', message: 'Add at least one item.' };

  try {
    await send(`/orders/${orderId}`, 'PATCH', {
      customerName: formData.get('customerName'),
      customerPhone: formData.get('customerPhone'),
      governorate: formData.get('governorate'),
      address: formData.get('address'),
      paymentMethod: formData.get('paymentMethod') || 'COD',
      shippingCost: String(formData.get('shippingCost') || '0'),
      notes: formData.get('notes'),
      items,
    });
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Could not save the order' };
  }

  revalidatePath('/orders');
  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}`);
}

/** Product lookup for the manual order form. */
export async function searchVariants(term: string) {
  if (!term.trim()) return [];
  const res = await fetch(`${API}/catalog/variants/search?q=${encodeURIComponent(term)}`, {
    headers: await authHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return (await res.json()) as Array<{
    id: string;
    label: string;
    sku: string | null;
    sellingPrice: string | null;
    unitCost: string | null;
    onHand: number;
  }>;
}

export async function setOrderTracking(
  orderId: string,
  trackingNumber: string | null,
): Promise<ActionResult> {
  try {
    await send(`/bosta/orders/${orderId}/tracking`, 'PATCH', { trackingNumber });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not update tracking number' };
  }
  revalidatePath('/orders');
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}

export async function trackBostaLive(trackingNumber: string) {
  const clean = trackingNumber.trim();
  if (!clean) return { ok: false as const, message: 'Tracking number is required' };
  try {
    const res = await fetch(`${API}/bosta/track/${encodeURIComponent(clean)}`, {
      headers: await authHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Tracking failed' }));
      return { ok: false as const, message: err?.message ?? 'Shipment not found on Bosta' };
    }
    const data = await res.json();
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : 'Could not connect to tracking service' };
  }
}



