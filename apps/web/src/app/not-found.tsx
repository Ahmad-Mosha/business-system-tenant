import { SearchX } from 'lucide-react';
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

/** A URL that matches no screen. */
export default function NotFound() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Empty className="max-w-lg">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>Page not found</EmptyTitle>
          <EmptyDescription>There’s no screen at this address.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" asChild>
            <Link href="/">Back to Prime Market</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
