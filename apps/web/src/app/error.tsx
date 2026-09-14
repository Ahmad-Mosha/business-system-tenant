'use client';

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
  const unreachable = /fetch|ECONNREFUSED/.test(error.message);
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Empty className="max-w-lg">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-destructive-subtle text-destructive">
            <AlertTriangle />
          </EmptyMedia>
          <EmptyTitle>Something went wrong</EmptyTitle>
          <EmptyDescription>
            {unreachable
              ? 'The API isn’t reachable right now. Check that it’s running, then try again.'
              : 'Trying again usually fixes it.'}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => retry()}>
            <RefreshCw />
            Try again
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
