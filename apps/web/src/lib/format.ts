import { dayKey } from '@/i18n/format';

const EGP = new Intl.NumberFormat('en-EG', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const EGP_WHOLE = new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 });

/**
 * A left-to-right mark before a minus — what Intl itself does for Arabic. In
 * Arabic text a bare `-1,234.50` loses its minus to the far side of the number.
 */
const keepSign = (s: string) => (s.startsWith('-') ? `\u200E${s}` : s);

/** `-1,234.50`. Values arrive as strings from Postgres `numeric`. */
export function money(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  return keepSign(EGP.format(Number(v)));
}

/** Compact form for dense table cells, where the piastres are noise. */
export function moneyWhole(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  return keepSign(EGP_WHOLE.format(Number(v)));
}

/**
 * Today as `YYYY-MM-DD` in Cairo — the business's day, whatever zone the
 * server runs in. On a UTC server, the first hours of a Cairo day would
 * otherwise still count as yesterday.
 */
export const today = (now = new Date()) => dayKey(now);

/** The Cairo date `n` days before today — for API date ranges, not display. */
export function daysAgo(n: number, now = new Date()): string {
  const d = new Date(`${today(now)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** The first day of this month in Cairo. */
export const monthStart = (now = new Date()) => `${today(now).slice(0, 7)}-01`;

/**
 * Money split into a bold whole part and a de-emphasised `.dd` — so a big
 * figure like `1,259,411.00` reads as "one-and-a-quarter million" at a glance
 * instead of trailing zeros that look like extra digits.
 */
export function moneyParts(v: string | number | null | undefined): {
  sign: string;
  whole: string;
  frac: string;
} {
  const n = Number(v ?? 0) || 0;
  const abs = Math.abs(n);
  return {
    sign: n < 0 ? '−' : '',
    whole: EGP_WHOLE.format(Math.trunc(abs)),
    frac: (abs - Math.trunc(abs)).toFixed(2).slice(1),
  };
}

/** Groups the integer part of a partial amount as the user types: `1250000` → `1,250,000`. */
export function groupDigits(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  const intPart = (dot === -1 ? cleaned : cleaned.slice(0, dot)).replace(/^0+(?=\d)/, '');
  const decPart = dot === -1 ? '' : '.' + cleaned.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (grouped || (dot !== -1 ? '0' : '')) + decPart;
}
