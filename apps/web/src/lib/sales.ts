import type { Tone } from '@/components/tone-badge';
import type { PaidStatus, SalesInvoiceStatus } from '@/lib/api';

/** How a sales invoice's state looks; its name is `enums.salesStatus`. */
export const SALES_TONE: Record<SalesInvoiceStatus, Tone> = { DRAFT: 'neutral', POSTED: 'success', VOID: 'muted' };

/** How much of a posted invoice is paid (`PaidChip`); a draft or void one has no paid state. */
export function salesPaidStatus(i: { status: SalesInvoiceStatus; total: string; paidAmount: string }): PaidStatus | null {
  if (i.status !== 'POSTED') return null;
  const paid = Number(i.paidAmount);
  return paid >= Number(i.total) - 0.005 ? 'PAID' : paid > 0.005 ? 'PARTIAL' : 'UNPAID';
}

/**
 * One word for where an invoice stands — draft, unpaid, partly paid, paid or
 * cancelled — instead of a status and a payment column side by side.
 */
export function salesState(i: { status: SalesInvoiceStatus; total: string; paidAmount: string }): PaidStatus {
  return i.status === 'POSTED' ? salesPaidStatus(i)! : i.status;
}

/** What a posted invoice still owes; 0 for a draft, a cancelled one, or one paid in full. */
export const salesDue = (i: { status: SalesInvoiceStatus; total: string; paidAmount: string }) =>
  i.status === 'POSTED' ? Math.max(Number(i.total) - Number(i.paidAmount), 0) : 0;
