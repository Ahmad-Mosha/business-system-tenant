'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

/**
 * A screen that failed, inside the shell — the sidebar stays, so the way to
 * every other screen stays too. `retry` re-fetches the segment (Next 16);
 * most failures here are the API being briefly out of reach.
 */
export default function ScreenError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations('states');
  const tc = useTranslations('common');
  const unreachable = /fetch|ECONNREFUSED/.test(error.message);
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Empty className="max-w-lg border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-destructive-subtle text-destructive">
            <AlertTriangle />
          </EmptyMedia>
          <EmptyTitle>{t('screenFailed')}</EmptyTitle>
          <EmptyDescription>{unreachable ? t('apiDown') : t('failed')}</EmptyDescription>
          {error.digest ? (
            <p className="num text-xs text-muted-foreground">{t('reference', { code: error.digest })}</p>
          ) : null}
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center">
          <Button onClick={() => retry()}>
            <RefreshCw />
            {tc('tryAgain')}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/orders">{t('goToOrders')}</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
