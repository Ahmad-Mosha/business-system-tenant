import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { NoDataYet } from '@/components/empty-state';
import { OpeningBalanceForm } from '@/components/opening-balance-form';
import { Page, PageHeader } from '@/components/page';
import { ToneBadge } from '@/components/tone-badge';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getAccount, getPeriods } from '@/lib/api';
import { money, monthLabel } from '@/lib/format';
import { requireAdmin } from '@/lib/session';

export default async function MonthsPage() {
  await requireAdmin();
  const [periods, account] = await Promise.all([getPeriods(), getAccount()]);

  if (!periods.length) {
    return (
      <Page>
        <PageHeader title="Months" description="noon settlements, month by month." />
        <NoDataYet />
      </Page>
    );
  }

  const anchored = account.openingAsOf !== null;

  return (
    <Page>
      <PageHeader title="Months" description="noon settlements, month by month — open one for its full statement." />

      <Card className="pb-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="text-end">Units</TableHead>
              <TableHead className="text-end">Proceeds</TableHead>
              <TableHead className="text-end">Fees</TableHead>
              <TableHead className="text-end">Cash to bank</TableHead>
              <TableHead className="text-end">Movement</TableHead>
              <TableHead className="text-end">Owed by noon</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {periods.map((p) => (
              <TableRow key={p.month} className="group relative">
                <TableCell className="font-medium">
                  <Link
                    href={`/months/${p.month}`}
                    className="after:absolute after:inset-0 hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    {monthLabel(p.month)}
                  </Link>
                </TableCell>
                <TableCell className="num text-end">{p.unitsSold}</TableCell>
                <TableCell className="num text-end">{money(p.netProceeds)}</TableCell>
                <TableCell className="num text-end text-muted-foreground">{money(p.fees)}</TableCell>
                <TableCell className="num text-end text-muted-foreground">{money(p.payouts)}</TableCell>
                <TableCell className="num text-end font-medium">{money(p.movement)}</TableCell>
                <TableCell className="num text-end font-medium">
                  {p.closingBalance === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    money(p.closingBalance)
                  )}
                </TableCell>
                <TableCell className="text-end">
                  <ChevronRight className="inline size-4 rtl:rotate-180 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="border-t px-4 py-3 text-xs/relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Movement</span> is what the month added to your
          noon balance. <span className="font-medium text-foreground">Cash to bank</span> is what noon
          actually transferred. <span className="font-medium text-foreground">Owed by noon</span> is
          what was still unpaid at month end.
        </p>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Opening balance</CardTitle>
          <CardDescription>
            An export only covers the months you downloaded, so the balance it describes is relative.
            Enter the balance noon showed <span className="text-foreground">before</span> your earliest
            import, and every later balance follows from it.
          </CardDescription>
          <CardAction>
            <ToneBadge tone={anchored ? 'success' : 'warning'}>{anchored ? 'Set' : 'Not set'}</ToneBadge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <OpeningBalanceForm openingBalance={account.openingBalance} openingAsOf={account.openingAsOf} />
        </CardContent>
      </Card>
    </Page>
  );
}
