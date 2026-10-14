import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

/**
 * Lists show live records; this brings the cancelled ones back (greyed and
 * struck through) and hides them again. `href` is the same list with the
 * switch flipped — the page builds it, so its other filters stay.
 */
export function CancelledToggle({ shown, href }: { shown: boolean; href: string }) {
  const t = useTranslations('corrections');
  return (
    <Button variant="ghost" size="sm" asChild className="-me-2 text-muted-foreground">
      <Link href={href} scroll={false}>
        {shown ? <EyeOff /> : <Eye />}
        {t(shown ? 'hideCancelled' : 'showCancelled')}
      </Link>
    </Button>
  );
}

/** The same URL with `cancelled=1` added or removed, other parameters kept. */
export function toggleCancelledHref(path: string, params: Record<string, string | undefined>, shown: boolean) {
  const next = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1]));
  if (shown) next.delete('cancelled');
  else next.set('cancelled', '1');
  next.delete('page');
  const query = next.toString();
  return query ? `${path}?${query}` : path;
}
