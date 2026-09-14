import { TIME_ZONE } from './config';

/**
 * Every date, count and compact figure the UI prints, in the active locale
 * and in Cairo time. Server components get one from `getFormat()`, client
 * components from `useFormat()`; both build it here, so the server's HTML
 * and the client's hydration always agree.
 *
 * Money is not here: with Western digits in both languages (i18n/config.ts)
 * amounts read identically — `1,234,567.50` — so `money()` and `Amount` in
 * lib stay as they are.
 */
export interface Format {
  /** `14 Sept 2026` · `14 سبتمبر 2026`. */
  date(value: string | null | undefined): string;
  /** `14 Sept, 15:29` — or `4 Sept` for something recorded without a time. */
  dateTime(value: string): string;
  /** `15:29` · `03:29 م`, or '' for something recorded without a time. */
  time(value: string): string;
  /** A day heading: "Today", "Yesterday", "Mon 14 Sept". */
  day(value: string): string;
  /** `2026-07` → `July 2026` · `يوليو 2026`. */
  month(month: string): string;
  /** `2026-07` → `Jul 26` — an axis tick. */
  monthShort(month: string): string;
  /** `2026-09-14` (a bucket start) → `14 Sept` · `14 سبتمبر`, for axes. */
  dayShort(isoDate: string): string;
  /** `1,234`. */
  count(value: number): string;
  /** `1.3M` · `1.3 مليون` — axis ticks, where the exact figure is noise. */
  compact(value: number): string;
  /** Rows already newest first, bunched by Cairo calendar day, each day headed. */
  byDay<T extends { occurredAt: string }>(rows: T[]): Array<{ key: string; label: string; rows: T[] }>;
}

/**
 * Recorded from a date alone — a voucher, an invoice, an opening balance. The
 * API stores those at midnight UTC; printing that as "03:00" would invent a
 * time nobody entered.
 */
export const isDateOnly = (value: string) => new Date(value).getTime() % 86_400_000 === 0;

/** The Cairo calendar day of an instant, `YYYY-MM-DD` — the key days group by. */
const cairoDay = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE });
export const dayKey = (value: string | number | Date) => cairoDay.format(new Date(value));

export function createFormat(locale: string, words: { today: string; yesterday: string }): Format {
  const cache = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat>();
  const dates = (options: Intl.DateTimeFormatOptions) => {
    const id = `d${JSON.stringify(options)}`;
    if (!cache.has(id)) cache.set(id, new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, ...options }));
    return cache.get(id) as Intl.DateTimeFormat;
  };
  const numbers = (options: Intl.NumberFormatOptions) => {
    const id = `n${JSON.stringify(options)}`;
    if (!cache.has(id)) cache.set(id, new Intl.NumberFormat(locale, options));
    return cache.get(id) as Intl.NumberFormat;
  };
  // Calendar-only values (a month, a bucket start) are dates, not instants:
  // read them in UTC so no time zone can move them to the day before.
  const calendar = (options: Intl.DateTimeFormatOptions) => dates({ ...options, timeZone: 'UTC' });

  const day = (value: string) => {
    const key = dayKey(value);
    const now = Date.now();
    if (key === dayKey(now)) return words.today;
    if (key === dayKey(now - 86_400_000)) return words.yesterday;
    const thisYear = key.slice(0, 4) === dayKey(now).slice(0, 4);
    return dates({ weekday: 'short', day: 'numeric', month: 'short', ...(thisYear ? {} : { year: 'numeric' }) }).format(
      new Date(value),
    );
  };

  return {
    date: (value) => (value ? dates({ day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '—'),
    dateTime: (value) =>
      dates(
        isDateOnly(value)
          ? { day: 'numeric', month: 'short' }
          : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
      ).format(new Date(value)),
    time: (value) => (isDateOnly(value) ? '' : dates({ hour: '2-digit', minute: '2-digit' }).format(new Date(value))),
    day,
    month: (month) => calendar({ month: 'long', year: 'numeric' }).format(new Date(`${month}-01T00:00:00Z`)),
    monthShort: (month) => calendar({ month: 'short', year: '2-digit' }).format(new Date(`${month}-01T00:00:00Z`)),
    dayShort: (iso) => calendar({ day: 'numeric', month: 'short' }).format(new Date(`${iso}T00:00:00Z`)),
    count: (value) => numbers({}).format(value),
    compact: (value) => numbers({ notation: 'compact', maximumFractionDigits: 1 }).format(value),
    byDay(rows) {
      const days: Array<{ key: string; label: string; rows: (typeof rows)[number][] }> = [];
      for (const row of rows) {
        const key = dayKey(row.occurredAt);
        const last = days.at(-1);
        if (last?.key === key) last.rows.push(row);
        else days.push({ key, label: day(row.occurredAt), rows: [row] });
      }
      return days;
    },
  };
}
