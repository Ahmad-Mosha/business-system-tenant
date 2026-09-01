const EGP = new Intl.NumberFormat('en-EG', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const EGP_WHOLE = new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 });

/** `-1,234.50`. Values arrive as strings from Postgres `numeric`. */
export function money(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  return EGP.format(Number(v));
}

/** Compact form for dense table cells, where the piastres are noise. */
export function moneyWhole(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  return EGP_WHOLE.format(Number(v));
}

export function date(v: string | null | undefined): string {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function dateTime(v: string): string {
  return new Date(v).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const isNegative = (v: string | number | null | undefined) =>
  v !== null && v !== undefined && v !== '' && Number(v) < 0;

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

/** `2026-07` -> `July 2026`. */
export function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
