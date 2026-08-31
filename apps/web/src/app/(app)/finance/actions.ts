'use server';

import { revalidatePath } from 'next/cache';
import { authHeaders } from '@/lib/session';

const API = process.env.API_URL ?? 'http://localhost:3001';

export type AnchorState = { status: 'idle' } | { status: 'saved' } | { status: 'error'; message: string };

/** Stores the cash balance every ledger entry is measured from. */
export async function setCashAnchor(
  _previous: AnchorState,
  formData: FormData,
): Promise<AnchorState> {
  const openingBalance = String(formData.get('openingBalance') ?? '').trim();
  const openingAsOf = String(formData.get('openingAsOf') ?? '').trim();

  if (!/^-?\d+(\.\d{1,2})?$/.test(openingBalance)) {
    return { status: 'error', message: 'Enter an amount, for example 300000.00' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(openingAsOf)) {
    return { status: 'error', message: 'Enter the date as YYYY-MM-DD' };
  }

  let res: Response;
  try {
    res = await fetch(`${API}/finance/anchor`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ openingBalance, openingAsOf }),
    });
  } catch {
    return { status: 'error', message: 'Could not reach the API.' };
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    return { status: 'error', message: detail?.message ?? 'Could not save.' };
  }

  revalidatePath('/finance');
  return { status: 'saved' };
}

export type CapitalState = { status: 'idle' } | { status: 'saved' } | { status: 'error'; message: string };

/** Owner adds or withdraws funds — the only manually-entered cash movement. */
export async function recordCapital(
  _previous: CapitalState,
  formData: FormData,
): Promise<CapitalState> {
  const amount = String(formData.get('amount') ?? '').trim();
  const direction = formData.get('direction') === 'OUT' ? 'OUT' : 'IN';
  const note = String(formData.get('note') ?? '').trim();

  if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
    return { status: 'error', message: 'Enter an amount, for example 5000.00' };
  }

  let res: Response;
  try {
    res = await fetch(`${API}/finance/capital`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ amount, direction, note: note || undefined }),
    });
  } catch {
    return { status: 'error', message: 'Could not reach the API.' };
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    return { status: 'error', message: detail?.message ?? 'Could not save.' };
  }

  revalidatePath('/finance');
  return { status: 'saved' };
}
