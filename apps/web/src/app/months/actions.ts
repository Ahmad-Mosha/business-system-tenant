'use server';

import { revalidatePath } from 'next/cache';

const API = process.env.API_URL ?? 'http://localhost:3001';

export type AnchorState = { status: 'idle' } | { status: 'saved' } | { status: 'error'; message: string };

/** Stores the balance every later month is measured from. */
export async function setOpeningBalance(
  _previous: AnchorState,
  formData: FormData,
): Promise<AnchorState> {
  const openingBalance = String(formData.get('openingBalance') ?? '').trim();
  const openingAsOf = String(formData.get('openingAsOf') ?? '').trim();

  if (!/^-?\d+(\.\d{1,2})?$/.test(openingBalance)) {
    return { status: 'error', message: 'Enter an amount, for example 89006.06' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(openingAsOf)) {
    return { status: 'error', message: 'Enter the date as YYYY-MM-DD' };
  }

  let res: Response;
  try {
    res = await fetch(`${API}/noon/account`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ openingBalance, openingAsOf }),
    });
  } catch {
    return { status: 'error', message: 'Could not reach the API.' };
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    return { status: 'error', message: detail?.message ?? 'Could not save.' };
  }

  revalidatePath('/');
  revalidatePath('/months');
  return { status: 'saved' };
}
