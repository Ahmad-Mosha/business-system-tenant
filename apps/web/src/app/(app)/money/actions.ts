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

// ── Suppliers & purchases ────────────────────────────────────────────────

function revalidatePurchasing() {
  revalidateMoney();
  revalidatePath('/money/suppliers');
  revalidatePath('/money/purchases');
  revalidatePath('/inventory');
}

export async function createSupplier(_prev: FormState, form: FormData): Promise<FormState> {
  const name = String(form.get('name') ?? '').trim();
  if (!name) return { status: 'error', message: 'Enter the supplier name' };
  const state = await send('/suppliers', 'POST', {
    name,
    phone: String(form.get('phone') ?? '').trim() || undefined,
    note: String(form.get('note') ?? '').trim() || undefined,
  });
  if (state.status === 'saved') revalidatePath('/money/suppliers');
  return state;
}

export async function paySupplier(_prev: FormState, form: FormData): Promise<FormState> {
  const id = String(form.get('id') ?? '');
  const amount = String(form.get('amount') ?? '').trim();
  const invoiceId = String(form.get('invoiceId') ?? '').trim() || undefined;
  if (!id) return { status: 'error', message: 'Missing supplier' };
  if (!MONEY.test(amount)) return { status: 'error', message: 'Enter an amount, e.g. 10000.00' };
  const state = await send(`/suppliers/${id}/payments`, 'POST', {
    amount,
    invoiceId,
    memo: String(form.get('memo') ?? '').trim() || undefined,
  });
  if (state.status === 'saved') {
    revalidatePurchasing();
    revalidatePath(`/money/suppliers/${id}`);
  }
  return state;
}

export interface InvoiceLinePayload {
  variantId: string;
  quantity: number;
  unitCost: string;
}
export interface InvoicePayload {
  supplierId: string;
  invoiceNo?: string;
  invoiceDate: string;
  payment: 'CASH' | 'CREDIT';
  allocation: 'BY_VALUE' | 'PER_UNIT';
  extraCosts: string;
  lines: InvoiceLinePayload[];
}

export type InvoiceResult = { ok: true; id: string } | { ok: false; message: string };

/**
 * Creates a product + its default variant so an invoice can receive stock for
 * something not in the catalogue yet. Cost comes from the invoice line, so none
 * is set here.
 */
export async function createProductForInvoice(input: {
  name: string;
  category?: string;
  sku?: string;
  /** Channel SKUs to link on creation — blank ones are dropped before sending. */
  listings?: Array<{ channel: string; externalId: string }>;
}): Promise<{ ok: true; variantId: string; label: string } | { ok: false; message: string }> {
  if (!input.name.trim()) return { ok: false, message: 'Enter a product name' };
  const listings = input.listings?.filter((l) => l.externalId.trim());
  let res: Response;
  try {
    res = await fetch(`${API}/catalog/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({
        name: input.name.trim(),
        category: input.category || undefined,
        sku: input.sku?.trim() || undefined,
        listings: listings?.length ? listings : undefined,
      }),
    });
  } catch {
    return { ok: false, message: 'Could not reach the API.' };
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, message: data?.message ?? 'Could not create the product.' };
  revalidatePath('/inventory');
  return { ok: true, variantId: data.variantId as string, label: input.name.trim() };
}

async function call(path: string, method: 'POST', body?: unknown): Promise<InvoiceResult> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: 'Could not reach the API.' };
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, message: data?.message ?? 'Could not save.' };
  return { ok: true, id: data.id as string };
}

/** Creates the invoice, and posts it too unless `asDraft`. */
export async function saveInvoice(input: InvoicePayload, asDraft: boolean): Promise<InvoiceResult> {
  if (!input.supplierId) return { ok: false, message: 'Choose a supplier' };
  if (!ISO_DATE.test(input.invoiceDate)) return { ok: false, message: 'Enter the invoice date' };
  if (!input.lines.length) return { ok: false, message: 'Add at least one product' };
  for (const l of input.lines) {
    if (!l.variantId) return { ok: false, message: 'Every line needs a product' };
    if (!Number.isInteger(l.quantity) || l.quantity < 1) {
      return { ok: false, message: 'Every line needs a whole quantity' };
    }
    if (!MONEY.test(l.unitCost) || Number(l.unitCost) <= 0) {
      return { ok: false, message: 'Every line needs a unit cost' };
    }
  }
  if (input.extraCosts && !MONEY.test(input.extraCosts)) {
    return { ok: false, message: 'Extra costs must be an amount like 5000.00' };
  }

  const created = await call('/purchases', 'POST', input);
  if (!created.ok) return created;

  if (asDraft) {
    revalidatePurchasing();
    return created;
  }
  const posted = await call(`/purchases/${created.id}/post`, 'POST');
  revalidatePurchasing();
  return posted.ok ? created : posted;
}

export async function postInvoice(_prev: FormState, form: FormData): Promise<FormState> {
  const id = String(form.get('id') ?? '');
  if (!id) return { status: 'error', message: 'Missing invoice' };
  const state = await send(`/purchases/${id}/post`, 'POST', undefined);
  if (state.status === 'saved') {
    revalidatePurchasing();
    revalidatePath(`/money/purchases/${id}`);
  }
  return state;
}
