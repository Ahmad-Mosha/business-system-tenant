import { Upload } from 'lucide-react';
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

/** The noon screens before the first settlement report is in. */
export function NoDataYet() {
  return (
    <Empty className="border bg-card py-20">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Upload />
        </EmptyMedia>
        <EmptyTitle>Nothing imported yet</EmptyTitle>
        <EmptyDescription>
          Upload a noon settlement export and the products, revenue and fees in it are read
          automatically.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link href="/imports">Import a report</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
