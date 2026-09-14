import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { createFormat, type Format } from './format';

/** The formatter for client components and non-async server components. */
export function useFormat(): Format {
  const locale = useLocale();
  const t = useTranslations('common');
  return useMemo(() => createFormat(locale, { today: t('today'), yesterday: t('yesterday') }), [locale, t]);
}
