import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('states');
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Empty className="max-w-lg border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>{t('notFound')}</EmptyTitle>
          <EmptyDescription>{t('recordMissing')}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" asChild>
            <Link href="/orders">{t('goToOrders')}</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
