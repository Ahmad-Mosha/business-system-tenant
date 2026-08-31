import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { NewProductForm } from '@/components/new-product-form';
import { PageBody, PageHeader } from '@/components/page-header';
import { requireAdmin } from '@/lib/session';

export default async function NewProductPage() {
  await requireAdmin();

  return (
    <>
      <PageHeader
        title="Add product"
        actions={
          <Link
            href="/inventory"
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ArrowLeft className="size-4" />
            Cancel
          </Link>
        }
      />
      <PageBody>
        <div className="max-w-lg">
          <NewProductForm />
        </div>
      </PageBody>
    </>
  );
}
