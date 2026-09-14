/**
 * The languages Prime Market speaks, and everything that follows from each —
 * shared by server and client code, so it holds no server-only imports.
 */

export const LANGUAGES = ['ar', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

/** First-time visitors get Arabic, the team's language (decided 2026-09-14). */
export const DEFAULT_LANGUAGE: Language = 'ar';

/** Where the choice is kept: this browser only — no account setting, by decision. */
export const LANGUAGE_COOKIE = 'NEXT_LOCALE';

export const isLanguage = (value: unknown): value is Language =>
  LANGUAGES.includes(value as Language);

/**
 * The locale every translation and format runs in. Egyptian conventions —
 * Arabic month names, ج.م — but Western digits in both languages: they match
 * SKUs, phone numbers and the noon and Bosta dashboards, and keep figures in
 * the tabular face. English stays day-first and 24-hour, as it always read.
 */
export const LOCALES = {
  ar: 'ar-EG-u-nu-latn',
  en: 'en-GB',
} as const satisfies Record<Language, string>;

export type Locale = (typeof LOCALES)[Language];

/** The language behind a locale — `ar-EG-u-nu-latn` → `ar`. */
export const languageOf = (locale: string): Language => (locale.startsWith('ar') ? 'ar' : 'en');

export const directionOf = (locale: string): 'rtl' | 'ltr' =>
  languageOf(locale) === 'ar' ? 'rtl' : 'ltr';

/** Every date and time reads in Cairo time, whatever zone the server runs in. */
export const TIME_ZONE = 'Africa/Cairo';
