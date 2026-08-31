import { createHash } from 'node:crypto';
import { parseCsv } from './csv';

/** A single settlement line, normalised out of noon's column names. */
export interface NoonRow {
  fingerprint: string;
  referenceNr: string;
  orderNr: string | null;
  itemNr: string | null;
  orderDate: string | null;
  transactionDate: string | null;
  title: string;
  noonSku: string | null;
  partnerSku: string | null;
  transactionType: string;
  currency: string;
  netProceeds: string;
  referralFee: string;
  fulfilmentFee: string;
  shippingCredits: string;
  otherOrderFees: string;
  orderSubsidies: string;
  nonOrderFees: string;
  nonOrderSubsidies: string;
  others: string;
  total: string;
}

/**
 * noon's own header spellings, including the "Fullfilment" typo. Kept verbatim
 * so that a header change surfaces as a loud error rather than silent zeroes.
 */
const COLUMNS = {
  referenceNr: 'Reference Nr',
  orderNr: 'Order Nr',
  itemNr: 'Item Nr',
  orderDate: 'Order Date',
  transactionDate: 'Transaction Date',
  title: 'Title',
  noonSku: 'SKUs',
  partnerSku: 'Partner SKUs',
  transactionType: 'Transaction Type',
  currency: 'Currency',
  netProceeds: 'Net Proceeds',
  referralFee: 'Referral Fee including VAT',
  fulfilmentFee: 'Fullfilment & Logistics Fees including VAT',
  shippingCredits: 'Shipping Credits including VAT',
  otherOrderFees: 'Other Order Fees including VAT',
  orderSubsidies: 'Order Subsidies including VAT',
  nonOrderFees: 'Non-Order Fees including VAT',
  nonOrderSubsidies: 'Non-Order Subsidies including VAT',
  others: 'Others including VAT',
  total: 'Total',
} as const;

const MONEY_FIELDS = [
  'netProceeds', 'referralFee', 'fulfilmentFee', 'shippingCredits', 'otherOrderFees',
  'orderSubsidies', 'nonOrderFees', 'nonOrderSubsidies', 'others', 'total',
] as const;

/** Unit separator: joins raw cells unambiguously when fingerprinting a row. */
const SEP = '\u001F';

export class NoonReportFormatError extends Error {}

const money = (v: string): string => {
  const t = (v ?? '').trim();
  if (t === '') return '0';
  if (!/^-?\d+(\.\d+)?$/.test(t)) throw new NoonReportFormatError(`not a number: "${v}"`);
  return t;
};

const date = (v: string): string | null => {
  const t = (v ?? '').trim();
  if (t === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) throw new NoonReportFormatError(`not a date: "${v}"`);
  return t;
};

const orNull = (v: string): string | null => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

export function parseNoonReport(text: string): NoonRow[] {
  const table = parseCsv(text);
  if (!table.length) throw new NoonReportFormatError('file is empty');

  const header = table[0].map((h) => h.trim());
  const index: Record<string, number> = {};
  for (const [field, columnName] of Object.entries(COLUMNS)) {
    const at = header.indexOf(columnName);
    if (at === -1) throw new NoonReportFormatError(`missing column "${columnName}"`);
    index[field] = at;
  }

  return table
    .slice(1)
    // A trailing blank line parses as a single empty field; drop it.
    .filter((cells) => cells.some((c) => c.trim() !== ''))
    .map((cells) => {
      const get = (f: string) => cells[index[f]] ?? '';
      const row: Record<string, unknown> = {
        // The whole raw line is the row's identity: re-uploading an overlapping
        // export re-derives the same fingerprint and the row is skipped.
        fingerprint: createHash('sha256').update(cells.join(SEP)).digest('hex'),
        referenceNr: get('referenceNr').trim(),
        orderNr: orNull(get('orderNr')),
        itemNr: orNull(get('itemNr')),
        orderDate: date(get('orderDate')),
        transactionDate: date(get('transactionDate')),
        title: get('title').trim(),
        noonSku: orNull(get('noonSku')),
        partnerSku: orNull(get('partnerSku')),
        transactionType: get('transactionType').trim(),
        currency: get('currency').trim() || 'EGP',
      };
      for (const f of MONEY_FIELDS) row[f] = money(get(f));
      return row as unknown as NoonRow;
    });
}
