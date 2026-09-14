import { notFound } from 'next/navigation';
import { Page, PageHeader } from '@/components/page';
import { StatementView } from '@/components/statement-view';
import { getPeriods } from '@/lib/api';
import { date, monthLabel } from '@/lib/format';
import { requireAdmin } from '@/lib/session';

/** Next 16 hands params in as a promise. */
export default async function MonthPage({ params }: { params: Promise<{ month: string }> }) {
  await requireAdmin();
  const { month } = await params;
  const periods = await getPeriods();
  const period = periods.find((p) => p.month === month);
  if (!period) notFound();

  return (
    <Page>
      <PageHeader
        back={{ href: '/months', label: 'Back to months' }}
        title={monthLabel(period.month)}
        description={`noon settlement · ${date(period.from)} – ${date(period.to)}`}
      />
      <StatementView from={period.from} to={period.to} />
    </Page>
  );
}
