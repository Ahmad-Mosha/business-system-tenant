import type { Money } from '@app/contracts';

const numberFormat = new Intl.NumberFormat('en-EG', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Amounts cross the wire as integer minor units. Converting to a decimal happens here,
 * at the edge, and nowhere else.
 */
export function formatMoney(money: Money): string {
  return `${numberFormat.format(money.amount / 100)} ${money.currency}`;
}

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Africa/Cairo',
});

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Africa/Cairo',
});

/** The business runs on Cairo time; timestamps are stored UTC and rendered here. */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${dateFormat.format(d)}, ${timeFormat.format(d)}`;
}
