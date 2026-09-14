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

/** A URL that matches no screen. */
export default function NotFound() {
  const t = useTranslations('states');
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Empty className="max-w-lg">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>{t('pageNotFound')}</EmptyTitle>
          <EmptyDescription>{t('noScreen')}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" asChild>
            <Link href="/">{t('backHome')}</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
