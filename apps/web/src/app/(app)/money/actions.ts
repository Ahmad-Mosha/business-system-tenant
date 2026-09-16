'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { apiRequest } from '@/lib/api-request';
import type messages from '@/messages/en.json';

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
  const r = await apiRequest(path, method, body);
  if (!r.ok) return { status: 'error', message: r.message };
  revalidateMoney();
  return { status: 'saved' };
}

/** A form's own check failing — said in the reader's language. */
type Check = keyof (typeof messages)['validation'];
async function invalid(check: Check, example?: string): Promise<{ status: 'error'; message: string }> {
  const t = await getTranslations('validation');
  return { status: 'error', message: check === 'amount' ? t('amount', { example: example ?? '' }) : t(check) };
}

/** سند قبض / سند صرف / إيداع نقدي — a hand-entered cash movement. */
export async function recordVoucher(_prev: FormState, form: FormData): Promise<FormState> {
  const direction = form.get('direction') === 'IN' ? 'IN' : 'OUT';
  const counter = String(form.get('counter') ?? '');
  const amount = String(form.get('amount') ?? '').trim();
  const memo = String(form.get('memo') ?? '').trim();
  const occurredAt = String(form.get('occurredAt') ?? '').trim();

  if (!MONEY.test(amount)) return invalid('amount', '5000.00');
  if (!counter) return invalid('chooseCounter');
  if (occurredAt && !ISO_DATE.test(occurredAt)) return invalid('date');

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

  if (!MONEY.test(amount)) return invalid('amount', '25000.00');
  if (!fromParty) return invalid('chequeFrom');
  if (!ISO_DATE.test(receivedDate)) return invalid('receivedDate');
  if (dueDate && !ISO_DATE.test(dueDate)) return invalid('dueDate');

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
  if (!id) return invalid('missingRecord');
  if (clearedDate && !ISO_DATE.test(clearedDate)) return invalid('date');
  return send(`/finance/cheques/${id}`, 'PATCH', {
    status,
    clearedDate: clearedDate || undefined,
  });
}

/** The opening cash balance the ledger starts from. */
export async function setAnchor(_prev: FormState, form: FormData): Promise<FormState> {
  const openingBalance = String(form.get('openingBalance') ?? '').trim();
  const openingAsOf = String(form.get('openingAsOf') ?? '').trim();
  if (!MONEY.test(openingBalance)) return invalid('amount', '300000.00');
  if (!ISO_DATE.test(openingAsOf)) return invalid('date');
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
  if (!name) return invalid('supplierName');
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
  if (!id) return invalid('missingRecord');
  if (!MONEY.test(amount)) return invalid('amount', '10000.00');
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
  extraCostsPaidSeparately?: boolean;
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
  if (!input.name.trim()) return { ok: false, message: (await invalid('productName')).message };
  const listings = input.listings?.filter((l) => l.externalId.trim());
  const r = await apiRequest<{ variantId: string }>('/catalog/products', 'POST', {
    name: input.name.trim(),
    category: input.category || undefined,
    sku: input.sku?.trim() || undefined,
    listings: listings?.length ? listings : undefined,
  });
  if (!r.ok) return r;
  revalidatePath('/inventory');
  return { ok: true, variantId: r.data.variantId, label: input.name.trim() };
}

async function call(path: string, body?: unknown): Promise<InvoiceResult> {
  const r = await apiRequest<{ id: string }>(path, 'POST', body);
  return r.ok ? { ok: true, id: r.data.id } : r;
}

/** Creates the invoice, and posts it too unless `asDraft`. */
export async function saveInvoice(input: InvoicePayload, asDraft: boolean): Promise<InvoiceResult> {
  const problem: Check | null = !input.supplierId
    ? 'chooseSupplier'
    : !ISO_DATE.test(input.invoiceDate)
      ? 'invoiceDate'
      : !input.lines.length
        ? 'addProduct'
        : input.lines.some((l) => !l.variantId)
          ? 'lineProduct'
          : input.lines.some((l) => !Number.isInteger(l.quantity) || l.quantity < 1)
            ? 'lineQuantity'
            : input.lines.some((l) => !MONEY.test(l.unitCost) || Number(l.unitCost) <= 0)
              ? 'lineCost'
              : input.extraCosts && !MONEY.test(input.extraCosts)
                ? 'extraCosts'
                : null;
  if (problem) return { ok: false, message: (await invalid(problem)).message };

  const result = await call('/purchases', { ...input, postImmediately: !asDraft });
  if (result.ok) revalidatePurchasing();
  return result;
}

export async function postInvoice(_prev: FormState, form: FormData): Promise<FormState> {
  const id = String(form.get('id') ?? '');
  if (!id) return invalid('missingRecord');
  const state = await send(`/purchases/${id}/post`, 'POST', undefined);
  if (state.status === 'saved') {
    revalidatePurchasing();
    revalidatePath(`/money/purchases/${id}`);
  }
  return state;
}

export async function createSupplierInline(form: FormData) {
  const r = await apiRequest<{ id: string; name: string; phone: string | null; note: string | null; active: boolean; createdAt: string }>('/suppliers', 'POST', {
    name: String(form.get('name') ?? '').trim(), phone: String(form.get('phone') ?? '').trim(), note: String(form.get('note') ?? '').trim(),
  });
  if (r.ok) revalidatePath('/money/suppliers');
  return r;
}
