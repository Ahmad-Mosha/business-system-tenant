import { createHash } from 'node:crypto';
import { parseCsv } from '../noon/csv';

/** One line of Amazon's "Date Range Reports → Transaction" export, normalised. */
export interface AmazonRow {
  fingerprint: string;
  postedAt: Date;
  settlementId: string | null;
  /** `Order` | `Refund` | `Amazon Fees` | `Service Fee` | `Adjustment` | `Transfer`. */
  type: string;
  orderId: string | null;
  sku: string | null;
  description: string;
  /** Units on the line — unlike noon, Amazon ships a quantity column. */
  quantity: number;
  marketplace: string | null;
  fulfillment: string | null;
  productSales: string;
  shippingCredits: string;
  promotionalRebates: string;
  sellingFees: string;
  fbaFees: string;
  otherTransactionFees: string;
  other: string;
  total: string;
  /** `Released` or `Deferred` — money Amazon still holds. Absent on pre-2025 reports. */
  status: string | null;
  releaseAt: Date | null;
}

/** Amazon's header spellings, matched case-insensitively. */
const COLUMNS = {
  postedAt: 'date/time',
  settlementId: 'settlement id',
  type: 'type',
  orderId: 'order id',
  sku: 'sku',
  description: 'description',
  quantity: 'quantity',
  marketplace: 'marketplace',
  fulfillment: 'fulfillment',
  productSales: 'product sales',
  shippingCredits: 'shipping credits',
  promotionalRebates: 'promotional rebates',
  sellingFees: 'selling fees',
  fbaFees: 'fba fees',
  otherTransactionFees: 'other transaction fees',
  other: 'other',
  total: 'total',
} as const;
const OPTIONAL = { status: 'transaction status', releaseAt: 'transaction release date' } as const;

const MONEY_FIELDS = [
  'productSales', 'shippingCredits', 'promotionalRebates', 'sellingFees',
  'fbaFees', 'otherTransactionFees', 'other', 'total',
] as const;

/**
 * Columns that change after the fact — a deferred line is released later and
 * may only then join a settlement — so they are not part of a row's identity:
 * downloading the same days again refreshes them instead of adding the row twice.
 */
const MUTABLE = new Set<string>(['settlementId', 'status', 'releaseAt']);

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

export class AmazonReportFormatError extends Error {}

/** `1 Aug 2026 1:23:01 PM UTC` — the only form Amazon.eg writes. */
export function amazonDate(v: string): Date {
  const m = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4}) (\d{1,2}):(\d{2}):(\d{2}) (AM|PM) UTC$/.exec(v.trim());
  const month = m ? MONTHS[m[2].toLowerCase()] : undefined;
  if (!m || month === undefined) throw new AmazonReportFormatError(`not a date: "${v}"`);
  const hour = (Number(m[4]) % 12) + (m[7] === 'PM' ? 12 : 0);
  return new Date(Date.UTC(Number(m[3]), month, Number(m[1]), hour, Number(m[5]), Number(m[6])));
}

/** `-2,737.60` → `-2737.60`; blank → `0`. */
const money = (v: string): string => {
  const t = (v ?? '').trim().replace(/,/g, '');
  if (t === '') return '0';
  if (!/^-?\d+(\.\d+)?$/.test(t)) throw new AmazonReportFormatError(`not a number: "${v}"`);
  return t;
};

const orNull = (v: string): string | null => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

/** Unit separator: joins raw cells unambiguously when fingerprinting a row. */
const SEP = '\u001F';

export function parseAmazonReport(text: string): AmazonRow[] {
  const table = parseCsv(text);
  // A few lines of notes come first; the table starts at its header.
  const start = table.findIndex((cells) => (cells[0] ?? '').trim().toLowerCase() === COLUMNS.postedAt);
  if (start === -1) throw new AmazonReportFormatError('no "date/time" header — not an Amazon transaction report');

  const header = table[start].map((h) => h.trim().toLowerCase());
  const index: Record<string, number> = {};
  for (const [field, name] of Object.entries(COLUMNS)) {
    const at = header.indexOf(name);
    if (at === -1) throw new AmazonReportFormatError(`missing column "${name}"`);
    index[field] = at;
  }
  for (const [field, name] of Object.entries(OPTIONAL)) index[field] = header.indexOf(name);

  const seen = new Map<string, number>();
  return table
    .slice(start + 1)
    .filter((cells) => cells.some((c) => c.trim() !== ''))
    .map((cells) => {
      const get = (f: string) => (index[f] >= 0 ? cells[index[f]] ?? '' : '');
      const quantity = get('quantity').trim();
      if (quantity !== '' && !/^-?\d+$/.test(quantity)) throw new AmazonReportFormatError(`not a quantity: "${quantity}"`);

      // Two identical lines are two real lines (two equal fees on one order), so
      // the n-th copy is fingerprinted as such — and an overlapping download
      // that holds both copies again derives the same two fingerprints.
      const identity = Object.keys(COLUMNS).filter((f) => !MUTABLE.has(f)).map((f) => get(f).trim()).join(SEP);
      const copy = (seen.get(identity) ?? 0) + 1;
      seen.set(identity, copy);

      const release = orNull(get('releaseAt'));
      const row: Record<string, unknown> = {
        fingerprint: createHash('sha256').update(`${identity}${SEP}${copy}`).digest('hex'),
        postedAt: amazonDate(get('postedAt')),
        settlementId: orNull(get('settlementId')),
        type: get('type').trim(),
        orderId: orNull(get('orderId')),
        sku: orNull(get('sku')),
        description: get('description').trim(),
        quantity: quantity === '' ? 0 : Number(quantity),
        marketplace: orNull(get('marketplace')),
        fulfillment: orNull(get('fulfillment')),
        status: orNull(get('status')),
        releaseAt: release ? amazonDate(release) : null,
      };
      for (const f of MONEY_FIELDS) row[f] = money(get(f));
      return row as unknown as AmazonRow;
    });
}
