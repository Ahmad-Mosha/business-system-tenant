'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export const PRIVACY_COOKIE = 'pm_privacy';

/**
 * Hides costs and money figures on screen when someone is nearby (rules in
 * globals.css). Kept in a cookie so the root layout renders the page already
 * hidden — figures never flash on reload.
 */
export function PrivacyToggle({ initial }: { initial: boolean }) {
  const t = useTranslations('privacy');
  const [hidden, setHidden] = useState(initial);

  const toggle = () => {
    const next = !hidden;
    setHidden(next);
    if (next) document.documentElement.dataset.privacy = 'hidden';
    else delete document.documentElement.dataset.privacy;
    document.cookie = `${PRIVACY_COOKIE}=${next ? 'hidden' : ''}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={toggle} aria-pressed={hidden} aria-label={t(hidden ? 'show' : 'hide')}>
          {hidden ? <EyeOff /> : <Eye />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t(hidden ? 'showHint' : 'hideHint')}</TooltipContent>
    </Tooltip>
  );
}
