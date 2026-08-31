import Link from 'next/link';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NoDataYet() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-20 text-center">
      <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-muted">
        <Upload className="size-5 text-muted-foreground" strokeWidth={1.8} />
      </div>
      <h2 className="text-base font-medium">Nothing imported yet</h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        Upload a noon settlement export and the products, revenue and fees in it
        will be read automatically.
      </p>
      <Button asChild className="mt-6">
        <Link href="/imports">Import a report</Link>
      </Button>
    </div>
  );
}
