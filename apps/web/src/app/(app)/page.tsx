import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { NoDataYet } from '@/components/empty-state';
import { Page, PageHeader } from '@/components/page';
import { StatementView } from '@/components/statement-view';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getDataRange, getPeriods } from '@/lib/api';
import { date, money, monthLabel } from '@/lib/format';
import { requireSession } from '@/lib/session';

export default async function OverviewPage() {
  const user = await requireSession();
  if (user.role === 'MODERATOR') redirect('/orders');

  const range = await getDataRange();
  if (!range) {
    return (
      <Page>
        <PageHeader title="noon" description="What noon owes us, and why." />
        <NoDataYet />
      </Page>
    );
  }

  const periods = await getPeriods();
  const peak = Math.max(...periods.map((p) => Math.abs(Number(p.netProceeds))), 1);

  return (
    <Page>
      <PageHeader
        title="noon"
        description={`Everything imported, ${date(range.from)} – ${date(range.to)}. Every figure matches noon’s own statement.`}
        actions={
          <Button variant="outline" asChild>
            <Link href="/months">
              View by month
              <ArrowUpRight />
            </Link>
          </Button>
        }
      />

      <StatementView from={range.from} to={range.to} />

      {periods.length > 1 ? (
        <Card className="pb-2">
          <CardHeader>
            <CardTitle>By month</CardTitle>
            <CardDescription>Net proceeds per settlement month.</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/months">
                  All months
                  <ArrowUpRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <ul className="grid px-2">
            {periods.map((p) => (
              <li key={p.month}>
                <Link
                  href={`/months/${p.month}`}
                  className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-4 px-2 py-2 text-[13px] hover:bg-muted"
                >
                  <span className="font-medium">{monthLabel(p.month)}</span>
                  <span className="h-2 bg-muted">
                    <span
                      className="block h-full bg-chart-3"
                      style={{ width: `${(Math.abs(Number(p.netProceeds)) / peak) * 100}%` }}
                    />
                  </span>
                  <span className="num w-28 text-right font-medium">{money(p.netProceeds)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </Page>
  );
}
