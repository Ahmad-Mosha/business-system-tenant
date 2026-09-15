import { notFound } from 'next/navigation';
import { Page, PageHeader } from '@/components/page';
import { StatementView } from '@/components/statement-view';
import { getPeriods } from '@/lib/api';

import { requireAdmin } from '@/lib/session';
import { getTranslations } from 'next-intl/server';
import { getFormat } from '@/i18n/get-format';

/** Next 16 hands params in as a promise. */
export default async function MonthPage({ params }: { params: Promise<{ month: string }> }) {
  const [f, t, tr] = await Promise.all([getFormat(), getTranslations('noon.months'), getTranslations()]);
  await requireAdmin();
  const { month } = await params;
  const periods = await getPeriods();
  const period = periods.find((p) => p.month === month);
  if (!period) notFound();

  return (
    <Page>
      <PageHeader
        back={{ href: '/months', label: t('back') }}
        title={f.month(period.month)}
        description={t('settlement', {
          range: tr('common.dateRange', { from: f.date(period.from), to: f.date(period.to) }),
        })}
      />
      <StatementView from={period.from} to={period.to} />
    </Page>
  );
}
