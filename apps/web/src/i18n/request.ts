import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LANGUAGE, isLanguage, LANGUAGE_COOKIE, LOCALES, TIME_ZONE } from './config';

/**
 * The language comes from a cookie, not the URL: Prime Market is a signed-in
 * back office, so every route, link and redirect stays exactly as it is.
 */
export default getRequestConfig(async () => {
  const chosen = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  const language = isLanguage(chosen) ? chosen : DEFAULT_LANGUAGE;

  return {
    locale: LOCALES[language],
    timeZone: TIME_ZONE,
    messages: (await import(`../messages/${language}.json`)).default,
  };
});
