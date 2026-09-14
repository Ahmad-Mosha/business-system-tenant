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
import { date } from '@/lib/format';
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
        <Card>
          <CardHeader>
            <CardTitle>By month</CardTitle>
            <CardDescription>Net proceeds per settlement month. Open a bar for its statement.</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/months">
                  All months
                  <ArrowUpRight />
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
