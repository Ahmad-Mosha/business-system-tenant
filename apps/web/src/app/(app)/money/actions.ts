'use server';

import { revalidatePath } from 'next/cache';
import { authHeaders } from '@/lib/session';

const API = process.env.API_URL ?? 'http://localhost:3001';
const MONEY = /^\d+(\.\d{1,2})?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type FormState = { status: 'idle' } | { status: 'saved' } | { status: 'error'; message: string };

/** Refreshes every money screen after a write — balances feed all of them. */
function revalidateMoney() {
  revalidatePath('/money');
  revalidatePath('/money/treasury');
  revalidatePath('/money/ledger');
}

async function send(path: string, method: 'POST' | 'PATCH', body: unknown): Promise<FormState> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: 'error', message: 'Could not reach the API.' };
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    return { status: 'error', message: detail?.message ?? 'Could not save.' };
  }
  revalidateMoney();
  return { status: 'saved' };
}

/** سند قبض / سند صرف / إيداع نقدي — a hand-entered cash movement. */
export async function recordVoucher(_prev: FormState, form: FormData): Promise<FormState> {
  const direction = form.get('direction') === 'IN' ? 'IN' : 'OUT';
  const counter = String(form.get('counter') ?? '');
  const amount = String(form.get('amount') ?? '').trim();
  const memo = String(form.get('memo') ?? '').trim();
  const occurredAt = String(form.get('occurredAt') ?? '').trim();

  if (!MONEY.test(amount)) return { status: 'error', message: 'Enter an amount, e.g. 5000.00' };
  if (!counter) return { status: 'error', message: 'Choose what this is for' };
  if (occurredAt && !ISO_DATE.test(occurredAt)) {
    return { status: 'error', message: 'Enter the date as YYYY-MM-DD' };
  }

  return send('/finance/vouchers', 'POST', {
    direction,
    counter,
    amount,
    memo: memo || undefined,
    occurredAt: occurredAt || undefined,
  });
}

/** إيداع سندي — record a received cheque. */
export async function recordCheque(_prev: FormState, form: FormData): Promise<FormState> {
  const amount = String(form.get('amount') ?? '').trim();
  const fromParty = String(form.get('fromParty') ?? '').trim();
  const receivedDate = String(form.get('receivedDate') ?? '').trim();
  const dueDate = String(form.get('dueDate') ?? '').trim();
  const memo = String(form.get('memo') ?? '').trim();

  if (!MONEY.test(amount)) return { status: 'error', message: 'Enter an amount, e.g. 25000.00' };
  if (!fromParty) return { status: 'error', message: 'Enter who the cheque is from' };
  if (!ISO_DATE.test(receivedDate)) return { status: 'error', message: 'Enter the received date' };
  if (dueDate && !ISO_DATE.test(dueDate)) return { status: 'error', message: 'Enter the due date as YYYY-MM-DD' };

  return send('/finance/cheques', 'POST', {
    amount,
    fromParty,
    receivedDate,
    dueDate: dueDate || undefined,
    memo: memo || undefined,
  });
}

/** Clear or bounce a pending cheque. */
export async function settleCheque(_prev: FormState, form: FormData): Promise<FormState> {
  const id = String(form.get('id') ?? '');
  const status = form.get('status') === 'BOUNCED' ? 'BOUNCED' : 'CLEARED';
  const clearedDate = String(form.get('clearedDate') ?? '').trim();
  if (!id) return { status: 'error', message: 'Missing cheque' };
  if (clearedDate && !ISO_DATE.test(clearedDate)) {
    return { status: 'error', message: 'Enter the date as YYYY-MM-DD' };
  }
  return send(`/finance/cheques/${id}`, 'PATCH', {
    status,
    clearedDate: clearedDate || undefined,
  });
}

/** The opening cash balance the ledger starts from. */
export async function setAnchor(_prev: FormState, form: FormData): Promise<FormState> {
  const openingBalance = String(form.get('openingBalance') ?? '').trim();
  const openingAsOf = String(form.get('openingAsOf') ?? '').trim();
  if (!MONEY.test(openingBalance)) return { status: 'error', message: 'Enter an amount, e.g. 300000.00' };
  if (!ISO_DATE.test(openingAsOf)) return { status: 'error', message: 'Enter the date as YYYY-MM-DD' };
  return send('/finance/anchor', 'PATCH', { openingBalance, openingAsOf });
}
