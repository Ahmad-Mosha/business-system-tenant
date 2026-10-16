'use client';

import { Languages } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { setLanguage } from '@/i18n/actions';
import { isLanguage, languageOf, LANGUAGES, type Language } from '@/i18n/config';

/**
 * The current language and a way to change it: the cookie is set on the
 * server, then the page refreshes — the root layout re-renders `lang` and
 * `dir`, and every screen its words and formats.
 */
function useLanguage() {
  const router = useRouter();
  const current = languageOf(useLocale());
  const [pending, start] = useTransition();
  const change = (next: Language) => {
    if (next === current) return;
    start(async () => {
      await setLanguage(next);
      router.refresh();
    });
  };
  return { current, change, pending };
}

/** Inside the user menu: each language, named in itself. */
export function LanguageMenuGroup() {
  const t = useTranslations('language');
  const { current, change, pending } = useLanguage();
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel className="text-muted-foreground">{t('label')}</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={current} onValueChange={(v) => isLanguage(v) && change(v)}>
        {LANGUAGES.map((l) => (
          <DropdownMenuRadioItem key={l} value={l} lang={l} disabled={pending}>
            {t(l)}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
  );
}

/**
 * One button offering the other language, in that language — before signing
 * in, and in the top bar (`compact`: "EN" / "ع", named in full for screen readers).
 */
export function LanguageToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const t = useTranslations('language');
  const { current, change, pending } = useLanguage();
  const other: Language = current === 'ar' ? 'en' : 'ar';
  return (
    <Button
      variant="ghost"
      size="sm"
      lang={other}
      disabled={pending}
      onClick={() => change(other)}
      aria-label={compact ? t(other) : undefined}
      title={compact ? t(other) : undefined}
      className={className}
    >
      <Languages />
      {compact ? <span className="text-xs font-semibold">{other === 'en' ? 'EN' : 'ع'}</span> : t(other)}
    </Button>
  );
}
