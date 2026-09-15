import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MonthlyProceedsChart } from '@/components/charts';
import { NoDataYet } from '@/components/empty-state';
import { Page, PageHeader } from '@/components/page';
import { StatementView } from '@/components/statement-view';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getDataRange, getPeriods } from '@/lib/api';

import { requireSession } from '@/lib/session';
import { getTranslations } from 'next-intl/server';
import { getFormat } from '@/i18n/get-format';

export default async function OverviewPage() {
  const [f, t, tr] = await Promise.all([getFormat(), getTranslations('noon.overview'), getTranslations()]);
  const user = await requireSession();
  if (user.role === 'MODERATOR') redirect('/orders');

  const [range, periods] = await Promise.all([getDataRange(), getPeriods()]);
  if (!range) {
    return (
      <Page>
        <PageHeader title={tr('nav.groups.noon')} description={t('noDataDescription')} />
        <NoDataYet />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title={tr('nav.groups.noon')}
        description={t('description', {
          range: tr('common.dateRange', { from: f.date(range.from), to: f.date(range.to) }),
        })}
        actions={
          <Button variant="outline" asChild>
            <Link href="/months">
              {t('viewByMonth')}
              <ArrowUpRight className="rtl:-scale-x-100" />
            </Link>
          </Button>
        }
      />

      <StatementView from={range.from} to={range.to} />

      {periods.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('byMonth')}</CardTitle>
            <CardDescription>{t('byMonthHint')}</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/months">
                  {t('allMonths')}
                  <ArrowUpRight className="rtl:-scale-x-100" />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <MonthlyProceedsChart periods={periods} />
          </CardContent>
        </Card>
      ) : null}
    </Page>
  );
}
