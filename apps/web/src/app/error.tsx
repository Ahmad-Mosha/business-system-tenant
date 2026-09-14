'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

/** Anything outside the signed-in shell that fails — the sign-in screen, mostly. */
export default function RootError({
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
    <div className="flex min-h-svh items-center justify-center p-6">
      <Empty className="max-w-lg">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-destructive-subtle text-destructive">
            <AlertTriangle />
          </EmptyMedia>
          <EmptyTitle>{t('somethingWrong')}</EmptyTitle>
          <EmptyDescription>{unreachable ? t('apiDown') : t('failedShort')}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => retry()}>
            <RefreshCw />
            {tc('tryAgain')}
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
