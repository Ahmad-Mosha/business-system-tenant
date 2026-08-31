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

/** `2026-07` -> `July 2026`. */
export function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
