'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiRequest } from '@/lib/api-request';

export type CreateProductState = { status: 'idle' } | { status: 'error'; message: string };

type Result = { ok: true } | { ok: false; message: string };

/** A write to the catalogue; the given pages refresh when it lands. */
async function write(path: string, method: 'POST' | 'PATCH' | 'DELETE', body: unknown, ...paths: string[]): Promise<Result> {
  const r = await apiRequest(path, method, body);
  if (!r.ok) return r;
  revalidatePath('/inventory', 'layout');
  revalidatePath('/money', 'layout');
  for (const p of paths) revalidatePath(p);
  return { ok: true };
}

/** Creates a product and lands on its detail page — matches the order form. */
export async function addProduct(
  _prev: CreateProductState,
  formData: FormData,
): Promise<CreateProductState> {
  const openingStock = String(formData.get('openingStock') ?? '').trim();
  const listings = (['noon', 'amazon', 'easyorders'] as const).flatMap((channel) =>
    formData
      .getAll(`sku_${channel}`)
      .map((v) => ({ channel, externalId: String(v).trim() }))
      .filter((l) => l.externalId),
  );
  const created = await apiRequest<{ id: string }>('/catalog/products', 'POST', {
    name: formData.get('name'),
    category: formData.get('category') || undefined,
    sku: formData.get('sku') || undefined,
    unitCost: String(formData.get('unitCost') ?? '').trim() || undefined,
    sellingPrice: String(formData.get('sellingPrice') ?? '').trim() || undefined,
    openingStock: openingStock ? Number(openingStock) : undefined,
    listings: listings.length ? listings : undefined,
  });
  if (!created.ok) return { status: 'error', message: created.message };
  revalidatePath('/inventory');
  redirect(`/inventory/${created.data.id}`);
}

export async function updateProduct(productId: string, patch: { name?: string; category?: string | null }) {
  return write(`/catalog/products/${productId}`, 'PATCH', patch, '/inventory', `/inventory/${productId}`);
}

/** Archives (soft-deletes) a product, then sends the caller back to the list. */
export async function archiveProduct(productId: string) {
  const r = await write(`/catalog/products/${productId}`, 'DELETE', undefined, '/inventory');
  if (!r.ok) return r;
  redirect('/inventory');
}

export async function recordStock(variantId: string, quantity: number, reason: string, note?: string, location: 'WAREHOUSE' | 'NOON' = 'WAREHOUSE') {
  return write(`/catalog/variants/${variantId}/stock`, 'POST', { quantity, reason, note, location }, '/inventory');
}

export async function updateVariant(
  variantId: string,
  patch: {
    sku?: string | null;
    unitCost?: string | null;
    sellingPrice?: string | null;
    costReason?: string;
  },
) {
  return write(`/catalog/variants/${variantId}`, 'PATCH', patch, '/inventory');
}

/** Links a channel's SKU to a product so a sale there decrements its stock. */
export async function addListing(productId: string, channel: string, externalId: string, variantId?: string) {
  return write(
    `/catalog/products/${productId}/listings`,
    'POST',
    { channel, externalId, variantId },
    `/inventory/${productId}`,
  );
}

export async function updateListing(productId: string, listingId: string, externalId: string) {
  return write(`/catalog/listings/${listingId}`, 'PATCH', { externalId }, `/inventory/${productId}`);
}

export async function removeListing(productId: string, listingId: string) {
  return write(`/catalog/listings/${listingId}`, 'DELETE', undefined, `/inventory/${productId}`);
}

/** Pulls the live Easy Orders catalogue so website orders resolve to stock. */
export async function syncEasyOrders() {
  const r = await apiRequest<{ updated: number; unmatched: unknown[] }>('/catalog/sync/easyorders', 'POST', {});
  if (r.ok) revalidatePath('/inventory');
  return r;
}

export async function transferStock(variantId: string, quantity: number, from: 'WAREHOUSE' | 'NOON', note: string) {
  return write(`/catalog/variants/${variantId}/transfer`, 'POST', {
    quantity, from, to: from === 'WAREHOUSE' ? 'NOON' : 'WAREHOUSE', note,
  }, '/inventory');
}
