import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageBody, PageHeader } from '@/components/page-header';
import { StatementView } from '@/components/statement-view';
import { getPeriods } from '@/lib/api';
import { date, monthLabel } from '@/lib/format';

/** Next 16 hands params in as a promise. */
export default async function MonthPage({
  params,
}: {
  params: Promise<{ month: string }>;
}) {
  const { month } = await params;
  const periods = await getPeriods();
  const period = periods.find((p) => p.month === month);
  if (!period) notFound();

  return (
    <>
      <PageHeader
        title={monthLabel(period.month)}
        actions={
          <>
            <p className="text-xs text-muted-foreground">
              noon settlement · {date(period.from)} – {date(period.to)}
            </p>
            <Link
              href="/months"
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <ArrowLeft className="size-4" />
              All months
            </Link>
          </>
        }
      />
      <PageBody>
        <StatementView from={period.from} to={period.to} />
      </PageBody>
    </>
  );
}
