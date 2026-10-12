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
