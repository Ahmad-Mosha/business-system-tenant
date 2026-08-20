'use server';

import { revalidatePath } from 'next/cache';
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

export type FormState = { status: 'idle' } | { status: 'ok'; message: string } | { status: 'error'; message: string };

export async function addProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const openingStock = String(formData.get('openingStock') ?? '').trim();
  const channels = formData.getAll('channels') as string[];
  try {
    await send('/catalog/products', 'POST', {
      name: formData.get('name'),
      category: formData.get('category') || undefined,
      sku: formData.get('sku') || undefined,
      unitCost: String(formData.get('unitCost') ?? '').trim() || undefined,
      sellingPrice: String(formData.get('sellingPrice') ?? '').trim() || undefined,
      openingStock: openingStock ? Number(openingStock) : undefined,
      channels: channels.length > 0 ? channels : undefined,
    });
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Could not add product' };
  }
  revalidatePath('/inventory');
  return { status: 'ok', message: 'Product added.' };
}

export async function recordStock(
  variantId: string,
  quantity: number,
  reason: string,
  note?: string,
) {
  try {
    await send(`/catalog/variants/${variantId}/stock`, 'POST', { quantity, reason, note });
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : 'Could not record stock' };
  }
  revalidatePath('/inventory');
  return { ok: true as const };
}

export async function updateVariant(
  variantId: string,
  patch: { sku?: string | null; unitCost?: string | null; sellingPrice?: string | null },
) {
  try {
    await send(`/catalog/variants/${variantId}`, 'PATCH', patch);
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : 'Could not save' };
  }
  revalidatePath('/inventory');
  return { ok: true as const };
}

/** Pulls the live Easy Orders catalogue so website orders resolve to stock. */
export async function syncEasyOrders() {
  try {
    const result = await send('/catalog/sync/easyorders', 'POST', {});
    revalidatePath('/inventory');
    return { ok: true as const, ...result };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : 'Sync failed' };
  }
}
