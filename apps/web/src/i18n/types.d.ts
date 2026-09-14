import type messages from '../messages/en.json';
import type { Locale } from './config';

/**
 * English is the source of truth: every `t('…')` key is checked against it at
 * compile time, and `messages.test.ts` holds Arabic to the same keys.
 */
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
