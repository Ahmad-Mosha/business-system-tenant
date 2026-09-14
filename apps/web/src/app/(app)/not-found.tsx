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

/** A record that isn't there (deleted, or a stale link) — inside the shell. */
export default function RecordNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Empty className="max-w-lg border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>Not found</EmptyTitle>
          <EmptyDescription>
            This record doesn’t exist, or it was removed. The link may be out of date.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" asChild>
            <Link href="/orders">Go to orders</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
