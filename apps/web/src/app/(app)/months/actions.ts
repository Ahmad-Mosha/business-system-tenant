'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { apiRequest } from '@/lib/api-request';

export type AnchorState = { status: 'idle' } | { status: 'saved' } | { status: 'error'; message: string };

/** Stores the balance every later month is measured from. */
export async function setOpeningBalance(
  _previous: AnchorState,
  formData: FormData,
): Promise<AnchorState> {
  const openingBalance = String(formData.get('openingBalance') ?? '').trim();
  const openingAsOf = String(formData.get('openingAsOf') ?? '').trim();

  const t = await getTranslations('validation');
  if (!/^-?\d+(\.\d{1,2})?$/.test(openingBalance)) {
    return { status: 'error', message: t('amount', { example: '89006.06' }) };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(openingAsOf)) return { status: 'error', message: t('date') };

  const r = await apiRequest('/noon/account', 'PATCH', { openingBalance, openingAsOf });
  if (!r.ok) return { status: 'error', message: r.message };

  revalidatePath('/');
  revalidatePath('/months');
  return { status: 'saved' };
}
