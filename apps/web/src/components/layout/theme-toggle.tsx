'use client';

import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Light or dark, one click from the top bar. Both icons render and CSS shows
 * the right one, so the server's first paint never disagrees with the theme
 * the browser remembers.
 */
export function ThemeToggle() {
  const t = useTranslations('user');
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t('theme')} onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
          <Moon className="dark:hidden" />
          <Sun className="hidden dark:block" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t('theme')}</TooltipContent>
    </Tooltip>
  );
}
