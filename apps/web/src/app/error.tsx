'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Shown when a page fails to render - most often because the API is unreachable.
 * The failure is stated plainly; it is never disguised as an empty result, which would
 * read as "you have no orders" when the truth is "we could not ask".
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="font-display text-[26px] leading-tight text-ink">
          We could not load this page
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          The service did not respond as expected. This is usually temporary - try again,
          and tell an administrator if it keeps happening.
        </p>
        {error.digest ? (
          <p className="tnum mt-4 text-[13px] text-ink-faint">Reference: {error.digest}</p>
        ) : null}
        <Button onClick={reset} variant="secondary" className="mt-7">
          Try again
        </Button>
      </div>
    </div>
  );
}
