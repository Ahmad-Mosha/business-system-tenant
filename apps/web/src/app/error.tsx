'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6 text-center">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
        {error.message.includes('fetch') || error.message.includes('ECONNREFUSED')
          ? 'The API is not reachable. Check that it is running on port 3001.'
          : error.message}
      </p>
      <Button variant="outline" onClick={reset} className="mt-6">
        <RefreshCw className="size-4" />
        Try again
      </Button>
    </div>
  );
}
