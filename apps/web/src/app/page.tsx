import Link from 'next/link';
import { NoDataYet } from '@/components/empty-state';
import { PageBody, PageHeader } from '@/components/page-header';
import { StatementView } from '@/components/statement-view';
import { getDataRange, getPeriods } from '@/lib/api';
import { date, money, monthLabel } from '@/lib/format';

export default async function OverviewPage() {
  const range = await getDataRange();
  if (!range) {
    return (
      <>
        <PageHeader title="Overview" description="noon settlement performance" />
        <PageBody>
          <NoDataYet />
        </PageBody>
      </>
    );
  }

  const periods = await getPeriods();

  return (
    <>
      <PageHeader
        title="Overview"
        description={
          <>
            All {periods.length} months · {date(range.from)} – {date(range.to)}
          </>
        }
        actions={
          <Link
            href="/months"
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            View by month
          </Link>
        }
      />

      <PageBody>
        <StatementView from={range.from} to={range.to} />

        {periods.length > 1 && (
          <section>
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 className="text-sm font-medium tracking-[-0.01em]">By month</h2>
              <Link
                href="/months"
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                See all
              </Link>
            </div>
            <ul className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
              {periods.map((p) => (
                <li key={p.month} className="bg-background">
                  <Link
                    href={`/months/${p.month}`}
                    className="block p-5 transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:-outline-offset-2"
                  >
                    <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                      {monthLabel(p.month)}
                    </p>
                    <p className="mt-3 text-xl font-semibold tracking-[-0.02em] tabular-nums">
                      {money(p.netProceeds)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.unitsSold} units · {money(p.movement)} movement
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </PageBody>
    </>
  );
}
