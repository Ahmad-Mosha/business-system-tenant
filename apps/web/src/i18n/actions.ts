'use server';

import { cookies } from 'next/headers';
import { isLanguage, LANGUAGE_COOKIE, type Language } from './config';

/** Remembers the language in this browser for a year. The caller refreshes. */
export async function setLanguage(language: Language) {
  if (!isLanguage(language)) return;
  (await cookies()).set(LANGUAGE_COOKIE, language, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}
