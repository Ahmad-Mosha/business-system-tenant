import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { NewOrderForm } from '@/components/new-order-form';
import { PageBody, PageHeader } from '@/components/page-header';
import { requireSession } from '@/lib/session';

export default async function NewOrderPage() {
  const user = await requireSession();

  return (
    <>
      <PageHeader
        title="New order"
        actions={
          <Link
            href="/orders"
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ArrowLeft className="size-4" />
            Cancel
          </Link>
        }
      />
      <PageBody>
        <div className="max-w-3xl">
          <NewOrderForm assignsToSelf={user.role === 'MODERATOR'} />
        </div>
      </PageBody>
    </>
  );
}
