import type { Tone } from '@/components/tone-badge';
import type { SalesInvoiceStatus } from '@/lib/api';

/** How a sales invoice's state looks; its name is `enums.salesStatus`. */
export const SALES_TONE: Record<SalesInvoiceStatus, Tone> = { DRAFT: 'neutral', POSTED: 'success', VOID: 'muted' };
