import { getLocale, getTranslations } from 'next-intl/server';
import { createFormat, type Format } from './format';

/** The formatter for async server components — pages and layouts. */
export async function getFormat(): Promise<Format> {
  const [locale, t] = await Promise.all([getLocale(), getTranslations('common')]);
  return createFormat(locale, { today: t('today'), yesterday: t('yesterday') });
}
