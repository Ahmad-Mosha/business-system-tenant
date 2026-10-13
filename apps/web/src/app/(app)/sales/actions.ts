'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { DialogFormState } from '@/components/form-dialog';
import { apiRequest } from '@/lib/api-request';
import type { CustomerRow } from '@/lib/api';

const MONEY = /^\d+(\.\d{1,2})?$/;

function revalidateSales(...paths: string[]) {
  revalidatePath('/sales', 'layout');
  revalidatePath('/customers', 'layout');
  revalidatePath('/money', 'layout');
  for (const p of paths) revalidatePath(p);
}

// ── Customers ──────────────────────────────────────────────────────────────

function customerBody(form: FormData) {
  return {
    name: String(form.get('name') ?? '').trim(),
    phone: String(form.get('phone') ?? '').trim() || null,
    note: String(form.get('note') ?? '').trim() || null,
  };
}

async function needName(): Promise<DialogFormState> {
  return { status: 'error', message: (await getTranslations('errors.api.customer'))('name') };
}

export async function createCustomer(_prev: DialogFormState, form: FormData): Promise<DialogFormState> {
  const body = customerBody(form);
  if (!body.name) return needName();
  const r = await apiRequest('/customers', 'POST', body);
  if (!r.ok) return { status: 'error', message: r.message };
  revalidateSales();
  return { status: 'saved' };
}

/** From inside an invoice: the new customer comes back so the invoice can select it. */
export async function createCustomerInline(form: FormData) {
  const body = customerBody(form);
  if (!body.name) return { ok: false as const, message: (await getTranslations('errors.api.customer'))('name') };
  const r = await apiRequest<CustomerRow>('/customers', 'POST', body);
  if (r.ok) revalidateSales();
  return r;
}

export async function updateCustomer(id: string, _prev: DialogFormState, form: FormData): Promise<DialogFormState> {
  const body = customerBody(form);
  if (!body.name) return needName();
  const r = await apiRequest(`/customers/${id}`, 'PATCH', body);
  if (!r.ok) return { status: 'error', message: r.message };
  revalidateSales(`/customers/${id}`);
  return { status: 'saved' };
}

/** Archives (false) or restores (true); the API refuses archiving someone who still owes money. */
export async function setCustomerActive(id: string, active: boolean) {
  const r = await apiRequest(`/customers/${id}`, 'PATCH', { active });
  if (r.ok) revalidateSales(`/customers/${id}`);
  return r.ok ? { ok: true as const } : r;
}

/** Only a customer with no invoices; anything else is refused by the API. */
export async function deleteCustomer(id: string) {
  const r = await apiRequest(`/customers/${id}`, 'DELETE');
  if (!r.ok) return r;
  revalidateSales();
  redirect('/customers');
}

// ── Sales invoices ─────────────────────────────────────────────────────────

/** Quantity with either a unit price or a line total — whichever was typed. */
export interface SalesLinePayload {
  variantId: string;
  quantity: number;
  unitPrice?: string;
  lineTotal?: string;
}

export interface SalesInvoicePayload {
  requestId: string;
  customerId: string;
  invoiceDate: string;
  discount: string;
  notes?: string;
  lines: SalesLinePayload[];
}

export type SalesResult = { ok: true; id: string } | { ok: false; message: string };

/** The form's own checks, in the reader's language — null when it may be sent. */
async function check(input: SalesInvoicePayload): Promise<string | null> {
  const t = await getTranslations('sales.builder.missing');
  if (!input.customerId) return t('customer');
  if (!input.lines.length || input.lines.some((l) => !l.variantId)) return t('product');
  if (input.lines.some((l) => !Number.isInteger(l.quantity) || l.quantity < 1)) return t('quantity');
  if (input.lines.some((l) => (l.lineTotal !== undefined ? !MONEY.test(l.lineTotal) : !/^\d+(\.\d{1,4})?$/.test(l.unitPrice ?? '')))) return t('price');
  if (input.discount && !MONEY.test(input.discount)) return t('discount');
  return null;
}

export async function saveSalesDraft(input: SalesInvoicePayload): Promise<SalesResult> {
  const problem = await check(input);
  if (problem) return { ok: false, message: problem };
  const r = await apiRequest<{ id: string }>('/sales-invoices', 'POST', input);
  if (!r.ok) return r;
  revalidateSales();
  return { ok: true, id: r.data.id };
}

export async function updateSalesDraft(id: string, input: SalesInvoicePayload): Promise<SalesResult> {
  const problem = await check(input);
  if (problem) return { ok: false, message: problem };
  const r = await apiRequest(`/sales-invoices/${id}`, 'PATCH', input);
  if (!r.ok) return r;
  revalidateSales(`/sales/${id}`);
  return { ok: true, id };
}

/** A draft never moved stock or money. */
export async function deleteSalesDraft(id: string) {
  const r = await apiRequest(`/sales-invoices/${id}`, 'DELETE');
  if (!r.ok) return r;
  revalidateSales();
  redirect('/sales');
}

/** Takes the goods out of the warehouse and books the sale; `paidNow` is received in cash. */
export async function postSalesInvoice(id: string, paidNow: string) {
  const r = await apiRequest(`/sales-invoices/${id}/post`, 'POST', { paidNow: paidNow || '0' });
  if (!r.ok) return r;
  revalidateSales(`/sales/${id}`);
  return { ok: true as const };
}

export async function recordSalesPayment(id: string, _prev: DialogFormState, form: FormData): Promise<DialogFormState> {
  const amount = String(form.get('amount') ?? '');
  if (!MONEY.test(amount) || Number(amount) <= 0) {
    return { status: 'error', message: (await getTranslations('errors.api.sales'))('paymentAmount') };
  }
  const r = await apiRequest(`/sales-invoices/${id}/payments`, 'POST', { amount, memo: String(form.get('memo') ?? '').trim() || undefined });
  if (!r.ok) return { status: 'error', message: r.message };
  revalidateSales(`/sales/${id}`);
  return { status: 'saved' };
}

export async function reverseSalesPayment(id: string, entryId: string) {
  const r = await apiRequest(`/sales-invoices/${id}/payments/${entryId}/reverse`, 'POST');
  if (!r.ok) return r;
  revalidateSales(`/sales/${id}`);
  return { ok: true as const };
}

export async function voidSalesInvoice(id: string, reason: string) {
  const r = await apiRequest(`/sales-invoices/${id}/void`, 'POST', { reason });
  if (!r.ok) return r;
  revalidateSales(`/sales/${id}`);
  return { ok: true as const };
}
